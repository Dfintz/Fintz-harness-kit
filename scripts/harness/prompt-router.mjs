#!/usr/bin/env node
/**
 * Prompt router — kit-shipped policy helper for sending prompts through the harness stage machine.
 *
 * It does not intercept editor prompts on its own. Instead it gives operators and wrapper commands
 * a deterministic stage/model handoff plan that mirrors the harness environment policy.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createManifestAllowlist } from "./manifest-allowlist.mjs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getStageContractMetadata,
  getStagePromptPackMetadata,
} from "./registry.mjs";
import { buildGraphStatusCore } from "./graph-provider.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const configPath = join(repoRoot, "harness.config.json");
const runsDir = join(repoRoot, ".github", "harness", "runs");
const handoffLogPath = join(runsDir, "handoffs.jsonl");
const preflightOverrideLogPath = join(runsDir, "preflight-overrides.jsonl");
const promptPacksDir = join(runsDir, "prompt-packs");
const featureRunsDir = join(runsDir, "feature-runs");
const featureRunIndexPath = join(featureRunsDir, "index.json");
const featureRunManifestAllowlist = createManifestAllowlist({
  rootDir: featureRunsDir,
  fail,
});

const DEFAULT_STAGE_PROMPT_METADATA = {
  understand: {
    title: "Understand",
    outputFile: "understand-notes.md",
    deliverable: "Component/layer impact map and graph freshness status.",
    instructions: [
      "Load the understand-process skill before analysis.",
      "Run the graph freshness gate and document whether it is up to date or blocked.",
      "Map changed components, one-hop affected components, affected layers, and hotspots.",
      "Record missing context and reduced-confidence assumptions explicitly.",
    ],
  },
  architect: {
    title: "Architect",
    outputFile: "architecture-brief.md",
    deliverable:
      "Architecture Brief with gate decisions, files, constraints, Do-NOTs, assumptions.",
    instructions: [
      "Read understand-notes.md first.",
      "Run gates 1-5 (and gate 4b when applicable) with explicit pass/fail reasoning.",
      "Define exactly which files change and why they belong there.",
      "Persist the settled brief in the repository memory briefs folder when implementation proceeds.",
    ],
  },
  "architect-challenge": {
    title: "Architect Challenge",
    outputFile: "architect-challenge-verdict.md",
    deliverable:
      "Independent verdict on the Architecture Brief with required revisions or unblock steps.",
    instructions: [
      "Read architecture-brief.md and any cited supporting files first.",
      "Pressure-test ownership, boundaries, reuse, approval assumptions, and missing context.",
      "Return APPROVED, REVISE, or BLOCKED with the smallest concrete next step.",
      "Keep the verdict concise and grounded in the current brief rather than reopening the whole design.",
    ],
  },
  implement: {
    title: "Implement",
    outputFile: "implementation-notes.md",
    deliverable:
      "Applied changes plus pre-implementation and self-review notes.",
    instructions: [
      "Read architecture-brief.md and stay within its ownership boundaries.",
      "Load relevant domain skills before editing.",
      "Complete pre-implementation discovery, then apply the smallest rooted code change.",
      "Record validation commands run and self-review checklist outcomes.",
    ],
  },
  "review-breadth": {
    title: "Review Breadth",
    outputFile: "review-breadth-findings.md",
    deliverable:
      "Severity-tagged findings covering correctness, regressions, tests, and standards.",
    instructions: [
      "Read architecture-brief.md and implementation-notes.md.",
      "List findings first, ordered by severity, with concrete file references.",
      "If no findings exist, state that explicitly and note residual gaps.",
    ],
  },
  "review-depth": {
    title: "Review Depth",
    outputFile: "review-depth-findings.md",
    deliverable:
      "Gate verdicts and structural findings checked against the Architecture Brief.",
    instructions: [
      "Read architecture-brief.md and review-breadth-findings.md.",
      "Re-run the architectural gates against the implemented diff.",
      "Trace ownership, boundaries, and systemic risks.",
    ],
  },
  feedback: {
    title: "Feedback",
    outputFile: "feedback-verdict.md",
    deliverable:
      "Verdict table, decision updates, and refreshed next-steps summary.",
    instructions: [
      "Read Architecture Brief plus both review outputs.",
      "Produce a verdict table with accepted/rejected/deferred findings.",
      "Update the brief if decisions changed.",
      "Refresh next-steps.md with what shipped, what remains, and next loop focus.",
    ],
  },
};

function resolveStagePromptMetadata(stage) {
  const registryMeta = getStagePromptPackMetadata(stage) ?? {};
  const fallback = DEFAULT_STAGE_PROMPT_METADATA[stage] ?? {
    title: stage,
    outputFile: `${stage}.md`,
    deliverable: "Document output for this stage.",
    instructions: ["Follow the harness stage instructions for this step."],
  };
  return {
    title: registryMeta.title ?? fallback.title,
    outputFile: registryMeta.outputFile ?? fallback.outputFile,
    deliverable: registryMeta.deliverable ?? fallback.deliverable,
    instructions:
      Array.isArray(registryMeta.instructions) && registryMeta.instructions.length > 0
        ? registryMeta.instructions
        : fallback.instructions,
  };
}

function resolveStageContract(stage) {
  const registryMeta = getStageContractMetadata(stage) ?? {};
  return {
    requiredArtifacts: Array.isArray(registryMeta.requiredArtifacts)
      ? registryMeta.requiredArtifacts
      : null,
    outputArtifact: registryMeta.outputArtifact ?? null,
    approval: registryMeta.approval ?? null,
  };
}

const SIDECAR_PROMPT_METADATA = {
  scout: {
    title: "Scout",
    promptFile: "optional-scout.md",
    outputFile: "scout-notes.md",
    recommendedModel: "claude-opus-4-8",
    purpose:
      "Parallel research sidecar for reuse opportunities, missing context, and adjacent risks.",
    timing:
      "Run any time after pack generation; highest value before or during Understand and Architect.",
    instructions: [
      "Read manifest.json and next-steps.md first.",
      "Find relevant patterns, lessons, docs, and adjacent surfaces the main chain may miss.",
      "Prefer actionable findings with concrete file references.",
      "Write distilled output to scout-notes.md.",
    ],
  },
  challenger: {
    title: "Challenger",
    promptFile: "optional-challenger.md",
    outputFile: "challenger-findings.md",
    recommendedModel: "claude-opus-4-8",
    purpose:
      "Independent challenge sidecar that pressure-tests assumptions, risks, and review blind spots.",
    timing:
      "Best run after architecture or implementation artifacts exist; can run in parallel with breadth review.",
    instructions: [
      "Read manifest.json plus architecture/implementation notes when available.",
      "Challenge assumptions, boundaries, missing tests, and safety gaps.",
      "Focus on findings that could change plan, tests, or review outcomes.",
      "Write concise severity-oriented findings to challenger-findings.md.",
    ],
  },
};

function fail(message, code = 2) {
  process.stderr.write(`[prompt-router] ${message}\n`);
  process.exit(code);
}

export function loadConfig() {
  if (!existsSync(configPath)) {
    fail(`missing harness.config.json at ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json" || arg === "--stdin" || arg === "--help") {
      flags[arg.slice(2)] = true;
    } else if (arg === "--allow-degraded-preflight") {
      flags.allowDegradedPreflight = true;
    } else if (arg === "--out") {
      flags.out = argv[++i];
    } else if (arg === "--profile") {
      flags.profile = argv[++i];
    } else if (arg === "--task") {
      flags.task = argv[++i];
    } else if (arg === "--intent") {
      flags.intent = argv[++i];
    } else if (arg === "--pack") {
      flags.pack = argv[++i];
    } else if (arg === "--pack-latest") {
      flags.packLatest = true;
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function readStdin() {
  return new Promise((resolveText) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveText(data));
  });
}

function normalizeText(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase();
}

function ensureSafeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]+$/.test(value)) {
    fail(`invalid ${label}: ${JSON.stringify(value)}`);
  }
  if (value === "." || value === "..") {
    fail(`invalid ${label}: ${JSON.stringify(value)}`);
  }
  return value;
}

function normalizePathForCompare(pathValue) {
  return process.platform === "win32"
    ? pathValue.toLowerCase()
    : pathValue;
}

function isPathInside(rootDir, candidatePath) {
  const rootWithSep = rootDir.endsWith(sep) ? rootDir : `${rootDir}${sep}`;
  const normalizedRoot = normalizePathForCompare(rootDir);
  const normalizedRootWithSep = normalizePathForCompare(rootWithSep);
  const normalizedCandidate = normalizePathForCompare(candidatePath);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(normalizedRootWithSep)
  );
}

function assertContainedPath(rootDir, candidatePath, label) {
  if (!isPathInside(rootDir, candidatePath)) {
    fail(
      `invalid ${label}: resolved path escaped root ${rootDir} -> ${candidatePath}`,
      1,
    );
  }

  if (existsSync(rootDir) && existsSync(candidatePath)) {
    try {
      const rootReal = realpathSync(rootDir);
      const candidateReal = realpathSync(candidatePath);
      if (!isPathInside(rootReal, candidateReal)) {
        fail(
          `invalid ${label}: canonical path escaped root ${rootDir} -> ${candidatePath}`,
          1,
        );
      }
    } catch {
      // If canonicalization is unavailable for this path, keep the resolved-path guardrail.
    }
  }

  return candidatePath;
}

function safeJoinUnder(baseDir, segment, label) {
  const safeSegment = ensureSafeSegment(segment, label);
  const separator = baseDir.endsWith("/") || baseDir.endsWith("\\") ? "" : sep;
  const joined = `${baseDir}${separator}${safeSegment}`;
  return assertContainedPath(baseDir, joined, label);
}

function getModelAssignments(config) {
  return {
    implementer: config.models?.implementer?.model ?? "gpt-5.3-codex",
    reviewer: config.models?.reviewer?.model ?? "claude-opus-4-8",
  };
}

function getSkillModelEntry(config, skillName) {
  const mappings = config.skillModelMapping?.mappings;
  if (!mappings || typeof mappings !== "object") {
    return null;
  }
  const entry = mappings[skillName];
  return entry && typeof entry === "object" ? entry : null;
}

function getPrimaryModelForSkill(config, skillName, fallbackModel) {
  const entry = getSkillModelEntry(config, skillName);
  return typeof entry?.primary === "string" && entry.primary.trim()
    ? entry.primary
    : fallbackModel;
}

function getStageSkillName(stage) {
  switch (stage) {
    case "understand":
      return "understand-process";
    case "architect":
      return "architect";
    case "architect-challenge":
      return null;
    case "implement":
    case "review-breadth":
    case "review-depth":
    case "feedback":
      return stage;
    default:
      return null;
  }
}

function getStageModel(config, stage, roleModels) {
  const skillName = getStageSkillName(stage);
  if (skillName) {
    const defaultModel =
      stage === "implement" || stage === "build-fix" || stage === "test-fix"
        ? roleModels.implementer
        : roleModels.reviewer;
    return getPrimaryModelForSkill(config, skillName, defaultModel);
  }

  if (stage === "architect-challenge") {
    return roleModels.implementer;
  }
  if (stage === "build-fix" || stage === "test-fix") {
    return roleModels.implementer;
  }
  return roleModels.implementer;
}

function detectModelProvider(model) {
  if (typeof model !== "string" || model.trim() === "") return "unknown";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "google";
  if (model.startsWith("gpt-")) return "github-copilot";
  if (model.includes(":")) return "local";
  return "unknown";
}

function getStageTelemetryDetails(config, stage, model) {
  const skillName = getStageSkillName(stage);
  const entry = skillName ? getSkillModelEntry(config, skillName) : null;
  if (entry) {
    return {
      skill: skillName,
      tier: entry.tier ?? null,
      provider: detectModelProvider(model),
      primary: entry.primary ?? null,
      fallback: Array.isArray(entry.fallback) ? entry.fallback : [],
    };
  }
  if (stage === "architect-challenge") {
    return {
      skill: null,
      tier: "challenge",
      provider: detectModelProvider(model),
      primary: model,
      fallback: [],
      note: "Challenge stage defaults to the repository implementer-role model unless explicitly overridden.",
    };
  }
  return {
    skill: skillName,
    tier: null,
    provider: detectModelProvider(model),
    primary: model,
    fallback: [],
  };
}

function buildHandoffTelemetry(route, command, config) {
  return {
    id: `hof-${Date.now()}-${randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    command,
    runId: route.runId ?? null,
    task: route.task,
    profile: route.profile,
    intent: route.intent,
    intentSource: route.intentSource,
    mode: route.mode,
    why: route.why,
    modelSet: config.modelPolicy?.activePhase ?? "default",
    routingDecision: {
      source:
        route.intentSource ?? (route.profile ? "profile-selected" : "default"),
      profile: route.profile ?? null,
      intent: route.intent ?? null,
    },
    stages: route.stages,
    models: route.models,
    stageModelDetails: Object.fromEntries(
      route.stages.map((stage) => [
        stage,
        getStageTelemetryDetails(config, stage, route.models[stage]),
      ]),
    ),
    crossModelReview: route.crossModelReview,
  };
}

function recordHandoffTelemetry(route, command, config) {
  const payload = buildHandoffTelemetry(route, command, config);
  try {
    mkdirSync(runsDir, { recursive: true });
    appendFileSync(handoffLogPath, `${JSON.stringify(payload)}\n`, "utf8");
    return { ok: true, path: handoffLogPath, payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      payload,
    };
  }
}

function getProfile(config, profileName) {
  if (!profileName) {
    return null;
  }

  const profile = config.routing?.profiles?.[profileName] ?? null;
  if (!profile) {
    fail(`unknown profile: ${profileName}`);
  }
  return profile;
}

function getIntentProfiles(config) {
  const intentProfiles = config.routing?.intentProfiles;
  return intentProfiles && typeof intentProfiles === "object"
    ? intentProfiles
    : {};
}

function scoreIntent(text, intentName, intentConfig) {
  let score = 0;
  const keywords = Array.isArray(intentConfig?.keywords)
    ? intentConfig.keywords
    : [];
  for (const keyword of keywords) {
    if (typeof keyword === "string" && keyword.trim()) {
      if (text.includes(normalizeText(keyword))) score += 3;
    }
  }

  const nameTokens = String(intentName)
    .split(/[-_\s]+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);
  for (const token of nameTokens) {
    if (token.length > 2 && text.includes(token)) score += 1;
  }
  return score;
}

function recommendIntentProfile(taskText, config, explicitIntent = null) {
  const intents = getIntentProfiles(config);
  const entries = Object.entries(intents);
  if (entries.length === 0) return null;

  if (explicitIntent) {
    const canonical = Object.keys(intents).find(
      (key) => normalizeText(key) === normalizeText(explicitIntent),
    );
    const matched = canonical ? intents[canonical] : null;
    if (!matched) {
      fail(`unknown intent: ${explicitIntent}`);
    }
    return {
      intent: canonical,
      profile: matched.profile ?? null,
      description: matched.description ?? null,
      score: Number.POSITIVE_INFINITY,
      source: "explicit-intent",
    };
  }

  const text = normalizeText(taskText);
  let best = null;
  for (const [intentName, intentConfig] of entries) {
    const score = scoreIntent(text, intentName, intentConfig);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = {
        intent: intentName,
        profile: intentConfig.profile ?? null,
        description: intentConfig.description ?? null,
        score,
        source: "keyword-match",
      };
    }
  }
  return best;
}

function validateModelSeparation(config) {
  const { implementer, reviewer } = getModelAssignments(config);
  const mustDiffer =
    config.routing?.requireDistinctReviewerAndImplementer !== false;
  if (mustDiffer && implementer === reviewer) {
    fail(
      `implementer and reviewer must be different models in this repo (both are ${implementer}). Update harness.config.json.`,
    );
  }
  return { implementer, reviewer };
}

function buildModelRouting(config) {
  const roleModels = validateModelSeparation(config);
  return {
    understand: getStageModel(config, "understand", roleModels),
    architect: getStageModel(config, "architect", roleModels),
    "architect-challenge": getStageModel(config, "architect-challenge", roleModels),
    implement: getStageModel(config, "implement", roleModels),
    "review-breadth": getStageModel(config, "review-breadth", roleModels),
    "review-depth": getStageModel(config, "review-depth", roleModels),
    feedback: getStageModel(config, "feedback", roleModels),
    "build-fix": getStageModel(config, "build-fix", roleModels),
    "test-fix": getStageModel(config, "test-fix", roleModels),
    "cross-model-review": `${roleModels.implementer} -> ${roleModels.reviewer}`,
  };
}

function summarizeCrossModelReview(stages, models) {
  const implementModel = models.implement ?? models["build-fix"] ?? models["test-fix"] ?? "unspecified";
  const reviewStages = stages.filter((stage) =>
    stage === "review-breadth" || stage === "review-depth" || stage === "feedback",
  );
  const distinctReviewModels = [...new Set(reviewStages.map((stage) => models[stage]).filter(Boolean))];

  if (distinctReviewModels.length === 0) {
    return models["cross-model-review"] ?? `${implementModel} -> review`;
  }
  if (distinctReviewModels.length === 1) {
    return `${implementModel} -> ${distinctReviewModels[0]}`;
  }
  return `${implementModel} -> [${distinctReviewModels.join(", ")}]`;
}

function normalizeTaskKey(taskText) {
  return normalizeText(taskText).replace(/\s+/g, " ").trim();
}

function toRepoRelativePath(pathValue) {
  if (typeof pathValue !== "string" || !pathValue.trim()) {
    fail(`invalid repository path: ${JSON.stringify(pathValue)}`);
  }
  const repoRootNormalized = repoRoot.replaceAll("\\", "/");
  const pathNormalized = pathValue.replaceAll("\\", "/");
  const rootPrefix = repoRootNormalized.endsWith("/")
    ? repoRootNormalized
    : `${repoRootNormalized}/`;

  if (pathNormalized !== repoRootNormalized && !pathNormalized.startsWith(rootPrefix)) {
    fail(`invalid repository path: ${JSON.stringify(pathValue)}`);
  }

  const relative = pathNormalized.slice(repoRootNormalized.length);
  return relative.startsWith("/") ? relative.slice(1) : relative;
}

function toFeatureRunRelativePath(pathValue, label) {
  if (typeof pathValue !== "string" || !pathValue.trim()) {
    fail(`invalid ${label}: ${JSON.stringify(pathValue)}`);
  }
  assertContainedPath(featureRunsDir, pathValue, label);

  const rootNormalized = featureRunsDir.replaceAll("\\", "/");
  const pathNormalized = pathValue.replaceAll("\\", "/");
  const rootPrefix = rootNormalized.endsWith("/")
    ? rootNormalized
    : `${rootNormalized}/`;
  const relative = pathNormalized.slice(rootPrefix.length).replace(/^\/+/, "");

  if (!relative) {
    fail(`invalid ${label}: ${JSON.stringify(pathValue)}`);
  }

  const segments = relative.split("/").filter(Boolean);
  for (const segment of segments) {
    ensureSafeSegment(segment, `${label} segment`);
  }
  return segments.join("/");
}

function buildFeatureRunFileManifest() {
  if (!existsSync(featureRunsDir)) {
    return new Map();
  }
  const map = new Map();
  const queue = [{ absoluteDir: featureRunsDir, relativeDir: "" }];
  while (queue.length > 0) {
    const next = queue.pop();
    const entries = readdirSync(next.absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = next.relativeDir
        ? `${next.relativeDir}/${entry.name}`
        : entry.name;
      const childAbsolute = join(next.absoluteDir, entry.name);
      if (entry.isDirectory()) {
        queue.push({ absoluteDir: childAbsolute, relativeDir: childRelative });
        continue;
      }
      if (entry.isFile()) {
        map.set(childRelative.replaceAll("\\", "/"), childAbsolute);
      }
    }
  }
  return map;
}

function selectFeatureRunManifestPath(relativePath, label) {
  const selectedPath = buildFeatureRunFileManifest().get(relativePath);
  if (!selectedPath) {
    fail(`${label} not found in feature-runs manifest: ${relativePath}`);
  }
  return selectedPath;
}

function readJsonFileOrDefault(filePath, fallbackValue) {
  const label = "feature run json file path";
  const relativePath = toFeatureRunRelativePath(filePath, label);
  if (!/(^|\/)(index|manifest)\.json$/i.test(relativePath)) {
    fail(`invalid ${label}: ${JSON.stringify(filePath)}`);
  }
  if (!existsSync(filePath)) {
    return fallbackValue;
  }
  try {
    return JSON.parse(featureRunManifestAllowlist.readUtf8Relative(relativePath, label));
  } catch {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, payload) {
  assertContainedPath(featureRunsDir, filePath, "feature run json file path");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function mintFeatureRunId() {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `run-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function loadFeatureRunIndex() {
  const parsed = readJsonFileOrDefault(featureRunIndexPath, {
    version: 1,
    tasks: {},
  });
  if (!parsed || typeof parsed !== "object") {
    return { version: 1, tasks: {} };
  }
  if (!parsed.tasks || typeof parsed.tasks !== "object") {
    parsed.tasks = {};
  }
  return parsed;
}

function saveFeatureRunIndex(index) {
  writeJsonFile(featureRunIndexPath, index);
}

function buildDefaultFeatureRunManifest(route, runId, runDir, taskKey) {
  return {
    schemaVersion: 1,
    runId,
    task: route.task,
    taskKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode: route.mode,
    profile: route.profile,
    intent: route.intent,
    intentSource: route.intentSource,
    why: route.why,
    stages: route.stages,
    models: route.models,
    crossModelReview: route.crossModelReview,
    runDir: toRepoRelativePath(runDir),
    artifacts: {
      route: null,
      handoff: null,
      promptPackDir: null,
      comparativeReviewLedger: null,
      councilReviewEnvelope: null,
      planReviewJournal: null,
      comparativeReviewFinalLedger: null,
      brief: null,
      implementation: null,
      reviewBreadth: null,
      reviewDepth: null,
      feedback: null,
    },
  };
}

function createOrReuseFeatureRun(route) {
  const taskKey = normalizeTaskKey(route.task);
  if (!taskKey) {
    return null;
  }

  const index = loadFeatureRunIndex();
  const existing = index.tasks[taskKey];
  const candidateRunId =
    existing && typeof existing.runId === "string" && /^[A-Za-z0-9._-]+$/.test(existing.runId)
      ? existing.runId
      : null;
  const runId = candidateRunId ?? mintFeatureRunId();
  const runDir = safeJoinUnder(featureRunsDir, runId, "feature run directory");
  mkdirSync(runDir, { recursive: true });

  const manifestPath = safeJoinUnder(runDir, "manifest.json", "feature run manifest");
  const existingManifest = readJsonFileOrDefault(manifestPath, null);
  const manifest =
    existingManifest && typeof existingManifest === "object"
      ? existingManifest
      : buildDefaultFeatureRunManifest(route, runId, runDir, taskKey);

  manifest.runId = runId;
  manifest.task = route.task;
  manifest.taskKey = taskKey;
  manifest.mode = route.mode;
  manifest.profile = route.profile;
  manifest.intent = route.intent;
  manifest.intentSource = route.intentSource;
  manifest.why = route.why;
  manifest.stages = route.stages;
  manifest.models = route.models;
  manifest.crossModelReview = route.crossModelReview;
  manifest.runDir = toRepoRelativePath(runDir);
  manifest.updatedAt = new Date().toISOString();
  if (!manifest.createdAt) {
    manifest.createdAt = manifest.updatedAt;
  }
  if (!manifest.artifacts || typeof manifest.artifacts !== "object") {
    manifest.artifacts = buildDefaultFeatureRunManifest(route, runId, runDir, taskKey).artifacts;
  }

  index.tasks[taskKey] = {
    runId,
    updatedAt: manifest.updatedAt,
    status: "active",
  };

  saveFeatureRunIndex(index);
  writeJsonFile(manifestPath, manifest);

  return {
    runId,
    runDir,
    manifestPath,
    taskKey,
  };
}

function updateFeatureRunManifest(featureRunContext, mutate) {
  if (!featureRunContext) {
    return;
  }
  const manifest = readJsonFileOrDefault(featureRunContext.manifestPath, null);
  if (!manifest || typeof manifest !== "object") {
    return;
  }
  mutate(manifest);
  manifest.updatedAt = new Date().toISOString();
  writeJsonFile(featureRunContext.manifestPath, manifest);
}

function writeFeatureRunArtifact(featureRunContext, slot, fileName, contents) {
  if (!featureRunContext) {
    return;
  }
  const artifactPath = safeJoinUnder(featureRunContext.runDir, fileName, `feature run artifact ${slot}`);
  writeFileSync(artifactPath, contents, "utf8");
  updateFeatureRunManifest(featureRunContext, (manifest) => {
    if (!manifest.artifacts || typeof manifest.artifacts !== "object") {
      manifest.artifacts = {};
    }
    manifest.artifacts[slot] = toRepoRelativePath(artifactPath);
  });
}

function recordPromptPackInFeatureRun(featureRunContext, packDir) {
  if (!featureRunContext || !packDir) {
    return;
  }
  updateFeatureRunManifest(featureRunContext, (manifest) => {
    if (!manifest.artifacts || typeof manifest.artifacts !== "object") {
      manifest.artifacts = {};
    }
    manifest.artifacts.promptPackDir = toRepoRelativePath(packDir);
    const comparativeLedgerPath = toRepoRelativePath(
      safeJoinUnder(packDir, "consensus-divergence-ledger.json", "comparative review ledger"),
    );
    manifest.artifacts.comparativeReviewLedger = comparativeLedgerPath;
  });
}

function resolveTaskText(flags) {
  if (flags.task) {
    return flags.task;
  }

  if (flags._.length > 1) {
    return flags._.slice(1).join(" ");
  }

  return "";
}

export function planTask(taskText, config, options = {}) {
  const text = normalizeText(taskText);
  const routing = config.routing ?? {};
  const trivialKeywords = routing.trivialKeywords ?? [];
  const nonTrivialKeywords = routing.nonTrivialKeywords ?? [];
  const intentRecommendation = recommendIntentProfile(
    taskText,
    config,
    options.intent ?? null,
  );
  const profileExplicit = Boolean(options.profile);
  const profileName =
    options.profile ?? intentRecommendation?.profile ?? null;
  const profile = getProfile(config, profileName);

  const trivialHit = trivialKeywords.find((keyword) => text.includes(keyword));
  const nonTrivialHit = nonTrivialKeywords.find((keyword) =>
    text.includes(keyword),
  );

  const trivial =
    !profile && Boolean(trivialHit) && !nonTrivialHit && text.length < 180;
  const stages =
    profile?.stages ??
    (trivial
      ? [routing.trivialStartsAt ?? "implement"]
      : (routing.nonTrivialStages ?? [
          "understand",
          "architect",
          "implement",
          "review-breadth",
          "review-depth",
          "feedback",
        ]));

  const modelRouting = buildModelRouting(config);

  let why;
  if (profile) {
    if (!profileExplicit && intentRecommendation?.intent) {
      why =
        profile.description ??
        `intent-selected handoff: ${intentRecommendation.intent} -> ${profileName}`;
    } else {
      why = profile.description ?? `profile-selected handoff: ${profileName}`;
    }
  } else if (trivial) {
    why = `matched trivial keyword: ${trivialHit}`;
  } else if (nonTrivialHit) {
    why = `matched non-trivial keyword: ${nonTrivialHit}`;
  } else {
    why =
      "default harness-first routing for any prompt that is not obviously trivial";
  }

  return {
    task: String(taskText ?? "").trim(),
    profile: profileName,
    intent: intentRecommendation?.intent ?? null,
    intentSource: intentRecommendation?.source ?? null,
    mode: profile?.mode ?? (trivial ? "trivial" : "non-trivial"),
    why,
    stages,
    models: Object.fromEntries(
      stages.map((stage) => [
        stage,
        modelRouting[stage] ?? modelRouting.implement,
      ]),
    ),
    crossModelReview: summarizeCrossModelReview(
      stages,
      Object.fromEntries(
        stages.map((stage) => [
          stage,
          modelRouting[stage] ?? modelRouting.implement,
        ]),
      ),
    ),
  };
}

function slugifyTask(taskText) {
  let slug = normalizeText(taskText).replace(/[^a-z0-9]+/g, "-");
  while (slug.startsWith("-")) slug = slug.slice(1);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  slug = slug.slice(0, 80);
  return slug || "task";
}

function resolvePromptPackDir(slug, outDir) {
  const dirName = outDir ? slugifyTask(outDir) : slug;
  return safeJoinUnder(promptPacksDir, dirName, "prompt pack directory name");
}

function packFilePath(packDir, fileName) {
  return safeJoinUnder(packDir, fileName, "prompt pack file name");
}

function writePackFile(packDir, fileName, contents) {
  writeFileSync(packFilePath(packDir, fileName), contents, "utf8");
}

function buildPromptPack(route, outDir) {
  const slug = slugifyTask(route.task || route.profile || "task");
  const packDir = resolvePromptPackDir(slug, outDir);
  const stageFiles = route.stages.map((stage, index) => {
    const meta = resolveStagePromptMetadata(stage);
    const contract = resolveStageContract(stage);
    return {
      stage,
      index: index + 1,
      model: route.models[stage] ?? "unspecified",
      promptFile: `${String(index + 1).padStart(2, "0")}-${stage}.md`,
      outputFile: meta.outputFile,
      title: meta.title,
      deliverable: meta.deliverable,
      instructions: meta.instructions,
      requiredArtifacts: contract.requiredArtifacts,
      outputArtifact: contract.outputArtifact,
      approval: contract.approval,
    };
  });

  return {
    slug,
    packDir,
    runId: route.runId ?? null,
    route,
    stageFiles,
    sidecarFiles: Object.entries(SIDECAR_PROMPT_METADATA).map(
      ([key, meta]) => ({
        key,
        ...meta,
      }),
    ),
    nextStepsFile: "next-steps.md",
    logFile: "orchestrator-log.md",
    manifestFile: "manifest.json",
    comparativeReviewLedgerFile: "consensus-divergence-ledger.json",
    readmeFile: "README.md",
    orchestratorFile: "orchestrator.md",
  };
}

function renderComparativeReviewLedgerTemplate(pack) {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      status: "pending",
      task: pack.route.task,
      generatedAt: new Date().toISOString(),
      consensus: null,
      divergence: {
        hasDivergence: false,
        disagreements: [],
      },
      evidence: {
        scoutNotes: pack.sidecarFiles.find((s) => s.key === "scout")?.outputFile ?? null,
        challengerFindings: pack.sidecarFiles.find((s) => s.key === "challenger")?.outputFile ?? null,
        councilEnvelope: null,
        planReviewJournal: null,
      },
      notes: [],
    },
    null,
    2,
  )}\n`;
}

function renderPromptPackReadme(pack) {
  const stageLines = pack.stageFiles
    .map(
      (stage) =>
        `- ${stage.promptFile} -> ${stage.outputFile} (${stage.title}; model ${stage.model})`,
    )
    .join("\n");
  const sidecarLines = pack.sidecarFiles
    .map(
      (sidecar) =>
        `- ${sidecar.promptFile} -> ${sidecar.outputFile} (optional ${sidecar.title}; model ${sidecar.recommendedModel})`,
    )
    .join("\n");

  return `# Harness Prompt Pack\n\nTask: ${pack.route.task}\n\nRoute: ${pack.route.stages.join(" -> ")}\n\nFiles:\n${stageLines}\n${sidecarLines}\n- ${pack.orchestratorFile} -> orchestrator control prompt\n- ${pack.nextStepsFile} -> rolling cycle memory\n- ${pack.logFile} -> delegation/completion log\n- ${pack.manifestFile} -> machine-readable plan\n`;
}

function renderOrchestratorPrompt(pack) {
  const stageTable = pack.stageFiles
    .map(
      (stage) =>
        `${stage.index}. ${stage.title} (${stage.model})\n   - Prompt: ${stage.promptFile}\n   - Required output: ${stage.outputFile}`,
    )
    .join("\n");
  const sidecarTable = pack.sidecarFiles
    .map(
      (sidecar) =>
        `- ${sidecar.title} (${sidecar.recommendedModel})\n  - Prompt: ${sidecar.promptFile}\n  - Optional output: ${sidecar.outputFile}\n  - Use when: ${sidecar.timing}`,
    )
    .join("\n");

  return `# Orchestrator Prompt\n\nYou are the harness orchestrator for this task:\n\n${pack.route.task}\n\nBefore doing anything:\n1. Read ${pack.nextStepsFile} if it already contains notes from a previous cycle.\n2. Treat ${pack.manifestFile} as the source of truth for file names and stage order.\n3. Append every delegation and completion event to ${pack.logFile}.\n\nExecution protocol:\n1. Follow this exact stage sequence and do not skip ahead:\n${stageTable}\n2. Do not start a stage until its upstream required output file exists and has substantive content.\n3. Keep implementation aligned with the repository harness contract and Architecture Brief.\n4. After feedback, refresh ${pack.nextStepsFile} with changed outcomes, top 3 next actions, and unresolved risks.\n\nOptional parallel sidecars:\n${sidecarTable}\n- Sidecars are advisory and do not replace canonical stage outputs.\n\nLoop discipline:\n- Reuse prior cycle memory rather than re-deriving settled decisions.\n- If a stage is blocked, record it and mark next action in ${pack.nextStepsFile}.\n- Prefer small, testable progress over reopening the whole plan.\n`;
}

function renderStagePrompt(pack, stageFile) {
  const requiredInputs = Array.isArray(stageFile.requiredArtifacts)
    ? stageFile.requiredArtifacts
    : [];

  const requiredInputsBlock = requiredInputs.length
    ? requiredInputs.map((name) => `- ${name}`).join("\n")
    : "- manifest.json\n- next-steps.md (if present)";
  const instructionBlock = stageFile.instructions
    .map((line) => `- ${line}`)
    .join("\n");
  const approvalRequirements = Array.isArray(stageFile.approval?.requiredFor)
    ? stageFile.approval.requiredFor
    : [];
  const approvalItems = approvalRequirements.map((item) => `- ${item}`).join("\n");
  const approvalBlock = approvalRequirements.length
    ? `\nApproval triggers:\n${approvalItems}\n`
    : "";

  return `# Stage ${stageFile.index}: ${stageFile.title}\n\nTask: ${pack.route.task}\nModel owner: ${stageFile.model}\nRoute profile: ${pack.route.profile ?? pack.route.mode}\n\nRequired inputs:\n${requiredInputsBlock}\n\nRequired output:\n- ${stageFile.outputFile}\n\nDeliverable:\n${stageFile.deliverable}\n\nInstructions:\n${instructionBlock}\n${approvalBlock}\nGuardrails:\n- Follow the repository harness stage contract for ${stageFile.stage}.\n- Keep output grounded in real files and repository state.\n- Do not perform the next stage in the same session; stop after writing ${stageFile.outputFile}.\n`;
}

function renderNextStepsTemplate(pack) {
  return `# Next Steps\n\n## Latest cycle\n- Task: ${pack.route.task}\n- Status: Not started\n\n## Top 3 next actions\n1. Run ${pack.stageFiles[0].promptFile}.\n2. Decide whether ${pack.sidecarFiles[0].promptFile} or ${pack.sidecarFiles[1].promptFile} adds value this cycle.\n3. Capture Architecture Brief before implementation.\n\n## Open risks\n- Knowledge graph freshness or missing context blockers go here.\n\n## Optional sidecar notes\n- Scout output: ${pack.sidecarFiles[0].outputFile}\n- Challenger output: ${pack.sidecarFiles[1].outputFile}\n\n## Notes from previous cycles\n- Add carry-forward notes here for the next orchestrator run.\n`;
}

function renderOrchestratorLog(pack) {
  return `# Orchestrator Log\n\n- ${new Date().toISOString()} generated prompt pack for task: ${pack.route.task}\n- Optional sidecars available: ${pack.sidecarFiles.map((s) => s.title).join(", ")}\n`;
}

function renderSidecarPrompt(pack, sidecar) {
  const suggestedInputs = [pack.manifestFile, pack.nextStepsFile];
  if (sidecar.key === "challenger") {
    suggestedInputs.push("architecture-brief.md", "implementation-notes.md");
  }
  const suggestedInputsBlock = suggestedInputs
    .map((name) => `- ${name}`)
    .join("\n");
  const instructionsBlock = sidecar.instructions
    .map((line) => `- ${line}`)
    .join("\n");

  return `# Optional Sidecar: ${sidecar.title}\n\nTask: ${pack.route.task}\nRecommended model: ${sidecar.recommendedModel}\n\nPurpose:\n${sidecar.purpose}\n\nSuggested inputs:\n${suggestedInputsBlock}\n\nOptional output:\n- ${sidecar.outputFile}\n\nWhen to use:\n${sidecar.timing}\n\nInstructions:\n${instructionsBlock}\n\nGuardrails:\n- This is a sidecar, not a replacement for canonical harness stages.\n- Keep output concise, file-grounded, and actionable by the orchestrator.\n- Stop after writing ${sidecar.outputFile}.\n`;
}

function writePromptPack(route, outDir) {
  const pack = buildPromptPack(route, outDir);
  mkdirSync(pack.packDir, { recursive: true });

  const manifest = {
    runId: pack.runId,
    task: pack.route.task,
    profile: pack.route.profile ?? null,
    mode: pack.route.mode,
    rationale: pack.route.why,
    stages: pack.route.stages,
    models: pack.route.models,
    crossModelReview: pack.route.crossModelReview,
    generatedAt: new Date().toISOString(),
    packDir: pack.packDir,
    files: {
      readme: pack.readmeFile,
      orchestrator: pack.orchestratorFile,
      nextSteps: pack.nextStepsFile,
      log: pack.logFile,
      comparativeReviewLedger: pack.comparativeReviewLedgerFile,
      sidecars: pack.sidecarFiles.map((sidecar) => ({
        key: sidecar.key,
        promptFile: sidecar.promptFile,
        outputFile: sidecar.outputFile,
        recommendedModel: sidecar.recommendedModel,
      })),
      stagePrompts: pack.stageFiles.map((stage) => ({
        stage: stage.stage,
        promptFile: stage.promptFile,
        outputFile: stage.outputFile,
        model: stage.model,
        requiredArtifacts: stage.requiredArtifacts ?? [],
        outputArtifact: stage.outputArtifact,
        approval: stage.approval ?? { humanRequired: false, requiredFor: [] },
      })),
    },
  };

  writePackFile(pack.packDir, pack.readmeFile, renderPromptPackReadme(pack));
  writePackFile(
    pack.packDir,
    pack.orchestratorFile,
    renderOrchestratorPrompt(pack),
  );
  writePackFile(
    pack.packDir,
    pack.nextStepsFile,
    renderNextStepsTemplate(pack),
  );
  writePackFile(pack.packDir, pack.logFile, renderOrchestratorLog(pack));
  writePackFile(
    pack.packDir,
    pack.comparativeReviewLedgerFile,
    renderComparativeReviewLedgerTemplate(pack),
  );
  writePackFile(
    pack.packDir,
    pack.manifestFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  for (const stageFile of pack.stageFiles) {
    writePackFile(
      pack.packDir,
      stageFile.promptFile,
      renderStagePrompt(pack, stageFile),
    );
  }
  for (const sidecar of pack.sidecarFiles) {
    writePackFile(
      pack.packDir,
      sidecar.promptFile,
      renderSidecarPrompt(pack, sidecar),
    );
  }

  return pack;
}

function renderPromptPackSummary(pack) {
  const lines = [
    `[prompt-router] prompt pack created`,
    `[prompt-router] run-id: ${pack.runId ?? "none"}`,
    `[prompt-router] task: ${pack.route.task || "<stdin>"}`,
    `[prompt-router] output: ${pack.packDir}`,
    `[prompt-router] stages: ${pack.route.stages.join(" -> ")}`,
  ];

  for (const stageFile of pack.stageFiles) {
    lines.push(
      `[prompt-router] ${stageFile.promptFile} -> ${stageFile.outputFile} (${stageFile.model})`,
    );
  }
  for (const sidecar of pack.sidecarFiles) {
    lines.push(
      `[prompt-router] ${sidecar.promptFile} -> ${sidecar.outputFile} (optional ${sidecar.recommendedModel})`,
    );
  }
  lines.push(
    `[prompt-router] orchestrator: ${pack.orchestratorFile}`,
    `[prompt-router] memory: ${pack.nextStepsFile}`,
    `[prompt-router] comparative-ledger: ${pack.comparativeReviewLedgerFile}`,
  );
  return `${lines.join("\n")}\n`;
}

export function renderCompactRoute(route) {
  return (
    `[prompt-router] ${route.mode.toUpperCase()} — ${route.why}\n` +
    `[prompt-router] run-id: ${route.runId ?? "none"}\n` +
    `[prompt-router] stages: ${route.stages.join(" -> ")}\n` +
    `[prompt-router] models: ${Object.entries(route.models)
      .map(([stage, model]) => `${stage}=${model}`)
      .join(", ")}\n` +
    `[prompt-router] cross-model review: ${route.crossModelReview}\n`
  );
}

export function renderHandoffPlan(route) {
  const profileSuffix = route.profile ? ` (${route.profile})` : "";
  const lines = [
    `[prompt-router] operator handoff plan${profileSuffix}`,
    `[prompt-router] run-id: ${route.runId ?? "none"}`,
    `[prompt-router] task: ${route.task || "<stdin>"}`,
    `[prompt-router] rationale: ${route.why}`,
  ];

  route.stages.forEach((stage, index) => {
    lines.push(
      `[prompt-router] ${index + 1}. ${stage} -> ${route.models[stage]}`,
    );
  });

  lines.push(`[prompt-router] cross-model review: ${route.crossModelReview}`);
  return `${lines.join("\n")}\n`;
}

function printBanner(config) {
  const roleModels = validateModelSeparation(config);
  const stageModels = buildModelRouting(config);
  process.stdout.write(
    `[prompt-router] Harness-first mode is ON for this repo.\n` +
      `[prompt-router] Non-trivial prompts route: understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback\n` +
      `[prompt-router] Stage defaults: understand=${stageModels.understand}; architect=${stageModels.architect}; architect-challenge=${stageModels["architect-challenge"]}; implement=${stageModels.implement}; review-breadth=${stageModels["review-breadth"]}; review-depth=${stageModels["review-depth"]}; feedback=${stageModels.feedback}\n` +
      `[prompt-router] Cross-model review guardrail: ${roleModels.implementer} -> ${roleModels.reviewer}\n` +
      `[prompt-router] Trivial prompts may start at implement only when they are clearly one-file/low-risk.\n`,
  );
}

function printReminder() {
  process.stdout.write(
    `[prompt-router] Operator shortcuts:\n` +
      `[prompt-router]   npm run harness:feature -- --task "<feature task>"\n` +
      `[prompt-router]   npm run harness:handoff:review -- --task "<review task>"\n` +
      `[prompt-router]   npm run harness:profile -- --task "<task>" --json\n` +
      `[prompt-router]   npm run harness:route -- --task "<any prompt>" --json\n` +
      `[prompt-router]   npm run harness:prompt-pack -- --profile feature --task "<task>"\n`,
  );
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: [
          "node scripts/harness/prompt-router.mjs banner",
          'node scripts/harness/prompt-router.mjs route --task "fix auth middleware race"',
          'node scripts/harness/prompt-router.mjs route --intent turnkey-coding --task "add billing API + UI"',
          'node scripts/harness/prompt-router.mjs pick-profile --task "design multi-agent orchestration"',
          'node scripts/harness/prompt-router.mjs handoff --profile feature --task "ship auth audit"',
          'node scripts/harness/prompt-router.mjs handoff --profile review --task "review auth audit"',
          'node scripts/harness/prompt-router.mjs route --task "ship auth audit" --allow-degraded-preflight',
          'node scripts/harness/prompt-router.mjs prompt-pack --profile feature --task "ship auth audit"',
          'node scripts/harness/prompt-router.mjs next-actions --task "ship auth audit"',
          'node scripts/harness/prompt-router.mjs next-actions --pack ship-auth-audit --profile feature',
          'node scripts/harness/prompt-router.mjs next-actions --pack-latest',
          'echo "typo in README" | node scripts/harness/prompt-router.mjs route --stdin --json',
        ],
        note: "Deterministic repo policy helper. It does not intercept editor prompts by itself; use it via session hooks and repo instructions.",
      },
      null,
      2,
    )}\n`,
  );
}

function resolveCommand(flags) {
  const command = flags._[0] ?? "banner";
  if (
    command !== "banner" &&
    command !== "remind" &&
    command !== "route" &&
    command !== "handoff" &&
    command !== "prompt-pack" &&
    command !== "pick-profile" &&
    command !== "next-actions"
  ) {
    fail(`unknown command: ${command}`);
  }
  return command;
}

function isNonEmptyFileUnderRoot(rootDir, fileName, label) {
  const safePath = safeJoinUnder(rootDir, fileName, label);
  if (!existsSync(safePath)) return false;
  try {
    return statSync(safePath).size > 0;
  } catch {
    return false;
  }
}

function listPromptPackDirs() {
  if (!existsSync(promptPacksDir)) return [];
  const entries = readdirSync(promptPacksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = safeJoinUnder(
        promptPacksDir,
        entry.name,
        "prompt pack directory name",
      );
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(dir).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { dir, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries.map((entry) => entry.dir);
}

function enforceNextActionSelectors(flags) {
  if (flags.pack && flags.packLatest) {
    fail('next-actions: --pack and --pack-latest cannot be used together.', 1);
  }
}

function packDirFromSlug(slug) {
  return safeJoinUnder(promptPacksDir, slug, "prompt pack slug");
}

function selectPackByFlags(flags) {
  if (flags.pack) {
    const dir = packDirFromSlug(flags.pack);
    if (!existsSync(dir)) {
      fail(`next-actions: prompt pack "${flags.pack}" was not found under ${promptPacksDir}.`, 1);
    }
    return dir;
  }
  if (flags.packLatest) {
    const dirs = listPromptPackDirs();
    if (dirs.length === 0) {
      fail("next-actions: no prompt packs are available for --pack-latest.", 1);
    }
    return dirs[0];
  }
  return null;
}

function matchesProfile(manifest, expectedProfile) {
  if (!expectedProfile) return true;
  return manifest?.profile === expectedProfile;
}

function readJsonFileOrNull(rootDir, fileName, label) {
  const safePath = safeJoinUnder(rootDir, fileName, label);
  if (!existsSync(safePath)) return null;
  try {
    return require(safePath);
  } catch {
    return null;
  }
}

function findLatestBrief() {
  const briefsDir = join(repoRoot, ".github", "harness", "memory", "briefs");
  if (!existsSync(briefsDir)) return null;
  const files = readdirSync(briefsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const path = safeJoinUnder(briefsDir, entry.name, "brief file name");
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(path).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { path, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.path ?? null;
}

function pendingStageHint(stage) {
  if (stage === "understand") {
    return "Run npm run harness:graph -- status and record freshness caveats in understand notes.";
  }
  if (stage === "architect-challenge") {
    return "Run an independent architect challenge pass and resolve REVISE/BLOCKED concerns before implement.";
  }
  if (stage === "implement") {
    return "Execute only the file changes declared in the Architecture Brief, then capture validation evidence.";
  }
  return null;
}

function nextActionSelectorLabel(flags) {
  if (flags.pack) return `--pack ${flags.pack}`;
  if (flags.packLatest) return "--pack-latest";
  return "task-match";
}

function manifestMatchesTask(manifest, normalizedTask, explicitPackDir) {
  if (explicitPackDir) return true;
  if (!normalizedTask) return true;
  const manifestTask = normalizeText(manifest?.task ?? "");
  return (
    manifestTask.length > 0 &&
    (manifestTask.includes(normalizedTask) ||
      normalizedTask.includes(manifestTask))
  );
}

function selectManifestForNextActions(packDirs, normalizedTask, flags, explicitPackDir) {
  for (const packDir of packDirs) {
    const manifest = readJsonFileOrNull(
      packDir,
      "manifest.json",
      "prompt pack manifest file",
    );
    if (!manifest) continue;
    if (!matchesProfile(manifest, flags.profile)) continue;
    if (!manifestMatchesTask(manifest, normalizedTask, explicitPackDir)) {
      continue;
    }
    return { selectedPackDir: packDir, selectedManifest: manifest };
  }
  return { selectedPackDir: null, selectedManifest: null };
}

function findPendingStage(stagePrompts, packDir) {
  return stagePrompts.find((stage) => {
    const outputFile = stage?.outputFile;
    if (typeof outputFile !== "string" || outputFile.trim().length === 0) {
      return true;
    }
    return !isNonEmptyFileUnderRoot(packDir, outputFile, "stage output file name");
  });
}

function nextStepsFileName(manifest) {
  if (typeof manifest?.files?.nextSteps !== "string") {
    return "next-steps.md";
  }
  return ensureSafeSegment(manifest.files.nextSteps, "next-steps file name");
}

function validateManifestPathFields(manifest, packDir) {
  const nextStepsFile = nextStepsFileName(manifest);
  safeJoinUnder(packDir, nextStepsFile, "next-steps file name");

  const stagePrompts = Array.isArray(manifest?.files?.stagePrompts)
    ? manifest.files.stagePrompts
    : [];

  stagePrompts.forEach((stagePrompt, index) => {
    const prefix = `stage prompt #${index + 1}`;
    if (
      typeof stagePrompt?.promptFile === "string" &&
      stagePrompt.promptFile.trim().length > 0
    ) {
      const safePrompt = ensureSafeSegment(
        stagePrompt.promptFile,
        `${prefix} prompt file name`,
      );
      safeJoinUnder(packDir, safePrompt, `${prefix} prompt file name`);
    }
    if (
      typeof stagePrompt?.outputFile === "string" &&
      stagePrompt.outputFile.trim().length > 0
    ) {
      const safeOutput = ensureSafeSegment(
        stagePrompt.outputFile,
        `${prefix} output file name`,
      );
      safeJoinUnder(packDir, safeOutput, `${prefix} output file name`);
    }
  });

  return { nextStepsFile, stagePrompts };
}

function buildPendingActions(pending, selectedPackDir, nextStepsFile) {
  const pendingPrompt =
    typeof pending.promptFile === "string"
      ? ensureSafeSegment(pending.promptFile, "stage prompt file name")
      : null;
  const pendingOutput =
    typeof pending.outputFile === "string"
      ? ensureSafeSegment(pending.outputFile, "stage output file name")
      : null;
  const stageHint = pendingStageHint(pending?.stage);
  return [
    pendingPrompt && pendingOutput
      ? `Run ${pendingPrompt} in ${selectedPackDir} and write ${pendingOutput}.`
      : null,
    stageHint,
    `Update ${nextStepsFile} with the latest status and top 3 actions.`,
  ].filter(Boolean);
}

function buildCompletedActions() {
  return [
    "All staged outputs appear present in the selected prompt pack.",
    "Run Feedback-stage verification and confirm decision logs are updated.",
    "Start the next loop by generating a fresh handoff for remaining gaps or follow-up tasks.",
  ];
}

function buildFallbackActions(taskText, latestBrief) {
  if (latestBrief) {
    return [
      `Use ${latestBrief} as the source brief and continue with Implement-stage scoped edits.`,
      "Run npm run harness:docs:check after edits and capture proof notes.",
      "Run breadth and depth review stages before final feedback verdict updates.",
    ];
  }

  const fallbackTask = taskText || "Describe the feature task";
  return [
    `Run node scripts/harness/prompt-router.mjs handoff --task "${fallbackTask}".`,
    `Run node scripts/harness/prompt-router.mjs prompt-pack --task "${fallbackTask}".`,
    "Start with Understand and produce a brief before implementation.",
  ];
}

function inferNextActions(taskText, config, flags = {}) {
  enforceNextActionSelectors(flags);
  const normalizedTask = normalizeText(taskText);
  const explicitPackDir = selectPackByFlags(flags);
  const packDirs = explicitPackDir ? [explicitPackDir] : listPromptPackDirs();
  const { selectedPackDir, selectedManifest } = selectManifestForNextActions(
    packDirs,
    normalizedTask,
    flags,
    explicitPackDir,
  );

  if (flags.profile && !selectedManifest) {
    const selector = nextActionSelectorLabel(flags);
    fail(
      `next-actions: no prompt pack matched profile "${flags.profile}" using selector ${selector}.`,
      1,
    );
  }

  const fallbackRoute = taskText ? planTask(taskText, config, {}) : null;

  if (selectedPackDir && selectedManifest) {
    const { nextStepsFile, stagePrompts } = validateManifestPathFields(
      selectedManifest,
      selectedPackDir,
    );
    const pending = findPendingStage(stagePrompts, selectedPackDir);
    const actions = pending
      ? buildPendingActions(pending, selectedPackDir, nextStepsFile)
      : buildCompletedActions();

    return {
      source: "prompt-pack",
      packDir: selectedPackDir,
      task: selectedManifest.task ?? taskText ?? "",
      route: selectedManifest.stages ?? fallbackRoute?.stages ?? [],
      pendingStage: pending?.stage ?? null,
      actions: actions.slice(0, 3),
    };
  }

  const latestBrief = taskText ? null : findLatestBrief();
  const actions = buildFallbackActions(taskText, latestBrief);

  return {
    source: latestBrief ? "brief-fallback" : "route-fallback",
    packDir: null,
    task: taskText || "",
    route: fallbackRoute?.stages ?? [],
    pendingStage: latestBrief ? "implement" : "understand",
    actions: actions.slice(0, 3),
  };
}

function printNextActions(task, flags, config) {
  const payload = inferNextActions(task, config, flags);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const lines = [
    `[prompt-router] next actions source: ${payload.source}`,
    `[prompt-router] task: ${payload.task || "<none>"}`,
  ];
  if (payload.packDir) {
    lines.push(`[prompt-router] prompt pack: ${payload.packDir}`);
  }
  if (payload.pendingStage) {
    lines.push(`[prompt-router] pending stage: ${payload.pendingStage}`);
  }
  payload.actions.forEach((action, index) => {
    lines.push(`[prompt-router] ${index + 1}. ${action}`);
  });
  process.stdout.write(`${lines.join("\n")}\n`);
}

function printPickProfile(route, asJson) {
  const payload = {
    task: route.task,
    intent: route.intent,
    profile: route.profile,
    mode: route.mode,
    why: route.why,
    stages: route.stages,
  };
  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    `[prompt-router] intent: ${payload.intent ?? "none"}\n` +
      `[prompt-router] profile: ${payload.profile ?? "default"}\n` +
      `[prompt-router] rationale: ${payload.why}\n` +
      `[prompt-router] stages: ${payload.stages.join(" -> ")}\n`,
  );
}

function printPromptPack(route, flags) {
  const pack = writePromptPack(route, flags.out);
  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          runId: pack.runId,
          task: pack.route.task,
          profile: pack.route.profile ?? null,
          output: pack.packDir,
          stages: pack.stageFiles.map((stage) => ({
            stage: stage.stage,
            model: stage.model,
            promptFile: stage.promptFile,
            outputFile: stage.outputFile,
          })),
          sidecars: pack.sidecarFiles.map((sidecar) => ({
            key: sidecar.key,
            promptFile: sidecar.promptFile,
            outputFile: sidecar.outputFile,
            recommendedModel: sidecar.recommendedModel,
          })),
        },
        null,
        2,
      )}\n`,
    );
    return pack;
  }
  process.stdout.write(renderPromptPackSummary(pack));
  return pack;
}

function printRouteOutput(command, route, flags) {
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(route, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    command === "handoff"
      ? renderHandoffPlan(route)
      : renderCompactRoute(route),
  );
}

function buildPreflightOverrideTelemetry({ route, command, reason, source }) {
  return {
    id: `pfo-${Date.now()}-${randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    command,
    task: route?.task ?? "",
    profile: route?.profile ?? null,
    intent: route?.intent ?? null,
    mode: route?.mode ?? null,
    source,
    reason,
    user: process.env.USERNAME ?? process.env.USER ?? null,
  };
}

function recordPreflightOverride(route, command, reason, source = "--allow-degraded-preflight") {
  const payload = buildPreflightOverrideTelemetry({
    route,
    command,
    reason,
    source,
  });
  try {
    mkdirSync(runsDir, { recursive: true });
    appendFileSync(preflightOverrideLogPath, `${JSON.stringify(payload)}\n`, "utf8");
    return { ok: true, path: preflightOverrideLogPath, payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      payload,
    };
  }
}

function enforceNonTrivialGraphPreflight(route, command, flags) {
  if (route?.mode !== "non-trivial") {
    return;
  }

  const coreStatus = buildGraphStatusCore({
    repoRoot,
    configPath,
    probe: true,
  });

  if (coreStatus?.refreshReadiness?.ready) {
    return;
  }

  const reason =
    coreStatus?.degradationReason ||
    coreStatus?.refreshReadiness?.reason ||
    "unknown graph refresh degradation";

  if (flags?.allowDegradedPreflight) {
    const telemetry = recordPreflightOverride(route, command, reason);
    if (!telemetry.ok) {
      fail(
        `${command} bypass denied: degraded preflight override audit logging failed (${telemetry.error}).`,
        1,
      );
    }
    process.stderr.write(
      `[prompt-router] WARNING: bypassing degraded preflight via --allow-degraded-preflight. reason=${reason}; audit=${telemetry.path}\n`,
    );
    return;
  }

  fail(
    `${command} blocked: non-trivial routes require graph refresh readiness, but readiness is degraded (${reason}). ` +
      `Run "npm run harness:graph -- status" and configure the required refresh prerequisites (for understand-anything, set graph.pluginRoot/UNDERSTAND_PLUGIN_ROOT).`,
    1,
  );
}

function maybeRecordHandoff(route, command, config) {
  if (command !== "handoff") {
    return;
  }
  const telemetry = recordHandoffTelemetry(route, command, config);
  if (!telemetry.ok) {
    process.stderr.write(
      `[prompt-router] warning: could not write handoff telemetry: ${telemetry.error}\n`,
    );
  }
}

function createFeatureRunContext(route) {
  try {
    const featureRunContext = createOrReuseFeatureRun(route);
    if (featureRunContext) {
      route.runId = featureRunContext.runId;
    }
    return featureRunContext;
  } catch (error) {
    process.stderr.write(
      `[prompt-router] warning: feature run bundle unavailable: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return null;
  }
}

function recordPromptPackArtifact(featureRunContext, packDir) {
  try {
    if (featureRunContext) {
      recordPromptPackInFeatureRun(featureRunContext, packDir);
    }
  } catch (error) {
    process.stderr.write(
      `[prompt-router] warning: could not update feature run prompt-pack artifact: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

function recordCommandArtifacts(featureRunContext, command, route) {
  if (!featureRunContext) {
    return;
  }
  try {
    if (command === "route") {
      writeFeatureRunArtifact(
        featureRunContext,
        "route",
        "route.json",
        `${JSON.stringify(route, null, 2)}\n`,
      );
      return;
    }
    if (command === "handoff") {
      writeFeatureRunArtifact(
        featureRunContext,
        "handoff",
        "handoff.txt",
        renderHandoffPlan(route),
      );
    }
  } catch (error) {
    process.stderr.write(
      `[prompt-router] warning: could not update feature run artifacts: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const command = resolveCommand(flags);
  const config = loadConfig();

  if (command === "banner") {
    printBanner(config);
    return;
  }

  if (command === "remind") {
    printReminder();
    return;
  }

  const task = flags.stdin ? await readStdin() : resolveTaskText(flags);
  if (command !== "next-actions" && (!task || !String(task).trim())) {
    fail(`${command} requires --task "..." or --stdin`);
  }

  if (command === "next-actions") {
    printNextActions(String(task ?? "").trim(), flags, config);
    return;
  }

  const route = planTask(task, config, {
    profile: flags.profile,
    intent: flags.intent,
  });
  const featureRunContext = createFeatureRunContext(route);

  enforceNonTrivialGraphPreflight(route, command, flags);

  maybeRecordHandoff(route, command, config);

  if (command === "pick-profile") {
    printPickProfile(route, flags.json);
    return;
  }

  if (command === "prompt-pack") {
    const pack = printPromptPack(route, flags);
    recordPromptPackArtifact(featureRunContext, pack?.packDir);
    return;
  }

  recordCommandArtifacts(featureRunContext, command, route);

  printRouteOutput(command, route, flags);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 1);
  }
}

