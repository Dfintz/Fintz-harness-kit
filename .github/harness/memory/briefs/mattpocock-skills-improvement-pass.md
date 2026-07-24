## Architecture Brief — mattpocock/skills Improvement Pass

resource: https://github.com/mattpocock/skills, .github/harness/memory/radar/, .github/harness/loops/, .github/instructions/, .github/skills/

### Objective

Import 5 high-signal patterns from `mattpocock/skills` into the harness-kit, scoped to patterns that fill confirmed gaps with additive, reviewable changes. Route is `wayfinder` (planning-only) — each ticket resolves a decision before implementation.

---

### Scope and boundaries

**In scope:**
- Diagnosing-bugs feedback-loop-first invariant → `diagnose` loop + `doubt-driven-development` skill
- Standards/Spec axis separation → `.github/instructions/05-REVIEW-BREADTH.md`
- Prototype skill → new `.github/skills/prototype/SKILL.md`
- "Push right" checkpoint deferral → `.github/harness/LOOPS.md` loop invariant
- Ready-for-agent brief format → `.github/harness/memory/README.md` or new brief template
- DESIGN-IT-TWICE interface exploration → `.github/instructions/03-ARCHITECT.md` Gate 5

**Out of scope:**
- Full triage state machine (kit has no issue tracker)
- `loop-me` / `wizard` / `writing-*` (in-progress, non-engineering category)
- Wayfinder sub-agent definitions (requires issue tracker integration)
- `to-spec` full PRD format (Architecture Brief serves this purpose in the harness)
- `to-tickets` (not yet — depends on stable issue tracker config; park)

---

### Key decisions

- **Decision:** Diagnosing-bugs → don't copy 6 phases verbatim; inject only the single missing invariant: "build a tight red-capable feedback loop FIRST, no hypothesis before you have one."
- **Decision:** Two-axis review → adopt conceptual separation (Standards lane and Spec/Brief lane) as named lanes in Review Breadth; no sub-agent infrastructure required.
- **Decision:** `prototype` skill → LOGIC branch only at this stage; UI branch is framework-specific and not kit-portable.
- **Decision:** "Push right" → becomes Loop Invariant 10 in LOOPS.md.
- **Decision:** DESIGN-IT-TWICE → add as optional procedure inside Gate 5 of 03-ARCHITECT.md.

---

### Wayfinder Map

**Destination:** 5 harness improvements landed and validated, each additive and provenance-linked to `mattpocock/skills`.

**Decisions so far:** (none yet — map just opened)

**Not yet specified:**
- Whether `to-tickets` belongs in the harness once a tracker config is standardized
- Whether the LOGIC prototype should plug into the Architect stage's Brief output contract

**Out of scope:**
- Full triage state machine
- `loop-me` workflow spec vocabulary (in-progress upstream)
- `wayfinder` sub-agent definitions (requires tracker integration)

---

### Artifacts to modify

| Ticket | Target | Change | Source |
|---|---|---|---|
| T1 `diagnose-feedback-loop` | `.github/harness/loops/diagnose.json` + `doubt-driven-development` skill | Add "build a tight red-capable feedback loop first — no hypothesis before you have a command that can go red" as a Guardrail and fixPrompt header | `mattpocock/skills/engineering/diagnosing-bugs` |
| T2 `review-breadth-axes` | `.github/instructions/05-REVIEW-BREADTH.md` | Rename Lane 3 to "Functional correctness, safety, and spec conformance" — split into 3a (correctness/safety, existing) and 3b (spec conformance: requirements missing, scope creep, wrong implementation) | `mattpocock/skills/engineering/code-review` |
| T3 `prototype-skill` | New `.github/skills/prototype/SKILL.md` | Create prototype skill (LOGIC branch: throwaway TUI to validate state models; throwaway branch, one command to run, pure logic module, capture answer + context pointer) | `mattpocock/skills/engineering/prototype` |
| T4 `push-right-invariant` | `.github/harness/LOOPS.md` | Add Loop Invariant 10: "Push right — do maximal work before the checkpoint. Present a decision-ready brief, not raw output." | `mattpocock/skills/in-progress/loop-me` |
| T5 `design-it-twice` | `.github/instructions/03-ARCHITECT.md` Step 5 | Add optional procedure under Gate 5 (Reuse): "DESIGN-IT-TWICE — spin up two parallel sub-agents to design the same interface radically differently, then compare on depth, locality, and seam placement. Do this when the right shape is genuinely uncertain." | `mattpocock/skills/engineering/codebase-design` DESIGN-IT-TWICE.md |

### Ticket blocking edges

T3 (prototype-skill) → can start immediately  
T4 (push-right-invariant) → can start immediately  
T5 (design-it-twice) → can start immediately  
T1 (diagnose-feedback-loop) → can start immediately  
T2 (review-breadth-axes) → can start immediately (additive; no blocking dependencies)

All 5 tickets are unblocked and can be executed in any order.

---

### Constraints

- Every change must be additive — no existing lanes, guardrails, or gates removed
- Each change must include a provenance citation: `Adapted from mattpocock/skills/<path>`
- No new dependencies introduced
- Validation: `npm run harness:docs:check` must pass after each ticket

### Do NOT

- Do not copy diagnosing-bugs 6 phases verbatim into the diagnose loop — only the feedback-loop-first invariant
- Do not add the UI prototype branch — it's framework-specific
- Do not break existing Lane 1–6 numbering in Review Breadth — 3b is a sublane, not a new top-level lane
- Do not implement `to-tickets` until a standard tracker config exists in the kit

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
|---|---|---|
| `DESIGN-IT-TWICE.md` content in codebase-design is stable enough to reference | T5 | Low — the parallel sub-agent design pattern is stable regardless of the specific file |
| `diagnose` loop is workflow-kind and won't break if guardrail text is added | T1 | Low — workflow loops are agent-native; text changes don't affect runner |
