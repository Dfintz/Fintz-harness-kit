#!/usr/bin/env node
/**
 * Enforces the decision-sidecar freeze. A frozen component protected only by prose
 * gets re-enabled by the first reader who skims; this makes that break the build.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const config = JSON.parse(readFileSync(resolve(repoRoot, "harness.config.json"), "utf8"));

export function assertFreezeInvariants(policy) {
  const freeze = policy?.freeze;
  if (freeze?.status !== "frozen") return { frozen: false, checks: 0 };

  let checks = 0;
  const check = (fn) => {
    fn();
    checks += 1;
  };

  check(() => assert.equal(policy.enabled, false, "a frozen decision sidecar must stay disabled"));
  check(() => assert.equal(policy.mode, "shadow", "a frozen decision sidecar must stay in shadow mode"));
  check(() => assert.match(freeze.frozenAt ?? "", /^\d{4}-\d{2}-\d{2}$/, "freeze.frozenAt must be an ISO date"));
  check(() => assert.ok(freeze.reason?.length > 40, "freeze.reason must explain why, not just that"));
  check(() => assert.ok(freeze.brief?.startsWith(".github/harness/memory/briefs/"), "freeze.brief must cite the deciding Brief"));
  check(() =>
    assert.ok(
      Array.isArray(freeze.unfreezeRequires) && freeze.unfreezeRequires.length >= 3,
      "freeze.unfreezeRequires must list checkable conditions",
    ),
  );
  check(() =>
    assert.ok(
      freeze.unfreezeRequires.every((item) => typeof item === "string" && item.length > 20),
      "each unfreeze condition must be specific enough to verify",
    ),
  );

  return { frozen: true, checks };
}

function main() {
  const policy = config.modelPolicy?.localDecisionSidecar;
  assert.ok(policy, "modelPolicy.localDecisionSidecar is missing");

  const result = assertFreezeInvariants(policy);
  assert.ok(result.frozen, "expected the decision sidecar to be frozen");
  assert.ok(result.checks > 0, "freeze invariants produced no checks");

  // Negative control: the invariants must actually reject a re-enabled sidecar.
  const tampered = structuredClone(policy);
  tampered.enabled = true;
  assert.throws(() => assertFreezeInvariants(tampered), /must stay disabled/);

  process.stdout.write(`[decision-freeze-test] PASS (${result.checks} invariants + negative control)\n`);
}

main();
