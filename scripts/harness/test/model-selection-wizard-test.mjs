#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkConfiguredModels,
  getModelAvailability,
  recommendModePackage,
  recommendModel,
} from "../model-selection-wizard.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const wizardPath = join(repoRoot, "scripts", "harness", "model-selection-wizard.mjs");

function runWizard(args) {
  return spawnSync(process.execPath, [wizardPath, ...args], {
    cwd: repoRoot,
    shell: false,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function main() {
  const availability = checkConfiguredModels();
  assert.equal(availability.ok, true, "all configured wizard models should exist in the supported Copilot snapshot");
  assert.ok(availability.checkedModels.length >= 10, "wizard should check domain, level, and fallback model references");

  const frontendBalanced = recommendModel({ domain: "frontend", level: "balanced" });
  assert.equal(frontendBalanced.selected.id, "gpt-5.6-terra");
  assert.equal(frontendBalanced.selected.supported, true);
  assert.equal(frontendBalanced.selected.releaseStatus, "GA");
  assert.equal(frontendBalanced.costRank, 2);
  assert.equal(frontendBalanced.qualityRank, 2);

  const infrastructureHigh = recommendModel({ domain: "infrastructure", level: "high" });
  assert.equal(infrastructureHigh.selected.id, "gpt-5.5");
  assert.equal(infrastructureHigh.level, "high");

  const devHigh = recommendModePackage({ mode: "dev", level: "high" });
  assert.equal(devHigh.selected.id, "gpt-5.6-sol");
  assert.equal(devHigh.localModel, "devstral:24b");
  assert.match(devHigh.context, /131K/);

  const missing = getModelAvailability({ supportedById: new Map(), snapshotDate: "test" }, "not-a-model");
  assert.equal(missing.supported, false);
  assert.equal(missing.releaseStatus, "not-listed");

  const cli = runWizard(["recommend", "--domain", "database", "--level", "high", "--json"]);
  assert.equal(cli.status, 0, `CLI recommend should pass: ${cli.stdout} ${cli.stderr}`);
  const parsed = JSON.parse(cli.stdout);
  assert.equal(parsed.domain, "database");
  assert.equal(parsed.selected.supported, true);

  const modeCli = runWizard(["recommend", "--mode", "super-plus", "--level", "balanced", "--json"]);
  assert.equal(modeCli.status, 0, `CLI mode recommend should pass: ${modeCli.stdout} ${modeCli.stderr}`);
  const parsedMode = JSON.parse(modeCli.stdout);
  assert.equal(parsedMode.mode, "super-plus");
  assert.equal(parsedMode.localModel, "devstral:24b");

  const failed = runWizard(["recommend", "--domain", "frontend", "--level", "turbo"]);
  assert.equal(failed.status, 2, "unknown level should fail with usage error");
  assert.match(failed.stderr, /Unknown level/);

  process.stdout.write("[model-selection-wizard-test] PASS\n");
}

main();
