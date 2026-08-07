# Brief: workflow-normalization-profile-matrix-and-immutability-policy-2026-08-04 - active
resource: harness.config.json,.github/harness/HARNESS.md,.github/harness/WORKFLOW.md,scripts/harness/validate-doc-contracts.mjs,scripts/harness/new-brief.mjs,.github/agents/architect-challenge.agent.md,.github/harness/memory/reviews/architect-challenge-verdict.md

**Date:** 2026-08-04
**Task:** Produce a strict normalization profile matrix mapping task category -> mandatory route + mandatory verdict schema, and add a small enforceable policy patch for immutable/frozen markers across architect/review/challenge artifact families.
**Scope:** workflow + documentation + validation script

## Understand Snapshot
- Graph status: STALE by 1 commit / 5 source files; refresh readiness is ready.
- Impacted components:
  - `harness.config.json` routing profiles and stage sequences
  - `.github/harness/HARNESS.md` and `.github/harness/WORKFLOW.md` process contracts
  - `scripts/harness/validate-doc-contracts.mjs` docs governance enforcement surface
  - `scripts/harness/new-brief.mjs` brief generation template
  - `.github/agents/architect-challenge.agent.md` challenge artifact contract
- Blast radius: medium-low (docs + docs validator behavior); no runtime product path changes.

## Architectural Gates (1-5)
1. **Domain alignment:** PASS. The change belongs to harness governance and workflow standardization.
2. **Generality:** PASS. Policy + matrix are reusable across all feature tasks and reviewers.
3. **Ownership:** PASS. Validator and harness docs own process-contract enforcement.
4. **Boundary integrity:** PASS. No business logic movement; only contract/documentation and validation guardrails.
4b. **Isolation/safety:** PASS. Read-only and frozen semantics are made explicit; no destructive defaults.
5. **Reuse:** PASS. Reuses existing docs-check command (`harness:docs:check`) and existing artifact naming families.

## Files To Modify
- `scripts/harness/validate-doc-contracts.mjs`
- `scripts/harness/new-brief.mjs`
- `.github/agents/architect-challenge.agent.md`
- `.github/harness/memory/reviews/architect-challenge-verdict.md`
- `.github/harness/WORKFLOW.md`

## Files To Create
- `.github/harness/NORMALIZATION-PROFILE-MATRIX.md`
- `.github/harness/IMMUTABILITY-MARKERS-POLICY.md`

## Files Not Being Created
- No new runner, loop, or model-routing scripts.
- No migration script for legacy brief files in this patch.

## Interface / Abstraction Decision
- Keep enforcement lightweight by extending existing `validate-doc-contracts.mjs` with forward-enforcement focused on changed files.
- Use frontmatter markers as canonical machine-readable contract (`artifact_family`, `immutability`).

## Constraints
- Do not break existing historical artifacts that predate markers.
- Enforce new policy without requiring broad backfill in one patch.
- Keep commands and stage machine semantics unchanged.

## Do-NOTs
- Do NOT weaken read-only guardrails.
- Do NOT alter stage order or model-role mapping behavior.
- Do NOT introduce destructive operations or historical file rewrites.

## Assumptions
- Existing CI or operators run `npm run harness:docs:check` on changed surfaces.
- Frontmatter-based marker policy is acceptable for markdown artifact families.

## Definition Of Done
- A strict profile normalization matrix exists and is referenced from workflow docs.
- Immutability marker policy is documented with required keys and family mapping.
- Docs validator checks changed family artifacts for required markers.
- Architect challenge artifact template includes required marker fields.
- `harness:docs:check` passes after patch.

## Architect Challenge
VERDICT: APPROVED
Rationale: Proposed patch is bounded, backward-compatible for legacy files, and adds enforceable policy at the existing docs contract gate.