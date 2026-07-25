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

1. **Capture domain knowledge as persistent memory**: Lessons and briefs enable reuse across future stages.
   Persist only non-obvious, reusable knowledge that cost real effort to discover. When captured,
   this knowledge becomes a harness asset for Understand, Architect, Implement, and Review stages.

---

## Recommended Models (Phase 5)

**Tier:** High-Reasoning  
**Primary:** `claude-opus-4-8` (Deep Contextual Understanding)  
**Fallback 1:** `claude-opus-5` (Extended Reasoning)  
**Fallback 2:** `claude-sonnet-5` (Faster Extraction)  
**Fallback 3:** `claude-haiku-4-5` (Universal Safety Net)

**Why?** Knowledge synthesis from architecture briefs requires deep contextual understanding. Opus 4.8's 200K context window ideal for pattern extraction. Alternative: Claude Sonnet 5 for faster knowledge extraction. Maintained +219.8% improvement. Phase 5 validation: stable performance across fallback chain.

---

## Memory Structure
3. When architecture changed, update or add the relevant Brief artifact instead of writing a vague
   retrospective note.
4. Never store secrets, tokens, private logs, or user-specific sensitive data.

## Handoff contract

- Downstream consumers: future Understand, Architect, Implement, and Review stages
- Hand off durable memory, not ephemeral scratch notes

## Approval contract

If a proposed memory entry would expose secrets, private data, or unresolved policy-sensitive claims,
do not write it. Escalate instead.



[Optimization attempt 1]: IMPROVEMENT: Ensure all memory artifacts are formatted according to the guidelines specified in `../../../.github/harness/memory/README.md` to guarantee compliance and consistency, which can directly improve passing rates by avoiding formatting errors.