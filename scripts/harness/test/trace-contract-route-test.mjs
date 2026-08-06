import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRouteTrace } from "../trace-contract.mjs";

const repoRoot = join(fileURLToPath(new URL("../../..", import.meta.url)));
const router = join(repoRoot, "scripts", "harness", "prompt-router.mjs");
const result = spawnSync(process.execPath, [router, "route", "--task", "add a cross-provider harness feature", "--json", "--allow-degraded-preflight"], { cwd: repoRoot, encoding: "utf8", shell: false });
assert.equal(result.status, 0, result.stderr);
const route = JSON.parse(result.stdout);
const trace = validateRouteTrace(route.stages.map((stage, index) => ({ stage, context: index === 0 ? { graph: "checked" } : {} })), route.stages, ["graph"]);
assert.equal(trace.sequence.actual.length, route.stages.length);
assert.ok(Array.isArray(route.rationale?.conditionsMatched));
assert.ok(Array.isArray(route.rationale?.exclusions));
assert.ok(Array.isArray(route.rationale?.stateFactors));
assert.ok(route.rationale.stateFactors.length >= 1);
console.log("PASS trace contract route test suite");
