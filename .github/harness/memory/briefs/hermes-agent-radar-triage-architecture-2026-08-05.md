---
summary: "Architecture Brief - Hermes Agent radar triage final decision and roadmap"
type: brief
status: active
source: research
created: 2026-08-05
updated: 2026-08-05
tags: [radar, hermes-agent, governance, roadmap]
---
# Architecture Brief - Hermes Agent radar triage final decision and roadmap
resource: .github/harness/memory/radar/README.md, .github/harness/loops/technique-triage.json, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, scripts/harness/run-loop.mjs, scripts/harness/plan-review.mjs, scripts/harness/stage-state.mjs

## Context sufficiency check
- Scope: research and roadmap documentation; no runtime implementation in this pass.
- Primary boundary: external technique triage into repository-owned radar records and follow-up tasks.
- Graph: provider ready; snapshot refreshed during Understand, with normalization warnings only.
- External evidence: current Hermes sources confirm its revision-gate taxonomy, layered deployment checklist, approval-gated memory writes, Supermemory auto-recall/capture provider, and three-layer LLM wiki.

## Architectural gates
- Gate 1 Domain alignment: PASS. Radar owns external technique dispositions; milestone brief owns delivery sequencing.
- Gate 2 Generality: PASS. Each evaluated practice is decomposed into a reusable harness governance pattern, not an upstream-platform copy.
- Gate 3 Ownership: PASS. Existing loop, review, stage-state, security, and memory owners remain unchanged.
- Gate 4 Boundary integrity: PASS. This pass creates no runtime integration, provider dependency, tool permission, or automatic-memory behavior.
- Gate 4b Isolation/safety: PASS. Auto-recall/capture and gateway surfaces remain parked/rejected pending explicit privacy and permission design.
- Gate 5 Reuse: PASS. Existing `run-loop`, `plan-review`, `stage-state`, and memory protocol are the reuse targets.

## Final decision
- Adopt as bounded roadmap tasks: explicit revision-gate stall escalation; an operational security evidence checklist; approval-gated destructive memory maintenance.
- Park: auto-recall/auto-capture provider tuning; three-layer wiki curation.
- Reject: Hermes gateway/runtime integration.
- No upstream code, installer, skill pack, platform integration, or dependency is copied.

## Roadmap
1. P0: normalize revision-gate stall escalation across `run-loop` and `plan-review`; cap at three revision attempts where a producer/reviewer loop exists and persist the human escalation reason.
2. P1: add a review-breadth security-evidence checklist to the existing differential-security workflow; retain existing scanner policy and CI optionality.
3. P1: architect a separate approval gate for destructive memory-graph maintenance; reuse `stage-state` approvals and retain fail-closed behavior.
4. Parked review trigger: revisit auto-memory only after explicit consent, retention, tenant-boundary, and retrieval-quality evaluation requirements exist.
5. Parked review trigger: revisit wiki curation when a documented knowledge-base operator workflow and source-immutability owner exist.

## Do NOT
- Do NOT adopt Hermes autonomous skill creation, memory ingestion, gateway, scheduler, provider, or installation surfaces.
- Do NOT add external memory providers or capture conversation data without separate approval and privacy architecture.
- Do NOT treat this triage as authorization to implement the adopted roadmap items.

## Validation
- All six radar records must have explicit status, source link, decision log, and concrete next step where adopted.
- The milestone roadmap must reference the final dispositions.
- `npm run harness:docs:check` validates the edited records.