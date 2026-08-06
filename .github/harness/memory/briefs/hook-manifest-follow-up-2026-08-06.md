---
summary: "Architecture Brief - harden hook manifest merge and strip contracts"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [hooks, manifest, dedupe, portability, testing]
---
## Architecture Brief
resource: scripts/harness/hook-manifest.mjs, scripts/harness/test/adoption-slices-test.mjs, .github/harness/memory/briefs/adoption-slices-2026-08-06.md, package.json

### Objective
- Complete the hook-manifest first slice with deterministic handling for malformed `hooks` containers and stale/conflicting top-level metadata.
- Preserve the existing pure API shape and first-seen hook precedence while making conflicts observable through structured findings.

### Scope and boundaries
- In scope: harden `mergeHookManifests` and `stripHooks`; add focused self-tests for malformed containers, invalid entries, duplicate identities with differing metadata, unknown-key preservation, and non-mutating behavior.
- Out of scope: live hook writers, provider installers, hook execution, shell command rendering, automatic remediation, or manifest schema adoption by a provider.
- Primary boundary: `hook-manifest.mjs` owns pure manifest normalization/merge semantics; tests own fixtures and assertions; no runtime caller is introduced.

### Artifacts to create
- None. The existing helper and adoption test are the correct first-slice owners.

### Artifacts to modify
- `scripts/harness/hook-manifest.mjs` - report malformed `hooks` containers, detect conflicting top-level keys, retain valid first-seen hooks, and keep strip behavior pure.
- `scripts/harness/test/adoption-slices-test.mjs` - add focused edge-case and immutability assertions.
- `package.json` - no command change expected; existing `test:harness:adoption` remains the proof surface.

### Key decisions
- Decision: an own `hooks` property with a non-array value is treated as empty for that source, never allowed to erase valid hooks from the other source, and reports exactly one `{ code: "invalid-hooks-container", source, details }` finding; an absent `hooks` property is valid empty input.
- Decision: duplicate hook identity keeps the base/first-seen entry and reports `{ code: "duplicate-hook", source, identity }`; payload equality uses recursively key-sorted JSON serialization, and differing payloads additionally report `{ code: "hook-payload-conflict", source, identity }` with no incoming takeover.
- Decision: conflicting unknown top-level keys are retained from the incoming manifest for forward compatibility but reported as `{ code: "metadata-conflict", key, source: "incoming" }`; metadata keys are compared in sorted order and `hooks` is excluded.
- Decision: incoming-only top-level keys are retained silently; `metadata-conflict` is reserved for keys present in both manifests with different canonical values.
- Decision: strip returns a new manifest and preserves non-matching entries, including malformed entries, because removal policy belongs to the caller predicate and no automatic repair is safe.
- Decision: keep the helper pure and provider-neutral; no schema, filesystem, command execution, or provider branch is added.

### Constraints
- Preserve existing exports and return fields; findings are additive.
- Never mutate either input manifest or hook entry objects.
- Stable finding order follows source traversal and hook order.
- Metadata conflict findings are emitted after hook findings in sorted key order.
- Identity remains `provider + event/type + command/run`, with fallback provider support.
- Do not silently replace a valid base hook with a conflicting incoming hook.
- Self-tests must cover empty manifests, malformed containers, invalid entries, duplicate same/different payloads, metadata conflicts, strip behavior, and input immutability.

### Validation plan
- Run `node scripts/harness/test/adoption-slices-test.mjs` immediately after the edit.
- Run `npm run test:harness:adoption`, `npm run test:harness:core`, `npm run harness:docs:check`, `npm run harness:commands:check`, and `git diff --check`.

### Do NOT
- Do not add live hook installation or execution.
- Do not reject an entire manifest because one source has malformed hooks.
- Do not silently discard unknown provider metadata.
- Do not alter route, prompt-pack, sidecar, or command-guard behavior.

### Assumptions and risks
- `[UNVERIFIED]` No current runtime consumer depends on exact findings length; graph lookup found no tracked dependents for this uncommitted helper.
- Risk: metadata conflict findings may expose noisy provider-specific differences. Mitigation: report conflicts without changing incoming-key preservation or hook selection.
- Risk: expanding the pure return contract could affect a future consumer. Mitigation: preserve existing `manifest`, `findings`, and `removed` fields and only add finding codes.
- Understand status: graph fresh and ready; hook helper has no graph-indexed dependents; residual risk low because the change is pure and fixture-tested.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: defined malformed-container detection, recursively sorted payload equality, exact finding fields, metadata conflict ordering, and the absent-versus-malformed `hooks` distinction.
