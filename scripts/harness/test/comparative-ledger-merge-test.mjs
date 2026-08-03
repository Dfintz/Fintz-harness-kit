#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const scriptPath = join(repoRoot, "scripts", "harness", "merge-comparative-ledger.mjs");
const featureRunsDir = join(repoRoot, ".github", "harness", "runs", "feature-runs");

function run(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    shell: false,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function writeJson(pathValue, payload) {
  mkdirSync(dirname(pathValue), { recursive: true });
  writeFileSync(pathValue, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

const runId = `run-merge-test-${Date.now()}`;
const runDir = join(featureRunsDir, runId);
const packDir = join(repoRoot, ".github", "harness", "prompt-packs", `merge-test-${Date.now()}`);
const ledgerTemplatePath = join(packDir, "consensus-divergence-ledger.json");
const councilPath = join(runDir, "council-review-test.json");
const planPath = join(runDir, "plan-review-test.json");
const manifestPath = join(runDir, "manifest.json");

try {
  mkdirSync(runDir, { recursive: true });
  mkdirSync(packDir, { recursive: true });

  writeJson(ledgerTemplatePath, {
    schemaVersion: 1,
    status: "pending",
    task: "merge test",
    generatedAt: new Date().toISOString(),
    consensus: null,
    divergence: {
      hasDivergence: false,
      disagreements: [],
    },
    evidence: {
      scoutNotes: null,
      challengerFindings: null,
      councilEnvelope: null,
      planReviewJournal: null,
    },
    notes: [],
  });

  writeJson(councilPath, {
    mode: "review",
    engine: "nano",
    generatedAt: new Date().toISOString(),
    responses: [
      { member: "codex", output: "Concern found\nVERDICT: REVISE" },
      { member: "claude", output: "Looks solid\nVERDICT: APPROVED" },
      { member: "gemini", output: "Acceptable\nVERDICT: APPROVED" },
    ],
    synthesis: "conflicting outputs",
  });

  writeJson(planPath, {
    comparativeReviewLedger: {
      schemaVersion: 1,
      source: "plan-review",
      consensus: {
        status: "consensus",
        finalVerdict: "APPROVED",
      },
      divergence: {
        hasDivergence: false,
        count: 0,
        rounds: [],
      },
    },
  });

  writeJson(manifestPath, {
    schemaVersion: 1,
    runId,
    task: "merge test",
    mode: "non-trivial",
    artifacts: {
      comparativeReviewLedger: "./.github/harness/prompt-packs/placeholder",
    },
  });

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.artifacts.comparativeReviewLedger =
    ledgerTemplatePath
      .replaceAll("\\", "/")
      .replace(repoRoot.replaceAll("\\", "/") + "/", "");
  writeJson(manifestPath, manifest);

  const result = run([
    "--run-id",
    runId,
    "--council-envelope",
    councilPath.replaceAll("\\", "/").replace(repoRoot.replaceAll("\\", "/") + "/", ""),
    "--plan-review-journal",
    planPath.replaceAll("\\", "/").replace(repoRoot.replaceAll("\\", "/") + "/", ""),
    "--json",
  ]);

  assert.equal(result.status, 0, `merge command failed: ${result.stderr || result.stdout}`);
  const merged = JSON.parse(result.stdout);

  assert.equal(merged.status, "divergence", "status should indicate divergence on disagreement");
  assert.equal(merged.divergence.hasDivergence, true, "divergence flag should be true");
  assert.ok(
    Array.isArray(merged.divergence.disagreements) && merged.divergence.disagreements.length > 0,
    "divergence disagreements should be non-empty when reviewer verdicts disagree",
  );

  const finalPath = join(runDir, "consensus-divergence-ledger.final.json");
  assert.ok(existsSync(finalPath), "final merged ledger should be written in run directory");

  console.log("PASS comparative ledger merge disagreement test");
} finally {
  rmSync(runDir, { recursive: true, force: true });
  rmSync(packDir, { recursive: true, force: true });
}
