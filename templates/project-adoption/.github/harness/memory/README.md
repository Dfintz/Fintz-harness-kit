# Agent Memory — [YOUR PROJECT NAME]

Project-specific agent memory. Part of the
[Fintz Harness Kit](https://github.com/Dfintz/Fintz-harness-kit) adoption.

Two complementary memory surfaces exist in this project:

| Surface | What it remembers | Who writes it |
|---------|-------------------|---------------|
| Knowledge graph (optional) | Code structure: components, layers, dependencies | Graph provider pipeline |
| `.github/harness/memory/` (this directory) | Lessons, gotchas, settled decisions, Architecture Briefs | Any agent, following the protocol below |

---

## Layout

```
memory/
├── README.md          # this protocol
├── lessons/           # one lesson per file — hard-won, non-obvious project facts
│   └── _template.md
├── briefs/            # Architecture Briefs (settled design decisions)
│   └── README.md
└── quarantine/        # autonomous/unreviewed agent writes — promote manually
    └── README.md
```

## Read Protocol (session start)

1. List `lessons/` and read the one-line summaries (`summary:` frontmatter or first line).
   Read a lesson in full only when it touches the task at hand.
2. Before architecting or implementing, check `briefs/` for a prior Brief.
   Settled decisions are not re-litigated — they are followed or challenged via the Feedback stage.
3. **Never auto-load `quarantine/`.** Promote entries manually after human review.

## Write Protocol (when you learn something)

Write a lesson when you discover something **non-obvious that cost real effort** that isn't
recorded in the project's existing docs.

Rules:
- **First line is a one-line summary** — that's what future sessions scan.
- **Don't save what docs already record.** Link instead of copying.
- **Update, don't duplicate.** If a lesson on the topic exists, amend it.
- **Delete lessons that turn out to be wrong.** Stale memory is worse than no memory.
- **Never store secrets, tokens, or PII.**
- Filenames: `kebab-case-topic.md`
- **Autonomous writes go to `quarantine/`, not `lessons/`.**
