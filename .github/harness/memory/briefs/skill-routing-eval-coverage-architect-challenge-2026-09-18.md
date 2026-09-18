---
summary: "Architect Challenge - Skill Routing and Eval Coverage Validation"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [architect-challenge, skill-routing, eval-first]
artifact_family: challenge
immutability: frozen
immutable_since: 2026-09-18
---
## Architect Challenge
resource: .github/harness/memory/briefs/skill-routing-eval-coverage-2026-09-18.md, scripts/harness/skill-routing-eval.mjs, scripts/harness/optimize-all-skills.mjs, scripts/harness/test/skill-routing-eval-test.mjs

### Initial verdict
- VERDICT: REVISE

### Findings and resolutions
| Finding | Resolution | Evidence |
| --- | --- | --- |
| Mapped skills were not checked for actual `SKILL.md` existence. | Validator now requires a matching skill file under `.github/skills` or `.claude/skills`. | Real 20-skill baseline passes. |
| Optimizer supports skill-local `eval-set.json` but validator did not. | Validator accepts both canonical eval-set and skill-local paths. | Focused test covers local eval set. |
| Windows skill selectors were not normalized. | Optimizer normalizes backslashes before canonical ID matching. | Optimizer self-test remains green. |
| Structural validation is not quality measurement. | Scope and output explicitly remain coverage/preflight validation; model quality stays in eval runners. | Architecture Brief constraints and README contract. |

### Final verdict
- VERDICT: APPROVED
