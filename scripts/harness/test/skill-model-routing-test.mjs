#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveModelFamily } from "../config.mjs";
import { planTask } from "../prompt-router.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const config = JSON.parse(readFileSync(resolve(repoRoot, "harness.config.json"), "utf8"));

test("longest prefix wins regardless of family order", () => {
  const expected = {
    "gpt-5.6-sol": "openai-reasoning",
    "gpt-5.6-terra": "openai-coding",
    "gpt-5.6-luna": "openai-fast",
    "gpt-5.4": "openai-coding",
    "gpt-5.4-mini": "openai-fast",
    "gpt-5.4-nano": "openai-fast",
    "gpt-5-mini": "openai-fast",
    "gpt-6-astra": "openai-reasoning",
    "gpt-6-luna": "openai-fast",
    "claude-opus-5-5": "claude-frontier",
    "claude-sonnet-5": "claude-balanced",
    "claude-haiku-4-5": "claude-compact",
    "gemini-3.8-flash": "gemini",
    "mai-code-1.1-flash": "generic-open",
    hydrafusion: "ensemble",
    "hydrafusion:latest": "ensemble",
    "ensemble-v2": "ensemble",
    auto: "dynamic-selection",
    "copilot-auto": "dynamic-selection",
    "qwen2.5-coder:14b": "generic-open",
    "unknown-model": "generic-open",
  };
  for (const [model, family] of Object.entries(expected)) {
    assert.equal(resolveModelFamily(config, model).family, family, model);
  }
  assert.equal(resolveModelFamily(config, "hydrafusion").executionMode, "ensemble");
  assert.equal(resolveModelFamily(config, "hydrafusion:latest").executionMode, "ensemble");
  assert.equal(resolveModelFamily(config, "auto").executionMode, "dynamic");
});

test("local name:tag ids keep localFamily unless a non-fixed family matches", () => {
  const spec = {
    default: "fallback",
    localFamily: "local",
    families: {
      cloud: { match: ["gpt-"], adapter: "cloud.md" },
      local: { match: [], adapter: "local.md" },
      fallback: { match: [], adapter: "fallback.md" },
      ensemble: { match: ["hydrafusion"], adapter: "local.md", executionMode: "ensemble" },
      pinned: { match: ["pinned-"], adapter: "cloud.md", executionMode: "fixed" },
    },
  };
  const synthetic = { skillModelMapping: { modelFamilies: spec } };
  assert.equal(resolveModelFamily(synthetic, "gpt-oss:20b").family, "local");
  assert.equal(resolveModelFamily(synthetic, "pinned-model:1").family, "local");
  assert.equal(resolveModelFamily(synthetic, "gpt-5.4").family, "cloud");
  assert.equal(resolveModelFamily(synthetic, "hydrafusion:latest").family, "ensemble");

  const withoutLocal = { skillModelMapping: { modelFamilies: { ...spec, localFamily: undefined } } };
  assert.equal(resolveModelFamily(withoutLocal, "unknown:tag").family, "fallback");
  assert.equal(resolveModelFamily(withoutLocal, "hydrafusion:latest").family, "ensemble");
});

test("family resolution degrades to null without modelFamilies", () => {
  assert.deepEqual(resolveModelFamily({}, "claude-opus-5-5"), { family: null, adapter: null });
  assert.deepEqual(resolveModelFamily(config, ""), { family: null, adapter: null });
});

test("every executable model resolves to an existing adapter", () => {
  const models = new Set([config.skillModelMapping.universal_fallback]);
  for (const mapping of Object.values(config.skillModelMapping.mappings)) {
    models.add(mapping.primary);
    mapping.fallback.forEach((model) => models.add(model));
  }
  for (const model of models) {
    const { adapter } = resolveModelFamily(config, model);
    assert.ok(adapter && existsSync(resolve(repoRoot, adapter)), `${model} -> ${adapter}`);
  }
});

test("feature route emits a skill and adapter chain per stage from the resolved model", () => {
  const route = planTask("Add a new feature to the router api", config, { profile: "feature" });
  for (const stage of route.stages) {
    const routing = route.skillRouting[stage];
    assert.ok(routing, `missing skillRouting for ${stage}`);
    assert.ok(routing.skillPath && existsSync(resolve(repoRoot, routing.skillPath)), `${stage} skillPath`);
    assert.equal(routing.chain[0].model, route.models[stage], `${stage} chain starts at resolved model`);
    assert.equal(routing.chain[0].role, "primary");
    assert.equal(routing.chain.at(-1).model, config.skillModelMapping.universal_fallback);
    assert.equal(routing.chain.at(-1).role, "universal-fallback");
    assert.equal(new Set(routing.chain.map((link) => link.model)).size, routing.chain.length, `${stage} chain has duplicates`);
    for (const link of routing.chain) {
      assert.ok(link.adapter, `${stage} ${link.model} has no adapter`);
    }
  }
  assert.equal(route.skillRouting["architect-challenge"].skill, "architect-challenge");
  assert.deepEqual(
    route.skillRouting.implement.chain.map((link) => link.model).slice(1),
    [...config.skillModelMapping.mappings.implement.fallback, config.skillModelMapping.universal_fallback],
  );
});
