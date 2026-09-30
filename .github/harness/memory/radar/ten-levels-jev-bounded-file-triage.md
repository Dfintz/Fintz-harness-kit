---
summary: Evaluate bounded semantic file triage after deterministic retrieval without treating cheap judgments as code evidence.
status: parked
source: https://github.com/disler/ten-levels-of-jev/tree/777adaf47d37ae0553220d35b2f15b3a3a063305
author_project: disler / ten-levels-of-jev
captured: 2026-09-28
tags: [retrieval, evaluation, decisions, privacy, token-budget]
---

# Bounded Semantic File Triage

## Technique Summary

Levels 8 and 9 move file-classification work out of the main agent's context: a small model reads
each candidate and returns typed judgments, then the agent opens selected files. This can reduce
main-agent context, but it still reads and processes those files elsewhere. Savings must include
the classifier's input, retries, latency, and any later full reads.

## Repository Relevance

The harness already has file retrieval and a comparison runner in `scripts/harness/file-search.mjs`.
Its `evaluateCase` checks retrieved paths against expected markers, so an existing evaluation surface
can compare a bounded reranking step against retrieval alone. Do not add another repository crawler
or claim the current retriever misses relevant files without a measured baseline. This is a separate
decision site from intent routing and needs its own labels.

## Adoption Notes

- **Target files/domains:** `scripts/harness/file-search.mjs` retrieval evaluation; the existing
  retrieval implementation it calls; `scripts/harness/decision-policy.mjs` for reusable validation;
  future read-only CLI/MCP exposure only after an approved Brief.
- **Risks/constraints:** The source's
  [single-file reader](https://github.com/disler/ten-levels-of-jev/blob/777adaf47d37ae0553220d35b2f15b3a3a063305/apps/ten-levels/src/levels/level08/read-state.ts)
  accepts absolute/relative paths without root containment. Its
  [batch pruner](https://github.com/disler/ten-levels-of-jev/blob/777adaf47d37ae0553220d35b2f15b3a3a063305/apps/ten-levels/src/levels/level09/prune.ts)
  checks lexical relative paths, not resolved symlink targets, and has no explicit secret-file or
  gitignore policy. Do not copy these boundaries. Any harness version needs canonical containment
  including Windows drive/junction cases, existing access-policy enforcement, sensitive-file
  exclusion, and explicit consent before sending source to a hosted provider.
- **Budget constraints:** The source batches up to 255 files with 16 workers. Start a proposed
  experiment with at most 10 already-retrieved candidates and one in-flight local call, subject to
  provider limits and the shared-GPU budget. Bound total bytes, questions, elapsed time, and spend;
  support cancellation and list skipped/failed files. Unknown is not irrelevant. The source's
  [batch result](https://github.com/disler/ten-levels-of-jev/blob/777adaf47d37ae0553220d35b2f15b3a3a063305/apps/ten-levels/src/levels/level09/ask-files.ts)
  counts successful results as `calls`; independent accounting must include failed attempts/retries.
- **Evidence constraints:** A selected file still needs a direct read before an edit, quote, or
  correctness claim. Include content hash, question/policy/model revision, and explicit uncertainty
  in any proposed result receipt; persist metadata rather than full private source.
- **Next step:** After a separately approved evaluation task, compare retrieval-only against
  retrieval-plus-triage on maintainer-labelled file relevance. Predeclare recall@K, missed-required-
  file rate, main-agent tokens, total cost, end-to-end p95 latency, and task success criteria.
  Promotion requires a material measured benefit without unacceptable recall/task-success loss.
  Start with report-only reordering, never automatic exclusion of low-confidence candidates.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-28 | candidate | Captured L8/L9 as one retrieval experiment with common ownership and proof. | GitHub Copilot |
| 2026-09-28 | parked | Technically plausible, but no demonstrated retrieval gap or per-site calibration; the decision sidecar remains frozen. Design a bounded comparison before any runtime or hosted-provider integration. | GitHub Copilot, manual technique-triage |
