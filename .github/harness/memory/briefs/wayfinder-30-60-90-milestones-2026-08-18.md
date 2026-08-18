---
summary: "Architecture Brief - Wayfinder 30/60/90 Milestone Plan (Token/Context/Memory Radar Batch)"
type: brief
status: active
source: human
created: 2026-08-18
updated: 2026-08-18
tags: [wayfinder, roadmap, milestones, ownership, acceptance-gates, context-engineering]
---
# Architecture Brief - Wayfinder 30/60/90 Milestone Plan (Token/Context/Memory Radar Batch)
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-18.md, .github/harness/memory/briefs/radar-batch-governance-gate-and-token-hardening-2026-08-18.md

## Architecture Brief

### Objective
- Convert the 2026-08-18 wayfinder decision map (T1-T7) into a strict, execution-ready 30/60/90 day plan with owner roles, measurable acceptance gates, and explicit trigger-gated go/no-go points for the three tickets that must not start speculatively (T3, T5, T6).

### Scope and boundaries
- In scope: milestone sequencing for T1-T6, owner-role assignment, acceptance gates, and explicit handling of trigger-gated (not yet triggered) tickets.
- Out of scope: any runtime code for T3/T5/T6 before their trigger conditions are met with real evidence; re-scoring the underlying radar entries; tool-permission or policy changes; T7 (no ticket exists to schedule).
- Primary boundary: this is a planning artifact — the only files this brief itself changes are the two wayfinder documents (decision map + this milestone plan).

### Artifacts to create
- `.github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-18.md` (this file) — single source of truth for this batch's milestone sequencing, ownership, and acceptance gates.

### Artifacts to modify
- None.

### Key decisions
- Decision: schedule only T1 and T2 as active build work in this plan; T3, T5, T6 remain trigger-gated and unscheduled until evidence exists. Evidence: the source radar entries for all three were explicitly parked/candidate pending observed symptoms (unbounded context growth, repeated re-discovery, goal drift) that no current loop exhibits, per the 2026-08-18 measurement brief.
- Decision: T4 stays a watchlist item with no scheduled work. Evidence: its trigger (tool-calling added to `llm-provider.mjs`) is not proposed anywhere in the current roadmap; scheduling work against a hypothetical future PR would be speculative.
- Decision: use role-based ownership, not person names, consistent with the 2026-08-05 wayfinder milestone plan's precedent for durability across staffing changes.
- Decision: T2 (context-growth tripwire) is the only new runtime code this plan schedules; it is intentionally small (metric comparison against a soft threshold, warning only) so it does not itself become an unrequested feature.

### Constraints
- Do not begin T3, T5, or T6 implementation until the named trigger condition in the decision map has real, evidenced occurrence (a journal excerpt or metric crossing, not a hypothetical).
- T2's threshold check must warn only — it must not block a loop or fail a run, consistent with this repo's default-off-autonomy-escalation stance.
- Any ticket that touches `llm-provider.mjs`, `run-experiment.mjs`, or `plan-review.mjs` must not change existing prompt-assembly behavior, only add observability (T2) or documentation (T1).

### Validation plan
- Routing/graph checks for this brief:
  - `npm run harness:graph -- provider-status`
  - `node scripts/harness/prompt-router.mjs route --task "wayfinder 30/60/90 milestone plan for token/context/memory radar batch" --json`
- Milestone acceptance evidence:
  - T1: a recorded strict/warn decision plus one real warn-mode log line from `.github/harness/runs/protected-path-overrides.jsonl` or a clean `harness:protected-paths:check` run.
  - T2: a sample metrics-file excerpt showing the threshold comparison firing (or explicitly not firing) on a real `run-experiment`/`plan-review` invocation.
  - Each milestone ends with a dated checkpoint note referencing ticket artifacts, mirroring the 2026-08-05 wayfinder day-30 checkpoint pattern.

### Do NOT
- Do NOT start T3/T5/T6 implementation without documented trigger evidence — this is the single most important guardrail in this plan.
- Do NOT let T2's tripwire escalate to a blocking gate without a separate, later opt-in decision (mirrors the protected-path-guard's own warn-then-strict pattern).
- Do NOT open a ticket for T7 (dispatcher priority order) — no dispatcher exists to attach it to.
- Do NOT replace the measurable trigger conditions with narrative judgment calls under schedule pressure.

### Assumptions and risks
- `[UNVERIFIED]` No loop currently emits a metrics file dense enough to make T2's threshold meaningful on day one; the first few runs may need threshold tuning rather than producing an immediately actionable signal.
- `[UNVERIFIED]` Owner roles below assume the same role taxonomy as the 2026-08-05 milestone plan is still current; reassign at the Day-30 checkpoint if roles have changed.
- Risk: T2 could be over-tuned to be noisy (false positives) or too loose (never fires). Mitigation: threshold is configurable and the exit criteria explicitly require reviewing a real sample before declaring the milestone done, not just "code merged."

## 30/60/90 milestone schedule

Baseline date: 2026-08-18

### Day 30 checkpoint (due 2026-09-17)

| Milestone | Owner role | Tickets | Acceptance gates |
| --- | --- | --- | --- |
| M30-1: Governance-gate rollout decision | Governance Tooling Owner | T1 | 1) Explicit adopt-strict or stay-warn decision recorded in `coleam00-dark-factory-protected-governance-files-gate.md`'s Decision Log. 2) If strict is adopted: `--allow` bypass runbook step documented in `SETUP.md` or equivalent. 3) No existing CI job's exit code changes without that job's owner's sign-off. **Status (2026-08-18): done.** Decision recorded: stay-warn, evidence cited, re-evaluate at Day 60. |
| M30-2: Context-growth tripwire built | Loop Reliability Owner | T2 | 1) Threshold comparison added to `run-experiment.mjs`/`plan-review.mjs` metrics path, warn-only. 2) At least one real run's metrics-file excerpt captured showing the check executing (fired or not). 3) Review breadth contains no Blocker/Major findings for T2 scope. **Status (2026-08-18): built.** Shipped as `scripts/harness/context-growth-guard.mjs` (character-count proxy, not token count — see Understand correction in `wayfinder-day30-t1-t2-implementation-2026-08-18.md`), wired into both composers, `promptChars` persisted per iteration/round. Self-tests pass (`harness:plan-review:self-test`, inline smoke test). |

### Day 60 checkpoint (due 2026-10-17)

| Milestone | Owner role | Tickets | Acceptance gates |
| --- | --- | --- | --- |
| M60-1: Trigger-watch review | Context Engineering Owner | T3, T5, T6 (watch only) | 1) Journals/metrics from the 30 days since T2 shipped are reviewed for any of the three named trigger conditions. 2) Explicit written finding: "triggered — open a ticket" or "not triggered — remain parked," for each of T3/T5/T6 individually. 3) No implementation starts unless a finding is "triggered" with cited evidence. **Interim check (2026-08-18): HOLD — insufficient elapsed time.** Same-day-as-T2-ship review found zero post-T2 loop journals to evaluate; all three remain parked-until-trigger, unchanged. See `wayfinder-day60-t3-t5-t6-t4-checkpoint-2026-08-18.md`. Full evidence-backed review still due at the real 2026-10-17 date. |
| M60-2: KV-cache watchlist review | LLM Provider Owner | T4 (watch only) | 1) Confirm no tool-calling schema was added to `llm-provider.mjs` in the period, or if one was, the re-audit from T4 was actually run before merge. 2) Finding recorded either way. **Interim check (2026-08-18): PASS.** Grep confirms no tool-calling patterns in `llm-provider.mjs`; T4 stays watchlist-only. See `wayfinder-day60-t3-t5-t6-t4-checkpoint-2026-08-18.md`. Recheck at the real Day-60 date. |

### Day 90 checkpoint (due 2026-11-16)

| Milestone | Owner role | Tickets | Acceptance gates |
| --- | --- | --- | --- |
| M90-1: Trigger-gated implementation (conditional) | Context Engineering Owner | whichever of T3/T5/T6 triggered at M60 | 1) Only proceeds for tickets marked "triggered" at Day 60. 2) Each proceeding ticket gets its own Understand -> Architect -> Implement -> Review Breadth -> Review Depth -> Feedback pass, not a shortcut. 3) Feedback verdict confirms no speculative scope crept in beyond the specific evidenced symptom. |
| M90-2: Batch closeout note | Governance Tooling Owner | T1-T6 | 1) Dated closeout note summarizing final disposition of every ticket in this batch (built / triggered-and-in-progress / still-parked). 2) Radar entries for any ticket whose status changed are updated with a decision-log row citing this checkpoint. |

## Ticket ownership matrix

| Ticket | Primary owner role | Secondary reviewer role | Current state |
| --- | --- | --- | --- |
| T1 | Governance Tooling Owner | Security/Compliance Reviewer | Ready (gate shipped, decision pending) |
| T2 | Loop Reliability Owner | Observability Reviewer | Ready |
| T3 | Context Engineering Owner | Loop Reliability Reviewer | Parked-until-trigger |
| T4 | LLM Provider Owner | Security Reviewer | Watchlist |
| T5 | Context Engineering Owner | Memory Surfaces Reviewer | Parked-until-trigger |
| T6 | Context Engineering Owner | Loop Reliability Reviewer | Parked-until-trigger |
| T7 | — | — | No ticket (parked, unattached) |

## Inline skeptical pass (architect challenge omitted by route)

- Challenge prompt: Is T2 itself an unrequested feature, given the prior brief explicitly avoided building speculative compaction code?
  - Response: T2 is observability, not the compaction feature itself — it is the mechanism that turns "measure first" from a one-time audit into a standing check, which is what makes T3/T5/T6's trigger-gating actually enforceable rather than aspirational.
  - Mitigation: keep T2 to a warn-only threshold comparison; if review breadth finds it growing beyond that, cut scope back rather than let it absorb T3's job.
- Challenge prompt: Could "parked-until-trigger" become a permanent excuse to never build T3/T5/T6?
  - Response: possible if no one reviews the evidence.
  - Mitigation: M60-1's acceptance gate requires an explicit written finding for each ticket individually, not a blanket "still parked" — this forces a real look at the 30 days of evidence rather than silent inertia.
- Challenge prompt: Is owner-role granularity (a new "Context Engineering Owner" role) justified versus reusing existing roles from the 2026-08-05 plan?
  - Response: the 2026-08-05 plan's roles (Retrieval Quality Owner, Memory and Graph Owner) are adjacent but not identical — this batch is specifically about in-context token/attention management, not retrieval or the graph.
  - Mitigation: if headcount is a real constraint, the Day-30 checkpoint can explicitly merge this role into an existing one rather than treating it as fixed.
