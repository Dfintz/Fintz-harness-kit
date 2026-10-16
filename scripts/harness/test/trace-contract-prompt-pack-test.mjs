#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertArtifactHandoffs,
  assertExactStageSequence,
  assertPromptContains,
} from "../trace-contract.mjs";

const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const router = join(harnessRoot, "scripts", "harness", "prompt-router.mjs");
const baseConfig = JSON.parse(readFileSync(join(harnessRoot, "harness.config.json"), "utf8"));
const kitPromptPacksDir = join(harnessRoot, ".github", "harness", "runs", "prompt-packs");
const tempRoot = mkdtempSync(join(tmpdir(), "harness-trace-contract-pack-"));

// Isolated target repos keep this test independent of the kit's local knowledge graph, the
// caller's UNDERSTAND_PLUGIN_ROOT / HARNESS_PROJECT_ROOT, and the kit's own run artifacts.
// The registry and stage contracts still come from the kit via HARNESS_REPO_ROOT.
function writeFixture(name, { refreshReady }) {
  const root = join(tempRoot, name);
  mkdirSync(root, { recursive: true });
  const config = structuredClone(baseConfig);
  config.graph = { ...config.graph, pluginRoot: refreshReady ? join(root, "graph-plugin") : "" };
  writeFileSync(join(root, "harness.config.json"), JSON.stringify(config, null, 2));
  return root;
}

function fixturePromptPacksDir(root) {
  return join(root, ".github", "harness", "runs", "prompt-packs");
}

function childEnv() {
  const env = { ...process.env, HARNESS_REPO_ROOT: harnessRoot };
  delete env.HARNESS_PROJECT_ROOT;
  delete env.UNDERSTAND_PLUGIN_ROOT;
  return env;
}

function runPromptPack(root, task, outSlug) {
  return spawnSync(
    process.execPath,
    [router, "prompt-pack", "--task", task, "--out", outSlug, "--json", "--repo-root", root],
    { cwd: harnessRoot, encoding: "utf8", shell: false, env: childEnv() },
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
const task = "trace contract prompt-pack behavior";
const slug = `trace-contract-pack-${Date.now()}-${randomUUID().slice(0, 8)}`;

try {
  const readyRoot = writeFixture("refresh-ready", { refreshReady: true });
  const promptPacksDir = fixturePromptPacksDir(readyRoot);
  const packDir = join(promptPacksDir, slug);
  const result = runPromptPack(readyRoot, task, slug);
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

  const degradedRoot = writeFixture("refresh-degraded", { refreshReady: false });
  const blocked = runPromptPack(degradedRoot, task, slug);
  assert.equal(blocked.status, 1, `degraded graph readiness must block prompt-pack\n${blocked.stderr}\n${blocked.stdout}`);
  assert.match(blocked.stderr, /prompt-pack blocked: non-trivial routes require graph refresh readiness/);
  assert.equal(existsSync(join(fixturePromptPacksDir(degradedRoot), slug)), false, "a blocked prompt-pack must not write a pack");

  assert.equal(existsSync(join(kitPromptPacksDir, slug)), false, "fixture prompt-packs must not write into the kit");

  console.log("PASS trace contract prompt-pack test suite");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}