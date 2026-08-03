---
summary: "Architecture Brief — deeper source-level audit of SSSF and fusion-harness"
type: brief
status: active
source: research
created: 2026-08-03
updated: 2026-08-03
tags: [research, audit, sssf, fusion-harness, 2026]
---
# Architecture Brief — deeper source-level audit of SSSF and fusion-harness

resource: .github/harness/memory/briefs/external-harness-learnings-2026-08-03.md, scripts/harness/graph-provider.mjs, scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs, scripts/harness/harness-evolve.mjs, external/sssf/SKILL.md, external/sssf/data_types.py, external/sssf/gates.py, external/sssf/tracer.py, external/sssf/agent_pi.py, external/sssf/permissions.py, external/sssf/quality.py, external/sssf/adw_plan_build_test.py, external/fusion/fusion-harness.ts, external/fusion/SYSTEM_PROMPT_VALIDATOR.md, external/fusion/SYSTEM_PROMPT_TRIAGE.md, external/fusion/USER_PROMPT_VALIDATOR.md, external/fusion/USER_PROMPT_BUILDER.md, external/fusion/USER_PROMPT_CORRECTION.md, external/fusion/USER_PROMPT_TRIAGE.md, external/fusion/USER_PROMPT_FUSION_MERGE.md

**Date:** 2026-08-03  
**Status:** APPROVED

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| Prior external learning brief | Initial README-level adoption recommendations | Harness memory |
| SSSF `SKILL.md` | Actual lazy-load and orchestration rules | External skill contract |
| SSSF `data_types.py` | Typed envelope model, gate report types, config contract | External runtime core |
| SSSF `gates.py` | Claim-verifying gates and deterministic test gate factory | External runtime core |
| SSSF `tracer.py` | WAL SQLite trace design and additive migrations | External observability |
| SSSF `agent_pi.py` | Event-stream capture, model resolution, tool-call folding | External runtime bridge |
| SSSF `permissions.py` | Post-factum repo mutation enforcement with rollback | External safety boundary |
| SSSF `quality.py` | Deterministic code-phase quality blocks and envelope adapter | External deterministic validation |
| SSSF `adw_plan_build_test.py` | Representative thin workflow shape | External orchestration example |
| fusion `fusion-harness.ts` | Real orchestration, persistence, artifact, widget, and gate loop code | External runtime core |
| fusion validator/triage/builder prompts | Exact gate-first and correction contracts | External prompt contract |
| Local harness docs and scripts | Current owners for any adoption in this repo | Harness-kit runtime/docs |

**Scope:** workflow / architecture research  
**Primary boundary:** whether source-level evidence changes the previously recorded adoption priorities or boundaries

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Full execution traces from both external repos | Whether runtime behavior under failure perfectly matches the source contracts inspected |
| Complete audit of every external helper/module | Whether additional low-level patterns beyond the inspected files merit adoption |

Proceeding is safe because this task is an adoption audit, not a parity implementation. Residual uncertainty is confined to uninspected helper surfaces, not the core mechanisms audited here.

## Understand Output

### Changed components

- `.github/harness/memory/briefs/` — new source-audit brief and downstream stage artifacts

### Affected components

- Future validation-loop surfaces: `.github/instructions/04-IMPLEMENT.md`, `.github/harness/loops/feature-cycle.json`, `.github/skills/deterministic-validation/SKILL.md`
- Future run-artifact surfaces: `scripts/harness/prompt-router.mjs`, `scripts/harness/record-run.mjs`, `scripts/harness/stage-state.mjs`, `scripts/harness/report-server.mjs`
- Possible future safety surface: spawned-agent mutation auditing around harness-owned subprocess paths

### Layers involved

- Stage contract
- Deterministic validation
- Run observability
- Spawned-agent safety boundaries

### Complexity hotspots

- fusion-harness's gate-first loop is stronger than a generic "write a test first" pattern because it couples immutable off-repo gate ownership, red-baseline proof, triage, and one-shot gate repair.
- SSSF's write-boundary enforcement is more concrete than a policy note: it snapshots the repo, detects both edits and reversions, and rolls breaches back before failing the phase.
- SSSF typed envelopes are a coherent runtime design, but they depend on a homogeneous orchestration layer and synchronized prompt/type/call-site maintenance that this kit does not currently enforce.

## Source-Level Findings

### Confirmed in SSSF source

- README claims about typed outputs are accurate and stronger than initially summarized: `data_types.py` defines a true output contract triad around `EnvelopeBase`, `output_type`, and agent report examples.
- "Known command is code" is not rhetorical. `quality.py` implements deterministic command blocks and wraps failures back into typed envelopes for the builder.
- Observability is genuinely first-class. `tracer.py` writes every event to JSONL and SQLite in WAL mode with dedicated tables for phases, envelopes, gates, agent sessions, and processes.
- Write boundaries are enforced after the fact, not just declared. `permissions.py` snapshots git-visible state, detects unauthorized additions/edits/reversions, attempts rollback, and aborts the phase loudly.
- Workflow scripts are intentionally thin. `adw_plan_build_test.py` mostly wires phases, gates, and deterministic code blocks; low-level logic stays in modules.

### Confirmed in fusion-harness source

- Gate-first validation is fully realized in code, not just prompt phrasing. `fusion-harness.ts` creates the gate before building, requires a baseline run, loops builder corrections against exact gate output, and halts after a cap.
- The strongest portable mechanic is the gate ownership model: the validator writes `gate.py` to an external artifacts dir, the builder sees but cannot mutate it, and triage may repair it once under explicit constraints.
- Comparative fusion is grounded in explicit artifacts. The fuser is handed exact paths for both source answers and asked to produce a Consensus & Divergence close.
- Several behaviors remain runtime-specific and should not be imported into this kit's core contract: persistent per-role sessions, host-session forking, Pi-specific widget/footer rendering, and TUI escape interception.
- The repo already anticipates collision risk from concurrent writers and mitigates it with read-only opinion mode and filename rules, which confirms that generic parallel dual-writer adoption should remain parked here.

## Architectural Gates

### Gate 1 — Domain / module alignment

Pass. The proper owner of this work remains harness research and future harness runtime/docs surfaces, not editor-specific integrations.

### Gate 2 — Generality

Pass with refinement. The portable patterns are:

- deterministic gate-first validation
- manifest-backed run artifacts
- post-factum mutation auditing for spawned agents

The non-portable patterns are Pi session persistence, TUI rendering, and Python-specific ADW structure.

### Gate 3 — Ownership

Pass. Source-level evidence sharpens ownership:

- gate-first acceptance belongs to validation/loop surfaces
- artifact bundles belong to run-journal/state/report surfaces
- mutation-audit, if adopted, belongs only around harness-owned spawned agent workflows, not around the editor host itself

### Gate 4 — Boundary integrity

Pass with a stricter rule. Do not collapse gate authoring, builder execution, and gate repair into one agent role. fusion-harness's value comes from preserving those seams.

### Gate 4b — Isolation / safety boundary

Pass with one promotion. SSSF source shows that mutation auditing is sufficiently concrete to justify a future narrow adoption candidate, but only where this repo itself launches subprocess agents and can compare pre/post filesystem state without conflicting with editor-owned writes.

### Gate 5 — Reuse

Pass. Existing harness structures can absorb the portable lessons without introducing a second orchestration framework.

## Key Decisions

1. **Keep gate-first acceptance as the top recommendation, but make it more specific.**
   The portable slice is not merely "acceptance before implementation". It is validator-owned immutable acceptance artifacts, baseline-red proof, verbatim failure feedback, bounded escalation, and at most one audited gate repair.

2. **Keep unified feature run bundles as the second recommendation.**
   Source inspection increases confidence that SSSF-style durable artifact chains are worth adopting, but it does not move them ahead of gate-first validation.

3. **Keep comparative review artifacts as the third recommendation.**
   fusion-harness confirms that Consensus & Divergence is a real useful output contract, but the adoption should remain machine-readable and repo-neutral rather than UI-led.

4. **Promote a new narrow candidate: spawned-agent mutation audit for isolated or manifest-bounded subprocess workflows only.**
   This is a refinement of the previously parked generic rollback idea. The source audit shows the pattern is concrete and valuable, but its safe owner here is limited to harness-controlled subprocess flows, not all editors or all tools.

5. **Keep typed envelope parity as a parked idea, not an adoption target.**
   SSSF proves the design works, but this kit should not adopt mandatory typed response contracts repo-wide without a homogeneous runtime and synchronized prompt/type/call-site enforcement.

6. **Keep Pi-specific session persistence and UI mechanisms rejected for the core kit.**
   They are effective in fusion-harness but do not satisfy this repo's project-agnostic boundary.

## Revised Follow-up Slices

### Slice A — Immutable Gate-First Acceptance Workflow

**Intent:** add an optional workflow where a validator-owned acceptance artifact exists before implementation and remains outside builder control.  
**Likely target files:** `.github/harness/loops/feature-cycle.json`, `.github/instructions/04-IMPLEMENT.md`, `.github/skills/deterministic-validation/SKILL.md`, possible new helper under `scripts/harness/`.

**Desired behavior:**

- generate or author acceptance criteria before implementation
- require baseline fail or explicit already-done branch
- preserve builder/gate separation
- allow at most one explicit, audited gate-repair path
- feed exact gate output back as correction input

### Slice B — Unified Feature Run Bundle

**Intent:** gather full feature-stage artifacts under one stable run directory with a manifest.  
**Likely target files:** `scripts/harness/prompt-router.mjs`, `scripts/harness/record-run.mjs`, `scripts/harness/stage-state.mjs`, `scripts/harness/report-server.mjs`, `README.md`.

**Desired behavior:**

- route/handoff mints or reuses a run id
- stage artifacts land under one manifest-backed run directory
- downstream reviewers and dashboards can navigate a single run package
- partial-write recovery is explicit

### Slice C — Consensus/Divergence Review Ledger

**Intent:** formalize multi-model or multi-review output into a structured consensus/divergence artifact.  
**Likely target files:** `scripts/harness/plan-review.mjs`, `scripts/harness/prompt-router.mjs`, prompt-pack surfaces, `README.md`.

**Desired behavior:**

- record what both reviewers agreed on
- record what only one surfaced
- record what was discarded and why
- store it as a machine-readable sidecar rather than a UI-only render

### Slice D — Spawned-Agent Mutation Audit

**Intent:** add optional pre/post filesystem auditing only where the harness owns an isolated worktree or a manifest-bounded target set for a subprocess agent.  
**Likely target files:** run-loop or future spawned-agent wrappers, possibly a new helper under `scripts/harness/`.

**Desired behavior:**

- snapshot permitted repo-visible state before a spawned agent run
- detect unauthorized edits or reversions after the run
- report and, when safe, roll back only agent-introduced breaches
- avoid interfering with pre-existing user dirty state
- require either an isolated worktree or an explicit manifest/target boundary before rollback is allowed
- extend existing integrity primitives rather than introducing a second unrelated audit system

**Why fourth:** valuable and source-validated, but it is a narrower safety primitive than the top three operator-facing improvements

## Constraints

- Keep the harness project-agnostic.
- Reuse existing run, loop, and review surfaces instead of introducing a second orchestration framework.
- Constrain any mutation-audit adoption to harness-owned subprocess boundaries; do not attempt to police the editor host's own tool runtime.
- Constrain any mutation-audit adoption to isolated worktrees or explicit manifest-bounded target sets; a dirty shared worktree is analysis-only, not rollback-safe.
- Do not adopt Pi session persistence, TUI widgets, or host-session forking as harness-core requirements.
- Do not require typed agent envelopes across the existing heterogeneous stage machine without first adding a matching runtime enforcement layer.

## Do-NOTs

- Do NOT copy external code, prompts, or Python ADW structure directly.
- Do NOT treat fusion-harness's per-role persistent sessions as a portable default.
- Do NOT merge validator, builder, and repair authority into one unconstrained role.
- Do NOT let a gate-repair mechanism weaken legitimate checks or run more than once per attempt cycle without explicit human review.
- Do NOT introduce generic rollback of all repo writes across all runtimes; keep any audit surface narrowly owned.
- Do NOT attempt rollback from a mixed dirty worktree unless the harness owns a fully isolated execution root or a manifest that bounds every allowed target.
- Do NOT convert the current prose-stage outputs into mandatory typed envelopes unless the whole call chain can enforce and maintain them.

## Assumptions And Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| The inspected source files are representative of the two repos' core runtime design | recommendation confidence | uninspected helpers could reveal additional constraints or exceptions |
| A gate-first acceptance helper can be implemented safely in this repo without letting generated checks mutate project state | Slice A feasibility | unsafe generated gates could undermine trust in deterministic validation |
| A spawned-agent mutation audit can distinguish harness-owned subprocess edits from ambient editor/user activity on the same worktree when bounded by isolation or manifest targets | Slice D feasibility | false positives or unsafe rollback could damage user work if the boundary is too loose |

## External Source Mapping

- `external/sssf/*` in the provenance line corresponds to inspected raw files from `disler/super-simple-software-factory`.
- `external/fusion/*` in the provenance line corresponds to inspected raw files from `disler/fusion-harness`.

## Validation Plan

- Persist this deeper source-audit brief.
- Run architect challenge against the revised recommendations.
- If the challenge approves, persist implementation/review/feedback artifacts only; no runtime adoption code is in scope for this audit pass.

## Understand Status

- Graph status: stale but refresh-ready; provider `understand-anything`
- Understand tools used: graph status, prior brief read, targeted external raw-file audit, targeted local grep
- Residual risk: medium, because this is still a selective source audit rather than a full execution audit of both external repos
