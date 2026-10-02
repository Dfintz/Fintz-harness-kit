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
    "qwen2.5-coder:14b": "generic-open",
    "unknown-model": "generic-open",
  };
  for (const [model, family] of Object.entries(expected)) {
    assert.equal(resolveModelFamily(config, model).family, family, model);
  }
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
