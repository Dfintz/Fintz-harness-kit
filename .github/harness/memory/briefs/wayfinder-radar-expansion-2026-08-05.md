---
summary: "Architecture Brief - Wayfinder Radar Expansion and Adoption Path"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [wayfinder, radar, teach-agent, triage, subagents, adoption]
---
# Architecture Brief - Wayfinder Radar Expansion and Adoption Path

resource: harness.config.json, .github/harness/HARNESS.md, .github/instructions/02-UNDERSTAND-WORKFLOW.md, .github/instructions/03-ARCHITECT.md, .github/harness/memory/radar/, .github/harness/loops/technique-triage.json, scripts/harness/prompt-router.mjs, scripts/harness/run-loop.mjs, scripts/harness/graph.mjs, scripts/harness/graph-provider.mjs

## Architecture Brief

### Objective

- Build a wayfinder-scale planning package that turns external research into a triaged, evidence-backed adoption path for harness-kit.
- Deliver decision tickets that can be executed in follow-up runs without redoing discovery.

### Scope and boundaries

- In scope:
  - Stage-compliant synthesis of external sources using subagent research.
  - Technique triage decisions (adopt/park/reject) mapped to concrete local surfaces.
  - Teach-agent style machine-operational guidance for follow-up execution.
- Out of scope:
  - Implementing runtime feature code for all adopted techniques in this pass.
  - Introducing non-harness external runtime dependencies.

### Artifacts to create

- `.github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md` - decision-ticket map and sequencing plan.
- `.github/harness/memory/briefs/wayfinder-implementation-summary-2026-08-05.md` - implement-stage packet and proof summary.
- `.github/harness/memory/briefs/wayfinder-review-breadth-2026-08-05.md` - breadth findings ledger.
- `.github/harness/memory/briefs/wayfinder-review-depth-2026-08-05.md` - depth gate ledger.
- `.github/harness/memory/briefs/wayfinder-feedback-verdict-2026-08-05.md` - final verdict record.
- `.github/harness/memory/radar/temporal-continue-as-new-and-parent-close-policy.md` - new radar candidate.
- `.github/harness/memory/radar/yc-qm-lease-heartbeat-reaper.md` - new radar candidate.
- `.github/harness/memory/radar/deusdata-persistent-codebase-memory-graph.md` - new radar candidate.
- `.github/harness/memory/radar/anthropic-contextual-embeddings-and-fusion-retrieval.md` - new radar candidate.
- `.github/harness/memory/radar/anthropic-hybrid-fusion-retrieval.md` - new radar candidate for parked fusion path.
- `.github/harness/memory/radar/openai-codex-security-differential-scanning.md` - new radar candidate.
- `.github/harness/memory/radar/no-ai-slop-doc-quality-linting.md` - new radar candidate.

### Artifacts to modify

- none required for this planning-only run.

### Key decisions

- Decision: Respect wayfinder route semantics by producing a decision-ticket map rather than broad feature code changes.
- Decision: Use subagent research lanes (orchestration, memory/retrieval, safety/workflow) and consolidate into one triage matrix.
- Decision: Create one radar file per new idea with explicit status and decision log entries, following radar template constraints.
- Decision: Record architect-challenge fallback inline because routed profile is planning-only and omits architect-challenge.

### Constraints

- Do not widen tool permissions, guardrails, or destructive defaults in this run.
- Keep the repository project-agnostic; no provider-specific mandatory behavior.
- Keep every recommendation tied to existing harness surfaces and deterministic follow-up checks.
- Follow one-idea-per-file in radar memory.

### Validation plan

- `npm run harness:graph -- status`
- `npm run harness:graph -- provider-status`
- `npm run harness:graph -- hubs`
- `npm run harness:docs:check`

### Do NOT

- Do NOT claim implementation landed for techniques without concrete code evidence.
- Do NOT mark radar entries as adopted without a concrete next step and target surfaces.
- Do NOT collapse multiple distinct techniques into a single radar file.

### Assumptions and risks

- [UNVERIFIED] The current graph snapshot is stale by one commit; dependency confidence is reduced but mitigated by direct file evidence and command outputs.
- [UNVERIFIED] Some external repos may evolve quickly; recommendations should be re-checked in each ticket implementation run.
- Risk: creating too many adopted techniques at once can exceed execution capacity; mitigate with wave-based decision tickets and priority ordering.

## Gate Summary

- Gate 1 Domain alignment: PASS. Planned artifacts stay within harness memory, docs, and planning surfaces.
- Gate 2 Generality: PASS. Recommendations are harness-agnostic orchestration/retrieval/safety patterns.
- Gate 3 Ownership: PASS. Planning and triage artifacts are owned by memory/briefs and memory/radar surfaces.
- Gate 4 Boundary integrity: PASS. No runtime control-plane code changes in this pass.
- Gate 4b Isolation/safety: PASS. No permission broadening; recommendations include explicit safety guardrails.
- Gate 5 Reuse: PASS. Uses existing radar template, triage loop contract, and brief lifecycle conventions.

## Inline Skeptical Pass (Architect-Challenge Fallback)

Route profile `wayfinder` omits `architect-challenge` (planning-only). Inline skeptical pass outcome:

- Challenge 1: "This should implement features now." Verdict: rejected for this run; planning-only route and wayfinder pattern require decision-ticket decomposition first.
- Challenge 2: "Subagent research may be noisy." Verdict: accepted risk with mitigation; all recommendations require local evidence mapping and explicit ticket acceptance criteria.
- Challenge 3: "Radar candidate sprawl may create debt." Verdict: accepted risk with mitigation; each candidate gets status, rationale, and ordered ticketing.

VERDICT: APPROVED for Implement stage within planning-only boundaries.
