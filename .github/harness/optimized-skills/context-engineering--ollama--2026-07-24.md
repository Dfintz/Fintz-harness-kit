---
name: context-engineering
description: Session memory hygiene, task-switch checkpointing, and compact handoff authoring. Use at session start and when switching tasks to preserve and recover context.
---

# Skill: Context Engineering

> Use when: Starting any harness session, switching tasks, or when agent output quality drops and
> the root cause is missing or stale context rather than a code problem.

Adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) —
`context-engineering` skill. Condensed to this repo's conventions.

---

## Objective

Feed the agent the right information at the right time so it makes correct decisions without
rediscovering what a prior session already established.

---

## Process

### Step 1 — Load committed memory first

Before any discovery or code work:

1. Read `.github/harness/memory/README.md` for the memory protocol.
2. Scan lesson one-liners in `.github/harness/memory/lessons/` — read in full only if relevant.
3. Check `.github/harness/memory/briefs/` for a prior Architecture Brief covering the area.
4. Check `.github/harness/memory/radar/` for any adopted technique entries relevant to the task.

### Step 2 — Check graph freshness

Run `npm run harness:graph -- status`. If stale, note confidence loss; for harness-only tasks
proceed with file grounding. For source-code tasks refresh with `/understand` and commit.

### Step 3 — Pack task-relevant context, prune the rest

| Include                                               | Exclude                              |
| ----------------------------------------------------- | ------------------------------------ |
| Files directly touched or imported by touched files   | All of `docs-archive/`               |
| Relevant Architecture Brief                           | Unrelated controller/service files   |
| Relevant lessons and radar entries                    | Generated files (`dist/`, snapshots) |
| Harness loop / skill definitions for the active stage | Irrelevant test fixtures             |

### Step 4 — State your context inventory before acting

Before producing code or a plan, list:

- Which memory files were consulted
- Which files will be read/edited
- What graph status reported

This is a 3-line block, not a narrative. It makes context gaps visible before they cost work.

### Step 5 — Write back before closing

At end of session, if something non-obvious was learned:

- If it's a hard-won fact: write a lesson to `.github/harness/memory/lessons/`.
- If it's a settled design decision: persist the Architecture Brief to
  `.github/harness/memory/briefs/`.
- If it's an external technique to track: add a radar entry to `.github/harness/memory/radar/`.

---

## Anti-Rationalization Table

| Excuse                                     | Counter                                                                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll just re-derive it, it's faster."     | No. Re-derivation burns tokens and reintroduces drift. Check memory first — always.                                                                                                                             |
| "The graph is stale, I can't proceed."     | Stale graph is a confidence warning, not a blocker. For harness-only/config-only tasks proceed with file grounding and report confidence loss. For source-code tasks: refresh with `/understand` before acting. |
| "I don't know which lessons are relevant." | Scan the one-liners. 30 seconds. Do it anyway.                                                                                                                                                                  |
| "The context is getting too long."         | Prune irrelevant files (step 3). Load only what's necessary for this specific task.                                                                                                                             |

---

## Verification

Session is context-ready when:

- [ ] Memory consulted (lessons one-liners scanned, relevant briefs opened)
- [ ] Graph status checked
- [ ] Context inventory stated before first substantive output

## Usage Scenarios

### Scenario 1: I am switching to a new task. How do I preserve context?

**What this demonstrates:** Shows session memory saving and task-switch checkpoint creation

### Scenario 2: My output quality is declining. Is it a context issue?

**What this demonstrates:** Demonstrates context inventory analysis and refresh patterns
