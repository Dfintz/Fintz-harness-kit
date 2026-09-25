#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const router = join(repoRoot, "scripts", "harness", "prompt-router.mjs");

function run(root, args) {
  return spawnSync(process.execPath, [router, ...args, "--repo-root", root, "--allow-degraded-preflight"], {
    cwd: repoRoot,
    shell: false,
    encoding: "utf8",
    env: { ...process.env, HARNESS_PROJECT_ROOT: root },
  });
}

async function startFixture(root) {
  const countFile = join(root, "calls.txt");
  const serverFile = join(root, "server.mjs");
  await writeFile(countFile, "0", "utf8");
  await writeFile(serverFile, `
    import { createServer } from "node:http";
    import { readFileSync, writeFileSync } from "node:fs";
    const countFile = process.argv[2];
    const server = createServer(async (req, res) => {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      const ids = Object.keys(body.questions.intent_profile.criteria);
      const probabilities = Object.fromEntries(ids.map((id, index) => [id, index === 0 ? 0.9 : 0.1 / (ids.length - 1)]));
      writeFileSync(countFile, String(Number(readFileSync(countFile, "utf8")) + 1));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ model: "fixture@revision", answers: { intent_profile: {
        type: "choice", choice: ids[0], probabilities, confidence: 0.88,
      } }, usage: { input_tokens: 10, output_tokens: 0 } }));
    });
    server.listen(0, "127.0.0.1", () => console.log(server.address().port));
  `, "utf8");
  const child = spawn(process.execPath, [serverFile, countFile], { stdio: ["ignore", "pipe", "inherit"] });
  const port = await new Promise((resolvePort, reject) => {
    child.once("error", reject);
    child.stdout.once("data", (chunk) => resolvePort(Number(String(chunk).trim())));
  });
  return { child, countFile, port };
}

const root = await mkdtemp(join(tmpdir(), "harness-decision-router-"));
try {
  const config = JSON.parse(readFileSync(join(repoRoot, "harness.config.json"), "utf8"));
  const fixture = await startFixture(root);
  const task = "private sidecar integration task";
  config.modelPolicy.localDecisionSidecar.enabled = false;
  await writeFile(join(root, "harness.config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const disabled = run(root, ["route", "--profile", "feature", "--task", task, "--json"]);
  assert.equal(disabled.status, 0, disabled.stderr);
  const disabledRoute = JSON.parse(disabled.stdout);
  assert.equal(disabledRoute.decisionAdvisory, undefined);
  assert.equal(Number(await readFile(fixture.countFile, "utf8")), 0);

  config.modelPolicy.localDecisionSidecar.enabled = true;
  config.modelPolicy.localDecisionSidecar.endpoint = `http://127.0.0.1:${fixture.port}`;
  config.modelPolicy.localDecisionSidecar.timeoutMs = 1000;
  await writeFile(join(root, "harness.config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const routed = run(root, ["route", "--profile", "feature", "--task", task, "--json"]);
  assert.equal(routed.status, 0, routed.stderr);
  const route = JSON.parse(routed.stdout);
  assert.equal(route.profile, "feature");
  assert.equal(route.mode, disabledRoute.mode);
  assert.deepEqual(route.stages, disabledRoute.stages);
  assert.deepEqual(route.models, disabledRoute.models);
  assert.equal(route.why, disabledRoute.why);
  assert.equal(route.decisionAdvisory.status, "matched");
  assert.equal(route.decisionAdvisory.agreement, false);
  assert.ok(route.runId);

  const runDir = join(root, ".github", "harness", "runs", "feature-runs", route.runId);
  const receiptPath = join(runDir, "decision-advisory.json");
  assert.ok(existsSync(receiptPath));
  const receiptText = readFileSync(receiptPath, "utf8");
  assert.ok(!receiptText.includes(task));
  assert.ok(Buffer.byteLength(receiptText) <= 16 * 1024);

  const handoff = run(root, ["handoff", "--profile", "feature", "--task", task]);
  assert.equal(handoff.status, 0, handoff.stderr);
  assert.match(handoff.stdout, /decision receipt:/i);
  const pack = run(root, ["prompt-pack", "--profile", "feature", "--task", task, "--json"]);
  assert.equal(pack.status, 0, pack.stderr);
  assert.equal(Number(await readFile(fixture.countFile, "utf8")), 1, "sticky receipt should avoid repeat inference");

  const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
  assert.match(manifest.artifacts.decisionAdvisory, /decision-advisory\.json$/);

  await rm(receiptPath, { force: true });
  await mkdir(receiptPath);
  config.modelPolicy.localDecisionSidecar.policyId = "intent-profile-shadow-v2";
  await writeFile(join(root, "harness.config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const writeFailure = run(root, ["route", "--profile", "feature", "--task", task, "--json"]);
  assert.equal(writeFailure.status, 0, writeFailure.stderr);
  assert.match(writeFailure.stderr, /receipt was not persisted/i);
  assert.equal(JSON.parse(writeFailure.stdout).decisionAdvisory, undefined);
  fixture.child.kill();

  const unavailableRoot = await mkdtemp(join(tmpdir(), "harness-decision-unavailable-"));
  try {
    config.modelPolicy.localDecisionSidecar.endpoint = "http://127.0.0.1:9";
    await writeFile(join(unavailableRoot, "harness.config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    const unavailable = run(unavailableRoot, ["route", "--profile", "feature", "--task", "unavailable sidecar", "--json"]);
    assert.equal(unavailable.status, 0, unavailable.stderr);
    const fallback = JSON.parse(unavailable.stdout);
    assert.equal(fallback.profile, "feature");
    assert.equal(fallback.decisionAdvisory.status, "unavailable");
  } finally {
    await rm(unavailableRoot, { recursive: true, force: true });
  }

  process.stdout.write("PASS decision router integration\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
