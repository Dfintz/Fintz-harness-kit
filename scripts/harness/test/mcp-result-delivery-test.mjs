import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readOutputPolicy,
  OutputStore,
  buildDispatchReply,
  captureProcessOutput,
} from "../mcp-result-delivery.mjs";
import { connectMcpStdioTestClient } from "./mcp-stdio-test-client.mjs";

const caller = { callerId: "alice", token: "same-token-prefix-first", role: "auditor", teams: [], valid: true };
const other = { ...caller, token: "same-token-prefix-second" };
const payload = {
  ok: true, command: "fixture", exitCode: 0, status: "success",
  stdout: ('quotes " and unicode \u4e2d\u6587 \ud83d\ude00\n').repeat(1600) + "FINAL-MARKER\n",
  stderr: "", _outputCapture: { complete: true, reason: "complete" },
};

assert.equal(readOutputPolicy({}), null);
assert.equal(readOutputPolicy({ commandDispatch: { retainedOutput: { enabled: "true" } } }), null);
for (const responseBytes of [1, 8191, 65537, Number.NaN, 8192.5, "8192"]) {
  assert.equal(readOutputPolicy({ commandDispatch: { retainedOutput: { enabled: true, responseBytes } } }), null);
}
assert.equal(readOutputPolicy({ commandDispatch: { retainedOutput: { enabled: true } } }).responseBytes, 32768);
const clipped = captureProcessOutput({ status: 0, stdout: "x".repeat(200000), stderr: "" });
assert.equal(clipped._outputCapture.complete, false);
assert.ok(Buffer.byteLength(clipped.stdout) <= 128 * 1024);

let clock = 0;
const store = new OutputStore({ now: () => clock, ttlMs: 10, maxEntries: 1 });
const reply = buildDispatchReply(payload, { ok: true, store, caller, responseBytes: 8192 });
assert.ok(Buffer.byteLength(JSON.stringify(reply)) <= 8192);
assert.equal(reply._meta.provenance.untrusted_content, true);
assert.equal(reply.structuredContent.retainedOutput.state, "retained");
const reference = reply.structuredContent.retainedOutput.stdoutUri;
assert.equal(store.read(reference, other, () => true), null, "full token must bind identity");
assert.equal(store.read(reference, caller, () => false), null, "authorization must be rechecked");
assert.equal(store.read(reference, null, () => true), null, "missing caller must fail closed");
assert.equal(new OutputStore().read(reference, caller, () => true), null, "foreign session must fail");
let reconstructed = "";
let uri = reference;
while (uri) {
  const page = store.read(uri, caller, () => true);
  assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 8192);
  reconstructed += page.contents[0].text;
  uri = page._meta.coverage.nextUri;
}
assert.equal(reconstructed, payload.stdout);
assert.equal(store.retain(payload, caller).state, "capacity-exceeded");
clock = 11;
assert.equal(store.read(reference, caller, () => true), null, "expiry must remove references");
assert.equal(store.retain(payload, caller).state, "retained");
assert.equal(new OutputStore({ maxBytes: 8 }).retain(payload, caller).state, "capacity-exceeded");

process.env.HARNESS_TEST_SECRET = "redact-this-long-test-secret";
try {
  const secretPayload = {
    ...payload,
    stdout: process.env.HARNESS_TEST_SECRET + "\n" + "ghp_" + "x".repeat(30) + "\n",
    commandResolved: "echo " + process.env.HARNESS_TEST_SECRET,
  };
  const secretStore = new OutputStore();
  const safe = buildDispatchReply(secretPayload, { ok: true, store: secretStore, caller, responseBytes: 8192 });
  assert.ok(!JSON.stringify(safe).includes(process.env.HARNESS_TEST_SECRET));
  const safePage = secretStore.read(safe.structuredContent.retainedOutput.stdoutUri, caller, () => true);
  assert.ok(!safePage.contents[0].text.includes(process.env.HARNESS_TEST_SECRET));
  assert.ok(!safePage.contents[0].text.includes("ghp_"));
  const credentials = buildDispatchReply({ ...payload,
    stdout: "Bearer AbC123+/==\n-----BEGIN PRIVATE KEY-----\nprivate-bytes\n-----END PRIVATE KEY-----\n" },
    { ok: true, store: new OutputStore(), caller, responseBytes: 8192 });
  assert.ok(!JSON.stringify(credentials).includes("AbC123"));
  assert.ok(!JSON.stringify(credentials).includes("private-bytes"));
  const partial = buildDispatchReply({ ...secretPayload, stdout: "complete-line\n" + process.env.HARNESS_TEST_SECRET.slice(0, 12), _outputCapture: { complete: false, reason: "timeout" } },
    { ok: false, store: new OutputStore(), caller, responseBytes: 8192 });
  assert.equal(partial.structuredContent.stdout, "complete-line\n");
  assert.equal(partial.structuredContent.capture.complete, false);
} finally {
  delete process.env.HARNESS_TEST_SECRET;
}
const failed = buildDispatchReply({ ...payload, ok: false, exitCode: 7, status: "exit-nonzero" },
  { ok: false, store: new OutputStore(), caller, responseBytes: 8192 });
assert.equal(failed.isError, true);
assert.equal(failed.structuredContent.exitCode, 7);
assert.ok(Buffer.byteLength(JSON.stringify(failed)) <= 8192);
const oversized = buildDispatchReply({ ...payload, error: "x".repeat(100000) },
  { ok: false, store: new OutputStore(), caller, responseBytes: 8192 });
assert.equal(oversized.structuredContent.exitCode, 0);
assert.equal(oversized.structuredContent.ok, true);
assert.equal(oversized.structuredContent.status, "success");
assert.equal(oversized.isError, true, "transport overflow must not imply execution failure");
assert.ok(Buffer.byteLength(JSON.stringify(oversized)) <= 8192);
console.log("PASS delivery lifecycle, byte bounds, Unicode, redaction and status tests");

const directory = mkdtempSync(join(tmpdir(), "harness-output-test-"));
const configPath = join(directory, "config.json");
const fixturePath = join(directory, "fixture.cjs");
const counterPath = join(directory, "counter.txt");
writeFileSync(fixturePath, `const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(counterPath)}, 'executed\\n');
const mode = process.argv[2];
if (mode === 'overflow') process.stdout.write('x'.repeat(300000));
else if (mode === 'timeout') { console.log('partial-line'); setTimeout(() => {}, 5000); }
else { console.log(('quoted " \\u4e2d\\u6587 \\ud83d\\ude00\\n').repeat(1200) + 'FINAL-MARKER'); }
if (mode === 'failure') process.exitCode = 7;
`);
const config = {
  project: { name: "output-fixture" },
  commands: Object.fromEntries(["normal", "failure", "overflow", "timeout"].map(mode => [mode, `"${process.execPath}" "${fixturePath}" ${mode}`])),
  commandDispatch: {
    auth: { enabled: false }, rateLimit: { enabled: false }, timeoutMs: 1000,
    retainedOutput: { enabled: true, responseBytes: 8192 },
  },
};
const metadata = { "harness/caller": { caller: { id: "alice", token: caller.token, role: "auditor" } } };
const env = { HARNESS_CONFIG_PATH: configPath, HARNESS_PROJECT_ROOT: process.cwd(), HARNESS_REPO_ROOT: process.cwd() };
let connection;
let foreign;
try {
  writeFileSync(configPath, JSON.stringify(config));
  connection = await connectMcpStdioTestClient({ env });
  const success = await connection.client.callTool({ name: "harness-command-dispatch", arguments: { command: "normal" }, _meta: metadata });
  assert.equal(success.isError, undefined, connection.stderr() + JSON.stringify(success.structuredContent));
  assert.ok(Buffer.byteLength(JSON.stringify(success)) <= 8192);
  assert.equal(success.structuredContent.retainedOutput.state, "retained");
  const stdoutUri = success.structuredContent.retainedOutput.stdoutUri;
  const listed = await connection.client.listResources();
  assert.ok(!listed.resources.some(resource => resource.uri.includes("/output/")));
  let sdkText = "";
  let sdkUri = stdoutUri;
  while (sdkUri) {
    const page = await connection.client.readResource({ uri: sdkUri, _meta: metadata });
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 8192);
    sdkText += page.contents[0].text;
    sdkUri = page._meta.coverage.nextUri;
  }
  assert.ok(sdkText.endsWith("FINAL-MARKER\n"));
  assert.equal(readFileSync(counterPath, "utf8"), "executed\n", "resource reads must not rerun producer");
  await assert.rejects(connection.client.readResource({ uri: stdoutUri }));
  await assert.rejects(connection.client.readResource({ uri: stdoutUri, _meta: { "harness/caller": { caller: { id: "alice", token: other.token, role: "auditor" } } } }));
  foreign = await connectMcpStdioTestClient({ env });
  await assert.rejects(foreign.client.readResource({ uri: stdoutUri, _meta: metadata }));
  await assert.rejects(connection.client.readResource({ uri: "io.modelcontextprotocol/harness/output/missing/stdout/0", _meta: metadata }));
  const noCaller = await connection.client.callTool({ name: "harness-command-dispatch", arguments: { command: "normal" } });
  assert.equal(noCaller.structuredContent.retainedOutput.state, "missing-caller");
  assert.equal(noCaller.structuredContent.capture.complete, false);

  for (const command of ["failure", "timeout", "overflow"]) {
    const result = await connection.client.callTool({ name: "harness-command-dispatch", arguments: { command }, _meta: metadata });
    assert.equal(result.isError, true, command);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 8192, command);
    if (command === "failure") assert.equal(result.structuredContent.exitCode, 7);
    else assert.equal(result.structuredContent.capture.complete, false, command);
  }
  config.commandDispatch.auth = { enabled: true, rolePermissions: { auditor: [] } };
  writeFileSync(configPath, JSON.stringify(config));
  await assert.rejects(connection.client.readResource({ uri: stdoutUri, _meta: metadata }));
  config.commandDispatch.auth = { enabled: false };
  config.commandDispatch.retainedOutput.enabled = false;
  writeFileSync(configPath, JSON.stringify(config));
  const disabled = await connection.client.callTool({ name: "harness-command-dispatch", arguments: { command: "normal" }, _meta: metadata });
  assert.equal(disabled.structuredContent.retainedOutput, undefined);
  assert.ok(disabled.structuredContent.stdout.includes("truncated"));
  await assert.rejects(connection.client.readResource({ uri: stdoutUri, _meta: metadata }));
  console.log("PASS SDK output pages, identity, authorization, isolation, status and default-off tests");
} finally {
  await foreign?.close();
  await connection?.close();
  rmSync(directory, { recursive: true, force: true });
}
