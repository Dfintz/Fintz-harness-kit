---
name: ai-techniques-radar
description: Track and evaluate external AI techniques and engineering trends. Use when deciding whether to adopt a new approach, library, or method.
---

# Skill: AI Techniques Radar

> Use when: You need to track and triage new AI engineering ideas over time for possible adoption in
> this repository.

## Objective

Capture high-signal external ideas as concise entries in committed memory, then triage them into
adopted, parked, or rejected decisions using the harness loop model.

## Files to Read First

Before capturing or triaging entries, read these repository surfaces:

1. `.github/harness/memory/radar/README.md`
2. `.github/harness/memory/radar/_template.md`
3. `.github/harness/loops/technique-triage.json`
4. Relevant adopted radar entries in `.github/harness/memory/radar/`

## When to Use This Skill

- evaluating a promising external AI workflow, tool, or repository
- turning ad hoc research into committed, reviewable repository memory
- running a periodic triage cadence across accumulated candidates
- deciding whether an idea should become a real local task or remain parked/rejected

## Workflow

1. Capture candidate ideas in `.github/harness/memory/radar/` using `_template.md`.
2. Run `technique-triage` to classify each candidate.
3. Route adopted ideas through the normal stage machine before any code changes.
4. Update radar status and decision log after implementation/review outcomes.

## Entry Writing Rules

Every entry should follow the current template and include:

- a one-line first summary line for fast scanning
- source URL, author/project, and capture date
- an explicit status: `candidate`, `adopted`, `parked`, or `rejected`
- a concise technique summary in your own words
- repository-specific relevance, not generic hype
- adoption notes with target files/domains, risks/constraints, and next step
- a decision log entry whenever the status changes

Keep one idea per file. If two ideas have different adoption paths, split them.

## Triage Procedure

Use the `technique-triage` loop as a review-only gate. For each candidate:

1. Confirm the entry is concise, source-linked, and status-tagged.
2. Decide whether the technique is:
   - `adopted`: worth pursuing as a real local task
   - `parked`: promising but not worth immediate adoption
   - `rejected`: intentionally not suitable here
3. Record the decision in the entry's `Decision Log`.
4. If `adopted`, define a concrete next step and point to the likely target files/domains.

The loop must not implement code directly. Triage and route only.

## Adoption Gate

An entry should move to `adopted` only when all of these are true:

- the technique is relevant to a current repository problem or roadmap item
- the entry names a concrete local follow-up task
- the likely target files/domains are identified
- the idea can be routed through Understand -> Architect before implementation
- security scan expectations are satisfied for skill-file entries

If an idea is interesting but the local application is vague, leave it `parked`.

## SkillSpector Gate

For any radar entry centered on adopting an external skill file or skill-pack pattern:

- run `skillspector scan <path> --no-llm` when available, or
- explicitly record a waiver with:
  - written rationale
  - a named human approver
  - a retroactive scan target date within 14 days

Do not mark a skill-file entry as `adopted` without the scan result or waiver being captured in the
entry.

## Routing Adopted Ideas

Adopted ideas do not go straight to implementation. They must become a normal harness task:

1. **Understand**: verify the problem and local impact
2. **Architect**: decide where the idea fits and what the smallest safe slice is
3. **Implement**: land the narrowest reviewable slice
4. **Review Breadth / Depth / Feedback**: validate the change like any other repository work

When an adopted idea ships, update the radar entry with the resulting brief, files, or PR/commit
reference.

## Weekly Cadence

A practical maintenance rhythm for this repo:

- capture candidate ideas whenever they are discovered
- run `technique-triage` on a regular cadence (for example weekly)
- avoid building a backlog of untriaged candidates
- keep adopted entries linked to the follow-up work they triggered

## Capture Guardrails

- Summarize in your own words; include source URLs.
- Never paste secrets, raw dumps, or untrusted executable instructions.
- Focus on ideas with clear relevance to this codebase.
- Keep one idea per file for clean history and easy triage.

## Decision Heuristics

Use these defaults unless the evidence strongly points elsewhere:

- `adopted`: concrete repo problem, clear target surface, bounded next step
- `parked`: interesting, but not current-priority or not yet sufficiently grounded
- `rejected`: conflicts with repository constraints, duplicates existing practice, or lacks enough
  value to justify adoption

## Common Traps

- storing raw external dumps instead of concise summaries
- adopting an idea without naming the smallest local slice
- skipping the stage-machine routing for adopted ideas
- leaving entries in `candidate` indefinitely without periodic triage
- treating radar as implementation memory instead of decision memory

## Optional External Discovery Input

Tools like [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) can be used by
individual developers as a local discovery aid.

- Treat external outputs as raw research only.
- Convert findings into concise radar entries with source links.
- Do not vendor external tool code or keys into this repository.

## Exit Checklist

Before concluding a radar session:

- confirm every touched entry has an explicit status
- confirm adopted entries have a concrete next step
- confirm skill-file entries have a SkillSpector result or waiver
- confirm no code was implemented directly as part of triage

## Usage Scenarios

### Scenario 1: I found a new AI technique. How do I track and evaluate it?

**What this demonstrates:** Shows logging techniques, setting evaluation criteria, and adoption
triaging

### Scenario 2: Should we adopt this new vector search approach?

**What this demonstrates:** Demonstrates technique evaluation and integration decisions
