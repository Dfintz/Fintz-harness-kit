#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createManifestAllowlist } from "./manifest-allowlist.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoManifestAllowlist = createManifestAllowlist({ rootDir: repoRoot, fail });
const featureRunManifestAllowlist = createManifestAllowlist({
  rootDir: repoManifestAllowlist.materializeRelativePath(
    ".github/harness/runs/feature-runs",
    "feature-runs root",
  ),
  fail,
});

function fail(message, code = 2) {
  process.stderr.write(`[merge-comparative-ledger] ${message}\n`);
  process.exit(code);
}

function ensureSafeSegment(text, label) {
  if (typeof text !== "string" || !text.trim()) {
    fail(`invalid ${label}: ${JSON.stringify(text)}`);
  }
  if (text.includes("/") || text.includes("\\") || text.includes("..")) {
    fail(`invalid ${label}: ${JSON.stringify(text)}`);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(text)) {
    fail(`invalid ${label}: ${JSON.stringify(text)}`);
  }
  return text;
}

function toRepoRelativePath(pathValue) {
  return repoManifestAllowlist.toRelativePath(pathValue, "repository path");
}

function readJson(pathValue, label) {
  if (!existsSync(pathValue)) {
    return null;
  }
  try {
    return JSON.parse(repoManifestAllowlist.readUtf8Path(pathValue, label));
  } catch {
    fail(`invalid JSON in ${label}: ${pathValue}`);
  }
}

function applyArgValue(flags, option, value) {
  if (option === "--run-id") {
    flags.runId = value;
    return;
  }
  if (option === "--council-envelope") {
    flags.councilEnvelope = value;
    return;
  }
  if (option === "--plan-review-journal") {
    flags.planReviewJournal = value;
    return;
  }
  if (option === "--output") {
    flags.output = value;
    return;
  }
  fail(`unknown option: ${option}`);
}

function parseArgs(argv) {
  const flags = {
    runId: null,
    councilEnvelope: null,
    planReviewJournal: null,
    output: null,
    json: false,
  };
  const withValue = new Set([
    "--run-id",
    "--council-envelope",
    "--plan-review-journal",
    "--output",
  ]);

  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--json") {
      flags.json = true;
      continue;
    }
    if (option === "--help") {
      flags.help = true;
      continue;
    }
    if (!withValue.has(option)) {
      fail(`unknown option: ${option}`);
    }
    const value = argv[i + 1];
    if (typeof value !== "string") {
      fail(`missing value for ${option}`);
    }
    applyArgValue(flags, option, value);
    i += 1;
  }

  if (!flags.help && !flags.runId) {
    fail("--run-id is required");
  }
  return flags;
}

function showHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/harness/merge-comparative-ledger.mjs --run-id <id> [options]",
      "  --council-envelope <repo-relative-path>   Optional explicit council envelope JSON",
      "  --plan-review-journal <repo-relative-path> Optional explicit plan-review journal JSON",
      "  --output <repo-relative-path>             Optional final ledger output path",
      "  --json                                    Print merged ledger JSON",
    ].join("\n") + "\n",
  );
}

function parseVerdict(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let verdict = null;
  for (const line of lines) {
    const normalized = line.trim().toUpperCase();
    if (!normalized.startsWith("VERDICT:")) continue;
    const token = normalized.slice("VERDICT:".length).trim();
    if (token.startsWith("APPROVED")) verdict = "APPROVED";
    if (token.startsWith("REVISE")) verdict = "REVISE";
  }
  return verdict;
}

function loadManifest(runId) {
  const safeRunId = ensureSafeSegment(runId, "run id");
  const manifestPath = featureRunManifestAllowlist.materializeRelativePath(
    `${safeRunId}/manifest.json`,
    "run manifest",
  );
  const runDir = featureRunManifestAllowlist.materializeRelativePath(safeRunId, "run directory");
  if (!existsSync(manifestPath)) {
    fail(`run manifest missing: ${toRepoRelativePath(manifestPath)}`);
  }
  const manifest = readJson(manifestPath, "run manifest");
  if (!manifest || typeof manifest !== "object") {
    fail("run manifest is not an object");
  }
  return { runDir, manifestPath, manifest };
}

function resolveOptionalArtifactPath(manifest, explicitPath, artifactKey) {
  if (explicitPath) {
    return repoManifestAllowlist.materializeRelativePath(explicitPath, artifactKey);
  }
  const fromManifest = manifest?.artifacts?.[artifactKey];
  if (typeof fromManifest === "string" && fromManifest.trim()) {
    return repoManifestAllowlist.materializeRelativePath(fromManifest, artifactKey);
  }
  return null;
}

function mergeCouncilEnvelope(ledger, envelopePath, envelopeJson) {
  if (!envelopePath || !envelopeJson || typeof envelopeJson !== "object") {
    return;
  }
  const responses = Array.isArray(envelopeJson.responses) ? envelopeJson.responses : [];
  const memberVerdicts = responses
    .map((response) => {
      const verdict = parseVerdict(response?.output ?? "");
      if (!verdict) return null;
      return {
        member: typeof response?.member === "string" ? response.member : "unknown",
        verdict,
      };
    })
    .filter(Boolean);

  const uniqueVerdicts = [...new Set(memberVerdicts.map((item) => item.verdict))];
  if (uniqueVerdicts.length > 1) {
    ledger.divergence.hasDivergence = true;
    ledger.divergence.disagreements.push({
      source: "council-review",
      summary: "Council members produced conflicting verdicts.",
      details: memberVerdicts,
    });
  }

  ledger.evidence.councilEnvelope = toRepoRelativePath(envelopePath);
  ledger.council = {
    mode: envelopeJson.mode ?? null,
    engine: envelopeJson.engine ?? null,
    memberVerdicts,
    synthesis: typeof envelopeJson.synthesis === "string" ? envelopeJson.synthesis : null,
  };
}

function mergePlanReviewJournal(ledger, journalPath, journalJson) {
  if (!journalPath || !journalJson || typeof journalJson !== "object") {
    return;
  }
  const section = journalJson.comparativeReviewLedger;
  if (!section || typeof section !== "object") {
    ledger.evidence.planReviewJournal = toRepoRelativePath(journalPath);
    return;
  }

  const planDivergence = section.divergence;
  if (planDivergence?.hasDivergence) {
    const rounds = Array.isArray(planDivergence.rounds) ? planDivergence.rounds : [];
    ledger.divergence.hasDivergence = true;
    ledger.divergence.disagreements.push({
      source: "plan-review",
      summary: "Plan-review rounds did not converge without disagreement.",
      details: rounds,
    });
  }

  const finalVerdict = section?.consensus?.finalVerdict ?? null;
  if (finalVerdict === "APPROVED" && !ledger.consensus) {
    ledger.consensus = {
      source: "plan-review",
      verdict: "APPROVED",
      status: "consensus",
    };
  }

  ledger.evidence.planReviewJournal = toRepoRelativePath(journalPath);
  ledger.planReview = section;
}

function buildMergedLedger({ template, runId, task, councilPath, councilJson, planPath, planJson }) {
  const now = new Date().toISOString();
  const baseTemplate = template && typeof template === "object" ? template : {};
  const ledger = {
    schemaVersion: 1,
    status: "pending",
    task: task ?? baseTemplate.task ?? null,
    runId,
    generatedAt: baseTemplate.generatedAt ?? now,
    mergedAt: now,
    consensus: baseTemplate.consensus ?? null,
    divergence: {
      hasDivergence: Boolean(baseTemplate?.divergence?.hasDivergence),
      disagreements: Array.isArray(baseTemplate?.divergence?.disagreements)
        ? [...baseTemplate.divergence.disagreements]
        : [],
    },
    evidence: {
      scoutNotes: baseTemplate?.evidence?.scoutNotes ?? null,
      challengerFindings: baseTemplate?.evidence?.challengerFindings ?? null,
      councilEnvelope: baseTemplate?.evidence?.councilEnvelope ?? null,
      planReviewJournal: baseTemplate?.evidence?.planReviewJournal ?? null,
    },
    notes: Array.isArray(baseTemplate?.notes) ? [...baseTemplate.notes] : [],
  };

  mergeCouncilEnvelope(ledger, councilPath, councilJson);
  mergePlanReviewJournal(ledger, planPath, planJson);

  if (ledger.divergence.hasDivergence) {
    ledger.status = "divergence";
    if (!ledger.consensus) {
      ledger.consensus = {
        source: "merge",
        verdict: "REVISE",
        status: "divergence",
      };
    }
  } else if (ledger.consensus) {
    ledger.status = "consensus";
  }

  return ledger;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const { manifestPath, manifest } = loadManifest(flags.runId);

  const templatePath = resolveOptionalArtifactPath(
    manifest,
    manifest?.artifacts?.comparativeReviewLedger ?? null,
    "comparativeReviewLedger",
  );
  const councilPath = resolveOptionalArtifactPath(
    manifest,
    flags.councilEnvelope,
    "councilReviewEnvelope",
  );
  const planPath = resolveOptionalArtifactPath(
    manifest,
    flags.planReviewJournal,
    "planReviewJournal",
  );

  const templateJson = templatePath ? readJson(templatePath, "comparative ledger template") : null;
  const councilJson = councilPath ? readJson(councilPath, "council envelope") : null;
  const planJson = planPath ? readJson(planPath, "plan-review journal") : null;

  const merged = buildMergedLedger({
    template: templateJson,
    runId: manifest.runId ?? flags.runId,
    task: manifest.task ?? null,
    councilPath,
    councilJson,
    planPath,
    planJson,
  });

  const defaultOutput = featureRunManifestAllowlist.materializeRelativePath(
    `${ensureSafeSegment(manifest.runId ?? flags.runId, "run id")}/consensus-divergence-ledger.final.json`,
    "default merged ledger output",
  );
  const outputPath = flags.output
    ? repoManifestAllowlist.materializeRelativePath(flags.output, "output")
    : defaultOutput;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  if (!manifest.artifacts || typeof manifest.artifacts !== "object") {
    manifest.artifacts = {};
  }
  manifest.artifacts.councilReviewEnvelope = councilPath ? toRepoRelativePath(councilPath) : null;
  manifest.artifacts.planReviewJournal = planPath ? toRepoRelativePath(planPath) : null;
  manifest.artifacts.comparativeReviewFinalLedger = toRepoRelativePath(outputPath);
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    `[merge-comparative-ledger] run-id: ${manifest.runId ?? flags.runId}\n` +
      `[merge-comparative-ledger] output: ${toRepoRelativePath(outputPath)}\n` +
      `[merge-comparative-ledger] status: ${merged.status}\n`,
  );
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
