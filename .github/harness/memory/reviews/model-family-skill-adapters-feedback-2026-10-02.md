# Feedback — Model-Family Skill Adapters (2026-10-02)

| Point | Source | Verdict | Notes |
|---|---|---|---|
| Prefix precedence ambiguity | Architect challenge | Upheld → fixed | Longest prefix wins; tested. |
| Chain must start from resolved model; architect-challenge skill | Architect challenge | Upheld → fixed | Separate doc-name resolver; chain = resolved model → fallbacks → universal. |
| Path ownership for adopted projects | Architect challenge | Upheld → fixed | Paths repo-relative; existence checked in project and kit roots. |
| Reserved-word check too narrow | Breadth #2 | Upheld → fixed | Substring match. |
| Persist `skillRouting` in feature-run manifest | Breadth #1 | Deferred | Additive later if a consumer needs it. |
| Retire `add-model-sections.mjs` | Breadth #3 | Deferred (operator) | Deletion needs approval; validator warns meanwhile. |
| Measure adapter quality per family | Breadth #4 | Deferred | Run `eval-first-tuning` with ≥3 scenarios per family before further tuning. |

Brief decisions unchanged after review. Next actions: (1) per-family adapter eval, (2) decide on
`add-model-sections.mjs`, (3) optionally persist `skillRouting` in feature-run manifests.
