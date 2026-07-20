<!-- harness-kit template: concrete examples below reference the kit's origin project (a TypeScript/Node monorepo). Adapt them to your stack; the workflow and gates are stack-agnostic. -->

---
applyTo: '**'
---

# Understand Workflow

> **Model:** high-reasoning (e.g., `claude-opus-4.8`; Copilot Auto is a safe default) — this stage
> requires sustained multi-hop context-holding across the component graph.
> **Purpose:** Require architecture-aware context using Understand before planning, implementation, and review.

Your core standards remain in `.github/copilot-instructions.md` and `CLAUDE.md`. This file adds an
Understand operating mode to improve agent reasoning and reduce blind edits.

---

## When This Applies

Apply this workflow for any task that is not trivial. Treat the task as non-trivial when it:

- Modifies more than one file
- Changes APIs, shared types, routes, or database behavior
- Touches auth, security, tenancy, caching, or infrastructure
- Includes review, risk analysis, or impact analysis requests

For trivial one-file typo/doc fixes, this workflow is optional.

---

## Step 1: Graph Freshness Gate (Mandatory for non-trivial tasks)

Before planning code changes:

1. Run `npm run harness:graph -- status` (exits non-zero and reports how many commits / source files
   the graph is behind HEAD; this automates the old manual `gitCommitHash` compare).
2. Optionally run `npm run harness:graph -- provider-status` to confirm which provider/path is active.
3. If stale:
   - Run `/understand` for incremental refresh.
   - Use `/understand --full` for broad refactors or major architecture changes.
4. If refresh is not possible, continue only with explicit warning about reduced confidence.

Then query the graph instead of reading the multi-megabyte JSON — these commands return only the
slice you need:

- `npm run harness:graph -- dependents <filePath>` — who imports a file (blast radius).
- `npm run harness:graph -- neighbors <nodeId> [--depth N] [--type imports]` — direct edges.
- `npm run harness:graph -- path <srcId> <dstId>` — how two nodes connect.
- `npm run harness:graph -- layer <name>` / `layers` — architectural-layer membership.
- `npm run harness:graph -- hubs` — highest-degree nodes (refactor-risk hotspots).

---

## Step 2: Architecture Discovery (Mandatory for non-trivial tasks)

Before editing files:

1. Run `/understand-chat` with the task statement to identify impacted components and layers.
2. Use `/understand-explain` for critical files, services, or modules that are touched.
3. Capture a short map in your working notes:
   - Changed components (direct)
   - Affected components (1-hop dependencies/callers)
   - Layers involved
   - Complexity hotspots

---

## Step 3: Implementation Boundaries

During edits:

- Keep changes within the discovered layer boundaries unless the task explicitly requires boundary
  shifts.
- If crossing a boundary, justify the ownership decision in the final summary.
- Prioritize tests for high-complexity nodes and high-blast-radius dependencies.

---

## Step 4: Diff Impact Review (Mandatory for non-trivial tasks)

After edits and before final response:

1. Run `/understand-diff`.
2. Include in your summary:
   - Changed components
   - Affected components
   - Affected layers
   - Key risks and mitigations

When relevant:

- Use `/understand-domain` for business-flow verification.
- Use `/understand-onboard` when creating onboarding or knowledge-transfer docs.

---

## Required Final Note

For non-trivial tasks, include an Understand status line in your completion summary:

- Graph status: up-to-date or stale
- Understand tools used: chat, explain, diff, domain, onboard (as applicable)
- Residual risk: low, medium, or high with one-line reason
