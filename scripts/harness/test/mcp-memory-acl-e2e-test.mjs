#!/usr/bin/env node
/**
 * End-to-end ACL evaluator test with mocked MCP caller contexts.
 * Verifies domain zone templates in memory access policy.
 */

import assert from "node:assert";
import { repoRoot } from "../config.mjs";
import { extractCallerIdentity } from "../mcp-auth-validator.mjs";
import {
  buildCallerAccessContext,
  evaluateMemoryAccess,
  loadMemoryAccessPolicy,
} from "../memory-access-control.mjs";

const REQUIRED_DOMAIN_TAGS = [
  "hr",
  "finance",
  "legal",
  "security",
  "it",
  "sales",
  "management",
];

const REQUIRED_ZONE_IDS = REQUIRED_DOMAIN_TAGS.map((tag) => `${tag}-memory`);

function buildMockEntry(tag) {
  return {
    scope: "lessons",
    path: ".github/harness/memory/lessons/mock-memory-entry.md",
    tags: [tag],
    content: `---\ntags:\n  - ${tag}\n---\n# mock`,
  };
}

function callerFromContext(context) {
  const callerInfo = extractCallerIdentity(context);
  return buildCallerAccessContext(callerInfo, context);
}

function assertAllowed(policy, domainTag) {
  const entry = buildMockEntry(domainTag);
  const caller = callerFromContext({
    caller: {
      id: `${domainTag}-user`,
      role: domainTag,
      teams: [domainTag],
    },
  });

  const verdict = evaluateMemoryAccess(entry, caller, policy);
  assert.strictEqual(
    verdict.allowed,
    true,
    `Expected ${domainTag} caller to access ${domainTag} memory`,
  );
}

function assertDenied(policy, domainTag) {
  const entry = buildMockEntry(domainTag);
  const outsider = callerFromContext({
    caller: {
      id: "eng-user",
      role: "engineering",
      teams: ["engineering"],
    },
  });

  const verdict = evaluateMemoryAccess(entry, outsider, policy);
  assert.strictEqual(
    verdict.allowed,
    false,
    `Expected non-${domainTag} caller to be denied ${domainTag} memory`,
  );
}

function main() {
  console.log("[mcp-memory-acl-e2e-test] loading policy...");

  const policy = loadMemoryAccessPolicy(repoRoot);
  assert(policy && typeof policy === "object", "Policy should load");

  const zones = Array.isArray(policy.zones) ? policy.zones : [];
  const zoneIds = new Set(zones.map((zone) => zone.id));
  for (const zoneId of REQUIRED_ZONE_IDS) {
    assert(zoneIds.has(zoneId), `Missing starter zone template: ${zoneId}`);
  }

  const starterTags = Array.isArray(policy.starterTags) ? policy.starterTags : [];
  for (const tag of REQUIRED_DOMAIN_TAGS) {
    assert(starterTags.includes(tag), `Missing starter domain tag: ${tag}`);
  }

  // Force evaluation mode for tests while preserving default runtime disabled posture.
  const enforcedPolicy = {
    ...policy,
    enabled: true,
  };

  for (const tag of REQUIRED_DOMAIN_TAGS) {
    assertAllowed(enforcedPolicy, tag);
    assertDenied(enforcedPolicy, tag);
  }

  // Unclassified memory should remain accessible with current default allow posture.
  const unclassifiedEntry = {
    scope: "lessons",
    path: ".github/harness/memory/lessons/general-note.md",
    tags: ["general"],
    content: "# general note",
  };
  const generalCaller = callerFromContext({ caller: { id: "eng-user", role: "engineering", teams: ["engineering"] } });
  const unclassifiedVerdict = evaluateMemoryAccess(unclassifiedEntry, generalCaller, enforcedPolicy);
  assert.strictEqual(unclassifiedVerdict.allowed, true, "Unclassified entries should follow defaultAllow=true");

  console.log("✅ [mcp-memory-acl-e2e-test] all ACL template checks passed");
}

main();
