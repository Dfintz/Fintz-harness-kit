#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertArtifactHandoffs,
  assertExactStageSequence,
  assertPromptContains,
} from "../trace-contract.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const router = join(repoRoot, "scripts", "harness", "prompt-router.mjs");
const runsDir = join(repoRoot, ".github", "harness", "runs");
const promptPacksDir = join(runsDir, "prompt-packs");
const featureRunsDir = join(runsDir, "feature-runs");
const featureRunIndexPath = join(featureRunsDir, "index.json");
const preflightOverrideLogPath = join(runsDir, "preflight-overrides.jsonl");

function snapshotDirectories(root) {
  if (!existsSync(root)) return new Set();
  return new Set(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
}

function runPromptPack(task, outSlug) {
  return spawnSync(
    process.execPath,
    [router, "prompt-pack", "--task", task, "--out", outSlug, "--json"],
    { cwd: repoRoot, encoding: "utf8", shell: false },
  );
}

function containedPath(root, candidate, label) {
  const rootPath = resolve(root);
  const candidatePath = resolve(root, candidate);
  const rootWithSeparator = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  if (candidatePath !== rootPath && !candidatePath.startsWith(rootWithSeparator)) {
    throw new Error(`${label} escaped root: ${candidatePath}`);
  }
  return candidatePath;
}

const expectedStages = [
  "understand",
  "architect",
  "architect-challenge",
  "implement",
  "review-breadth",
  "review-depth",
  "feedback",
];
const slug = `trace-contract-pack-${Date.now()}-${randomUUID().slice(0, 8)}`;
const packDir = join(promptPacksDir, slug);
const baselineFeatureDirs = snapshotDirectories(featureRunsDir);
const originalIndexExists = existsSync(featureRunIndexPath);
const originalIndexText = originalIndexExists
  ? readFileSync(featureRunIndexPath, "utf8")
  : null;
const originalOverrideLogExists = existsSync(preflightOverrideLogPath);
const originalOverrideLogText = originalOverrideLogExists
  ? readFileSync(preflightOverrideLogPath, "utf8")
  : null;

mkdirSync(featureRunsDir, { recursive: true });

try {
  const result = runPromptPack("trace contract prompt-pack behavior", slug);
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(containedPath(promptPacksDir, payload.output, "prompt pack output"), resolve(packDir), "prompt pack must use the unique slug under the supported root");

  const manifest = JSON.parse(readFileSync(join(packDir, "manifest.json"), "utf8"));
  assertExactStageSequence(manifest.stages, expectedStages);
  assertExactStageSequence(
    manifest.files.stagePrompts.map((stage) => stage.stage),
    expectedStages,
  );
  assertArtifactHandoffs(manifest.files.stagePrompts);

  const understandPrompt = readFileSync(containedPath(packDir, manifest.files.stagePrompts[0].promptFile, "Understand prompt"), "utf8");
  assertPromptContains(understandPrompt, ["graph freshness gate", "understand-process skill"], "Understand prompt");

  for (const stage of manifest.files.stagePrompts) {
    const prompt = readFileSync(containedPath(packDir, stage.promptFile, `${stage.stage} prompt`), "utf8");
    assertPromptContains(prompt, ["Required inputs:", `Required output:\n- ${stage.outputFile}`], `${stage.stage} prompt`);
  }

  console.log("PASS trace contract prompt-pack test suite");
} finally {
  rmSync(packDir, { recursive: true, force: true });
  if (originalIndexExists) writeFileSync(featureRunIndexPath, originalIndexText, "utf8");
  else if (existsSync(featureRunIndexPath)) unlinkSync(featureRunIndexPath);
  if (originalOverrideLogExists) writeFileSync(preflightOverrideLogPath, originalOverrideLogText, "utf8");
  else if (existsSync(preflightOverrideLogPath)) unlinkSync(preflightOverrideLogPath);
  for (const name of snapshotDirectories(featureRunsDir)) {
    if (!baselineFeatureDirs.has(name)) rmSync(join(featureRunsDir, name), { recursive: true, force: true });
  }
}