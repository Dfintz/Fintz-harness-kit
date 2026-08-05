#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const checkerPath = join(repoRoot, "scripts", "harness", "validate-doc-contracts.mjs");
const tempSkillDir = join(repoRoot, ".github", "skills", "_sidecar-validator-test");
const tempAgentsDir = join(tempSkillDir, "agents");
const tempSkillFile = join(tempSkillDir, "SKILL.md");
const tempSidecarFile = join(tempAgentsDir, "openai.yaml");

function runSidecarCheck(extraArgs = []) {
  return spawnSync(process.execPath, [checkerPath, "--sidecar-only", ...extraArgs], {
    cwd: repoRoot,
    shell: false,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function writePilotSkill() {
  mkdirSync(tempAgentsDir, { recursive: true });
  writeFileSync(
    tempSkillFile,
    [
      "---",
      "name: _sidecar-validator-test",
      "description: Temporary fixture skill for sidecar validator edge-case testing.",
      "---",
      "",
      "# Temporary Sidecar Validator Fixture",
      "",
      "Test fixture used by scripts/harness/test/sidecar-validator-edge-cases-test.mjs.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function expectFailure(label, yamlContent, expectedCode) {
  writeFileSync(tempSidecarFile, yamlContent, "utf8");
  const result = runSidecarCheck();
  assert.equal(result.status, 1, `${label} should fail validation`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `${label} should report ${expectedCode}`);
}

function main() {
  writePilotSkill();

  const baseline = runSidecarCheck();
  assert.equal(baseline.status, 1, "Baseline should fail until fixture sidecar is written");
  assert.match(`${baseline.stdout}\n${baseline.stderr}`, /missing-sidecar/, "Baseline should fail with missing-sidecar");

  expectFailure(
    "invalid yaml shape",
    [
      "interface: bad",
      "policy:",
      "  allow_implicit_invocation: false",
      "  behavior_class: explicit-invocation-required",
      "",
    ].join("\n"),
    "invalid-sidecar-yaml",
  );

  expectFailure(
    "missing policy key",
    [
      "interface:",
      "  display_name: Sidecar Validator Fixture",
      "  short_description: Fixture for sidecar validator test coverage.",
      "policy:",
      "  allow_implicit_invocation: false",
      "",
    ].join("\n"),
    "invalid-sidecar-contract",
  );

  expectFailure(
    "wrong scalar types",
    [
      "interface:",
      "  display_name: true",
      "  short_description: Fixture for sidecar validator test coverage.",
      "policy:",
      "  allow_implicit_invocation: \"false\"",
      "  behavior_class: 100",
      "",
    ].join("\n"),
    "invalid-sidecar-contract",
  );

  expectFailure(
    "policy semantic mismatch",
    [
      "interface:",
      "  display_name: Sidecar Validator Fixture",
      "  short_description: Fixture for sidecar validator test coverage.",
      "policy:",
      "  allow_implicit_invocation: true",
      "  behavior_class: explicit-invocation-required",
      "",
    ].join("\n"),
    "invalid-sidecar-policy-semantics",
  );

  expectFailure(
    "model-invoked class not allowlisted",
    [
      "interface:",
      "  display_name: Sidecar Validator Fixture",
      "  short_description: Fixture for sidecar validator test coverage.",
      "policy:",
      "  allow_implicit_invocation: true",
      "  behavior_class: model-invoked-eligible",
      "",
    ].join("\n"),
    "invalid-model-invoked-allowlist",
  );

  writeFileSync(
    tempSidecarFile,
    [
      "interface:",
      "  display_name: Sidecar Validator Fixture",
      "  short_description: Fixture for sidecar validator test coverage.",
      "policy:",
      "  allow_implicit_invocation: false",
      "  behavior_class: explicit-invocation-required",
      "",
    ].join("\n"),
    "utf8",
  );

  const success = runSidecarCheck();
  assert.equal(success.status, 0, `Valid fixture should pass: ${success.stdout} ${success.stderr}`);

  writeFileSync(
    tempSkillFile,
    [
      "---",
      "name: _sidecar-validator-test",
      "description: Pilot fixture skill for strict pilot policy validation.",
      "---",
      "",
      "# Temporary Sidecar Validator Fixture (Pilot)",
      "",
      "Test fixture used by scripts/harness/test/sidecar-validator-edge-cases-test.mjs.",
      "",
    ].join("\n"),
    "utf8",
  );

  const strictPilotMismatch = runSidecarCheck(["--strict-pilot-policy"]);
  assert.equal(strictPilotMismatch.status, 1, "Pilot fixture should fail strict mode when class is not user-invoked-only");
  assert.match(
    `${strictPilotMismatch.stdout}\n${strictPilotMismatch.stderr}`,
    /invalid-pilot-sidecar-policy/,
    "Strict mode should report invalid-pilot-sidecar-policy",
  );

  writeFileSync(
    tempSidecarFile,
    [
      "interface:",
      "  display_name: Sidecar Validator Fixture",
      "  short_description: Fixture for sidecar validator test coverage.",
      "policy:",
      "  allow_implicit_invocation: false",
      "  behavior_class: user-invoked-only",
      "",
    ].join("\n"),
    "utf8",
  );

  const strictPilotSuccess = runSidecarCheck(["--strict-pilot-policy"]);
  assert.equal(
    strictPilotSuccess.status,
    0,
    `Pilot fixture should pass strict mode with user-invoked-only class: ${strictPilotSuccess.stdout} ${strictPilotSuccess.stderr}`,
  );

  console.log("PASS sidecar validator edge-case test suite");
}

try {
  main();
} finally {
  rmSync(tempSkillDir, { recursive: true, force: true });
}
