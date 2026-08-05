---
summary: "Architecture Brief - T4 Production Security Evidence + CI Optional Gates"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t4, security, architecture, ci]
---
# Architecture Brief - T4 Production Security Evidence + CI Optional Gates
resource: .github/harness/memory/briefs/t4-production-security-understand-2026-08-05.md, .github/workflows/harness-optional-security-gates.example.yml, scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-diff.mjs, .github/harness/runs/t4-lurkr-diff-production-main.json

## Objective
- Complete T4 operationalization by executing one live-branch differential scan artifact and enabling optional CI gates to produce automated drift evidence for PR workflows.

## Scope and boundaries
- In scope:
  - Configure and run production evidence command once on current branch.
  - Make CI optional-security example workflow enabled for automatic drift-report generation and upload.
  - Improve Windows command execution compatibility for scanner wrappers.
  - Preserve deterministic report behavior in presence of volatile npm log-path lines.
- Out of scope:
  - Enforcing optional gates as mandatory in all workflows.
  - Replacing scanner with a different security product.
  - Distributed or hosted security orchestration.

## Artifacts to modify
- `scripts/harness/lurkr-core.mjs`
- `scripts/harness/lurkr-diff.mjs`
- `.github/workflows/harness-optional-security-gates.example.yml`

## Artifacts to produce
- `.github/harness/runs/t4-lurkr-diff-production-main.json`
- stage briefs for this run under `.github/harness/memory/briefs/`

## Key decisions
- Keep optional-policy semantics, but set example workflow gate toggle to enabled for demonstration of automated evidence.
- Upload CI drift report as artifact (`lurkr-diff-ci`) for review traceability.
- Resolve scanner command in a Windows-compatible manner; support npm shim invocation path.
- Filter volatile npm log file path lines from diff inputs to improve deterministic drift comparisons.
- Record spawn diagnostics in report when scanner command cannot execute.

## Constraints
- Do not remove safe-token command checks.
- Do not widen default destructive capabilities.
- Keep the workflow example readable and operator-editable.

## Validation plan
- `node --check scripts/harness/lurkr-core.mjs`
- `node --check scripts/harness/lurkr-diff.mjs`
- `npm run harness:security:lurkr:diff -- --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-production-main.json`
- sanity read of generated artifact for refs/scans/drift sections

## Do NOT
- Do NOT claim vulnerability remediation from this slice; this slice provides evidence workflow only.
- Do NOT hard-fail baseline harness flows when optional scanner is unavailable.

## Assumptions and risks
- [UNVERIFIED] Lurkr CLI package availability differs across environments and can return non-zero while still producing useful comparative evidence.
- [UNVERIFIED] Sonar static PATH warnings on `spawnSync` are environmental and not fully eliminable without broader execution-model changes.

## Architectural gates
- Gate 1 (Domain alignment): PASS
- Gate 2 (Generality): PASS
- Gate 3 (Ownership): PASS
- Gate 4 (Boundary integrity): PASS
- Gate 4b (Isolation/safety): PASS
- Gate 5 (Reuse): PASS
