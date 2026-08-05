---
summary: "Architecture Brief - Wayfinder 30/60/90 Milestone Plan"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [wayfinder, roadmap, milestones, ownership, acceptance-gates]
---
# Architecture Brief - Wayfinder 30/60/90 Milestone Plan
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/briefs/t1-prompt-prefix-cache-feedback-2026-08-05.md, .github/harness/memory/briefs/t2-contextual-embeddings-feedback-2026-08-05.md

## Architecture Brief

### Objective
- Convert the existing wayfinder decision map into a strict, execution-ready 30/60/90 day delivery plan with explicit owner roles, acceptance gates, and go/no-go decision points.

### Scope and boundaries
- In scope:
  - Milestone plan derived from queued wayfinder tickets T1-T8.
  - Owner-role assignment per ticket/milestone.
  - Objective acceptance gates with measurable pass criteria.
  - Explicit status handling for completed (T1), pilot-complete-but-NO-GO (T2), and queued tickets.
- Out of scope:
  - Runtime code changes for tickets themselves.
  - Re-scoring radar source disposition.
  - Tool-permission expansion or policy changes.

### Artifacts to create
- .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md - single source of truth for milestone sequencing, owner assignment, and acceptance gates.

### Artifacts to modify
- None.

### Key decisions
- Decision: Keep wayfinder planning-only route boundaries for this run.
  - Evidence: prompt-router route/handoff selected stages understand -> architect only.
- Decision: Use role-based ownership (not person names) to remain durable across staffing changes.
  - Evidence: harness artifacts consistently separate ownership by surface (retrieval, reliability, security, docs, governance).
- Decision: Treat T2 as completed pilot with adoption NO-GO and require a new gate before any promotion.
  - Evidence: T2 feedback verdict recorded hit-rate gate failure with explicit NO-GO.
- Decision: Sequence by risk-first and smallest safe slice while preserving existing wave intent.
  - Evidence: wayfinder decision map wave structure and risk controls.

### Constraints
- Keep all execution inside existing harness guardrails and stage contracts.
- Do not mark a milestone complete unless all acceptance checks for that milestone pass.
- Preserve non-default status for any feature carrying a NO-GO adoption verdict until a new evidence run changes that verdict.
- Any ticket that touches security boundaries must include explicit before/after evidence artifacts.

### Validation plan
- Graph and routing checks for this brief:
  - `npm run harness:graph -- provider-status`
  - `npm run harness:graph -- status`
  - `node scripts/harness/prompt-router.mjs route --task "follow-up brief that turns the decision map into strict 30/60/90 day milestones with owners and acceptance gates." --json`
  - `node scripts/harness/prompt-router.mjs handoff --task "follow-up brief that turns the decision map into strict 30/60/90 day milestones with owners and acceptance gates."`
- Milestone acceptance evidence:
  - Every completed ticket must have feedback verdict artifact with PASS/APPROVED or explicit accepted NO-GO outcome.
  - Each milestone must end with a dated checkpoint note referencing ticket artifacts and gate results.

### Do NOT
- Do NOT convert this planning brief into code implementation in the same run.
- Do NOT bypass failed acceptance gates by narrative justification.
- Do NOT promote parked tickets (T7/T8) without benchmark-backed trigger conditions.
- Do NOT replace measurable gates with subjective status labels.

### Assumptions and risks
- [UNVERIFIED] Graph is stale by 1 commit / 25 files and may miss latest dependency edges for memory brief files.
  - Affects: dependency-confidence for documentation-only impact map.
  - Risk if wrong: minor; mitigated with direct file evidence from existing brief artifacts.
- [UNVERIFIED] Owner roles map to currently available maintainers.
  - Affects: execution pacing and handoff latency.
  - Risk if wrong: medium; requires owner-role reassignment at Day-0 checkpoint.

## Understand output (impact map)

- Graph status: provider ready; snapshot stale by 1 commit / 25 files.
- Changed components (this run):
  - .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md
- Affected components (planning dependencies):
  - .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md
  - .github/harness/memory/briefs/t1-prompt-prefix-cache-feedback-2026-08-05.md
  - .github/harness/memory/briefs/t2-contextual-embeddings-feedback-2026-08-05.md
- Affected layers:
  - Harness memory briefs (planning/governance layer)
  - Ticket execution governance (review and feedback artifact layer)
- Residual risk: low-medium, because graph freshness is slightly stale but this change is documentation-planning only.

## 30/60/90 milestone schedule

Baseline date: 2026-08-05

### Day 30 checkpoint (due 2026-09-04)

| Milestone | Owner role | Tickets | Acceptance gates |
| --- | --- | --- | --- |
| M30-1: Lock quick-win closure and pilot next-step | Harness Runtime Owner | T1 follow-up note, T2 follow-up design | 1) T1 marked complete with feedback artifact reference. 2) T2 follow-up experiment brief approved with explicit thresholds and repeats >= 3. 3) No guardrail weakening recorded. |
| M30-2: Documentation quality enforcement pilot | Documentation Quality Owner | T6 (teach-agent anti-slop doc linting policy) | 1) Deterministic doc checks implemented in doc-verifier path. 2) At least one sample run artifact captured. 3) Review breadth contains no Blocker/Major findings for T6 scope. |

### Day 60 checkpoint (due 2026-10-04)

| Milestone | Owner role | Tickets | Acceptance gates |
| --- | --- | --- | --- |
| M60-1: Reliability envelope implementation | Loop Reliability Owner | T3 (lease/heartbeat loop envelope) | 1) Heartbeat and expiry behavior implemented and documented. 2) Stuck-run recovery scenario passes deterministic test path. 3) Review depth gate verdicts PASS for ownership and boundaries. |
| M60-2: Differential security workflow | Security Workflow Owner | T4 (differential security scan workflow) | 1) Before/after findings report path exists and is repeatable. 2) Optional CI wiring documented (not mandatory to enforce). 3) Feedback verdict confirms no silent policy weakening. |

### Day 90 checkpoint (due 2026-11-03)

| Milestone | Owner role | Tickets | Acceptance gates |
| --- | --- | --- | --- |
| M90-1: Memory graph hardening | Memory and Graph Owner | T5 | 1) Freshness checks and fallback behavior implemented and tested. 2) Graph stale-state handling documented in operator-facing docs. 3) Aggregate harness core suite includes fallback test and runs in CI. 4) Feedback verdict confirms architecture alignment without boundary leakage. |
| M90-2: Advanced research disposition decision | Architecture Council Owner | T7, T8 | 1) Benchmark or ROI evidence packet created. 2) Explicit go/park decision recorded for each ticket. 3) No implementation starts unless acceptance trigger conditions are met. |

## Ticket ownership matrix

| Ticket | Primary owner role | Secondary reviewer role | Current state |
| --- | --- | --- | --- |
| T1 | Harness Runtime Owner | Observability Reviewer | Complete |
| T2 | Retrieval Quality Owner | Evaluation Reviewer | Pilot complete, adoption NO-GO |
| T3 | Loop Reliability Owner | Runtime Safety Reviewer | Complete |
| T4 | Security Workflow Owner | Review Breadth Reviewer | Complete |
| T5 | Memory and Graph Owner | Architecture Reviewer | Complete |
| T6 | Documentation Quality Owner | Teach-Agent Reviewer | In Progress (kickoff active) |
| T7 | Architecture Council Owner | Runtime Feasibility Reviewer | Parked-until-capacity |
| T8 | Retrieval Quality Owner | Benchmark Reviewer | Parked-until-benchmark-gap |

## Hermes-agent cherry-pick assessment (pre-finalization)

Source reviewed: https://github.com/NousResearch/hermes-agent

### Adopt now (high fit, low risk)

1. Revision-gate loop cap and stall detection
  - Source: `optional-skills/software-development/subagent-driven-development/references/gates-taxonomy.md`
  - Why fit: aligns with harness bounded-loop and deterministic validation guardrails.
  - Target ticket: T3 (lease/heartbeat reliability envelope).
  - Proposed acceptance add-on: require explicit stall escalation after max 3 review/fix cycles.

2. Security checklist pattern for operational hardening
  - Source: `website/docs/user-guide/security.md` (gateway deployment checklist)
  - Why fit: reusable checklist shape for before/after security posture verification.
  - Target ticket: T4 (differential security scan workflow).
  - Proposed acceptance add-on: add explicit checklist artifact in review breadth evidence.

3. Memory write-gate pattern for batch operations
  - Source: `tools/memory_tool.py` (`_apply_batch_write_gate`)
  - Why fit: mirrors existing explicit-approval philosophy for high-impact writes.
  - Target ticket: T5 (memory graph persistence hardening).
  - Proposed acceptance add-on: introduce approval gate for destructive memory-graph maintenance operations.

### Adopt later (needs scoped experiment)

1. Auto-recall/auto-capture memory provider tuning knobs
  - Source: `plugins/memory/supermemory/README.md`, `plugins/memory/supermemory/__init__.py`
  - Why later: useful, but can increase context noise without calibrated policies.
  - Candidate tickets: T5 and T8.

2. Three-layer wiki structure and retrieval curation discipline
  - Source: `website/docs/user-guide/skills/bundled/research/research-llm-wiki.md`
  - Why later: strong knowledge hygiene model, but requires process changes beyond current milestone scope.
  - Candidate tickets: T5.

### Do not cherry-pick now

1. Runtime/platform-specific gateway integration surfaces
  - Reason: cross-platform runtime abstractions in Hermes are not a direct drop-in for this harness repository.
  - Risk: architecture drift and unnecessary complexity.

## Inline skeptical pass (architect challenge omitted by route)

- Challenge prompt: Are milestones over-concentrated in M60 and likely to slip?
  - Response: M60 includes two medium-to-high complexity tickets; risk is real.
  - Mitigation: enforce M30 prerequisite gate requiring T2 follow-up brief and T6 completion before starting both M60 tickets in parallel.
- Challenge prompt: Are owner roles too generic to drive accountability?
  - Response: Generic roles are intentional for durability, but accountability must be bound at checkpoint.
  - Mitigation: each checkpoint must record named assignee mapped to role in that cycle's checkpoint note.
- Challenge prompt: Could T2 NO-GO be ignored under schedule pressure?
  - Response: possible unless blocked by policy.
  - Mitigation: explicit Do-NOT and acceptance gate requiring fresh evidence before any promotion.
