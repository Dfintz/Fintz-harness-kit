#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadPhase5Skills,
  SYNTHETIC_MODEL_PROFILES,
} from "../phase5/validate-skills.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const configPath = resolve(repoRoot, "harness.config.json");

function main() {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const skills = loadPhase5Skills(configPath);
  assert.equal(skills.length, 20, "validator should load all 20 configured skill mappings");

  const architect = skills.find((skill) => skill.name === "architect");
  const feedback = skills.find((skill) => skill.name === "feedback");
  const implement = skills.find((skill) => skill.name === "implement");
  const budget = skills.find((skill) => skill.name === "budget-aware-execution");
  assert.equal(architect?.primary, "gpt-6-astra");
  assert.equal(feedback?.primary, "gpt-6-astra");
  assert.equal(architect?.fallback1, "claude-opus-5-5");
  assert.equal(implement?.primary, "gpt-5.6-terra");
  assert.equal(budget?.primary, "gpt-6-luna");

  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-6-astra"].role, "long-horizon");
  assert.equal(SYNTHETIC_MODEL_PROFILES["claude-opus-5-5"].role, "deep-reasoning");
  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-6-sol"].role, "deep-reasoning");
  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-5.6-sol"].role, "deep-reasoning");
  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-5.6-terra"].role, "balanced");
  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-6-luna"].role, "cheap-fast");
  assert.ok(
    SYNTHETIC_MODEL_PROFILES["gpt-6-astra"].qualityBonus > SYNTHETIC_MODEL_PROFILES["gpt-6-luna"].qualityBonus,
    "Astra must score above Luna in synthetic deep-reasoning profile hints",
  );
  assert.ok(
    SYNTHETIC_MODEL_PROFILES["gpt-6-luna"].costPerOutputToken < SYNTHETIC_MODEL_PROFILES["gpt-6-sol"].costPerOutputToken,
    "Luna must remain the cheaper GPT-6 package hint",
  );
  assert.ok(
    SYNTHETIC_MODEL_PROFILES["claude-opus-5-5"].costPerOutputToken < SYNTHETIC_MODEL_PROFILES["claude-opus-5"].costPerOutputToken,
    "Opus 5.5 profile should preserve the pricing advantage over Opus 5",
  );

  const supported = new Map(config.modelPolicy.modelSelectionWizard.supportedCopilotModels.map((model) => [model.id, model]));
  const executableReferences = new Set([
    config.models.implementer.model,
    config.models.reviewer.model,
    ...Object.values(config.routing.stageModelSets.feature),
  ]);
  for (const mapping of Object.values(config.skillModelMapping.mappings)) {
    executableReferences.add(mapping.primary);
    mapping.fallback.forEach((model) => executableReferences.add(model));
  }
  for (const model of executableReferences) {
    assert.ok(supported.has(model), `executable model reference should be listed in supportedCopilotModels: ${model}`);
  }

  assert.deepEqual(supported.get("claude-fable-5")?.caveats, ["data-retention-efs", "not-default"]);
  assert.ok(supported.get("kimi-k3")?.caveats.includes("open-weight"));
  assert.ok(supported.get("gpt-6-astra")?.caveats.includes("high-cost"));

  process.stdout.write("[model-routing-validator-refresh-test] PASS\n");
}

main();
