---
status: active
date: 2026-07-28
stage: Architect
brief_type: Review+Convergence
ownership: harness-team
architect-challenge-verdict: APPROVED (with mandatory fixes below)
---

# Architecture Brief: Harness Review + MCP Naming Convergence
resource: scripts/harness/mcp-tools.mjs,scripts/harness/mcp-server.mjs,scripts/harness/mcp-audit.mjs,scripts/harness/mpc-audit.mjs,scripts/harness/test/mcp-command-dispatch-test.mjs,scripts/harness/test/mpc-command-dispatch-test.mjs,scripts/harness/test/mpc-rate-limit-test.mjs,scripts/harness/test/mpc-auth-test.mjs,scripts/harness/test/mpc-template-test.mjs,scripts/harness/test/mpc-integration-test.mjs,harness.config.schema.json,harness.config.json,package.json,.github/instructions/03-ARCHITECT.md,.github/instructions/04-IMPLEMENT.md,.github/instructions/05-REVIEW-BREADTH.md,.github/instructions/06-REVIEW-DEPTH.md,.github/instructions/07-FEEDBACK.md

active

## Architect Challenge

VERDICT: APPROVED

Mandatory concerns resolved in Implement:
- Fix schema/behavior mismatch where `commands.*` supports object form in runtime but not in schema.
- Repair canonical `mcp-command-dispatch-test` so it uses schema-valid, cross-platform command fixtures.
- Converge naming to `mcp` at command surface while keeping `mpc` compatibility aliases.
- Remove dual-behavior risk by turning legacy `mpc-audit` into a compatibility shim.

## Context Sufficiency Check

### Inventory
- `harness.config.schema.json`: command schema currently accepts string only for `commands.*`.
- `harness.config.json`: includes object-format command (`test-filter`) with `vars`.
- `scripts/harness/mcp-tools.mjs`: dispatch logic supports string or object command entries.
- `scripts/harness/test/mcp-command-dispatch-test.mjs`: canonical dispatch test currently fails.
- `scripts/harness/test/mpc-command-dispatch-test.mjs`: legacy test uses stale assumptions and currently fails.
- `scripts/harness/test/mpc-*.mjs`: operational tests pass but naming is legacy (`mpc`).
- `scripts/harness/mcp-audit.mjs` and `scripts/harness/mpc-audit.mjs`: duplicate surfaces with drift risk.
- `package.json`: no canonical `test:mcp:dispatch:*` script family for these tests.

### Scope
- Scope: mixed (workflow/tooling + tests + command naming convergence)
- Primary boundary: harness dispatch + validation contract surfaces

### Missing Context
- Graph freshness is stale by 7 commits; dependency confidence is reduced for newly changed files not in graph.

## Gate Decisions

### Gate 1: Domain/Module Alignment
- Keep fixes in harness core (`scripts/harness`, `harness.config.schema.json`, `package.json`).
- Do not spread into unrelated docs or memory history rewrites.

### Gate 2: Generality
- Canonicalize naming to `mcp` at command surface.
- Preserve compatibility for `mpc` references with thin aliases/shims.

### Gate 3: Ownership
- Schema contract belongs in `harness.config.schema.json`.
- Dispatch behavior checks belong in `scripts/harness/test/*dispatch*`.
- Command discoverability belongs in `package.json` scripts.
- Legacy alias behavior belongs in compatibility shim files only.

### Gate 4: Boundary Integrity
- Keep implementation additive and non-breaking.
- No behavioral changes to execution logic in `mcp-tools.mjs` unless required by failing tests.

### Gate 4b: Isolation/Safety
- Do not weaken existing guardrails.
- Keep template escaping/auth/rate-limit tests in execution path.
- Keep command dispatch audit append-only behavior untouched.

### Gate 5: Reuse
- Reuse existing passing `mpc` tests through wrappers or script aliases instead of duplicating test logic.
- Replace divergent duplicate modules with compatibility re-export.

## Planned Change Set

### Modify
- `harness.config.schema.json`: allow `commands.*` as string OR `{ command, vars }` object.
- `scripts/harness/test/mcp-command-dispatch-test.mjs`: make test config schema-valid and cross-platform.
- `scripts/harness/test/mpc-command-dispatch-test.mjs`: convert to compatibility wrapper to canonical test.
- `scripts/harness/mpc-audit.mjs`: convert to compatibility shim re-exporting canonical `mcp-audit` exports.
- `package.json`: add canonical `test:mcp:dispatch:*` scripts and legacy `test:mpc:*` aliases.

### Add
- `scripts/harness/test/mcp-rate-limit-test.mjs`: wrapper to legacy test implementation.
- `scripts/harness/test/mcp-auth-test.mjs`: wrapper to legacy test implementation.
- `scripts/harness/test/mcp-template-test.mjs`: wrapper to legacy test implementation.
- `scripts/harness/test/mcp-integration-test.mjs`: wrapper to legacy test implementation.

### Explicitly Not Doing
- Not deleting `mpc-*` files (compatibility retained).
- Not rewriting historical review/brief memory files containing `mpc` labels.
- Not forcing graph refresh in this run.

## Constraints
- Backward compatibility must hold for operators invoking legacy names.
- Deterministic proof required: run canonical test scripts after edits.
- Keep diffs surgical; no unrelated refactors.

## Do-NOTs
- Do NOT change guardrails or approval semantics.
- Do NOT modify core dispatch runtime behavior without evidence.
- Do NOT remove legacy artifacts without compatibility path.

## Assumptions
- [UNVERIFIED] No external automation depends on direct execution of `scripts/harness/test/mpc-command-dispatch-test.mjs` semantics beyond pass/fail.
- [UNVERIFIED] Graph staleness does not hide importers of `mpc-audit.mjs` outside workspace files.

## Validation Plan
- `npm run harness:config:self-test`
- `node scripts/harness/test/mcp-command-dispatch-test.mjs`
- `node scripts/harness/test/mcp-rate-limit-test.mjs`
- `node scripts/harness/test/mcp-auth-test.mjs`
- `node scripts/harness/test/mcp-template-test.mjs`
- `node scripts/harness/test/mcp-integration-test.mjs`
- `npm run test:mcp:dispatch`
