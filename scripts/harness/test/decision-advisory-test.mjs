#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecisionAdvisoryIdentity,
  evaluateDecisionAdvisory,
  isReusableDecisionReceipt,
} from "../decision-advisory.mjs";

const route = { profile: "feature", intent: null, intentSource: null, runId: "run-1" };
const baseConfig = {
  routing: {
    intentProfiles: {
      feature: { profile: "feature", description: "Full feature cycle", keywords: ["ship feature", "build feature"] },
      coder: { profile: "coder", description: "Fast coding" },
    },
  },
  modelPolicy: {
    localDecisionSidecar: {
      enabled: true,
      endpoint: "http://127.0.0.1:11437",
      model: "Qwen/Qwen3.5-4B",
      revision: "fixture-revision",
      policyId: "shadow-v1",
      timeoutMs: 100,
      minProbability: 0.7,
      minMargin: 0.2,
    },
  },
};

test("disabled advisory produces no receipt", async () => {
  const config = structuredClone(baseConfig);
  config.modelPolicy.localDecisionSidecar.enabled = false;
  assert.equal(await evaluateDecisionAdvisory({ task: "ship feature", route, config }), null);
});

test("choice criteria carry profile keywords as disambiguators", async () => {
  let sent = null;
  await evaluateDecisionAdvisory({
    task: "ship feature",
    route,
    config: baseConfig,
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body);
      return Response.json({
        model: "Qwen/Qwen3.5-4B@fixture-revision",
        answers: { intent_profile: {
          type: "choice", choice: "feature", probabilities: { feature: 0.9, coder: 0.1 }, confidence: 0.8,
        } },
        usage: { input_tokens: 9, output_tokens: 0 },
      });
    },
  });

  const criteria = sent.questions.intent_profile.criteria;
  assert.match(criteria.feature, /^Full feature cycle Typical phrasing: ship feature; build feature\.$/);
  assert.equal(criteria.coder, "Fast coding", "a keyword-less profile degrades to its description");
});

test("adding keywords invalidates the candidate fingerprint", () => {
  const withKeywords = buildDecisionAdvisoryIdentity({ task: "t", route, config: baseConfig });
  const stripped = structuredClone(baseConfig);
  delete stripped.routing.intentProfiles.feature.keywords;
  const without = buildDecisionAdvisoryIdentity({ task: "t", route, config: stripped });

  assert.notEqual(withKeywords.candidateFingerprint, without.candidateFingerprint);
});

test("matched advisory records shadow disagreement without changing route", async () => {
  const receipt = await evaluateDecisionAdvisory({
    task: "ship feature",
    route,
    config: baseConfig,
    fetchImpl: async () => Response.json({
      model: "Qwen/Qwen3.5-4B@fixture-revision",
      answers: { intent_profile: {
        type: "choice", choice: "coder", probabilities: { feature: 0.1, coder: 0.9 }, confidence: 0.8,
      } },
      usage: { input_tokens: 12, output_tokens: 0 },
    }),
  });
  assert.equal(receipt.status, "matched");
  assert.equal(receipt.selected, "coder");
  assert.equal(receipt.agreement, false);
  assert.equal(route.profile, "feature");
  assert.ok(!JSON.stringify(receipt).includes("ship feature"));
});

test("near ties become uncertain", async () => {
  const receipt = await evaluateDecisionAdvisory({
    task: "ambiguous work",
    route,
    config: baseConfig,
    fetchImpl: async () => Response.json({
      model: "Qwen/Qwen3.5-4B@fixture-revision",
      answers: { intent_profile: {
        type: "choice", choice: "feature", probabilities: { feature: 0.52, coder: 0.48 }, confidence: 0.04,
      } }, usage: { input_tokens: 8, output_tokens: 0 },
    }),
  });
  assert.equal(receipt.status, "uncertain");
  assert.equal(receipt.fallbackReason, "policy-uncertain");
});

test("unavailable sidecar yields a stable fallback receipt", async () => {
  const receipt = await evaluateDecisionAdvisory({
    task: "ship feature", route, config: baseConfig,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(receipt.status, "unavailable");
  assert.equal(receipt.fallbackReason, "sidecar-unavailable");
});

test("advisory identity invalidates on policy or candidate changes", () => {
  const first = buildDecisionAdvisoryIdentity({ task: "ship feature", route, config: baseConfig });
  const changed = structuredClone(baseConfig);
  changed.modelPolicy.localDecisionSidecar.minMargin = 0.3;
  const second = buildDecisionAdvisoryIdentity({ task: "ship feature", route, config: changed });
  assert.notEqual(first.policyFingerprint, second.policyFingerprint);
  assert.equal(first.taskHash, second.taskHash);
});

test("only structurally valid scored receipts are reusable", () => {
  const identity = buildDecisionAdvisoryIdentity({ task: "ship feature", route, config: baseConfig });
  const receipt = {
    schemaVersion: 1,
    sticky: true,
    status: "matched",
    outcome: "matched",
    selected: "feature",
    selectedProbability: 0.9,
    margin: 0.8,
    distribution: { feature: 0.9, coder: 0.1 },
    taskHash: identity.taskHash,
    policyId: identity.policyId,
    policyFingerprint: identity.policyFingerprint,
    candidateFingerprint: identity.candidateFingerprint,
    requestedModel: identity.requestedModel,
    requestedRevision: identity.requestedRevision,
  };
  assert.equal(isReusableDecisionReceipt(receipt, identity), true);
  assert.equal(isReusableDecisionReceipt({ ...receipt, status: "unavailable", outcome: "unavailable" }, identity), false);
  assert.equal(isReusableDecisionReceipt({ ...receipt, margin: null }, identity), false);
  assert.equal(isReusableDecisionReceipt({ ...receipt, selected: "unknown" }, identity), false);
});
