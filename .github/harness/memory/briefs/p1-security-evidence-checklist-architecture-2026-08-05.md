---
summary: "Architecture Brief - P1 Security Evidence Checklist"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [architecture, p1, security, checklist, lurkr]
artifact_family: architect
immutability: frozen
immutable_since: 2026-08-05
---
# Architecture Brief - P1 Security Evidence Checklist
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, .github/harness/memory/radar/hermes-security-evidence-checklist.md, .github/harness/memory/briefs/t4-differential-security-architecture-2026-08-05.md, scripts/harness/lurkr-diff.mjs, .github/instructions/05-REVIEW-BREADTH.md, SETUP.md

## Architecture Brief

### Objective
- Add auditable checklist evidence to the existing differential security scan workflow without changing scanner enforcement behavior.

### Scope and boundaries
- In scope:
  - Add a machine-readable checklist block to differential report output.
  - Update review-breadth instructions to consume checklist evidence.
  - Update setup and optional CI example to surface checklist rows.
- Out of scope:
  - New required scanner policy.
  - Security certification claims.
  - New scanner engines, command flags, or schema lock-in.

### Artifacts to create
- `.github/harness/memory/briefs/p1-security-evidence-checklist-understand-2026-08-05.md` - Understand stage artifact.
- `.github/harness/memory/briefs/p1-security-evidence-checklist-architecture-2026-08-05.md` - architecture decision source of truth.

### Artifacts to modify
- `scripts/harness/lurkr-diff.mjs` - emit `checklist` evidence object in report JSON.
- `.github/instructions/05-REVIEW-BREADTH.md` - require checklist evidence rows in review artifacts for differential scans.
- `SETUP.md` - explain checklist fields and usage intent.
- `.github/workflows/harness-optional-security-gates.example.yml` - log checklist statuses for optional CI visibility.

### Key decisions
- Decision: keep optional security workflow semantics unchanged.
  - Evidence: wayfinder P1 text explicitly says "without changing scanner enforcement".
- Decision: checklist is emitted by `lurkr-diff` report generation, not a separate policy checker.
  - Evidence: single-source report keeps evidence deterministic and avoids branching scripts.
- Decision: checklist statuses can be `pass`, `warn`, or `fail` for evidence quality signaling only.
  - Evidence: this communicates evidence confidence without changing process gating.

### Constraints
- No changes to required/optional scanner mode semantics.
- No expansion of tool permissions or guardrail weakening.
- Keep output scanner-agnostic and deterministic.

### Validation plan
- `node --check scripts/harness/lurkr-diff.mjs`
- `npm run harness:security:lurkr:diff -- --command "node -v" --base HEAD~1 --output .github/harness/runs/p1-security-checklist-smoke.json`
- `node -e "const fs=require('node:fs');const r=JSON.parse(fs.readFileSync('.github/harness/runs/p1-security-checklist-smoke.json','utf8'));if(!r.checklist||!Array.isArray(r.checklist.items)||r.checklist.items.length<4){process.exit(1);}console.log('checklist items:', r.checklist.items.length);"`

### Do NOT
- Do NOT fail CI or local runs based solely on checklist status.
- Do NOT imply scanner findings are policy-complete security coverage.
- Do NOT modify scanner command safety parsing boundaries.

### Assumptions and risks
- [UNVERIFIED] Reviewers will consume checklist rows when present in report artifacts.
  - Affects: consistency of evidence quality across review passes.
  - Risk if wrong: checklist value is underused; mitigated by docs and workflow log summary.
- [UNVERIFIED] Scanner output remains stable enough for drift counts to remain meaningful.
  - Affects: confidence in `drift-summary-captured` interpretation.
  - Risk if wrong: noisy warn statuses; mitigated by preserving existing interpretation notes.

## Architectural gates
- Gate 1 (Domain alignment): PASS - belongs to optional security evidence workflow.
- Gate 2 (Generality): PASS - scanner-agnostic checklist over existing report metadata.
- Gate 3 (Ownership): PASS - checklist emission lives in report producer; docs live in guidance surfaces.
- Gate 4 (Boundary integrity): PASS - no routing, loop, or policy-owner boundary crossover.
- Gate 4b (Isolation/safety): PASS - no permission, tenancy, or destructive-action boundary change.
- Gate 5 (Reuse): PASS - reuses existing differential report path instead of introducing parallel tooling.
