---
summary: "Feedback Verdict - first adoption slices"
type: feedback
status: active
source: review
created: 2026-08-06
updated: 2026-08-06
tags: [adoption, review, verdict]
---
## Feedback Verdict Record
resource: .github/harness/memory/briefs/adoption-slices-2026-08-06.md, scripts/harness/test/adoption-slices-test.mjs, scripts/harness/test/trace-contract-route-test.mjs, docs/harness/COMMAND_INDEX.md

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Add trace-contract tests and route rationale | Current decision holds | Focused adoption suite and route trace pass; rationale is additive and documented | HIGH | Closed |
| 2 | Add pure hook merge/dedupe and cross-provider command guards | Current decision holds | Fixture test covers duplicate identity, malformed entries, and POSIX quoting; platform renderer rejects unsupported shells | HIGH | Closed |
| 3 | Add provider tree drift reporting | Current decision holds | Identical-tree JSON report is drift-free; explicit roots keep the command report-only | HIGH | Closed |
| 4 | Add deterministic detector registry | Third option | Current slice owns document-scoped rules in `doc-verifier`; repository-scoped rules are deferred until high-signal rules exist | HIGH | Brief updated; follow-up required before repository integration |
| 5 | Add route rationale artifact | Current decision holds | Route JSON exposes `conditionsMatched` and `exclusions` without changing `planTask` decisions | HIGH | Closed |
| 6 | Add shortcut generator | Current decision holds | Generator writes only with explicit `--out`; default emits stdout with provenance marker | HIGH | Closed |
| 7 | Add bounded journal retention planning | Current decision holds | Planner excludes non-journal artifacts and skips entries without trustworthy timestamps; fixture proves count bound | HIGH | Closed |
| 8 | Compose generic drift with sidecar policy validator | Third option | Generic file drift and sidecar semantic allowlist checks have different contracts; composition deferred | MEDIUM | Brief updated; retain separate owners |

### Accepted changes
- Keep all eight first adoption capabilities additive and deterministic.
- Keep drift, retention, and shortcut generation non-destructive by default.
- Keep route rationale explanatory and outside route authority.
- Keep document detector integration in `doc-verifier` and defer repository-scope rules.

### Rejected challenges
- No breadth blocker remains. Reported exit-code and Windows matcher concerns were contradicted by source and passing tests.
- No depth blocker remains after the Brief explicitly recorded the two deferred integrations.

### Deferred points
- Define high-signal repository-scoped detector rules before wiring `validate-doc-contracts.mjs`.
- Establish a shared sidecar manifest contract before composing semantic policy checks with generic file drift.
- Add a live hook writer only when a provider-specific manifest owner exists.

### Brief updates
- Decisions changed: repository detector scope and sidecar drift composition marked deferred.
- Constraints updated: no repository detector integration is claimed in this slice.
- Do NOT rules unchanged: no auto-install, auto-injection, deletion, or silent guardrail weakening.
- Assumptions retired: sidecar and generic drift are not assumed to share one manifest contract.

### Response notes
- The adoption pilot is accepted as a bounded, report-only foundation; the deferred items are explicit follow-up work rather than hidden gaps.
