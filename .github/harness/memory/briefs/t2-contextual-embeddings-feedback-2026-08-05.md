# Feedback Verdict Record - T2 Contextual Embeddings Pilot
resource: .github/harness/memory/briefs/t2-contextual-embeddings-pilot-2026-08-05.md, .github/harness/memory/briefs/t2-contextual-embeddings-implementation-2026-08-05.md, .github/harness/memory/briefs/t2-contextual-embeddings-review-breadth-2026-08-05.md, .github/harness/memory/briefs/t2-contextual-embeddings-review-depth-2026-08-05.md, .github/harness/memory/briefs/t2-contextual-embeddings-pilot-run-2026-08-05.json

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Should contextual embeddings be adopted after T2 pilot? | Current decision holds: NO-GO | pilot run gate checks in persisted JSON; hitRateAtKDelta gate failed | HIGH | Keep feature pilot-only and default-off |
| 2 | Is implementation within approved architecture boundaries? | Current decision holds | depth gate ledger pass across vector-search/file-search/doc-ingest | HIGH | No structural rollback needed |
| 3 | Are review findings blocking closure? | Current decision holds | breadth findings show no blocker/major runtime issues | HIGH | Close ticket with follow-up improvements |

## Accepted changes

- Keep contextual FS embedding mode implemented but non-default.
- Keep eval-pilot command and eval-set for repeatable future experiments.
- Keep persisted pilot evidence artifact as the adoption decision basis.

## Rejected challenges

- Challenge that T2 should auto-promote to adopted retrieval mode is rejected due to failed hit-rate gate.

## Deferred points

- Full static-analysis hardening for path/process warnings is deferred to a dedicated security-hardening ticket.

## Brief updates

- Decision status updated by evidence: implementation complete, adoption remains NO-GO for production default.
- Constraints unchanged.
- Do-NOT rules unchanged.
- Assumption about provider availability retired for this run (provider available and pilot executed).

## Response notes

- T2 succeeded as an eval-first pilot implementation and produced measurable output, but adoption criteria were not fully met.
- The correct next step is targeted retrieval-quality improvement and a repeat run with the same eval protocol.
