#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import { BackendError } from "../decision-backend-openai.mjs";
import { HostedSystemOneScorer, resolveHostedDecisionProvider } from "../decision-backend-systemone.mjs";
import { createDecisionSidecar } from "../decision-sidecar.mjs";

const silentLogger = { write() {} };
const key = "jev-secret-value";
const azureKey = "azure-secret-value";

function row(id = "q1") {
  return {
    id,
    state: { task: "route" },
    question: "Which option?",
    options: [{ id: "first", description: "First" }, { id: "second", description: "Second" }],
  };
}

function reply(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function fetchStub(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return handler(calls.at(-1));
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jev(fetchImpl, overrides = {}) {
  return new HostedSystemOneScorer({
    provider: "jev",
    endpoint: "http://127.0.0.1:4444/systemone",
    model: "jev-2026-10",
    revision: "revision",
    apiKey: key,
    fetchImpl,
    logger: silentLogger,
    ...overrides,
  });
}

test("resolver gives explicit valid overrides precedence and fails closed", () => {
  const resolved = resolveHostedDecisionProvider({
    HARNESS_DECISION_HOSTED_PROVIDER: "foundry",
    HARNESS_DECISION_FOUNDRY_ENDPOINT: "https://foundry.example",
    TYPESAFE_API_KEY: key,
  });
  assert.equal(resolved.provider, "foundry");
  assert.equal(resolveHostedDecisionProvider({ TYPESAFE_API_KEY: ` ${key} ` }).provider, "jev");
  assert.equal(resolveHostedDecisionProvider({ HARNESS_DECISION_FOUNDRY_ENDPOINT: "https://foundry.example" }).provider, "foundry");
  assert.equal(resolveHostedDecisionProvider({}), null);
  assert.throws(() => resolveHostedDecisionProvider({ HARNESS_DECISION_HOSTED_PROVIDER: "nope" }), /jev.*foundry/i);
  assert.throws(() => resolveHostedDecisionProvider({ HARNESS_DECISION_HOSTED_PROVIDER: "jev" }), /TYPESAFE_API_KEY/);
  assert.throws(() => resolveHostedDecisionProvider({ HARNESS_DECISION_HOSTED_PROVIDER: "foundry" }), /FOUNDRY_ENDPOINT/);
});

test("hosted endpoints require https except loopback", () => {
  assert.throws(() => jev(async () => reply({}), { endpoint: "http://example.test/systemone" }), /https/i);
  assert.doesNotThrow(() => jev(async () => reply({}), { endpoint: "https://example.test/systemone" }));
  assert.doesNotThrow(() => jev(async () => reply({}), { endpoint: "http://localhost:4444/systemone" }));
});

test("Jev sends bearer authentication and row-shaped System One requests", async () => {
  const fetchImpl = fetchStub(() => reply({
    model: "jev-2026-10",
    usage: { input_tokens: 7 },
    answers: { q1: { choice: "ignored", probabilities: { second: 3, first: 1 } } },
  }));
  const scorer = jev(fetchImpl);
  await scorer.start();
  const result = await scorer.score(row());
  assert.equal(fetchImpl.calls[0].init.headers.authorization, `Bearer ${key}`);
  assert.deepEqual(fetchImpl.calls[0].body, {
    model: "jev-2026-10",
    state: { task: "route" },
    questions: { q1: { type: "choice", instructions: "Which option?", criteria: { first: "First", second: "Second" } } },
  });
  assert.deepEqual(result.probabilities, [1, 3]);
  assert.equal(result.input_tokens, 7);
  assert.equal(scorer.metadata().revisionPinned, true);
});

test("Foundry uses Entra auth or startup-only api-key fallback", async () => {
  const entraFetch = fetchStub(() => reply({
    model: "Decision-1",
    answers: { q1: { probabilities: { first: 1, second: 2 } } },
  }));
  const entra = new HostedSystemOneScorer({
    provider: "foundry", endpoint: "https://foundry.example", deployment: "decision-deployment",
    fetchImpl: entraFetch, tokenProvider: async () => ({ accessToken: "token-value", expiresOn: Date.now() + 3600000 }),
    logger: silentLogger,
  });
  await entra.start();
  await entra.score(row());
  assert.equal(entra.metadata().authMode, "entra");
  assert.equal(entraFetch.calls[0].url, "https://foundry.example/providers/microsoft/v1/systemone");
  assert.equal(entraFetch.calls[0].init.headers.authorization, "Bearer token-value");

  const fallbackFetch = fetchStub(() => reply({ answers: { q1: { probabilities: { first: 1, second: 2 } } } }));
  const fallback = new HostedSystemOneScorer({
    provider: "foundry", endpoint: "https://foundry.example", deployment: "decision-deployment", apiKey: azureKey,
    fetchImpl: fallbackFetch, tokenProvider: async () => { throw new Error("unavailable"); }, logger: silentLogger,
  });
  await fallback.start();
  await fallback.score(row());
  assert.equal(fallback.metadata().authMode, "api-key");
  assert.equal(fallbackFetch.calls[0].init.headers["api-key"], azureKey);
});

test("expired Entra token fails closed without invoking token provider from score", async () => {
  let calls = 0;
  const scorer = new HostedSystemOneScorer({
    provider: "foundry", endpoint: "https://foundry.example", deployment: "decision",
    fetchImpl: async () => { throw new Error("must not fetch"); },
    tokenProvider: async () => ({ accessToken: "expired", expiresOn: Date.now() - 1 }),
    refreshWindowMs: 0, logger: silentLogger,
  });
  const original = scorer.tokenProvider;
  scorer.tokenProvider = async (...args) => { calls += 1; return original(...args); };
  await scorer.start();
  assert.equal(calls, 1);
  await assert.rejects(() => scorer.score(row()), (error) => error.code === "auth_expired");
  assert.equal(calls, 1);
});

test("strict response validation rejects malformed probability maps", async () => {
  const invalids = [
    { answers: {} },
    { answers: { q1: { probabilities: { first: 1 } } } },
    { answers: { q1: { probabilities: { first: 1, second: 2, extra: 3 } } } },
    { answers: { other: { probabilities: { first: 1, second: 2 } } } },
    { answers: { q1: { probabilities: { first: -1, second: 2 } } } },
    { answers: { q1: { probabilities: { first: Number.NaN, second: 2 } } } },
  ];
  for (const payload of invalids) {
    const scorer = jev(fetchStub(() => reply({ ...payload, model: "jev-2026-10" })));
    await scorer.start();
    await assert.rejects(() => scorer.score(row()), (error) => error instanceof BackendError && error.code === "invalid_response");
  }
});

test("pinned Jev identity changes fail closed", async () => {
  const scorer = jev(fetchStub(() => reply({
    model: "other", answers: { q1: { probabilities: { first: 1, second: 2 } } },
  })));
  await scorer.start();
  await assert.rejects(() => scorer.score(row()), (error) => error.code === "model_identity_changed");
  assert.equal(scorer.ready(), false);
});

test("timeouts and non-success statuses are sanitized BackendErrors", async () => {
  const timed = jev((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  }), { requestTimeoutMs: 5 });
  await timed.start();
  await assert.rejects(() => timed.score(row()), (error) => error.code === "upstream_timeout");
  const unauthorized = jev(fetchStub(() => reply({ sensitive: key }, 401)));
  await unauthorized.start();
  await assert.rejects(() => unauthorized.score(row()), (error) => error.code === "upstream_auth" && !error.message.includes(key));
});

test("sidecar maps choice, score, and noul using upstream probabilities in row order", async (t) => {
  const fetchImpl = fetchStub((call) => {
    const id = Object.keys(call.body.questions)[0];
    const criteria = call.body.questions[id].criteria;
    const reversed = Object.fromEntries(Object.keys(criteria).reverse().map((option, index) => [option, index + 1]));
    return reply({ model: "jev-2026-10", answers: { [id]: { choice: "ignored", probabilities: reversed } } });
  });
  const scorer = jev(fetchImpl);
  await scorer.start();
  const sidecar = createDecisionSidecar({ scorer, host: "127.0.0.1", port: 0 });
  const address = await sidecar.listen();
  t.after(() => sidecar.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "hosted", state: "x",
      questions: {
        pick: { type: "choice", criteria: { alpha: "Alpha", beta: "Beta" } },
        level: { type: "score", criteria: ["Low", "High"] },
        enough: { type: "noul" },
      },
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.answers.pick.type, "choice");
  assert.deepEqual(Object.keys(body.answers.pick.probabilities), ["alpha", "beta"]);
  assert.equal(typeof body.answers.level.score, "number");
  assert.equal(typeof body.answers.enough.noul, "number");
});

test("credentials never appear in metadata, errors, or sidecar error bodies", async (t) => {
  const scorer = jev(fetchStub(() => reply({ echoed: key }, 401)));
  await scorer.start();
  const serializedMetadata = JSON.stringify(scorer.metadata());
  assert.equal(serializedMetadata.includes(key), false);
  await assert.rejects(() => scorer.score(row()), (error) => !String(error.message).includes(key));
  const sidecar = createDecisionSidecar({ scorer, host: "127.0.0.1", port: 0 });
  const address = await sidecar.listen();
  t.after(() => sidecar.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "m", state: "x", questions: { q1: { type: "noul" } } }),
  });
  assert.equal(JSON.stringify(await response.json()).includes(key), false);
  assert.equal(JSON.stringify(scorer.metadata()).includes(azureKey), false);
});

test("request deadline aborts upstream work and returns deadline_exceeded", async (t) => {
  let upstreamAborted = false;
  const scorer = jev((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      upstreamAborted = true;
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  }), { requestTimeoutMs: 1000 });
  await scorer.start();
  const sidecar = createDecisionSidecar({ scorer, host: "127.0.0.1", port: 0, requestDeadlineMs: 10 });
  const address = await sidecar.listen();
  t.after(() => sidecar.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/systemone`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "m", state: "x", questions: { q1: { type: "noul" } } }),
  });
  assert.equal(response.status, 504);
  assert.equal((await response.json()).detail.error_type, "deadline_exceeded");
  assert.equal(upstreamAborted, true);
});
