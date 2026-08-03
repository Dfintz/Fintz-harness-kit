---
summary: "Architecture Brief"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [okf, phase0, v02, conformance]
---
# Architecture Brief

resource: scripts/harness/okf-phase0.mjs,.github/harness/memory/README.md,.github/harness/memory/lessons/_template.md

## Objective

Improve current OKF support by extending the phase-0 auditor from a coarse baseline into an OKF v0.2-aware conformance snapshot, while preserving its existing readiness semantics and read-only behavior.

## Scope

- In scope: Enhance `scripts/harness/okf-phase0.mjs` reporting with OKF v0.2 conformance metrics.
- In scope: Update memory lesson template wording from v0.1 to v0.2.
- In scope: Keep current operational contract (`--json`, `--self-test`, read-only audit) intact.
- Out of scope: Bulk migration of existing memory files to full OKF frontmatter.
- Out of scope: Changing readiness gate policy to require full OKF conformance by default.
- Out of scope: Introducing write-time mutation of memory files.

## Understand evidence and impact map

- Graph status: stale/degraded refresh readiness (missing `graph.pluginRoot`), proceeded using explicit degraded-preflight override and deterministic repository inspection.
- Primary artifact: `scripts/harness/okf-phase0.mjs`
- Secondary artifact: `.github/harness/memory/lessons/_template.md`
- Affected components: `package.json` script consumer (`harness:okf:phase0`) and operator workflows reading phase-0 JSON.
- Layers: Core script layer for harness operational checks; memory protocol docs.
- Blast radius: low to medium (report shape expansion, no destructive behavior).

## Gate results

- Gate 1 Domain alignment: PASS (belongs in OKF phase-0 auditor and memory template docs).
- Gate 2 Generality: PASS (adds spec-level generic OKF checks, not product-specific logic).
- Gate 3 Ownership: PASS (phase-0 audit script owns audit report composition).
- Gate 4 Boundary integrity: PASS (no routing or loop orchestration changes; read-only audit preserved).
- Gate 4b Isolation/safety: PASS (no permission widening; no file writes; no guardrail weakening).
- Gate 5 Reuse: PASS (new checks implemented as local pure helpers reused by report generation).

## Key decisions

1. Add OKF v0.2 conformance counters for concept docs (frontmatter presence + non-empty `type`) as report data, not default blockers.
2. Add a strict opt-in mode flag for operators who want conformance to influence readiness now.
3. Add migration signal counters for v0.1 legacy patterns (`timestamp` and `# Citations`) to prioritize upgrades.
4. Keep existing `phase1Ready` semantics unchanged unless strict mode is explicitly requested.

## Constraints

- Preserve CLI compatibility for existing commands.
- Preserve read-only behavior.
- Preserve current baseline checks (graph freshness and memory-curate hard flags).
- Keep JSON output deterministic and machine-readable.

## Validation plan

- `npm run harness:okf:phase0 -- --json`
- `npm run harness:okf:phase0 -- --json --strict-okf`
- `npm run harness:okf:phase0 -- --self-test`

## Do NOT

- Do NOT auto-edit or auto-fix memory markdown files.
- Do NOT fail default phase-0 readiness based solely on optional OKF fields.
- Do NOT introduce non-deterministic network dependencies in the auditor.

## Assumptions and risks

- [UNVERIFIED] Existing downstream consumers tolerate additive JSON fields.
- Risk: strict mode may surface high non-conformance in current corpus; mitigated by default-off behavior.
- Risk: heuristic `# Citations` detection may overcount prose mentions; mitigate by anchoring to heading pattern only.

## Architect challenge

- VERDICT: APPROVED.
- Pressure-test result: strict mode remains opt-in, so default readiness semantics are preserved and no operator workflow is broken by conformance reporting expansion.
- Blocking concerns: none.
