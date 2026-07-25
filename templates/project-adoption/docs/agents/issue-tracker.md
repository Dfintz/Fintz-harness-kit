# Issue Tracker — [YOUR PROJECT NAME]

Agent configuration for issue tracking in this repository.

## Mode

**`github`** — issues are tracked in GitHub Issues on this repository.

<!-- Change to `local-markdown` if tracking in docs/issues/*.md instead. -->

## Workflow

| State | Label | Meaning |
|-------|-------|---------|
| Incoming | `needs-triage` | New issue, not yet reviewed |
| Awaiting info | `needs-info` | Blocked on reporter response |
| Agent ready | `ready-for-agent` | Scoped, reproducible, agent can work on it |
| Human required | `ready-for-human` | Requires judgment, design decision, or deploy access |
| Closed | `wontfix` | Declined — add comment explaining why |

## Triage Rules

1. An agent must not close issues without a human review comment unless the issue is a duplicate
   (link the duplicate).
2. Issues labelled `ready-for-agent` are fair game for autonomous fix loops.
3. Issues labelled `ready-for-human` must be escalated, never silently ignored.
4. Security-related issues (labelled `security`) must never be worked on without human sign-off.

## Labels Reference

See [`triage-labels.md`](./triage-labels.md) for the full label vocabulary.
