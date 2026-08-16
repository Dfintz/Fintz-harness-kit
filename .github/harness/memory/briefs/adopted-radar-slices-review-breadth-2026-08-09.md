---
summary: "Review breadth - adopted radar slices (rerun scoring, failure batching, line-level review, skill output shape)"
type: brief
status: implemented
source: review
created: 2026-08-09
updated: 2026-08-09
tags: [radar, review-breadth, harness-evolve, grade-trace, teach-agent]
artifact_family: review
immutability: mutable
---

# Review Breadth: Adopted Radar Slices

resource: .github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md, scripts/harness/harness-evolve.mjs, scripts/harness/grade-trace.mjs, .github/instructions/06-REVIEW-DEPTH.md, .github/instructions/04-IMPLEMENT.md, .github/skills/teach-agent/SKILL.md, scripts/harness/validate-doc-contracts.mjs

- **Date:** 2026-08-09
- **Run ID:** run-20260809131412-b306ddfa

## Proof

| Check | Result |
|---|---|
| `node scripts/harness/harness-evolve.mjs --self-test` | ok, 13/13 (was 9/9 — 4 new cases) |
| `node scripts/harness/harness-evolve.mjs --check` | PASSED, eval task manifest rendered |
| `node scripts/harness/grade-trace.mjs --self-test` | PASSED, 19 checks (5 new) |
| `node scripts/harness/grade-trace.mjs --failures --json` | `{ minBatch: 2, records: 0, groups: [] }` |
| `npm run harness:docs:check` | `[docs-contracts] OK` |
| `node scripts/harness/check-memory-references.mjs` | OK — 701 files |
| `node scripts/harness/config-self-test.mjs` | PASS |

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| B1 | Info | `classifyIterationOutcome` is covered for all six input shapes: exit 0/1/3, exit 2, null status, signal kill, and spawn error. | Pass |
| B2 | Medium | `--failures` returned zero records because `.github/harness/runs/` holds no gradeable experiment journals. Behaviour matches `--all`, so the empty result is correct, but the mode has not been exercised against real data. | Accepted — logic is covered by five self-test cases using synthetic journals, matching the file's existing testing convention. |
| B3 | Medium | `validate-doc-contracts.mjs` was changed, which was not in the Brief's file list. Editing `06-REVIEW-DEPTH.md` made it match the `review-depth` filename pattern in `classifyArtifactFamily`, so the validator demanded review-artifact frontmatter from a stage instruction file. | Fixed at root cause: `.github/instructions/` is now excluded from artifact-family classification. A stage instruction is the contract, not an artifact the contract produces. Recorded as a Brief divergence. |
| B4 | Low | Two review briefs from the earlier radar run lacked required `artifact_family` / `immutability` frontmatter. Pre-existing; surfaced because the validator only inspects changed files. | Fixed — frontmatter added to both. |
| B5 | Low | `main()` in `harness-evolve.mjs` had cognitive complexity 43. The iteration loop was extracted to `runEvolutionLoop`, bringing it to 18 with the new function at 24. Both remain above the configured 15. | Accepted — the residue is pre-existing argument handling and guardrail branching. Reducing further would restructure the guardrail path, which is out of scope for this change. |
| B6 | Info | Lint issues introduced by this change were all fixed: locale-unsafe `.sort()` (3), nested template literals (4), nested ternaries (3), and one unused parameter on `abortOnTamper`. | Pass |
| B7 | Info | Security: no guardrail was weakened. `computeIntegrity` still gates before and after every iteration, and the manifest is diagnostic only — a manifest match cannot override a hash mismatch. | Pass |
| B8 | Info | Exit codes 0, 1, and 2 keep their meanings. Code 4 is new and documented in the file header and `--help`. | Pass |

## Verdict

No blocking findings. B3 must be carried to Review Depth as a Brief divergence.
