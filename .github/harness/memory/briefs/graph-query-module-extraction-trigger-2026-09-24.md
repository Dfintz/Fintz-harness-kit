# Follow-up: Graph Query Module Extraction Trigger
resource: scripts/harness/graph.mjs, .github/harness/memory/briefs/graph-structured-absence-adoption-2026-09-24.md
Status: active

## Owner

- Harness Runtime Owner; reassess during the next graph-query feature run.

## Trigger

- The next graph-query feature lands, or a second in-process consumer needs shared query execution beyond the current enumeration/boundary exports.

## Decision

- Do not extract only `buildGraphAbsence`; it has one owner and one consumer module.
- At the trigger, assess a coherent `graph-query.mjs` boundary containing indexing, node resolution, neighborhood/path/symbol query semantics, and absence construction.
- Extraction is not automatic. Run Understand and Architect against current consumers and complexity before moving code.

## Exit Evidence

- A future Brief either approves a query-module extraction with dependency and regression proof, or records why `graph.mjs` remains the correct owner.
