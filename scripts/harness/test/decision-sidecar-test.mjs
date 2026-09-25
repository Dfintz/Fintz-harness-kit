#!/usr/bin/env node
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDecisionSidecar, SemifWorkerClient } from "../decision-sidecar.mjs";

const metadata = {
  source: "Qwen/Qwen3.5-4B",
  revision: "fixture-revision",
  backend: "torch",
  device: "cuda",
  dtype: "bfloat16",
};

function scorer() {
  return {
    ready: () => true,
    metadata: () => metadata,
    async score(row) {
      const optionIds = row.options.map((option) => option.id);
      const weights = optionIds.map((_, index) => index + 1);
      const total = weights.reduce((sum, value) => sum + value, 0);
      return {
        option_ids: optionIds,
        probabilities: weights.map((value) => value / total),
        input_tokens: 42,
        model: metadata,
        total_seconds: 0.01,
      };
    },
    close() {},
  };
}

async function runningSidecar(t, overrides = {}) {
  const sidecar = createDecisionSidecar({ scorer: scorer(), host: "127.0.0.1", port: 0, ...overrides });
  const address = await sidecar.listen();
  t.after(() => sidecar.close());
  return `http://127.0.0.1:${address.port}`;
}

test("health and readiness distinguish process from scorer", async (t) => {
  const base = await runningSidecar(t);
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: "ok" });
  const ready = await (await fetch(`${base}/ready`)).json();
  assert.equal(ready.status, "ready");
  assert.equal(ready.model.revision, "fixture-revision");
});

test("systemone maps choice score and noul with exact response fields", async (t) => {
  const base = await runningSidecar(t);
  const response = await fetch(`${base}/v1/systemone`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "semif-local",
      state: { task: "route this" },
      questions: {
        route: { type: "choice", criteria: { feature: "Full", coder: "Fast" } },
        effort: { type: "score", criteria: ["low", "medium", "high"] },
        enough: { type: "noul", instructions: "Is context sufficient?" },
      },
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["model", "answers", "usage"]);
  assert.equal(body.answers.route.choice, "coder");
  assert.deepEqual(Object.keys(body.answers.route.probabilities), ["feature", "coder"]);
  assert.equal(body.answers.effort.score, 4 / 3);
  assert.deepEqual(body.answers.effort.legend, { 0: "low", 1: "medium", 2: "high" });
  assert.equal(body.answers.enough.noul, 2 / 3);
  assert.deepEqual(body.usage, { input_tokens: 126, output_tokens: 0 });
});

test("invalid questions fail with JSON 422 and never reach the scorer", async (t) => {
  let calls = 0;
  const injected = scorer();
  const original = injected.score;
  injected.score = async (row) => { calls += 1; return original(row); };
  const sidecar = createDecisionSidecar({ scorer: injected, host: "127.0.0.1", port: 0 });
  const address = await sidecar.listen();
  t.after(() => sidecar.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/systemone`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "m", state: "x", questions: { bad: { type: "choice", criteria: { only: "one" } } } }),
  });
  assert.equal(response.status, 422);
  assert.equal(calls, 0);
  assert.equal((await response.json()).detail[0].error_type, "validation_error");
});

test("bounded queue rejects excess work", async (t) => {
  let release;
  const blocked = scorer();
  blocked.score = () => new Promise((resolve) => { release = () => resolve({
    option_ids: ["false", "true"], probabilities: [0.4, 0.6], input_tokens: 1, model: metadata,
  }); });
  const sidecar = createDecisionSidecar({ scorer: blocked, host: "127.0.0.1", port: 0, maxQueued: 0 });
  const address = await sidecar.listen();
  t.after(() => sidecar.close());
  const request = () => fetch(`http://127.0.0.1:${address.port}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "m", state: "x", questions: { q: { type: "noul" } } }),
  });
  const first = request();
  await new Promise((resolve) => setImmediate(resolve));
  const second = await request();
  assert.equal(second.status, 503);
  release();
  assert.equal((await first).status, 200);
});

test("choice ties preserve request order and mismatched model identity is rejected", async (t) => {
  const tied = scorer();
  tied.score = async (row) => ({
    option_ids: row.options.map((option) => option.id),
    probabilities: [0.5, 0.5],
    input_tokens: 1,
    model: metadata,
  });
  const base = await runningSidecar(t, { scorer: tied });
  const payload = { model: "m", state: "x", questions: { q: { type: "choice", criteria: { first: "A", second: "B" } } } };
  const tiedResponse = await fetch(`${base}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  const tiedBody = await tiedResponse.json();
  assert.equal(tiedBody.answers.q.choice, "first");
  assert.equal(tiedBody.answers.q.confidence, 0);

  const mismatched = scorer();
  mismatched.score = async (row) => ({
    option_ids: row.options.map((option) => option.id), probabilities: [0.5, 0.5], input_tokens: 1,
    model: { ...metadata, revision: "different-revision" },
  });
  const mismatchBase = await runningSidecar(t, { scorer: mismatched });
  const mismatchResponse = await fetch(`${mismatchBase}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(mismatchResponse.status, 502);
  assert.match((await mismatchResponse.json()).detail.message, /model identity changed/i);
});

test("disconnected active work is discarded without blocking later requests", async (t) => {
  let release;
  let markEntered;
  let calls = 0;
  const entered = new Promise((resolve) => { markEntered = resolve; });
  const blocked = scorer();
  blocked.score = async (row) => {
    calls += 1;
    if (calls === 1) {
      markEntered();
      await new Promise((resolve) => { release = resolve; });
    }
    return {
      option_ids: row.options.map((option) => option.id),
      probabilities: [0.4, 0.6], input_tokens: 1, model: metadata,
    };
  };
  const base = await runningSidecar(t, { scorer: blocked, maxQueued: 1 });
  const request = (signal) => fetch(`${base}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" }, signal,
    body: JSON.stringify({ model: "m", state: "x", questions: { q: { type: "noul" } } }),
  });
  const controller = new AbortController();
  const abandoned = request(controller.signal);
  await entered;
  controller.abort();
  await assert.rejects(abandoned, /abort/i);
  release();
  const later = await request();
  assert.equal(later.status, 200);
  assert.equal(calls, 2);
});

test("persistent worker accepts a ready frame and correlates responses", async (t) => {
  const path = join(tmpdir(), `semif-worker-fixture-${process.pid}-${Date.now()}.mjs`);
  await writeFile(path, `
    import readline from "node:readline";
    const model = ${JSON.stringify(metadata)};
    console.log(JSON.stringify({ version: 1, type: "ready", model }));
    const input = readline.createInterface({ input: process.stdin });
    input.on("line", line => {
      const frame = JSON.parse(line);
      console.log(JSON.stringify({ version: 1, id: frame.id, ok: true, result: {
        option_ids: frame.row.options.map(option => option.id), probabilities: [0.25, 0.75],
        input_tokens: 9, model,
      }}));
    });
  `);
  t.after(async () => { await import("node:fs/promises").then(({ rm }) => rm(path, { force: true })); });
  const worker = new SemifWorkerClient({ command: process.execPath, args: [path], startupTimeoutMs: 2000 });
  t.after(() => worker.close());
  assert.equal((await worker.start()).revision, "fixture-revision");
  const result = await worker.score({ id: "q", state: "x", question: "?", options: [
    { id: "false", description: "No" }, { id: "true", description: "Yes" },
  ] });
  assert.deepEqual(result.probabilities, [0.25, 0.75]);
});

test("late worker responses after timeout are discarded without losing readiness", async (t) => {
  const path = join(tmpdir(), `semif-worker-late-${process.pid}-${Date.now()}.mjs`);
  await writeFile(path, `
    import readline from "node:readline";
    const model = ${JSON.stringify(metadata)};
    let calls = 0;
    console.log(JSON.stringify({ version: 1, type: "ready", model }));
    readline.createInterface({ input: process.stdin }).on("line", line => {
      const frame = JSON.parse(line); calls += 1;
      const send = () => console.log(JSON.stringify({ version: 1, id: frame.id, ok: true, result: {
        option_ids: frame.row.options.map(option => option.id), probabilities: [0.25, 0.75],
        input_tokens: 9, model,
      }}));
      if (calls === 1) setTimeout(send, 60); else send();
    });
  `);
  t.after(async () => { await import("node:fs/promises").then(({ rm }) => rm(path, { force: true })); });
  const worker = new SemifWorkerClient({
    command: process.execPath, args: [path], startupTimeoutMs: 2000, requestTimeoutMs: 20,
  });
  t.after(() => worker.close());
  await worker.start();
  const row = { id: "q", state: "x", question: "?", options: [
    { id: "false", description: "No" }, { id: "true", description: "Yes" },
  ] };
  await assert.rejects(() => worker.score(row), /timed out/i);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(worker.ready(), true);
  assert.deepEqual((await worker.score(row)).probabilities, [0.25, 0.75]);
});

test("malformed worker output fails readiness", async (t) => {
  const path = join(tmpdir(), `semif-worker-bad-${process.pid}-${Date.now()}.mjs`);
  await writeFile(path, String.raw`process.stdout.write("not-json\n"); setInterval(() => {}, 1000);`);
  t.after(async () => { await import("node:fs/promises").then(({ rm }) => rm(path, { force: true })); });
  const worker = new SemifWorkerClient({ command: process.execPath, args: [path], startupTimeoutMs: 2000 });
  t.after(() => worker.close());
  await assert.rejects(() => worker.start(), /malformed JSON/i);
  assert.equal(worker.ready(), false);
});
