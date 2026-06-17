# Skill Curation

Committed, curated tracker for the health and lifecycle of this repository's **own** harness skills.

Generate the health signal with `npm run harness:skill:curate -- --json`, then triage with the
`skill-curation` workflow loop.

## Lifecycle (one decision per skill that needs action)

- `keep`: healthy; no action (usually not recorded — only record skills that need a decision)
- `promote`: experimental → active
- `merge`: fold an overlapping/duplicate skill into another (dedupe)
- `deprecate`: mark metadata `status` deprecated; plan removal; keep while still referenced
- `retire`: remove a skill that is no longer needed

Status is recorded inside each entry file, not in folder names.

## Entry Rules

1. One skill per file, using `_template.md`. Only record skills the scanner flags
   (`orphan` / `stale` / `metadata-invalid` / `deprecated-but-referenced` / high-drift).
2. The first line must be a one-line summary for fast scanning.
3. Cite the `skill-curate` finding(s) that prompted the entry.
4. Never store secrets, tokens, or raw third-party dumps.
5. Decisions that **change** a skill (merge/retire/rewrite/promote) route through the normal stage
   machine (Understand → Architect → Implement → Review → Feedback). This surface **records** the
   decision; it does not perform it.

## Triage Cadence

Run the `skill-curation` workflow loop periodically. It is review-only and must not edit or delete
skills directly; accepted changes route back through the stage machine.

## Decision Log

Each entry keeps a dated decision log so the same skill is not repeatedly re-triaged.
