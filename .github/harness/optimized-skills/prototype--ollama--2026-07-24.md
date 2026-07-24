---
name: prototype
description: Build a throwaway Logic prototype to validate a state model or data shape before committing to an Architecture Brief. Use when the design question is about business logic, state transitions, or data shape — the kind that looks reasonable on paper but only feels wrong once you push it through real cases.
---

# Skill: Prototype (Logic Branch)

Adapted from [mattpocock/skills `prototype`](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype)
and [mattpocock/skills `prototype/LOGIC.md`](https://github.com/mattpocock/skills/blob/main/skills/engineering/prototype/LOGIC.md).

> **When to use:** A design decision in the Architect stage is uncertain about state transitions,
> data model edge cases, or API shape. You want to validate before writing the Architecture Brief.

---

## When this is the right shape

- "I'm not sure if this state machine handles the edge case where X then Y."
- "Does this data model let me represent the case where..."
- "I want to feel out what the API should look like before writing the Brief."
- Anything where the question is answered by **pressing buttons and watching state change**.

If the question is "what should this look like visually" → use a UI prototype tool, not this skill.

---

## Process

### 1. State the question

Before writing code, write one paragraph: what state model and what question is this prototype
answering? A prototype that answers the wrong question is pure waste — make the question explicit.

### 2. Pick the language

Use whatever the host project uses. Match existing tooling conventions — don't add a new package
manager or runtime.

### 3. Isolate the logic in a portable module

Put the actual logic — the bit answering the question — behind a small, pure interface that could be
lifted into the real codebase later. Pick the shape that fits the question:

- **Pure reducer** — `(state, action) => state` — discrete events, single state value
- **State machine** — explicit states and transitions — "which actions are even legal now"
- **Set of pure functions** over a plain data type — no implicit current state

Keep it pure: no I/O, no terminal code, no `console.log` for control flow.

### 4. Build the smallest TUI that exposes the state

A lightweight terminal UI — on every tick, clear the screen and re-render the whole frame:

1. **Current state** — pretty-printed, one field per line
2. **Keyboard shortcuts** at the bottom — `[a] add item  [d] delete  [q] quit`

Behaviour: initialise state → read one keystroke → dispatch to handler → re-render → loop until quit.

### 5. Make it runnable in one command

Add a script to the project's existing task runner. The user must be able to start it without
thinking about the path.

### 6. Hand it over

Give the user the run command. The interesting moments are when they say "wait, that shouldn't be
possible" or "huh, I assumed X would be different" — those are bugs in the *idea*, which is the point.

### 7. Capture the answer, then capture the prototype

Once the question is answered:
1. **Record the answer** — the verdict and the question it settled — in the originating issue or
   Architecture Brief.
2. **Commit the prototype to a throwaway branch** (`prototype/<name>`) and leave a context pointer
   (branch link) on the Brief or issue. The main branch keeps only the validated decision.
3. The pure logic module (reducer / state machine / functions) can be lifted into the real module
   as-is — the TUI shell stays on the throwaway branch.

---

## Rules

1. **Throwaway from day one.** Name it clearly as a prototype (e.g., `proto-order-state.ts`).
2. **One command to run.** No thinking about paths.
3. **No persistence by default.** State lives in memory.
4. **Skip the polish.** No tests, no error handling beyond runnable, no abstractions.
5. **Surface the state.** After every action, re-render the full relevant state.
6. **Capture it when done.** Commit to a throwaway branch; don't let it rot in the working tree.

## Anti-patterns

- Don't add tests to the prototype
- Don't wire it to the real database
- Don't generalise — one question per prototype
- Don't blur the logic and the TUI — the reducer must be pure
- Don't ship the TUI shell into production
