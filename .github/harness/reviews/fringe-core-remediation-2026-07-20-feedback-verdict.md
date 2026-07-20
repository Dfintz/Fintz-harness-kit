# Feedback Verdict Record: Fringe Core Remediation Backlog

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Need concrete, owner-backed remediation backlog from review findings | Challenge upheld | Breadth and depth findings identify blocker/major risks with clear artifact evidence | HIGH | Adopt staged backlog with named owners and dated milestones |
| 2 | Ensure backlog aligns to Review Breadth, Review Depth, and Feedback stage contracts | Challenge upheld | Stage contracts in .github/instructions/05-REVIEW-BREADTH.md, 06-REVIEW-DEPTH.md, 07-FEEDBACK.md | HIGH | Maintain stage-specific backlog IDs and acceptance criteria |
| 3 | Use challenger pressure-testing to avoid overstatement | Current decision holds with revision | Architect-challenge verified most majors; softened two over-broad claims | HIGH | Keep calibrated wording and confidence markers in final backlog |

## Accepted changes

1. Establish mandatory remote CI quality boundary (RB-01, RD-01).
2. Introduce lint and test-coverage ratchets with non-regression gates (RB-02, RB-03).
3. Execute explicit 2FA backup code enforcement program with dated milestones (RB-04, RD-02).
4. Harden harness reviewer isolation and integrity-boundary governance (RB-05, RD-03, RD-04).

## Rejected challenges

1. Rejected phrasing that linting is fully disabled.
   Reason: lint exists but warning thresholds are too permissive.

2. Rejected phrasing that no automation exists at all.
   Reason: local automation exists; missing element is hosted enforceable CI/PR gating.

## Deferred points

1. Multi-model council CLI challenge parity (codex/claude executables unavailable on this workstation).
   Required evidence: successful council-review runs with three independent challenger executables.
   Owner: Harness Maintainer.
   Timeline: by 2026-08-02.

## Backlog commitments (final)

| ID | Stage | Owner | Acceptance criteria | Timeline |
| --- | --- | --- | --- | --- |
| RB-01 | Review Breadth | DevOps Lead | Workflows for lint/type-check/test/build/security added and required in branch protection | 2026-07-25 |
| RB-02 | Review Breadth | Frontend Lead | Coverage non-regression enforced; first ratchet applied and documented | 2026-07-30 |
| RB-03 | Review Breadth | Backend Lead | Lint warning ceiling reduced; net-new warning failure enabled in CI | 2026-07-30 |
| RB-04 | Review Breadth | Security Lead | 2FA migration runbook with enforcement date, metrics, and rollback approved | 2026-07-29 |
| RB-05 | Review Breadth | Harness Maintainer | Reviewer isolation policy documented in review process docs | 2026-07-24 |
| RD-01 | Review Depth | DevOps Lead | Remote branch boundary enforces required checks and restricted direct push | 2026-07-25 |
| RD-02 | Review Depth | Security Lead | Security ownership and phase gate sign-off recorded for 2FA enforcement | 2026-07-29 |
| RD-03 | Review Depth | Harness Maintainer | Reviewer runs isolated in worktree/container with restricted writes | 2026-08-02 |
| RD-04 | Review Depth | Harness Maintainer | Integrity-boundary review checklist added and first pass completed | 2026-08-05 |
| FB-01 | Feedback | Engineering Manager | Weekly status review of all RB/RD items with blocked-item escalation path | Start 2026-07-26, weekly until closed |

## Response notes

- The next harness step has been executed by converting findings into stage-aligned, owner-backed backlog artifacts.
- This verdict file is the adjudicated source for execution tracking and should be referenced by subsequent implementation and review cycles.
