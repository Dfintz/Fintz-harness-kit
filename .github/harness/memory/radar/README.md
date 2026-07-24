# AI Techniques Radar

> Committed, agent-agnostic memory for tracking external AI engineering ideas under evaluation.
> Part of the [Agent Harness](../../HARNESS.md). Governed by the
> [ai-techniques-radar skill](../../../skills/ai-techniques-radar/SKILL.md).

## Status Values

| Status | Meaning |
|---|---|
| `candidate` | Captured, not yet triaged |
| `adopted` | Approved for a real harness task — see entry for next step |
| `parked` | Promising but no immediate local application |
| `rejected` | Intentionally not suitable here — reason recorded |

## Layout

```
radar/
├── README.md          # this file
├── _template.md       # copy to create new entries
└── <slug>.md          # one file per idea
```

## Workflow

1. Copy `_template.md` to a new slug file and fill in all required fields (status = `candidate`).
2. Run `npm run harness:loop -- harness-triage-technique` or manually triage each candidate.
3. Update `Decision Log` in the entry with every status change.
4. Route `adopted` ideas through the full stage machine before any code changes.

## Read Protocol

At session start, list this directory and scan the first-line summaries.
Load individual entries only when relevant to the current task or when running a triage pass.

## Adoption Gate

An entry moves to `adopted` only when ALL of the following are true:
- the technique solves a current harness problem or roadmap item
- a concrete local follow-up task is named
- target files/domains are identified
- it can be routed through Understand → Architect before implementation
- for skill-file entries: SkillSpector scan complete or waiver recorded
