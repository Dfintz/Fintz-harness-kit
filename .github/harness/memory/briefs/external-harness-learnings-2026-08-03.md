---
summary: "Architecture Brief — external harness learning pass from SSSF and fusion-harness"
type: brief
status: active
source: research
created: 2026-08-03
updated: 2026-08-03
tags: [research, external-harness, adoption, 2026]
---
# Architecture Brief — external harness learning pass from SSSF and fusion-harness

resource: README.md, SETUP.md, CREDITS.md, .github/harness/HARNESS.md, .github/instructions/02-UNDERSTAND-WORKFLOW.md, .github/instructions/03-ARCHITECT.md, scripts/harness/prompt-router.mjs, scripts/harness/record-run.mjs, scripts/harness/report-server.mjs, scripts/harness/stage-state.mjs

**Date:** 2026-08-03  
**Status:** APPROVED

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| `README.md` | Operator-facing capability and onboarding summary | Public repo docs |
| `SETUP.md` | Adoption and local engine setup flow | Project adoption docs |
| `.github/harness/HARNESS.md` | Canonical stage machine and routing contract | Harness core docs |
| `.github/instructions/02-UNDERSTAND-WORKFLOW.md` | Understand-stage graph and impact-map contract | Stage instruction |
| `.github/instructions/03-ARCHITECT.md` | Gate-based architecture decision contract | Stage instruction |
| `scripts/harness/prompt-router.mjs` | Route and handoff planning surface | Runtime orchestration |
| `scripts/harness/record-run.mjs` | Structured run artifact writer | Runtime observability |
| `scripts/harness/report-server.mjs` | Live dashboard surface | Runtime observability |
| `scripts/harness/stage-state.mjs` | Shared live stage state | Runtime orchestration |
| `https://raw.githubusercontent.com/disler/super-simple-software-factory/main/README.md` | SSSF design, install flow, phases, envelopes, gates, trace model | External reference |
| `https://raw.githubusercontent.com/disler/fusion-harness/main/README.md` | Fusion harness roles, fusion loop, gate-first validator, operator UX | External reference |

**Scope:** workflow / documentation / architecture research  
**Primary boundary:** harness orchestration and operator-facing evidence surfaces

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Full source inspection of both external repos beyond README-level public docs | Whether lower-level implementation details add material lessons beyond the documented patterns |
| A user-selected roadmap target for immediate adoption | Which recommended improvement should be implemented first |

Proceeding is safe because the task asks for learnings and improvements, not direct feature parity. Any recommendation that depends on deeper source inspection is marked `[UNVERIFIED]`.

## Understand Output

### Changed components

- `.github/harness/memory/briefs/` — new research brief artifact
- `harness.config.json` — local graph refresh readiness fix required to execute the routed harness workflow

### Affected components

- Routing/bootstrap surfaces: `scripts/harness/prompt-router.mjs`, `scripts/harness/graph.mjs`
- Observability surfaces: `scripts/harness/record-run.mjs`, `scripts/harness/report-server.mjs`, `scripts/harness/stage-state.mjs`
- Operator docs: `README.md`, `SETUP.md`, `CREDITS.md`

### Layers involved

- Harness stage contract
- Runtime orchestration
- Run observability
- Operator onboarding

### Complexity hotspots

- The kit has strong deterministic checks for known commands, but not an equivalent first-class gate-authoring workflow for ad hoc acceptance criteria.
- Feature runs do not yet appear to have one unified per-run artifact bundle spanning route, brief, implementation, and review outputs.
- Multi-model support exists, but the operator-facing representation of consensus vs divergence is still diffuse across route output, plan-review, and reports.

## Current Shape

- This repository already adopts the core SSSF thesis: code owns sequencing, bounded loops, and acceptance; agents work inside explicit stages and loops.
- This repository already adopts parts of fusion-harness indirectly: cross-model review, role-separated model routing, and explicit review stages.
- The strongest remaining opportunities are not conceptual rewrites. They are packaging and operator-surface improvements around artifacts, validation, and comparative reasoning.

## Architectural Gates

### Gate 1 — Domain / module alignment

Pass. The relevant owner for these learnings is the harness core itself: orchestration docs, runtime evidence surfaces, and stage artifacts.

### Gate 2 — Generality

Pass with one constraint. Improvements should be expressed as project-agnostic harness primitives, not Pi-specific or Claude-specific UX assumptions.

### Gate 3 — Ownership

Pass. Candidate improvements map cleanly to existing owners:

- run artifact packaging -> `record-run.mjs` / `stage-state.mjs` / report surfaces
- task-specific acceptance proofing -> loop and validation surfaces
- comparative multi-model outputs -> route, review, or prompt-pack surfaces

### Gate 4 — Boundary integrity

Pass with guardrail. Do not mix runtime orchestration changes with editor-specific UI assumptions. Fusion-harness UI ideas are only relevant when they improve artifact clarity in repo-neutral surfaces.

### Gate 4b — Isolation / safety boundary

Pass with caution. External patterns that widen tool permissions, allow concurrent writers, or synthesize gates that can mutate arbitrary files need explicit safeguards before adoption.

### Gate 5 — Reuse

Pass. The kit already has reusable hooks in `record-run.mjs`, `stage-state.mjs`, prompt-pack generation, and review loops, so any adoption should extend those surfaces rather than create parallel mechanisms.

## Key Decisions

1. **Adopt gate-first acceptance authoring as the first follow-up candidate, but only as an additive workflow.**
   Fusion-harness' strongest transferable idea is not its Pi UI; it is the requirement that acceptance be explicit before the build, with a baseline red check and bounded repair path.

2. **Adopt the per-run artifact bundle idea as the second follow-up candidate.**
   Create one stable run directory for full feature workflows that gathers route output, brief, implementation summary, review ledgers, and verdict record behind one manifest. This is a strong reusable lesson from SSSF, but it is new infrastructure rather than a low-cost extension.

3. **Adopt a comparative review artifact only after the first two slices.**
   The useful fusion-harness lesson is explicit consensus/divergence, but here it should land as a machine-readable review artifact rather than as editor-specific UI.

4. **Park aggressive dual-writer or UI-fusion ideas.**
   Two full-tool writers in parallel and Pi-specific two-column rendering are interesting, but they are not aligned with this repo's project-agnostic engine boundary and would add substantial environment coupling.

5. **Park generic post-call write-boundary rollback until a narrower use case exists.**
   SSSF's `writes` boundary enforcement is strong, but this kit serves many runtimes and CLIs. A universal mutation-audit layer is plausible, but not a small safe slice yet.

## Recommended Follow-up Slices

### Slice A — Gate-First Acceptance Workflow

**Intent:** add an optional path that defines acceptance before implementation for prompts lacking a ready-made deterministic test.  
**Likely target files:** `.github/harness/loops/feature-cycle.json`, `.github/instructions/04-IMPLEMENT.md`, `.github/skills/deterministic-validation/SKILL.md`, potentially a new helper under `scripts/harness/`.

**Desired behavior:**

- author or generate a narrow acceptance check first
- require baseline fail or explicit "already done" handling
- feed exact failure output back into the repair loop

**Why first:** highest value-to-effort ratio, immediate operator payoff, and smallest reusable slice from fusion-harness

### Slice B — Unified Feature Run Bundle

**Intent:** give a full feature handoff one durable run folder and manifest.  
**Likely target files:** `scripts/harness/prompt-router.mjs`, `scripts/harness/record-run.mjs`, `scripts/harness/stage-state.mjs`, `scripts/harness/report-server.mjs`, `README.md`.

**Desired behavior:**

- route/handoff commands mint or reuse a run id
- stage artifacts land under one stable run directory
- dashboard and final summaries can link to one manifest instead of multiple scattered files
- writes are atomic enough to recover from partial stage failures cleanly

**Why second:** strong operator leverage, but it is greenfield infrastructure and should be shaped by the gate-first workflow's needs rather than built speculatively first

### Slice C — Comparative Review Artifact

**Intent:** surface consensus/divergence explicitly when two models or two review passes are used.  
**Likely target files:** `scripts/harness/plan-review.mjs`, `scripts/harness/prompt-router.mjs`, prompt-pack output surfaces, `README.md`.

**Desired behavior:**

- review artifacts mark consensus, divergence, and unresolved disputes explicitly
- use a machine-readable sidecar instead of Pi-specific UI dependency or typed agent-enforced JSON envelopes

**Why third:** useful, but less foundational than artifact packaging and acceptance proofing

## Artifacts To Create

- `.github/harness/memory/briefs/external-harness-learnings-2026-08-03.md`
  - Single responsibility: persist the learning triage and local adoption decisions from the two external harness repos.

## Artifacts Explicitly Not Being Created

- No new runtime command or loop in this task.
- No editor-specific UI implementation.
- No direct vendoring of external repo structures, prompt files, or orchestration code.

## Constraints

- Keep the harness project-agnostic.
- Reuse existing run, loop, and review surfaces rather than introduce parallel ones.
- Do not adopt Pi-specific UX or session semantics as a repository-wide requirement.
- Do not widen tool permissions or weaken human approval gates as part of any follow-up slice.

## Do-NOTs

- Do NOT copy external repo code or prompts directly.
- Do NOT treat README-level claims as proof of low-level runtime behavior.
- Do NOT add a second orchestration model beside the existing stage machine; extend current surfaces instead.
- Do NOT prioritize visual novelty over deterministic proof and operator clarity.
- Do NOT copy SSSF's Python workflow scripts or typed envelope machinery directly; any adoption must be native to the current Node-based kit.
- Do NOT adopt fusion-harness cross-run role-memory persistence; stage roles must remain stateless per run.
- Do NOT require agents to emit mandatory typed JSON envelopes for comparative review; prefer structured sidecars validated by code.
- Do NOT allow gate repair to silently weaken or replace legitimate acceptance checks.
- Do NOT assume a multi-file run manifest is atomic by default; explicit recovery and partial-write handling are required.

## Risks And Mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Gate-first flow increases initial operator friction | baseline-red validation feels slower on first use | document the payoff clearly and keep the workflow optional and additive |
| Generated acceptance gates may be weak, unsatisfiable, or unsafe | false greens or invalid repair loops would undermine deterministic validation | require baseline fail or explicit already-done handling, audit gate changes, and cap validator-side repair tightly |
| Unified run manifest can drift or land partially written state | downstream report and review surfaces could read inconsistent artifacts | use temp-write plus rename where practical and provide explicit run-recovery guidance |
| Comparative review can become invisible without UI support | consensus/divergence value is lost if recorded only as prose | store it as a machine-readable ledger consumable by downstream stages |
| Cross-model or cross-role context contamination can distort review independence | persistent role memory or reused transcripts can bias supposedly independent stages | keep stage roles stateless and preserve explicit model separation only at routing time |

## Assumptions And Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED]` The external READMEs accurately represent their current runtime behavior | recommendation quality | deeper code inspection could change implementation details or caveats |
| `[UNVERIFIED]` Gate-first acceptance generation can be made safe with current validation guardrails | Slice B feasibility | a generated-gate feature could introduce unsafe or weak proof behavior |

## Validation Plan

- Prove the brief exists at the expected path.
- Validate changed file diagnostics remain clean for the touched JSON and Markdown surfaces.
- Use the stage review passes in this run to pressure-test the recommendation set before closing.

## External Sources

- `https://github.com/disler/super-simple-software-factory`
- `https://raw.githubusercontent.com/disler/super-simple-software-factory/main/README.md`
- `https://github.com/disler/fusion-harness`
- `https://raw.githubusercontent.com/disler/fusion-harness/main/README.md`

## Understand Status

- Graph status: stale but refresh-ready; provider `understand-anything`
- Understand tools used: graph status, provider-status, targeted local grep, external README fetch
- Residual risk: medium, because the external comparison is grounded in public documentation rather than full source traversal
