# Review Depth Findings: Fringe Core Remediation Backlog

## Gate ledger

1. Gate 1 (Domain alignment)
   Verdict: PASS
   Evidence: Backlog items are mapped to owning domains (DevOps, frontend, backend, security, harness runtime) and align with observed risk surfaces.

2. Gate 2 (Generality)
   Verdict: PASS
   Evidence: Proposed remediations are reusable platform controls (CI gates, ratchets, migration runbooks, isolation) rather than one-off product patches.

3. Gate 3 (Ownership)
   Verdict: MAJOR concern addressed by backlog
   Evidence: Prior review highlighted ownership ambiguity around compatibility-phase 2FA migration operations and reviewer command isolation responsibilities.

4. Gate 4 (Boundary integrity)
   Verdict: MAJOR concern addressed by backlog
   Evidence: Reviewer command path in plan-review enforces subject integrity, but stronger boundary isolation is required for sensitive review contexts.

5. Gate 4b (Isolation/safety)
   Verdict: MAJOR concern addressed by backlog
   Evidence: Proposed isolation controls for reviewer execution and security-runbook enforcement directly target boundary risk.

6. Gate 5 (Reuse)
   Verdict: PASS
   Evidence: Remediation reuses existing harness surfaces (review artifacts, loops, branch protection, workflow gates) and avoids parallel governance systems.

## Structural findings ledger

### Major

1. Artifact/path: CI governance boundary (.github/workflows + branch protection)
   Gate failed: Gate 4
   Evidence: No hosted workflows currently exist; local scripts are not a merge gate.
   Why structure is wrong: Quality enforcement is optional and environment-dependent.
   Recommended fix: Make CI checks mandatory at remote PR boundary.
   Confidence: HIGH

2. Artifact/path: 2FA migration operational ownership
   Gate failed: Gate 3
   Evidence: Runtime compatibility remains until explicit enforcement; no dated rollout artifact in harness review outputs.
   Why structure is wrong: Security posture depends on implicit operational memory rather than explicit controlled change.
   Recommended fix: Security-owned migration backlog item with dated acceptance criteria and telemetry cutoff.
   Confidence: HIGH

3. Artifact/path: plan-review reviewer execution model
   Gate failed: Gate 4b
   Evidence: Subject tamper detection exists; process-level containment is not guaranteed by script alone.
   Why structure is wrong: Reviewer command capability can exceed intended read-only boundary.
   Recommended fix: Isolated execution environment and explicit policy requirement in review runbooks.
   Confidence: MEDIUM

### Minor

1. Artifact/path: evolve guard boundary definition
   Gate failed: Gate 5 (defensive reuse/completeness)
   Evidence: Explicit forbidden surface can drift from policy-critical file set over time.
   Why structure is wrong: Defensive boundary needs periodic expansion governance.
   Recommended fix: quarterly forbidden-surface review checklist owned by harness maintainer.
   Confidence: MEDIUM

## Concrete remediation backlog (Depth-aligned)

| ID | Stage | Owner | Action | Acceptance criteria | Target timeline |
| --- | --- | --- | --- | --- | --- |
| RD-01 | Review Depth | DevOps Lead | Enforce remote quality boundary | Branch protection configured: required checks include lint, type-check, test, build, security; direct push to master restricted | 2026-07-25 |
| RD-02 | Review Depth | Security Lead | Institutionalize 2FA enforcement ownership | Security ADR/runbook merged with phase dates, owner, go/no-go metrics, rollback; sign-off recorded | 2026-07-29 |
| RD-03 | Review Depth | Harness Maintainer | Isolate reviewer command execution | Review pipeline or documented local process runs reviewer in isolated worktree/container with read-only repo mount except scratch | 2026-08-02 |
| RD-04 | Review Depth | Harness Maintainer | Expand integrity boundary governance | forbidden globs review checklist added and first review completed; update committed if deltas found | 2026-08-05 |

## Brief divergence note
- No architecture brief contradiction detected; this file operationalizes review findings into ownership and boundary controls.
