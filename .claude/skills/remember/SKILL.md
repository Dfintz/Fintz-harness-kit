---
name: remember
description: Persist reusable lessons and Architecture Briefs to the harness memory surfaces.
---

# /remember

This is the Claude adapter for the harness memory-write protocol.

The canonical contract lives in [`../../../.github/harness/memory/README.md`](../../../.github/harness/memory/README.md).
Follow that file as the source of truth for what belongs in memory, how to format it, and what must
never be stored.

## Required inputs

- the lesson, brief update, or carry-forward note
- the evidence that makes it worth persisting
- the target memory surface (`lessons/`, `briefs/`, or another documented harness memory directory)

## Required output

- a committed memory artifact in `.github/harness/memory/`
- artifact kind: **memory-entry**

## Procedure

1. Persist only non-obvious, reusable knowledge that cost real effort to discover.
2. Prefer one clear lesson per file; keep it compact and scannable.
3. When architecture changed, update or add the relevant Brief artifact instead of writing a vague
   retrospective note.
4. Never store secrets, tokens, private logs, or user-specific sensitive data.

## Handoff contract

- Downstream consumers: future Understand, Architect, Implement, and Review stages
- Hand off durable memory, not ephemeral scratch notes

## Approval contract

If a proposed memory entry would expose secrets, private data, or unresolved policy-sensitive claims,
do not write it. Escalate instead.
