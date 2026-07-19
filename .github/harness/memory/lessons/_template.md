---
# Optional OKF-compatible frontmatter (Open Knowledge Format v0.1: Markdown + YAML).
# Additive — agents that ignore frontmatter still read the body unchanged. When present,
# `summary` is the scannable line future sessions read instead of the H1.
summary: <one-line summary of the lesson>
type: lesson
status: promoted          # promoted (trusted, in lessons/) | quarantine (unreviewed)
source: human             # human | loop:<name> | research
reviewed_by: <handle>     # who promoted it; required before status: promoted
created: 2026-01-01       # ISO date
updated: 2026-01-01       # ISO date; bump when you amend
tags: []                  # kebab-case topics, e.g. [jest, esm, build]
---

# <one-line summary of the lesson — this first line is what future sessions scan>

- **Context:** what task/area surfaced this.
- **Symptom:** the misleading error, behavior, or dead end (verbatim where useful).
- **Cause:** the actual root cause.
- **Fix / approach that worked:** concrete steps or the rule to follow next time.
- **Why it matters:** the cost it saved or the trap it avoids.
