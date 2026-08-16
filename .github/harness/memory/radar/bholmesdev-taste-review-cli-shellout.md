---
summary: Shell out to a second model's CLI for an ambiguous taste call — rejected because we already have provider-separated cross-model review, and the reference implementation reads a long-lived OAuth token from the OS keychain
status: rejected
source: https://github.com/bholmesdev/skills/blob/main/skills/taste-review/SKILL.md
author_project: bholmesdev (Ben Holmes), MIT
captured: 2026-08-09
tags: [cross-model-review, security, council-review, duplicate]
---

# Taste-Review: CLI Shell-Out for Judgment Calls

## Technique Summary

When a decision is fuzzy — UI polish, phrasing, naming, formatting — instead of guessing, shell out to
a different model's CLI with a plainly-stated question and the relevant file paths, ask for a
recommendation plus alternatives considered, and let the responder choose the depth of the answer.
The reference implementation runs the CLI from the repository root so relative paths resolve, requests
a reusable approval for the command prefix so it can run outside the sandbox, and on macOS pulls a
long-lived subscription OAuth token out of the Keychain, falling back to the machine's normal
authentication.

## Repository Relevance

Rejected for two independent reasons, either of which is sufficient.

**Duplicate capability.** `scripts/harness/council-review.mjs` and `scripts/harness/plan-review.mjs`
already provide cross-model second opinions, and `plan-review.mjs` actively enforces provider
separation — it refuses to run without a `--reviewer` command from a different provider than authored
the subject. The prompt router additionally assigns distinct models per stage. The capability exists
and is better governed than an ad-hoc shell-out.

**Security posture.** The reference implementation reads a long-lived OAuth token from the macOS
Keychain and requests standing approval for a shell prefix that runs outside the sandbox. Importing an
auth-material-handling pattern of that shape into this kit is not acceptable, and it would be the
kind of pattern the harness is supposed to catch, not ship.

The one part worth keeping is a framing detail, not a mechanism: asking for a recommendation *plus
alternatives considered*, with depth matched to the decision. That belongs in our existing review
prompts and needs no new surface.

## Adoption Notes

- **Target files/domains:** none — capability already covered by `council-review.mjs` and
  `plan-review.mjs`
- **Risks/constraints:** Do not vendor this skill file. If a future pass wants the
  recommendation-plus-alternatives framing, add it to the existing review prompt text rather than
  introducing a new shell-out path.
- **SkillSpector gate:** Not applicable — entry is a rejection, nothing is imported.
- **Next step:** None.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from bholmesdev/skills deep dive | radar-pass |
| 2026-08-09 | rejected | Duplicates `council-review.mjs` / `plan-review.mjs`, and the reference implementation's Keychain OAuth read plus out-of-sandbox shell approval is a posture we will not import. Both reasons recorded so this is not re-litigated. | radar-pass |
