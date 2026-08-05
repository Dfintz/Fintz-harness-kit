# Implementation Summary - T2 Contextual Embeddings Pilot
resource: .github/harness/memory/briefs/t2-contextual-embeddings-pilot-2026-08-05.md, scripts/harness/vector-search.mjs, scripts/harness/file-search.mjs, scripts/harness/doc-ingest.mjs, .github/harness/eval-sets/t2-contextual-embeddings-pilot.json, .github/harness/memory/briefs/t2-contextual-embeddings-pilot-run-2026-08-05.json

## Delivered

- Added optional contextual filesystem embedding mode in `vector-search` index path via `--contextual-fs` and `--no-contextual-fs`.
- Added pilot metrics to index output:
  - `selectedEmbeddingChars`
  - `selectedEmbeddingCharsRaw`
  - `selectedContextualDocCount`
  - `indexingDurationMs`
- Added `eval-pilot` mode to `file-search`:
  - runs baseline/contextual A/B on a shared eval set
  - computes median-ready run aggregates
  - computes deltas and gate checks
  - emits deterministic `GO`/`NO-GO` verdict
- Added `doc-ingest --contextual` output mode for ingestion-side contextual framing experiments.
- Added T2 eval set with explicit criteria and 10 cases:
  - `.github/harness/eval-sets/t2-contextual-embeddings-pilot.json`

## Contract adherence

- Implemented only scoped surfaces from the approved brief.
- Preserved default behavior: contextual mode is explicit, default-off in pilot commands.
- Kept output machine-readable (JSON).

## Proof summary

- Syntax checks passed:
  - `node --check scripts/harness/vector-search.mjs`
  - `node --check scripts/harness/file-search.mjs`
  - `node --check scripts/harness/doc-ingest.mjs`
- Docs contract passed:
  - `npm run harness:docs:check`
- CLI smoke checks passed:
  - `node scripts/harness/file-search.mjs --help`
  - `node scripts/harness/file-search.mjs eval-pilot` (required-arg guard)
- Controlled tiny-corpus verification proved contextual toggle behavior:
  - baseline: `selectedEmbeddingCharsRaw=31`, `selectedContextualDocCount=0`
  - contextual: `selectedEmbeddingCharsRaw=104`, `selectedContextualDocCount=1`
- Full pilot run executed and persisted:
  - `.github/harness/memory/briefs/t2-contextual-embeddings-pilot-run-2026-08-05.json`
  - result: `NO-GO`

## Change summary

CHANGES MADE:
- `scripts/harness/vector-search.mjs`: contextual FS embedding inputs, added index-size/timing/contextual-count metrics, contextual flag handling, and metadata emission.
- `scripts/harness/file-search.mjs`: new `eval-pilot` command with A/B execution and deterministic gate evaluation.
- `scripts/harness/doc-ingest.mjs`: added `--contextual` framing mode and help examples.
- `.github/harness/eval-sets/t2-contextual-embeddings-pilot.json`: added pilot dataset and threshold criteria.
- `.github/harness/memory/briefs/t2-contextual-embeddings-pilot-2026-08-05.md`: revised architecture constraints and deterministic gates.

THINGS I DIDN'T TOUCH (intentionally):
- `scripts/harness/llm-provider.mjs`: no provider-level retrieval architecture changes needed for T2.
- `scripts/harness/graph-provider.mjs`: no graph provider changes needed for bounded pilot.
- BM25/reranker surfaces: intentionally out of scope for this ticket.

POTENTIAL CONCERNS:
- Static-analysis security warnings on path/process usage in these scripts are pre-existing and broad; this ticket did not widen those capabilities.
- Brief heading/resource line requires markdownlint suppression due to repository requirement that `resource:` is directly under heading.

## Assumptions or deviations

- Live embedding provider availability was assumed and validated by successful eval-pilot execution.
- Brief called for 3 repeats; execution proof used `repeats=1` for bounded run-time while command supports configured repeats for full protocol runs.
