#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const configPath = resolve(repoRoot, "harness.config.json");

const REQUIRED_EVIDENCE_CLASSES = [
  "adoption-signal",
  "benchmark-quality",
  "artifact-available",
  "profile-fit",
  "locally-measured",
];
const REQUIRED_FIT_STATUSES = ["supported-default", "optional-measured", "candidate-unverified", "disallowed"];
const REQUIRED_PROFILES = ["macbook-air-m1-8gb", "proxmox-lxc-xeon-v3-50gb", "cpu-only-50gb-intel"];
const FORBIDDEN_FINAL_STAGES = new Set(["architect", "review-depth", "feedback"]);

function main() {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const policy = config.modelPolicy?.localOpenModels;

  assert.equal(policy?.advisoryOnly, true, "local open model policy must remain advisory");
  assert.deepEqual(policy.evidenceClasses, REQUIRED_EVIDENCE_CLASSES);
  assert.deepEqual(policy.executableDefaultRequires, ["artifact-available", "profile-fit", "locally-measured"]);
  assert.deepEqual(policy.fitStatuses, REQUIRED_FIT_STATUSES);

  const signals = new Map(policy.signals.map((signal) => [signal.id, signal]));
  assert.equal(signals.get("jev-1.13")?.status, "signal-only");
  assert.equal(signals.get("jev-1.13")?.evidenceClass, "adoption-signal");

  const candidates = new Map(policy.candidates.map((candidate) => [candidate.id, candidate]));
  for (const defaultModel of ["qwen2.5:latest", "qwen2.5-coder:14b", "devstral:24b"]) {
    const candidate = candidates.get(defaultModel);
    assert.ok(candidate, `missing local candidate: ${defaultModel}`);
    assert.ok(candidate.evidenceClasses.includes("locally-measured"), `${defaultModel} must be locally measured`);
  }
  assert.ok(!candidates.get("qwen3.8-27b")?.evidenceClasses.includes("locally-measured"));

  for (const profile of REQUIRED_PROFILES) {
    const fit = policy.hardwareFit[profile];
    assert.ok(fit, `missing hardware fit profile: ${profile}`);
    for (const status of REQUIRED_FIT_STATUSES) {
      assert.ok(Array.isArray(fit[status]), `${profile}.${status} must be an array`);
    }
  }

  assert.ok(policy.hardwareFit["macbook-air-m1-8gb"].disallowed.includes("14b-plus"));
  assert.ok(policy.hardwareFit["proxmox-lxc-xeon-v3-50gb"].disallowed.includes("70b"));
  assert.ok(policy.hardwareFit["cpu-only-50gb-intel"]["optional-measured"].includes("devstral:24b"));

  for (const lane of policy.workflowLanes) {
    assert.equal(typeof lane.lane, "string");
    assert.ok(Array.isArray(lane.requiredProofs) && lane.requiredProofs.length > 0, `${lane.lane} needs proofs`);
    assert.ok(Array.isArray(lane.guardrails) && lane.guardrails.length > 0, `${lane.lane} needs guardrails`);
    assert.equal(typeof lane.escalateTo, "string", `${lane.lane} needs escalation target`);
  }

  const offline = policy.workflowLanes.find((lane) => lane.lane === "local-offline-fallback");
  assert.ok(offline, "missing local-offline-fallback lane");
  for (const stage of FORBIDDEN_FINAL_STAGES) {
    assert.ok(offline.forbiddenStages.includes(stage), `offline fallback must forbid ${stage}`);
  }
  assert.ok(offline.requiredProofs.includes("reduced-confidence-note"));

  process.stdout.write("[local-open-model-policy-test] PASS\n");
}

main();