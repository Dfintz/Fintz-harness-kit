# Skill: Understand-Driven Development

> **Use when:** Planning, implementing, reviewing, or risk-assessing any non-trivial change in this
> repository.

> **Codex support:** Optimized for GPT-5.3-Codex. Use Understand graph context to improve accuracy,
> reduce regressions, and make architectural impact explicit.

---

## Objective

Use the local Understand graph as a first-class input to coding decisions so agents can:

- Locate the right ownership/layer faster
- Detect dependency blast radius before and after edits
- Explain risks with evidence from connected components

---

## Standard Flow

### Phase 1: Graph Readiness

1. Run `npm run harness:graph -- provider-status` to confirm the active graph provider/path.
2. Ensure the active graph snapshot exists.
3. Check freshness against `git rev-parse HEAD`.
4. Refresh with `/understand` (or `/understand --full` for larger shifts) when stale.

### Phase 2: Task Discovery

1. Run `/understand-chat <task statement>`.
2. Extract:
   - Primary files/components to edit
   - 1-hop dependent/affected components
   - Relevant architecture layers
3. For key modules, run `/understand-explain <file-or-symbol>`.

### Phase 3: Change Execution

1. Keep edits inside identified ownership boundaries.
2. If you must cross boundaries, document why.
3. Prefer adding tests around:
   - High-complexity nodes
   - Core dependency hubs

### Phase 4: Review and Risk

1. Run `/understand-diff` after edits.
2. Capture:
   - Changed components
   - Affected components
   - Affected layers
   - Risk level and mitigation steps

### Phase 5: Knowledge Transfer (optional)

- `/understand-domain` for business-flow checks
- `/understand-onboard` for onboarding docs or handover guides

---

## Output Template

Use this concise template in final summaries for non-trivial tasks:

1. Graph status: up-to-date or stale
2. Changed components: ...
3. Affected components: ...
4. Affected layers: ...
5. Risk: low/medium/high (one-line reason)

---

## Guardrails

- Do not treat graph output as a substitute for reading edited files.
- If graph freshness cannot be restored, proceed with caution and explicitly report confidence loss.
- Keep graph-derived conclusions testable and tied to concrete files/modules.

## Usage Scenarios

### Scenario 1: I need to understand the blast radius of a database change before implementing.

**What this demonstrates:** Demonstrates graph-first discovery and dependency impact analysis

### Scenario 2: What files are affected if I rename a core service?

**What this demonstrates:** Shows how to trace cross-domain dependencies and usage patterns
