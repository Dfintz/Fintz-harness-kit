#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendError,
  MAX_LOGPROB_OPTIONS,
  OpenAiLogprobScorer,
} from "../decision-backend-openai.mjs";

const silentLogger = { write() {} };

function row(optionCount = 2) {
  return {
    id: "q1",
    state: { task: "route this" },
    question: "Which profile?",
    options: Array.from({ length: optionCount }, (_, index) => ({
      id: `opt-${index}`,
      description: `option ${index}`,
    })),
  };
}

function response({ top, model = "local-model", promptTokens = 42 }) {
  return {
    ok: true,
    json: async () => ({
      model,
      usage: { prompt_tokens: promptTokens },
      choices: [{ logprobs: { content: [{ token: top[0].token, logprob: top[0].logprob, top_logprobs: top }] } }],
    }),
  };
}

function stubFetch(handlers) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const handler = handlers[new URL(url).pathname];
    if (!handler) throw new Error(`unexpected path: ${url}`);
    return handler(calls.at(-1));
  };
  impl.calls = calls;
  return impl;
}

const modelsOk = () => ({ ok: true, json: async () => ({ data: [{ id: "local-model" }] }) });

async function startedScorer(fetchImpl, overrides = {}) {
  const scorer = new OpenAiLogprobScorer({ fetchImpl, logger: silentLogger, ...overrides });
  await scorer.start();
  return scorer;
}

test("resolves model identity from the server and reports unpinned revision", async () => {
  const scorer = await startedScorer(stubFetch({ "/v1/models": modelsOk }));
  assert.equal(scorer.ready(), true);
  assert.equal(scorer.metadata().source, "local-model");
  assert.equal(scorer.metadata().revision, "local-unpinned");
  assert.equal(scorer.metadata().backend, "openai-logprobs");
  assert.equal(scorer.metadata().residencyVerified, false);
});

test("maps label logprobs to a normalized distribution in option order", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () =>
      response({
        top: [
          { token: "B", logprob: Math.log(0.7) },
          { token: "A", logprob: Math.log(0.3) },
        ],
      }),
  });
  const scorer = await startedScorer(fetchImpl);
  const result = await scorer.score(row(2));

  assert.deepEqual(result.option_ids, ["opt-0", "opt-1"]);
  assert.equal(result.probabilities.length, 2);
  assert.ok(Math.abs(result.probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(result.probabilities[1] > result.probabilities[0]);
  assert.equal(result.input_tokens, 42);
});

test("sends a prefill-only request with logprobs enabled", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => response({ top: [{ token: "A", logprob: Math.log(0.9) }] }),
  });
  const scorer = await startedScorer(fetchImpl);
  await scorer.score(row(3));

  const body = fetchImpl.calls.at(-1).body;
  assert.equal(body.max_tokens, 1);
  assert.equal(body.temperature, 0);
  assert.equal(body.logprobs, true);
  assert.equal(body.top_logprobs, MAX_LOGPROB_OPTIONS);
  assert.equal(body.stream, false);
});

test("defaults to the Jev decision-function prompt layout", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => response({ top: [{ token: "A", logprob: Math.log(0.9) }] }),
  });
  const scorer = await startedScorer(fetchImpl);
  await scorer.score(row(2));

  const messages = fetchImpl.calls.at(-1).body.messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, "user");
  assert.match(messages[0].content, /\[State\][\s\S]*\[Question\][\s\S]*\[Options\][\s\S]*Answer:$/);
});

test("chat prompt style keeps the system-message layout", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => response({ top: [{ token: "A", logprob: Math.log(0.9) }] }),
  });
  const scorer = await startedScorer(fetchImpl, { promptStyle: "chat" });
  await scorer.score(row(2));

  const messages = fetchImpl.calls.at(-1).body.messages;
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "system");
  assert.match(messages[1].content, /State:[\s\S]*Options:[\s\S]*Question:/);
});

test("rejects an unknown prompt style", () => {
  assert.throws(
    () => new OpenAiLogprobScorer({ fetchImpl: async () => ({}), promptStyle: "nope" }),
    /unknown prompt style/,
  );
});

test("labels absent from the top-k receive floor mass instead of zero", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => response({ top: [{ token: "A", logprob: Math.log(0.99) }] }),
  });
  const scorer = await startedScorer(fetchImpl);
  const result = await scorer.score(row(4));

  assert.equal(result.probabilities.length, 4);
  for (const probability of result.probabilities) {
    assert.ok(probability > 0 && Number.isFinite(probability));
  }
  assert.ok(result.probabilities[0] > result.probabilities[1]);
});

test("rejects option sets beyond the top_logprobs ceiling", async () => {
  const scorer = await startedScorer(stubFetch({ "/v1/models": modelsOk }));
  await assert.rejects(
    () => scorer.score(row(MAX_LOGPROB_OPTIONS + 1)),
    (error) => error instanceof BackendError && error.code === "unsupported_option_count",
  );
});

test("rejects a response without token logprobs", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => ({ ok: true, json: async () => ({ model: "local-model", choices: [{}] }) }),
  });
  const scorer = await startedScorer(fetchImpl);
  await assert.rejects(
    () => scorer.score(row(2)),
    (error) => error instanceof BackendError && error.code === "missing_logprobs",
  );
});

test("detects a mid-session model swap and stays unready", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => response({ top: [{ token: "A", logprob: Math.log(0.9) }], model: "other-model" }),
  });
  const scorer = await startedScorer(fetchImpl);
  await assert.rejects(
    () => scorer.score(row(2)),
    (error) => error instanceof BackendError && error.code === "model_identity_changed",
  );
  assert.equal(scorer.ready(), false);
});

test("reports an unreachable server rather than throwing a transport error", async () => {
  const scorer = new OpenAiLogprobScorer({
    fetchImpl: async () => {
      throw new TypeError("connect ECONNREFUSED");
    },
    logger: silentLogger,
  });
  await assert.rejects(
    () => scorer.start(),
    (error) => error instanceof BackendError && error.code === "upstream_unreachable",
  );
  assert.equal(scorer.ready(), false);
});

test("bounds every request with the configured timeout", async () => {
  const scorer = new OpenAiLogprobScorer({
    requestTimeoutMs: 5,
    logger: silentLogger,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  await assert.rejects(
    () => scorer.start(),
    (error) => error instanceof BackendError && error.code === "upstream_timeout",
  );
});

test("warmup verifies residency with a single scoring request", async () => {
  const fetchImpl = stubFetch({
    "/v1/models": modelsOk,
    "/v1/chat/completions": () => response({ top: [{ token: "B", logprob: Math.log(0.8) }] }),
  });
  const scorer = await startedScorer(fetchImpl, { warmup: true });

  assert.equal(scorer.metadata().residencyVerified, true);
  assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v1/chat/completions")).length, 1);
});

test("honours an explicitly pinned model and revision without probing", async () => {
  const fetchImpl = stubFetch({});
  const scorer = await startedScorer(fetchImpl, { model: "pinned-model", revision: "abc123" });

  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(scorer.metadata().source, "pinned-model");
  assert.equal(scorer.metadata().revision, "abc123");
});
