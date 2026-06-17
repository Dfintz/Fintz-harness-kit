# AI Techniques Radar

Committed, curated tracker for new AI engineering techniques and ideas that may be relevant to this
repository.

This surface complements:

- `.github/harness/memory/lessons/` for hard-won implementation gotchas
- `.github/harness/memory/briefs/` for settled architecture decisions

Use this directory to track candidate techniques from external sources (for example,
`last30days-skill` outputs, blog posts, conference talks, or high-signal repo updates).

## Lifecycle

- `candidate`: captured and waiting for triage
- `adopted`: accepted for use; should reference implementation PR/brief
- `parked`: potentially useful, but not worth adopting now
- `rejected`: reviewed and intentionally not adopted

Status is recorded in each entry file, not in folder names.

## Entry Rules

1. One idea per file, using `_template.md`.
2. First line must be a one-line summary for fast scanning.
3. Store concise summaries plus source links, not raw scraped transcripts.
4. Never store secrets, tokens, proprietary text dumps, or PII.
5. Link to affected local files/briefs when moving to `adopted`.
6. `adopted` entries must name a concrete next task and the likely local target files/domains.
7. Entries about external skill files must record a SkillSpector result or an explicit waiver.

## Adoption Gate

Before a candidate moves to `adopted`, it should have all of the following:

- a repository-specific relevance statement
- a concrete next step
- likely target files/domains
- a clear routing path back through Understand -> Architect before implementation
- SkillSpector scan evidence or an explicit waiver for skill-file entries

If any of these are missing, prefer `parked` over premature adoption.

## SkillSpector / Waiver Rules

For entries centered on adopting external skill files or skill-pack patterns:

- preferred: `skillspector scan <path> --no-llm`
- acceptable waiver only if the entry records:
  - written rationale
  - a named human approver
  - a retroactive scan target date within 14 days

## Triage Cadence

Run the `technique-triage` workflow loop periodically (for example weekly) to move candidates to
`adopted`, `parked`, or `rejected`.

The loop is intentionally review-only and must not implement code directly; accepted ideas route
back through the normal stage machine (Understand -> Architect -> Implement -> Review -> Feedback).

## Post-Triage Expectations

- `adopted` entries should later link to the resulting brief, commit, or PR when work ships
- `parked` entries should still explain why they are not immediate priorities
- `rejected` entries should keep the decision rationale so the same idea is not repeatedly re-raised
