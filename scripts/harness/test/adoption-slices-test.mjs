import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateRouteTrace } from "../trace-contract.mjs";
import { hookIdentity, mergeHookManifests, stripHooks } from "../hook-manifest.mjs";
import { renderHookCommand } from "../hook-command-guard.mjs";
import { compareProviderTrees } from "../provider-drift-report.mjs";
import { listPolicyRules, runPolicyDetectors } from "../policy-detector-registry.mjs";
import { planJournalRetention } from "../journal-retention.mjs";
import { buildShortcutScript } from "../shortcut-generator.mjs";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const trace = validateRouteTrace(
  [{ stage: "understand", context: { graph: "fresh" } }, { stage: "architect" }, { stage: "architect-challenge" }, { stage: "implement" }, { stage: "review-breadth" }, { stage: "review-depth" }, { stage: "feedback" }],
  ["understand", "architect", "architect-challenge", "implement", "review-breadth", "review-depth", "feedback"],
  ["graph"],
);
assert.equal(trace.context.missing.length, 0);

const baseHooks = { version: 1, metadata: { source: "base" }, hooks: [{ provider: "copilot", event: "pre", command: "a", options: { z: 1, a: 2 } }] };
const incomingHooks = { version: 2, metadata: { source: "incoming" }, hooks: [{ provider: "copilot", event: "pre", command: "a", options: { a: 2, z: 1 } }, { provider: "claude", event: "post", command: "b" }, null] };
const baseHooksSnapshot = JSON.stringify(baseHooks);
const incomingHooksSnapshot = JSON.stringify(incomingHooks);
const merged = mergeHookManifests(baseHooks, incomingHooks);
assert.equal(merged.manifest.hooks.length, 2);
assert.deepEqual(merged.findings.map((finding) => finding.code), ["duplicate-hook", "invalid-hook-entry", "metadata-conflict", "metadata-conflict"]);
assert.equal(hookIdentity(merged.manifest.hooks[0]), "copilot\u0000pre\u0000a");
assert.equal(merged.manifest.hooks[0].options.z, 1, "first-seen hook payload should win");
assert.equal(stripHooks(merged.manifest, (entry) => entry.command === "b").removed.length, 1);
assert.equal(JSON.stringify(baseHooks), baseHooksSnapshot, "merge must not mutate base input");
assert.equal(JSON.stringify(incomingHooks), incomingHooksSnapshot, "merge must not mutate incoming input");
assert.equal(merged.manifest.version, 2, "incoming metadata should be retained");
const payloadConflict = mergeHookManifests(
  { hooks: [{ provider: "p", event: "pre", command: "run", args: ["safe"] }] },
  { hooks: [{ provider: "p", event: "pre", command: "run", args: ["changed"] }] },
);
assert.equal(payloadConflict.findings.some((finding) => finding.code === "hook-payload-conflict"), true);
const malformedMerge = mergeHookManifests({ hooks: [{ event: "pre", command: "safe" }] }, { hooks: "malformed", owner: "incoming" });
assert.equal(malformedMerge.manifest.hooks.length, 1, "malformed incoming hooks must not erase valid base hooks");
assert.equal(malformedMerge.findings[0].code, "invalid-hooks-container");
assert.equal(malformedMerge.manifest.owner, "incoming", "incoming-only metadata should be retained");
const malformedStrip = stripHooks({ hooks: "malformed", owner: "safe" }, () => true);
assert.equal(malformedStrip.findings[0].code, "invalid-hooks-container");
assert.equal(malformedStrip.manifest.hooks, "malformed", "strip must not silently repair malformed input");
const emptyMerge = mergeHookManifests({}, {});
assert.deepEqual(emptyMerge.manifest.hooks, []);
assert.deepEqual(emptyMerge.findings, []);
const missingHooksMerge = mergeHookManifests({ version: 1 }, { version: 2 });
assert.deepEqual(missingHooksMerge.manifest.hooks, []);
assert.equal(missingHooksMerge.findings.filter((finding) => finding.code === "metadata-conflict").length, 1);
assert.deepEqual(mergeHookManifests({ hooks: [] }, { hooks: [] }).manifest.hooks, []);
const fallbackIdentity = mergeHookManifests(
  { hooks: [{ provider: "fallback", type: "pre", run: "node task" }] },
  { hooks: [{ provider: "fallback", event: "pre", command: "node task" }] },
);
assert.equal(fallbackIdentity.findings.some((finding) => finding.code === "duplicate-hook"), true);
const stripAll = stripHooks({ hooks: [{ command: "a" }, { command: "b" }] }, () => true);
assert.equal(stripAll.removed.length, 2);
assert.deepEqual(stripAll.manifest.hooks, []);

assert.equal(renderHookCommand("posix", ["node", "a b", "x'y"]), String.raw`'node' 'a b' 'x'\''y'`);
assert.equal(renderHookCommand("cmd", ["node", "100%", 'a"b']), String.raw`"node" "100%%" "a\"b"`);
assert.equal(renderHookCommand("powershell", ["node", "a b", "x'y"]), "'node' 'a b' 'x''y'");
assert.throws(() => renderHookCommand("bad", ["node"]), /unsupported/);

const root = mkdtempSync(join(tmpdir(), "harness-adoption-"));
try {
const canonical = join(root, "canonical");
const installed = join(root, "installed");
mkdirSync(join(canonical, "skill", "agents"), { recursive: true });
mkdirSync(join(installed, "skill", "agents"), { recursive: true });
writeFileSync(join(canonical, "skill", "SKILL.md"), "canonical\n");
writeFileSync(join(installed, "skill", "SKILL.md"), "changed\n");
const contentReport = compareProviderTrees(canonical, [installed]);
assert.equal(contentReport.driftCount, 1);
assert.equal(contentReport.drifts[0].code, "content-drift");
assert.equal(contentReport.drifts[0].canonicalSha256, createHash("sha256").update("canonical\n").digest("hex"));
assert.equal(contentReport.drifts[0].installedSha256, createHash("sha256").update("changed\n").digest("hex"));
const cleanInstalled = join(root, "clean-installed");
mkdirSync(join(cleanInstalled, "skill", "agents"), { recursive: true });
writeFileSync(join(cleanInstalled, "skill", "SKILL.md"), "canonical\n");
writeFileSync(join(canonical, "skill", "agents", "openai.yaml"), "sidecar\n");
writeFileSync(join(cleanInstalled, "skill", "agents", "openai.yaml"), "sidecar\n");
mkdirSync(join(canonical, "nested", "arbitrary"), { recursive: true });
mkdirSync(join(cleanInstalled, "nested", "arbitrary"), { recursive: true });
writeFileSync(join(canonical, "nested", "arbitrary", "SKILL.md"), "ignored\n");
writeFileSync(join(cleanInstalled, "nested", "arbitrary", "SKILL.md"), "different\n");
const cleanReport = compareProviderTrees(canonical, [cleanInstalled, cleanInstalled]);
assert.equal(cleanReport.driftCount, 0, "identical valid shapes and ignored nested files should be clean");
assert.equal(cleanReport.installedRoots.length, 1, "duplicate roots should be deduplicated");
const extraInstalled = join(root, "extra-installed");
mkdirSync(join(extraInstalled, "bonus", "agents"), { recursive: true });
writeFileSync(join(extraInstalled, "bonus", "SKILL.md"), "bonus\n");
writeFileSync(join(extraInstalled, "bonus", "agents", "openai.yaml"), "bonus\n");
const extraReport = compareProviderTrees(canonical, [extraInstalled]);
assert.equal(extraReport.drifts.filter((drift) => drift.code === "extra-installed").length, 2);
const missingInstalled = join(root, "missing-installed");
mkdirSync(missingInstalled, { recursive: true });
const missingReport = compareProviderTrees(canonical, [missingInstalled]);
assert.equal(missingReport.drifts.filter((drift) => drift.code === "missing-installed").length, 2);
const missingRoot = join(root, "missing-root");
const missingRootReport = compareProviderTrees(canonical, [missingRoot]);
assert.equal(missingRootReport.drifts.filter((drift) => drift.code === "missing-installed").length, 2);
const driftCli = join(process.cwd(), "scripts", "harness", "provider-drift-report.mjs");
const cleanCli = spawnSync(process.execPath, [driftCli, "--canonical-root", canonical, "--installed-root", cleanInstalled, "--json"], { encoding: "utf8", shell: false });
assert.equal(cleanCli.status, 0, "explicit clean roots should exit 0");
const cleanCliPayload = JSON.parse(cleanCli.stdout);
assert.deepEqual(cleanCliPayload.installedRoots, [resolve(cleanInstalled)]);
const driftCliResult = spawnSync(process.execPath, [driftCli, "--canonical-root", canonical, "--installed-root", installed], { encoding: "utf8", shell: false });
assert.equal(driftCliResult.status, 1, "explicit drift roots should exit 1");
const invalidCli = spawnSync(process.execPath, [driftCli, "--unknown"], { encoding: "utf8", shell: false });
assert.equal(invalidCli.status, 2, "unknown drift CLI options should exit 2");

const hookGuardCli = join(process.cwd(), "scripts", "harness", "hook-command-guard.mjs");
const hookGuardCliResult = spawnSync(
  process.execPath,
  [
    hookGuardCli,
    "--platform",
    "powershell",
    "--arg",
    "node",
    "--arg",
    "C:/Path With Space/run.mjs",
    "--arg",
    "O'Hara",
  ],
  { encoding: "utf8", shell: false },
);
assert.equal(hookGuardCliResult.status, 0, "hook-command-guard CLI should succeed");
assert.equal(
  hookGuardCliResult.stdout.trim(),
  "'node' 'C:/Path With Space/run.mjs' 'O''Hara'",
  "hook-command-guard CLI should output platform-safe quoting",
);
const hookGuardCliInvalid = spawnSync(process.execPath, [hookGuardCli, "--arg", "node"], {
  encoding: "utf8",
  shell: false,
});
assert.equal(hookGuardCliInvalid.status, 2, "hook-command-guard CLI should fail on missing platform");

assert.equal(listPolicyRules("document").length, 5);
const destructiveRule = listPolicyRules("document").find((rule) => rule.id === "destructive-shell-example");
assert.deepEqual(Object.keys(destructiveRule).sort((left, right) => left.localeCompare(right)), ["advisory", "id", "message", "scope", "severity"]);
assert.equal(runPolicyDetectors("maxIterations: 0").some((finding) => finding.id === "unbounded-loop-field"), true);
assert.equal(runPolicyDetectors("maxIterations: -1").some((finding) => finding.id === "unbounded-loop-field"), true);
assert.equal(runPolicyDetectors("maxIterations: 5").some((finding) => finding.id === "unbounded-loop-field"), false);
assert.equal(runPolicyDetectors("```sh\nrm -rf ./build\n```").some((finding) => finding.id === "destructive-shell-example"), true);
assert.equal(runPolicyDetectors("rm -rf ./build").some((finding) => finding.id === "destructive-shell-example"), false);
assert.equal(runPolicyDetectors("kind: convergence\nmaxIterations: 0").some((finding) => finding.id === "convergence-loop-unbounded"), true);
assert.equal(runPolicyDetectors("kind: convergence\nnotes: prose\nmaxIterations: 3").some((finding) => finding.id === "convergence-loop-unbounded"), false);
assert.equal(runPolicyDetectors("Gate status: pass").some((finding) => finding.id === "ambiguous-gate-status"), true);
assert.equal(runPolicyDetectors("The test status: pass is recorded in the report.").some((finding) => finding.id === "ambiguous-gate-status"), false);
assert.equal(runPolicyDetectors("kind: convergence\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nmaxIterations: 5").some((finding) => finding.id === "convergence-loop-unbounded"), true);
assert.deepEqual(runPolicyDetectors("kind: convergence\nmaxIterations: 3", "repository"), []);
const verifier = join(process.cwd(), "scripts", "harness", "doc-verifier.mjs");
const fixture = join(root, "policy.md");
writeFileSync(fixture, "# Policy fixture\n\nmaxIterations: 0\n");
const verifierResult = spawnSync(process.execPath, [verifier, "--file", fixture], { encoding: "utf8", shell: false });
assert.equal(verifierResult.status, 1, "error-level policy detector should fail the verifier CLI");
const destructiveFixture = join(root, "destructive.md");
writeFileSync(destructiveFixture, "# Example\n```sh\nrm -rf ./build\n```\n");
const verifierThresholds = ["--min-score", "0", "--min-words", "1"];
const destructiveResult = spawnSync(process.execPath, [verifier, "--file", destructiveFixture, ...verifierThresholds], { encoding: "utf8", shell: false });
assert.equal(destructiveResult.status, 0, "advisory destructive detector should not fail the verifier CLI");
const convergenceFixture = join(root, "convergence.md");
writeFileSync(convergenceFixture, "# Loop\nkind: convergence\nmaxIterations: 0\n");
const convergenceResult = spawnSync(process.execPath, [verifier, "--file", convergenceFixture, ...verifierThresholds], { encoding: "utf8", shell: false });
assert.equal(convergenceResult.status, 1, "error convergence detector should fail the verifier CLI");
assert.equal(buildShortcutScript({ "harness-route": "harness:route" }).includes("Generated by"), true);
writeFileSync(join(root, "old.json"), JSON.stringify({ loop: "old", iterations: [], finishedAt: new Date(Date.now() - 86400000).toISOString() }));
writeFileSync(join(root, "new.json"), JSON.stringify({ loop: "new", iterations: [], finishedAt: new Date().toISOString() }));
const retention = planJournalRetention(root, { maxCount: 1, now: Date.now() });
assert.equal(retention.retain.length, 1);
assert.equal(retention.delete.length, 1);

console.log("PASS adoption slices test suite");
} finally {
  rmSync(root, { recursive: true, force: true });
}
