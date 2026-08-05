# Review Breadth Findings - T2 Contextual Embeddings Pilot
resource: .github/harness/memory/briefs/t2-contextual-embeddings-pilot-2026-08-05.md, scripts/harness/vector-search.mjs, scripts/harness/file-search.mjs, scripts/harness/doc-ingest.mjs, .github/harness/eval-sets/t2-contextual-embeddings-pilot.json, .github/harness/memory/briefs/t2-contextual-embeddings-pilot-run-2026-08-05.json

## Findings Ledger

### Major

1. Artifact: .github/harness/memory/briefs/t2-contextual-embeddings-pilot-2026-08-05.md
- Finding: `MD022` is triggered at the top heading due to required immediate `resource:` line placement.
- Evidence: `get_errors` reports heading-blank diagnostic at line 1.
- Impact: lint noise in stage artifact; does not affect runtime behavior.
- Confidence: HIGH
- Recommended fix: keep explicit markdownlint suppression at file top (already applied) or adjust repository lint rule to allow resource-line convention.

### Minor

1. Artifact: scripts/harness/vector-search.mjs and scripts/harness/doc-ingest.mjs
- Finding: static analysis still reports broad path/process security warnings (file inclusion, PATH trust) and style complexity warnings in long-standing code.
- Evidence: `get_errors` output reports existing warnings not introduced by T2 functional change.
- Impact: review signal noise; may hide future true positives if left unmanaged.
- Confidence: HIGH
- Recommended fix: separate hardening ticket to introduce path allowlists, command path pinning, and complexity decomposition.

### FYI

1. Artifact: .github/harness/memory/briefs/t2-contextual-embeddings-pilot-run-2026-08-05.json
- Finding: pilot run verdict is `NO-GO` because `hitRateAtKDelta` gate failed even though precision and cost/latency gates passed.
- Evidence: gate checks in persisted pilot output.
- Impact: expected eval-first behavior; avoids premature adoption.
- Confidence: HIGH
- Recommended fix: improve eval set discrimination and retrieval strategy before re-run.

## Coverage note

- Covered: changed T2 surfaces, new eval command behavior, pilot output semantics, and docs-contract validity.
- Not covered: full security hardening of legacy path/process handling and unrelated harness modules.

## Missing-context note

- Graph snapshot is stale by one commit; direct file-level inspection and command evidence were used to offset reduced graph confidence.
