#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecisionReceipt,
  evaluateCandidateDistribution,
  evaluateShadowWindow,
  hashDecisionTask,
  shouldSampleDecisionCheck,
} from "../decision-policy.mjs";

test("candidate policy requires probability and margin floors", () => {
  assert.deepEqual(
    evaluateCandidateDistribution({
      probabilities: { feature: 0.82, review: 0.12, coder: 0.06 },
      minProbability: 0.7,
      minMargin: 0.2,
    }),
    { outcome: "matched", selected: "feature", probability: 0.82, margin: 0.7 },
  );

  assert.equal(
    evaluateCandidateDistribution({
      probabilities: { feature: 0.51, review: 0.49 },
      minProbability: 0.5,
      minMargin: 0.1,
    }).outcome,
    "uncertain",
  );
});

test("candidate policy rejects malformed distributions", () => {
  assert.throws(
    () => evaluateCandidateDistribution({ probabilities: { feature: 0.8, review: 0.3 } }),
    /sum to 1/i,
  );
  assert.throws(
    () => evaluateCandidateDistribution({ probabilities: { feature: Number.NaN, coder: 0.2 } }),
    /finite/i,
  );
});

test("receipt is bounded and contains no raw task", () => {
  const task = "private source task that must not be persisted in the receipt";
  const receipt = buildDecisionReceipt({
    advisoryId: "adv-1",
    runId: "run-1",
    taskHash: hashDecisionTask(task),
    status: "matched",
    policyId: "shadow-v1",
    policyFingerprint: "policy-hash",
    candidateFingerprint: "candidate-hash",
    requestedModel: "Qwen/Qwen3.5-4B",
    requestedRevision: "revision-1",
    resolvedModel: "Qwen/Qwen3.5-4B@revision-1",
    outcome: "matched",
    selected: "turnkey-coding",
    selectedProbability: 0.91,
    margin: 0.72,
    distribution: { "turnkey-coding": 0.91, coder: 0.19 - 0.1 },
    baseline: { profile: "feature", intent: null, intentSource: null },
    agreement: false,
    fallbackReason: null,
    latencyMs: 14,
  });
  const serialized = JSON.stringify(receipt);
  assert.ok(Buffer.byteLength(serialized) <= 16 * 1024);
  assert.ok(!serialized.includes(task));
  assert.equal(receipt.mode, "shadow");
  assert.equal(receipt.sticky, true);
});

test("shadow windows report promotion and demotion without changing authority", () => {
  const good = evaluateShadowWindow(
    Array.from({ length: 5 }, (_, index) => ({ comparable: true, agreement: index < 4 })),
    { minWindow: 5, targetAgreement: 0.8 },
  );
  assert.deepEqual(good, {
    compared: 5,
    agreements: 4,
    agreement: 0.8,
    promotionEligible: true,
    demotionRecommended: false,
  });

  const drifted = evaluateShadowWindow(
    Array.from({ length: 5 }, (_, index) => ({ comparable: true, agreement: index < 2 })),
    { minWindow: 5, targetAgreement: 0.8, promoted: true },
  );
  assert.equal(drifted.demotionRecommended, true);
});

test("sample checks are deterministic", () => {
  assert.equal(shouldSampleDecisionCheck("same", 0.25), shouldSampleDecisionCheck("same", 0.25));
  assert.equal(shouldSampleDecisionCheck("same", 0), false);
  assert.equal(shouldSampleDecisionCheck("same", 1), true);
});
