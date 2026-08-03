#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const scriptPath = join(repoRoot, "scripts", "harness", "prompt-router.mjs");
const runsDir = join(repoRoot, ".github", "harness", "runs");
const featureRunsDir = join(runsDir, "feature-runs");
const featureRunIndexPath = join(featureRunsDir, "index.json");

function run(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    shell: false,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseJsonStdout(result, label) {
  assert.equal(result.status, 0, `${label} should succeed: ${result.stderr || result.stdout}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} returned non-JSON output: ${result.stdout}\n${String(error)}`);
  }
}

function normalizeTaskKey(taskText) {
  return String(taskText ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function listRunDirs() {
  if (!existsSync(featureRunsDir)) {
    return new Set();
  }
  return new Set(
    readdirSync(featureRunsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
}

mkdirSync(featureRunsDir, { recursive: true });

const originalIndexExists = existsSync(featureRunIndexPath);
const originalIndexText = originalIndexExists
  ? readFileSync(featureRunIndexPath, "utf8")
  : null;
const baselineRunDirs = listRunDirs();

const uniqueSuffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const taskA = `Slice B run bundle deterministic reuse ${uniqueSuffix}`;
const taskAWhitespaceVariant = `  slice b   RUN bundle deterministic   reuse ${uniqueSuffix}   `;
const taskB = `Slice B run bundle fresh mapping ${uniqueSuffix}`;

try {
  const routeA1 = parseJsonStdout(
    run(["route", "--task", taskA, "--json", "--allow-degraded-preflight"]),
    "first route",
  );
  assert.ok(routeA1.runId, "first route should include runId");

  const routeA2 = parseJsonStdout(
    run(["route", "--task", taskAWhitespaceVariant, "--json", "--allow-degraded-preflight"]),
    "second route",
  );
  assert.equal(routeA2.runId, routeA1.runId, "same normalized task should reuse runId");

  const handoff = run(["handoff", "--task", taskA, "--allow-degraded-preflight"]);
  assert.equal(handoff.status, 0, `handoff should succeed: ${handoff.stderr || handoff.stdout}`);
  assert.match(handoff.stdout, /run-id:\s+/i, "handoff output should include run-id line");

  const promptPack = parseJsonStdout(
    run(["prompt-pack", "--task", taskA, "--json", "--allow-degraded-preflight"]),
    "prompt-pack",
  );
  assert.equal(promptPack.runId, routeA1.runId, "prompt-pack should carry the same runId");

  const routeB = parseJsonStdout(
    run(["route", "--task", taskB, "--json", "--allow-degraded-preflight"]),
    "third route",
  );
  assert.ok(routeB.runId, "third route should include runId");
  assert.notEqual(routeB.runId, routeA1.runId, "different task should mint a new runId");

  const index = JSON.parse(readFileSync(featureRunIndexPath, "utf8"));
  const taskAKey = normalizeTaskKey(taskAWhitespaceVariant);
  const taskBKey = normalizeTaskKey(taskB);

  assert.equal(index.tasks?.[taskAKey]?.runId, routeA1.runId, "index should map task A to reused runId");
  assert.equal(index.tasks?.[taskBKey]?.runId, routeB.runId, "index should map task B to minted runId");

  const runDirA = join(featureRunsDir, routeA1.runId);
  const manifestPathA = join(runDirA, "manifest.json");
  const routeArtifactPathA = join(runDirA, "route.json");
  const handoffArtifactPathA = join(runDirA, "handoff.txt");

  assert.ok(existsSync(manifestPathA), "manifest.json should exist for task A run");
  assert.ok(existsSync(routeArtifactPathA), "route.json artifact should exist for task A run");
  assert.ok(existsSync(handoffArtifactPathA), "handoff.txt artifact should exist for task A run");

  const manifestA = JSON.parse(readFileSync(manifestPathA, "utf8"));
  assert.equal(manifestA.runId, routeA1.runId, "manifest runId should match route runId");
  assert.equal(manifestA.taskKey, taskAKey, "manifest taskKey should be normalized task key");
  assert.match(manifestA.artifacts?.route ?? "", /route\.json$/i, "manifest should record route artifact");
  assert.match(manifestA.artifacts?.handoff ?? "", /handoff\.txt$/i, "manifest should record handoff artifact");
  assert.ok(manifestA.artifacts?.promptPackDir, "manifest should record prompt pack directory");

  const runDirB = join(featureRunsDir, routeB.runId);
  const manifestPathB = join(runDirB, "manifest.json");
  assert.ok(existsSync(manifestPathB), "manifest.json should exist for task B run");

  console.log("PASS prompt-router run bundle test suite");
} finally {
  if (originalIndexExists) {
    writeFileSync(featureRunIndexPath, originalIndexText, "utf8");
  } else if (existsSync(featureRunIndexPath)) {
    unlinkSync(featureRunIndexPath);
  }

  const currentRunDirs = listRunDirs();
  for (const runDirName of currentRunDirs) {
    if (!baselineRunDirs.has(runDirName)) {
      rmSync(join(featureRunsDir, runDirName), { recursive: true, force: true });
    }
  }
}
