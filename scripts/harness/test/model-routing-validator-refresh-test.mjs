#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadPhase5Skills,
  SYNTHETIC_MODEL_PROFILES,
} from "../phase5/validate-skills.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const configPath = resolve(repoRoot, "harness.config.json");

function main() {
  const skills = loadPhase5Skills(configPath);
  assert.equal(skills.length, 20, "validator should load all 20 configured skill mappings");

  const architect = skills.find((skill) => skill.name === "architect");
  const feedback = skills.find((skill) => skill.name === "feedback");
  assert.equal(architect?.primary, "gpt-5.6-sol");
  assert.equal(feedback?.primary, "gpt-5.6-sol");
  assert.equal(architect?.fallback1, "claude-opus-5");

  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-5.6-sol"].role, "deep-reasoning");
  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-5.6-terra"].role, "balanced");
  assert.equal(SYNTHETIC_MODEL_PROFILES["gpt-5.6-luna"].role, "cheap-fast");
  assert.ok(
    SYNTHETIC_MODEL_PROFILES["gpt-5.6-sol"].qualityBonus > SYNTHETIC_MODEL_PROFILES["gpt-5.6-luna"].qualityBonus,
    "Sol must score above Luna in synthetic deep-reasoning profile hints",
  );
  assert.ok(
    SYNTHETIC_MODEL_PROFILES["gpt-5.6-luna"].costPerOutputToken < SYNTHETIC_MODEL_PROFILES["gpt-5.6-sol"].costPerOutputToken,
    "Luna must remain the cheaper GPT-5.6 package hint",
  );

  process.stdout.write("[model-routing-validator-refresh-test] PASS\n");
}

main();
