---
summary: "Kickoff Brief - T6 documentation quality enforcement pilot"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t6, docs, quality, teach-agent]
---
# Kickoff Brief - T6 documentation quality enforcement pilot
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, docs/harness/COMMAND_INDEX.md, scripts/harness/doc-verifier.mjs

## Objective
- Activate T6 with a first implementation slice that defines deterministic documentation-quality checks and evidence capture for teach-agent anti-slop policy enforcement.

## Initial slice scope
- Define and baseline T6 acceptance checks in terms of existing deterministic command surfaces.
- Identify doc-verifier coverage gaps relative to anti-slop policy expectations.
- Produce architecture and implementation brief pair for first T6 code slice before coding.

## Candidate deterministic proof surfaces
- `npm run harness:docs:check`
- `npm run harness:doc:verify`
- `npm run harness:acceptance -- scaffold --name t6-doc-quality-pilot --task "enforce deterministic doc quality checks"`
- `npm run harness:acceptance -- baseline --file .github/harness/acceptance/t6-doc-quality-pilot.json`

## Do NOT
- Do NOT implement T6 runtime or policy wiring in this kickoff artifact.
- Do NOT alter prior ticket completion states while opening T6.
