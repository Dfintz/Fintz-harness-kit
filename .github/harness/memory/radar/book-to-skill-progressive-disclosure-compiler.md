---
summary: Pay the structuring cost once at ingest — compile a document corpus into a small always-loaded index plus on-demand chapter, glossary, pattern, and cheatsheet files, so query cost stays proportional to the answer
status: adopted
source: https://github.com/virgiliojr94/book-to-skill
author_project: virgiliojr94, MIT
captured: 2026-08-09
tags: [teach-agent, doc-ingest, progressive-disclosure, context-engineering, token-cost]
---

# Progressive-Disclosure Skill Compiler

## Technique Summary

Two halves: a deterministic extractor that turns documents into clean text plus metadata, and a
spec-driven generator that an agent follows to compile that text into a structured skill. The output
is a fixed package — a small `SKILL.md` holding core mental models and a chapter index, one
on-demand file per chapter, plus a glossary, a patterns file, and a cheatsheet. Only the index loads
by default; chapter files cost nothing until the topic is asked about. The stated motivation is the
"discovery loop tax": an agent reading a source document directly re-navigates it every turn, so
structuring once at ingest is paid once instead of per query. A hard quality rule forbids copying raw
passages — the output is a synthesized derivative, not a reproduction.

## Repository Relevance

Verified gap: `.github/skills/teach-agent/SKILL.md` contains no notion of progressive disclosure,
on-demand sections, glossary, or cheatsheet. It governs promoting repository knowledge into skills but
says nothing about how a large body of knowledge should be shaped so that loading it is cheap.

We also already own the first half. `scripts/harness/doc-ingest.mjs` extracts text from PDF, DOCX,
XLSX, CSV, and images, and hands it to file indexing — then stops. There is no step that turns
extracted text into a structured, budget-aware skill. This entry supplies the missing second half, and
the output schema is the transferable part; the Python toolchain is not.

The no-raw-passage rule is worth adopting on its own merits and independent of any tooling. It is both
a copyright hygiene rule and a quality rule — a synthesized structure is more useful to an agent than
a quoted excerpt.

## Adoption Notes

- **Target files/domains:**
  - `.github/skills/teach-agent/SKILL.md` — add an output-shape section: small always-loaded index
    with a stated token budget, plus on-demand section files
  - `scripts/harness/doc-ingest.mjs` — a downstream mode that emits the structured package rather than
    flat text
  - `.github/skills/context-engineering/SKILL.md` — record the discovery-loop-tax rationale as the
    reason the shape matters
- **Risks/constraints:** Do not vendor the upstream Python code into this Node kit — cherry-pick the
  schema and the rules. Token-budget numbers from the source are theirs, not measured here; ours must
  be set against our own budgets. Copyright: the no-raw-passage rule must be stated as a hard rule
  before any ingest-to-skill path ships, and generated skills derived from third-party material must
  not be committed to a public repository.
- **SkillSpector gate:** Not applicable — nothing external is vendored or executed; the schema is
  re-authored in our own words and attributed. A scan becomes mandatory if any upstream file is
  imported verbatim.
- **Next step:** Architect the output-shape section for `teach-agent`, defining the package layout and
  a token budget for the always-loaded index. Do the skill-doc slice first; the `doc-ingest.mjs`
  automation only makes sense once the target shape is settled.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from book-to-skill deep dive | radar-pass |
| 2026-08-09 | adopted | Verified gap in `teach-agent`; we already own the extraction half in `doc-ingest.mjs`; bounded first slice (output-shape section, docs only). | radar-pass |
| 2026-08-09 | adopted | Implemented (docs slice). `teach-agent/SKILL.md` gained an Output Shape section: package layout, distribution rules, and a hard no-raw-passage rule. The `doc-ingest.mjs` automation remains open. See `.github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md`. | implement |
