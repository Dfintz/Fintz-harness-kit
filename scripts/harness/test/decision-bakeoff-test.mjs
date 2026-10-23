#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertLoopback, rankResults, summariseRun, validateMatrix } from "../decision-bakeoff.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function measured(id, metrics) {
  return {
    id,
    status: "measured",
    metrics: { correct: 0, wrong: 0, abstained: 0, unavailable: 0, confidentWrong: 0, latencyMs: { median: 100 }, ...metrics },
  };
}

test("committed candidate matrix validates", () => {
  const matrix = JSON.parse(readFileSync(join(root, ".github", "harness", "eval", "decision-bakeoff-candidates.json"), "utf8"));
  assert.equal(validateMatrix(matrix), matrix);
});

test("matrix rejects duplicate ids, unknown styles and non-loopback endpoints", () => {
  const base = { schemaVersion: 1, ollamaEndpoint: "http://127.0.0.1:11434" };
  const logprob = { id: "a", kind: "ollama-logprob", model: "m", promptStyles: ["jev"] };
  assert.throws(() => validateMatrix({ ...base, candidates: [logprob, logprob] }), /duplicate/);
  assert.throws(() => validateMatrix({ ...base, candidates: [{ ...logprob, promptStyles: ["xml"] }] }), /unknown prompt style/);
  assert.throws(() => validateMatrix({ ...base, ollamaEndpoint: "http://10.0.0.5:11434", candidates: [logprob] }), /loopback/);
  assert.throws(
    () => validateMatrix({ ...base, candidates: [{ id: "e", kind: "systemone-endpoint", endpoint: "https://api.example.com", models: ["x"] }] }),
    /loopback/,
  );
  assert.equal(assertLoopback("http://localhost:8765/v1", "x"), "http://localhost:8765");
});

test("confident-wrong and unavailable rows are disqualified regardless of accuracy", () => {
  const outcome = rankResults([
    measured("loud", { correct: 11, wrong: 1, confidentWrong: 1 }),
    measured("flaky", { correct: 12, unavailable: 1 }),
    measured("careful", { correct: 8, abstained: 4 }),
  ]);
  assert.equal(outcome.bestCandidate, "careful");
  assert.deepEqual(outcome.ranked.map((row) => row.disqualifiedBy), [null, "sidecar-unavailable", "confident-wrong"]);
});

test("ties break on wrong, abstentions, latency, then id", () => {
  const outcome = rankResults([
    measured("b-slow", { correct: 9, abstained: 3, latencyMs: { median: 200 } }),
    measured("a-fast", { correct: 9, abstained: 3, latencyMs: { median: 80 } }),
    measured("c-abstains", { correct: 9, abstained: 3, wrong: 0, latencyMs: { median: 80 } }),
    measured("d-wrong", { correct: 9, wrong: 1, abstained: 2 }),
  ]);
  assert.deepEqual(outcome.ranked.map((row) => row.id), ["a-fast", "c-abstains", "b-slow", "d-wrong"]);
  assert.deepEqual(outcome.ranked.map((row) => row.rank), [1, 2, 3, 4]);
});

test("no eligible candidate yields a null best candidate", () => {
  const outcome = rankResults([{ id: "x", status: "not-installed" }, { id: "y", status: "warmup-failed" }]);
  assert.equal(outcome.bestCandidate, null);
  assert.ok(outcome.ranked.every((row) => row.rank === undefined));
});

test("run summary reports coverage and warm latency excluding unavailable rows", () => {
  const metrics = summariseRun({
    summary: { total: 4, sidecar: { correct: 2, wrong: 1, abstained: 1 }, deterministic: { correct: 3 }, unavailable: 0, confidentWrong: 0 },
    rows: [
      { status: "matched", latencyMs: 10 },
      { status: "matched", latencyMs: 30 },
      { status: "uncertain", latencyMs: 20 },
      { status: "unavailable", latencyMs: 5000 },
    ],
  });
  assert.equal(metrics.coverage, 0.75);
  assert.equal(metrics.latencyMs.median, 20);
  assert.equal(metrics.latencyMs.p95, 30);
});
