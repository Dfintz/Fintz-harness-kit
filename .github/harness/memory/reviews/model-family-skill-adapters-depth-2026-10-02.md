# Review Depth — Model-Family Skill Adapters (2026-10-02)

Brief: `.github/harness/memory/briefs/model-family-skill-adapters-2026-10-02.md`

## Gate ledger

| Gate | Verdict | Reasoning |
|---|---|---|
| 1 Ownership | PASS | Family map in `harness.config.json` (config owns routing); resolution in `config.mjs` shared by router and validator; adapters under `.github/harness/`. |
| 2 Boundaries | PASS | `getStageModel` / `getStageSkillName` untouched; new `getStageSkillDocName` is doc-only, so architect-challenge's model resolution is unchanged. |
| 3 Reuse | PASS | One canonical skill + 8 adapters instead of 20×N copies; single `resolveModelFamily` used by router and validator. |
| 4 Validation | PASS | Validator errors on unrouted executable models / missing adapters; test pins prefix-overlap cases from the challenge. |
| 4b Safety | PASS | No guardrail, permission, or approval change; adapters defer to stage contracts. |
| 5 Simplicity | PASS | Additive `skillRouting` field; no new CLI flags or commands. |

## Brief conformance

- Longest-prefix precedence, resolved-model chain origin, and dual-root skill path resolution match
  the revised Brief. Dual-root check (`repoRoot`, `harnessRuntimeRoot`) was needed once
  `HARNESS_PROJECT_ROOT` pointed at an adopted project.
- Divergence: README updated in addition to HARNESS.md (alignment rule in copilot-instructions).
  Non-structural.

## Structural findings

- None blocking. Feature-run manifest persistence (breadth #1) is the only seam left unwired.
