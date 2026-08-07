#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runsDir = join(repoRoot, ".github", "harness", "runs");
const featureRunsDir = join(runsDir, "feature-runs");
const featureRunIndexPath = join(featureRunsDir, "index.json");
const handoffLogPath = join(runsDir, "handoffs.jsonl");
const task = `I want to check the harness functionality as a thin player and find issues, gaps and improvements ${Date.now()}-${randomUUID().slice(0, 8)}`;
const assistantTask = `What is the harness stage machine ${Date.now()}-${randomUUID().slice(0, 8)}`;
const reviewTask = `Review this change for correctness ${Date.now()}-${randomUUID().slice(0, 8)}`;

function runWrapper(script, taskText) {
  const args = ["run", "--silent", script, "--", "--task", taskText, "--json", "--allow-degraded-preflight"];
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "npm_execpath must be set when running the npm wrapper smoke test");
  return spawnSync(
    process.execPath,
    [npmCli, ...args],
    { cwd: repoRoot, encoding: "utf8", shell: false },
  );
}

function parseRoute(result, label) {
  assert.equal(result.status, 0, `${label} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} returned non-JSON output: ${result.stdout}\n${String(error)}`);
  }
}

const originalIndex = existsSync(featureRunIndexPath)
  ? readFileSync(featureRunIndexPath, "utf8")
  : null;
const originalHandoffLog = existsSync(handoffLogPath)
  ? readFileSync(handoffLogPath, "utf8")
  : null;
const runIds = new Set();

try {
  const route = parseRoute(runWrapper("harness:route", task), "route wrapper");
  const handoff = parseRoute(runWrapper("harness:handoff:feature", task), "feature handoff wrapper");
  const assistantRoute = parseRoute(runWrapper("harness:route", assistantTask), "assistant route wrapper");
  const reviewRoute = parseRoute(runWrapper("harness:route", reviewTask), "review route wrapper");
  [route, handoff, assistantRoute, reviewRoute].forEach((entry) => runIds.add(entry.runId));

  assert.equal(route.profile, "feature", "thin-player audit should select the feature profile");
  assert.equal(route.taskClass, "harness-audit", "matrix should classify the thin-player audit");
  assert.equal(route.modelSet, "feature", "matrix should select the feature model set");
  assert.deepEqual(
    route.stages,
    ["understand", "architect", "architect-challenge", "implement", "review-breadth", "review-depth", "feedback"],
    "thin-player audit should use the complete feature route",
  );
  assert.equal(assistantRoute.profile, "assistant", "unprofiled question should retain the assistant route");
  assert.equal(reviewRoute.profile, "review", "explicit review request should select the review route");
  assert.deepEqual(handoff.stages, route.stages, "route and handoff wrappers must have identical stages");
  assert.deepEqual(handoff.models, route.models, "route and handoff wrappers must have identical models");
  assert.ok(
    existsSync(join(featureRunsDir, route.runId, "route.json")),
    "route artifact should be stored under this project",
  );
  assert.ok(
    existsSync(join(featureRunsDir, route.runId, "handoff.txt")),
    "handoff artifact should be stored under this project",
  );
  assert.ok(existsSync(handoffLogPath), "handoff telemetry should be stored under this project");

  console.log("[harness-project-wrapper-smoke] PASS");
} finally {
  for (const runId of runIds) {
    rmSync(join(featureRunsDir, runId), { recursive: true, force: true });
  }
  if (originalIndex === null) {
    rmSync(featureRunIndexPath, { force: true });
  } else {
    writeFileSync(featureRunIndexPath, originalIndex, "utf8");
  }
  if (originalHandoffLog === null) {
    rmSync(handoffLogPath, { force: true });
  } else {
    writeFileSync(handoffLogPath, originalHandoffLog, "utf8");
  }
}