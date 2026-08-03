---
summary: "Architecture Brief — Slice A hardening follow-up and longer fusion TUI audit"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [slice-a, hardening, fusion-audit, 2026]
---
# Architecture Brief — Slice A hardening follow-up and longer fusion TUI audit

resource: scripts/harness/acceptance-gate.mjs, scripts/harness/test/acceptance-gate-test.mjs, .github/harness/memory/briefs/slice-a-gate-first-acceptance-2026-08-03.md, .github/harness/memory/briefs/external-harness-live-execution-audit-2026-08-03.md

**Date:** 2026-08-03  
**Status:** APPROVED

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| `scripts/harness/acceptance-gate.mjs` | New Slice A helper with residual analyzer warnings | Runtime helper |
| `scripts/harness/test/acceptance-gate-test.mjs` | Deterministic test coverage for Slice A | Test surface |
| Slice A brief and implementation artifacts | Prior ownership and safety decisions | Harness memory |
| Longer fusion TUI audit output | Stronger-validator runtime evidence | External audit evidence |

**Scope:** scripting / workflow hardening / audit evidence  
**Primary boundary:** reduce local analyzer noise where feasible without widening Slice A semantics, and persist stronger fusion runtime findings without changing shipped fusion integrations

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Analyzer-specific accepted suppression pattern for repo-contained file reads | Whether the remaining warnings can be fully removed without broader repo convention changes |

Proceeding is safe because the behavior is already covered by tests; this pass is a hardening and evidence pass, not a contract-expansion pass.

## Architectural Gates

### Gate 1 — Domain / module alignment

Pass. Both changes remain within the existing Slice A helper and its adjacent audit artifacts.

### Gate 2 — Generality

Pass. Trusted-path wrapper reuse is a generic helper hardening step, and the fusion audit remains external evidence rather than product code.

### Gate 3 — Ownership

Pass. Hardening belongs in `acceptance-gate.mjs`; longer fusion observations belong in memory artifacts, not in runtime code.

### Gate 4 — Boundary integrity

Pass. No new orchestrator or runtime coupling is introduced. The fusion TUI run remains observational only.

### Gate 4b — Isolation / safety boundary

Pass. Do not widen proof-command execution or add analyzer-only suppressions that weaken path safety claims.

### Gate 5 — Reuse

Pass. Reuse the repo’s trusted-path wrapper style from existing scripts where practical.

## Key Decisions

1. Apply a local hardening pass to `acceptance-gate.mjs` only when it preserves the current argv-only, repo-root-contained execution contract.
2. Record the longer fusion TUI result as stronger supporting evidence for Slice A, but do not fold any fusion runtime behavior into the shipped helper.
3. If residual analyzer warnings remain after adopting repo-standard trusted-path wrappers, treat them as a follow-up hardening slice rather than expanding scope in this run.

## Constraints

- Keep `acceptance-gate.mjs` behavior unchanged.
- Do not widen the proof-command allowlist.
- Do not patch fusion or SSSF runtime code in this repo.

## Do-NOTs

- Do NOT add external-runtime-specific workarounds into Slice A.
- Do NOT relax repo-root containment or argv-only command rules just to satisfy static analysis.
- Do NOT claim that the longer fusion audit reached baseline or builder phases unless the terminal evidence shows it.

## Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Repo-standard trusted-path wrappers may reduce analyzer noise without changing behavior | hardening value | warnings may remain and need a dedicated follow-up |
| The stronger fusion validator output is still useful evidence even if gate-file write contract is not fully honored | audit value | evidence could be overstated if not framed as partial progress |

## Definition Of Done

- `acceptance-gate.mjs` is hardened as far as practical in this slice without widening scope.
- Existing acceptance-gate tests still pass.
- Longer fusion TUI findings are captured precisely in persisted artifacts.

## Architect Challenge

VERDICT: APPROVED
