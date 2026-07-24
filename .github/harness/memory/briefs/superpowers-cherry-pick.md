## Architecture Brief — obra/superpowers Cherry-Pick

resource: https://github.com/obra/superpowers, .github/skills/doubt-driven-development/, .github/skills/deterministic-validation/, .github/skills/teach-agent/

### Objective

Import 3 high-signal patterns from superpowers into the harness-kit's existing skills, where each fills a confirmed gap. Add 2 radar entries for patterns worth tracking.

### Source Assessment

`superpowers` by Jesse Vincent (obra/superpowers) is a mature, extensively tested multi-harness agent methodology with 11 platform integrations and an eval harness for skill behavior testing. Its skills are notably well-engineered: they use RED-GREEN-REFACTOR for skill creation, include rationalization tables tested against real agent behavior, and have explicit Red Flags lists. The repo's own CLAUDE.md explicitly warns against "compliance changes" without eval evidence, so we respect that spirit: we cherry-pick only the content that addresses confirmed gaps in our own skill files, not restructure what works.

### Scope and boundaries

**In scope:**
- `doubt-driven-development` SKILL.md — add systematic-debugging's "3+ fixes = architecture problem" rule + rationalization table + Red Flags list (after the existing feedback-loop section from mattpocock)
- `deterministic-validation` SKILL.md — add the verification Gate Function (IDENTIFY→RUN→READ→VERIFY→CLAIM) as an explicit procedure
- `teach-agent` SKILL.md — add "Match the Form to the Failure" insight + SDO principle (description = when to use, NOT what the skill does)
- 2 new radar entries: "human-partner terminology" (parked), "session-start hook injection" (parked)

**Out of scope:**
- superpowers plugin system, hook infrastructure
- brainstorming / writing-plans / subagent-driven-development full workflows
- renaming "user" → "human partner" throughout (too sweeping, uncertain benefit)
- Iron Law addition to loop template (too generic without eval evidence)

### Key decisions

- **Decision:** Systematic-debugging additions go into `doubt-driven-development`, NOT the diagnose loop — the skill is the right owner; the loop references the skill.
- **Decision:** Verification Gate Function goes into `deterministic-validation` under a new "Gate Function" section — existing content stays; Gate Function is additive.
- **Decision:** "Match the Form to the Failure" goes into `teach-agent` as a new section — it changes HOW guidance is written, which is teach-agent's domain.

### Artifacts to modify

| File | Change |
|---|---|
| `.github/skills/doubt-driven-development/SKILL.md` | Add "3+ Fixes = Architecture Problem" rule, Red Flags list extension, Rationalization Table |
| `.github/skills/deterministic-validation/SKILL.md` | Add Gate Function section |
| `.github/skills/teach-agent/SKILL.md` | Add "Match the Form to the Failure" + SDO sections |

### Constraints

- All changes additive — no existing content removed or restructured
- Provenance citations on every addition
- `npm run harness:docs:check` must pass after all changes

### Do NOT

- Do not copy superpowers' full systematic-debugging skill verbatim — take only the specific missing pieces
- Do not restructure the existing deterministic-validation content
- Do not rename any existing terminology without explicit human approval

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
|---|---|---|
| Current deterministic-validation skill lacks Gate Function | Implementation target | Low — confirmed by reading it |
| teach-agent skill lacks "Match the Form" | Implementation target | Low — confirmed by reading it |
