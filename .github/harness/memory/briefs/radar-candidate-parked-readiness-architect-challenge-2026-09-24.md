# Architect Challenge: Radar Candidate and Parked Readiness

resource: .github/harness/memory/briefs/radar-candidate-parked-readiness-2026-09-24.md, .github/harness/memory/briefs/radar-candidate-parked-readiness-matrix-2026-09-24.md
Status: implemented

## Revision History

- Initial verdict: REVISE because pilot activities lacked exact inputs, owners, outputs and decision gates, and the 32-row matrix did not yet exist.
- Revision: pin source commits and Brief set, declare critic cap/adjudicator/output records, complete the 32-row matrix, and require set-equality validation.
- Final deterministic check: 32 parked IDs exactly once; 3 pilot, 29 blocked; no duplicates, omissions, extras or malformed rows.

## Post-Approval Breadth Amendment

- Breadth invalidated the hyperplan pilot because its inputs were post-review Briefs, its baseline was ambiguous, and no token/cost evidence existed. The entry returned to `still-blocked`.
- Breadth found Twelve-Factor had the same bounded source-comparison shape as Codex. It replaced hyperplan using immutable upstream commit `d20c728368bf9c189d6d7aab704744decb6ec0cc`, explicit file/time/character caps, a fixed output path, and a provisional proceed-or-repark gate.
- Delta-feed gained two fixed 14-day cycles, per-cycle time/link caps, an empty-cycle rule, and a hard end after cycle two. Codex gained path, file, time, and extracted-character caps.
- The assessment is now explicitly a working-tree snapshot. A 32-file SHA-256 manifest pins every evaluated radar input.
- Revalidation after the amendment preserved the approved invariants: 32 parked IDs exactly once; 3 pilot, 29 blocked; no discrepancy. Independent Breadth must still approve the amended evidence before Depth.

VERDICT: APPROVED
