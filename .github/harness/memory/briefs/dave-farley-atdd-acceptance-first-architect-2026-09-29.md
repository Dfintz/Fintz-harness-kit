# Architecture Brief: ATDD-Style Acceptance-First Validation Planning in Architect
resource: .github/harness/memory/radar/dave-farley-atdd-driven-agentic-workflow.md, .github/instructions/03-ARCHITECT.md, .github/skills/deterministic-validation/SKILL.md, .claude/skills/architect/SKILL.md
Status: active

## Architecture Brief

### Objective

- Adopt the radar candidate `dave-farley-atdd-driven-agentic-workflow.md` by making the Architect
  stage's Validation plan section explicitly require *acceptance-criteria-first* thinking (writing
  the executable checks before Implement starts) instead of treating validation as an afterthought
  discovered during Implement.

### Scope and boundaries

- In scope: the Architect stage contract (`03-ARCHITECT.md`), a one-line cross-reference from
  `deterministic-validation`, and closing the radar loop (status update + decision log + shipped
  evidence).
- Out of scope: building a new DSL/BDD framework, changing the `acceptance-gate.mjs` tool itself,
  making acceptance specs mandatory for every task (the harness already scopes Architect to
  non-trivial work), or any change to Implement/Review stage contracts.
- Primary boundary: stage-contract documentation under `.github/instructions/` and
  `.github/skills/deterministic-validation/`. No code paths change.
- Understand findings: the harness already has a working acceptance-gate mechanism
  (`scripts/harness/acceptance-gate.mjs` — `scaffold` / `baseline` / `verify`) referenced by
  `deterministic-validation` as *one example* of a deterministic proof, listed alongside tests/lint/
  build checks and only reached for "when none of the above exists yet." The radar technique's
  actual novelty is sequencing, not tooling: write the acceptance checks as part of the Brief
  (Architect), before Implement, so they function as the executable spec/contract handed downstream —
  not a fallback invented after code exists. No new script or dependency is required.

### Artifacts to create

- None. This is a documentation-only sequencing clarification layered on existing tooling.

### Artifacts to modify

- `.github/instructions/03-ARCHITECT.md` — Step 4 ("Define execution constraints") and the
  "Validation plan" line of the Output contract: add guidance that for testable changes, the Brief
  should state concrete acceptance checks (reusing `acceptance-gate.mjs scaffold`/`baseline` where a
  command-based check doesn't already exist) as part of Architect output, not deferred to Implement.
- `.github/skills/deterministic-validation/SKILL.md` — one-line cross-reference noting that
  Architect is the preferred place to draft the acceptance-gate spec when the task is testable and
  no existing check covers it, so proof selection isn't reinvented mid-Implement.
- `.github/harness/memory/radar/dave-farley-atdd-driven-agentic-workflow.md` — update `status` to
  `adopted`, add a Decision Log row, and note this Brief as the shipped follow-up.

### Key decisions

- Decision: treat this as a **sequencing** change (when acceptance checks get written) rather than a
  **tooling** change (what mechanism proves them) — the harness already has `acceptance-gate.mjs`;
  duplicating it would fail the reuse gate (Gate 5).
- Decision: keep the guidance advisory ("should", not "must") for Architect, consistent with the
  existing Brief output contract which already allows "checks, tests, previews, dry-runs, or
  approvals" as validation-plan options — this avoids forcing acceptance-gate specs onto Architect
  work where a simpler proof (existing test suite, lint, build) already suffices.
- Decision: do not touch Implement/Review Depth contracts — Review Depth already compares
  implementation against the Brief, so an acceptance-first Validation plan is enforced transitively
  once Architect states it.
- Gate 1 (domain alignment): PASS — validation planning already lives in Architect and
  deterministic-validation; this reinforces existing ownership.
- Gate 2 (generality): PASS — applies to any testable non-trivial task, not a one-off.
- Gate 3 (ownership): PASS — Architect owns the Brief's Validation plan section; deterministic-validation
  owns proof mechanics.
- Gate 4 (boundary integrity): PASS — no execution-surface responsibilities move; Implement still
  implements, Architect still only plans.
- Gate 5 (reuse): PASS — reuses `acceptance-gate.mjs` rather than introducing a parallel mechanism.

### Constraints

- Must not make acceptance-gate specs mandatory for every Architect Brief — only for testable
  changes where no existing check already covers the exit criteria.
- Must not duplicate or fork `acceptance-gate.mjs` behavior in documentation.
- Must preserve the existing Validation plan bullet's flexibility (tests/lint/build/approvals remain
  valid options) — this is an addition, not a replacement.
- Radar entry must not be marked `adopted` until this Brief's edits are actually applied and
  reviewed (Feedback stage closes the loop).

### Validation plan

- `npm run harness:docs:check` — confirm registry/doc references still resolve after edits.
- `npm run harness:memory:references:check` — confirm memory/radar cross-references remain valid
  after the radar entry status change.
- Manual read-through: confirm `03-ARCHITECT.md`'s Output contract and Step 4 still parse as a
  single coherent contract (no duplicate or contradictory validation guidance).

### Do NOT

- Do not implement a new BDD/DSL framework or modify `acceptance-gate.mjs` behavior in this slice.
- Do not mark the radar entry `adopted` before the doc edits land and pass Review Depth/Feedback.
- Do not make acceptance-first planning a hard gate that blocks trivial-mode tasks (this harness
  already routes trivial tasks around the full Architect stage).

### Assumptions and risks

- `[UNVERIFIED]` The source video's full technique may include mechanics beyond what title/
  description/pinned-comment reveal (transcript was unavailable). This Brief adopts only the
  narrow, low-risk, already-supported idea (acceptance-first sequencing) and explicitly does not
  adopt anything requiring the unseen transcript content.
- Risk if wrong: if the full video describes a materially different mechanism, this Brief's scope
  is still valid as a standalone, harness-consistent practice — it does not depend on the unverified
  parts being correct.
