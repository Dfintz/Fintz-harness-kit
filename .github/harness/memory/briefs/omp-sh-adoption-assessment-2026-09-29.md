---
summary: "Architecture Brief — OMP feature assessment and bounded adoption candidates"
type: brief
status: active
source: research
created: 2026-09-29
updated: 2026-09-29
tags: [research, omp, external-harness, adoption]
---
<!-- markdownlint-disable MD022 -->
# Architecture Brief — OMP Feature Assessment and Bounded Adoption Candidates
resource: <https://omp.sh/>, <https://omp.sh/docs>, <https://github.com/can1357/oh-my-pi>, .github/harness/HARNESS.md, harness.config.json, package.json, .github/harness/memory/briefs/external-harness-learnings-2026-08-03.md, .github/harness/memory/briefs/radar-adopted-disposition-2026-09-24.md
<!-- markdownlint-enable MD022 -->

**Date:** 2026-09-29
**Status:** ACTIVE - research recommendation; no runtime change approved

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| `https://omp.sh/docs` | OMP workflow, planning, session, provider, and approval documentation | External product documentation |
| `https://github.com/can1357/oh-my-pi` | OMP feature claims, architecture overview, and source entry points | External source repository |
| `.github/harness/HARNESS.md` | Current stage, loop, safety, and model-role contract | Harness operating contract |
| `harness.config.json` | Project routing, model, loop, and command configuration | Harness configuration |
| `package.json` | Existing executable command and validation surfaces | Project automation |
| `external-harness-learnings-2026-08-03.md` | Existing external-harness adoption decisions | Prior research brief |
| `radar-adopted-disposition-2026-09-24.md` | Confirmed/parked radar dispositions | Prior research brief |

**Scope:** workflow / architecture research
**Primary boundary:** project-agnostic harness orchestration, proof, and operator evidence

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Representative Harness-kit task traces with a measured operator-friction baseline | Whether any candidate improves completion quality, latency, or recovery in this harness |
| OMP source-level audit of its isolation, approval, and collaboration implementations | Whether OMP implementation details satisfy this harness's safety constraints |

Proceeding is safe because this task asks for feature and improvement opportunities, not direct parity. Recommendations below are pilots until local evidence exists.

### External source snapshot

- Retrieved OMP site and documentation on 2026-09-29.
- Feature claims were corroborated against the immutable OMP README source at commit `d1932a6ff85613dde1160b87a73ddcdc3beb01f6`: <https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/README.md>.
- Conclusions apply to that source state; the live OMP website remains a moving reference and requires re-evaluation before a future implementation brief.

## Understand Output

- **Graph status:** route/handoff preflight succeeded; detailed local graph-status output contained non-fatal schema auto-corrections, so this assessment does not claim symbol-level dependency evidence.
- **Affected components:** `.github/harness/memory/briefs/`, future `stage-state.mjs`, prompt-router, run artifacts, and validation/report surfaces only if a candidate is approved.
- **Affected layers:** research memory, workflow policy, orchestration, review evidence, and operator UX.
- **Risk:** medium. OMP's public docs establish feature intent but are not proof that a feature improves this codebase.

## Architecture Brief

### Objective

- Identify the highest-value OMP ideas that can improve Harness-kit without importing an editor/runtime dependency or weakening deterministic validation and human approval.

### Current overlap and gaps

| OMP capability | Harness-kit disposition | Reason |
| --- | --- | --- |
| Hash-anchored stale-edit rejection | Already adopted in principle | `04-IMPLEMENT.md` requires re-read-before-edit; do not build a custom edit runtime without evidence. |
| Plan-before-implementation | Already adopted | Full feature routing requires Architect, Brief, challenge, implementation, and review stages. |
| Isolated subagents with typed results | Candidate gap-demonstration | Existing `structured-output.mjs` and the comparative ledger already supply structured handoff surfaces; a pilot is justified only by a demonstrated gap. |
| Per-turn second-model advisor | Candidate pilot | Existing review is stage-based; a bounded advisory receipt may catch errors earlier if it stays non-authoritative. |
| Resumable/branchable session state | Partial overlap | Stage state, run bundles, memory, and continuation exist; do not add full transcript/session emulation. |
| Approval preview before sensitive mutation | Candidate pilot | Existing approval boundaries exist, but explicit preview/accept evidence for high-risk changes may improve reviewability. |
| Stream-rule interruption and reinjection | Park | Requires a persistent agent-stream runtime the harness does not own. |
| Native terminal, LSP, DAP, browser, desktop, and collaboration product stack | Park | These belong to a coding-agent runtime or editor integration, not a project-agnostic orchestration kit. |
| Multi-provider role routing and fallback | Mostly shipped | `harness.config.json` already owns skill/stage model mapping and local-model policy. |

### Architectural Gates

#### Gate 1 - Domain / module alignment

Pass. Candidate work belongs in existing harness orchestration, review-evidence, and stage-state surfaces. It must not create an OMP compatibility layer.

#### Gate 2 - Generality

Pass. Typed worker results, advisory receipts, and approval evidence are runtime-neutral patterns. OMP-specific commands, TUI cards, and URI schemes are not.

#### Gate 3 - Ownership

- Structured subagent results belong to the subagent invocation and review handoff owners.
- Advisory receipts belong to the existing decision/advisory evidence family, not prompt routing authority.
- Mutation-preview evidence belongs to stage-state/run artifact ownership, not individual tool wrappers.

#### Gate 4 - Boundary integrity

Pass with constraints. Preserve the current stage machine as the only sequencer. Any pilot may publish evidence or recommendations, but cannot edit code, alter routing, bypass approval, or replace validation.

#### Gate 4b - Isolation / safety boundary

Required. Workers must have isolated worktrees or read-only scope; advisor output is untrusted review input; preview acceptance must remain human-controlled for destructive or permission-sensitive operations.

#### Gate 5 - Reuse

Pass. Extend `stage-state.mjs`, run bundles, decision-advisory receipts, and review artifacts rather than adding a second session or orchestration subsystem.

### Key Decisions

1. **Require a typed subagent-results gap demonstration before a pilot.** Extend the existing `structured-output.mjs` extraction and comparative-ledger artifact flow only if a representative task cannot preserve findings, confidence, and provenance through the current path.
2. **Pilot a non-authoritative advisor receipt only after the gap decision.** It may flag concerns, but it cannot block, mutate, or reroute work. Raw task data must remain local unless the operator explicitly opts into an approved backend and data-handling policy.
3. **Restrict approval preview exploration to the existing destructive memory-maintenance operation.** A later pilot must bind a canonical scope digest, one-time approval id, expiry, and pre-state reference to the exact mutation; a generic preview record is not evidence of enforced approval.
4. **Do not build OMP compatibility or clone its persistent runtime.** Keep the harness project-agnostic and use editor/agent capabilities through their native integrations.
5. **Treat OMP claims as research inputs, not acceptance evidence.** Every pilot requires a baseline, holdout tasks, explicit rollback, and a measured promotion gate.

### Parked Opportunities and Entry Criteria

#### Opportunity A - Typed Independent-Worker Findings

- **Goal:** determine whether `structured-output.mjs` plus the comparative ledger lacks a required typed handoff field for parallel read-only/review tasks.
- **Current disposition:** PARKED. `structured-output.mjs` owns tagged payload parsing and `merge-comparative-ledger.mjs` owns comparative persistence; neither owns a generic subagent invocation/result lifecycle.
- **Entry criteria:** name a new lifecycle owner; define a versioned result schema with artifact provenance, timeout/cancellation status, parent-isolation mode, and result retention; document three representative failures that existing artifacts cannot express.
- **Future acceptance checks:** invalid result is rejected; valid result is persisted and rendered through the defined owner; parent remains functional when a worker times out; worker cannot mutate the parent workspace.

#### Opportunity B - Shadow Advisor Receipt

- **Goal:** attach a second-model, non-authoritative concern receipt to bounded feature runs.
- **Current disposition:** PARKED. `decision-advisory.mjs` sends raw task text to its loopback sidecar; the sidecar can use a configurable upstream OpenAI-compatible endpoint. No owner currently enforces upstream destination allowlisting, redaction, remote-consent, or data-retention policy.
- **Entry criteria:** create a separate Architecture Brief that names the configuration and enforcement owner, allows only a local sidecar/upstream by default, fails closed on an unallowlisted destination, records scope-bound operator consent before any remote egress, and defines redaction/retention behavior.
- **Evaluation rule:** reuse `decision-eval.mjs` rather than inventing a scorecard. The existing evidence floor is at least 100 human-labelled cases, zero confidently wrong results, split/family validation for held-out cases, and frozen report-only promotion. Any authority change remains out of scope for this opportunity.

#### Opportunity C - Scope-Bound Approval Evidence

- **Goal:** strengthen evidence for the existing destructive memory-maintenance approval path, not create a generic mutation interceptor.
- **Current disposition:** PARKED. `stage-state.mjs` records approvals, but current maintenance approval evaluation does not enforce a scope digest, expiry, or single-use consumption against a mutation owner.
- **Entry criteria:** identify the exact maintenance mutation function and create a focused architecture brief that binds its manifest digest, operation name, approval id, expiry, and single-use state in that function. A preview record alone remains insufficient proof.
- **Future acceptance checks:** preview does not mutate; the mutation rejects missing, expired, reused, or scope-mismatched approval; denial leaves no mutation; the report contains a stable audit record.

### Artifacts to Create

- `.github/harness/memory/briefs/omp-sh-adoption-assessment-2026-09-29.md`
  - Records the evidence, decisions, constraints, and candidate slices from this research task.

### Artifacts Explicitly Not Being Created

- No OMP dependency, compatibility layer, or source vendoring.
- No typed-worker lifecycle, advisor, or approval-preview runtime feature in this research task.
- No terminal UI, ACP client, LSP/DAP bridge, browser/desktop controller, collaboration relay, or persistent session service.
- No new tool permission, destructive default, or autonomous approval path.

### Constraints

- Preserve explicit stages, graph freshness, bounded loops, deterministic validation, and human approval gates.
- Keep implementation model and review model roles distinct.
- Use runtime-neutral, schema-validated sidecars for new machine-readable evidence.
- Do not promote a candidate without baseline and holdout task evidence.

### Do NOT

- Do NOT copy OMP source, prompts, command names, or protocol shapes solely for parity.
- Do NOT treat an advisor as an authority over routing, permissions, validation, or approval.
- Do NOT let concurrent workers write to the same worktree.
- Do NOT add a persistent session runtime to solve a brief-handoff or memory problem already covered by existing surfaces.
- Do NOT adopt broad desktop/browser/collaboration capabilities into the core harness.
- Do NOT send raw task data to a non-local advisor backend without explicit operator approval and a reviewed data-handling policy.
- Do NOT record an approval preview as sufficient proof unless the mutation verifies its scope-bound, unexpired, single-use authorization.

### Assumptions and Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED]` The existing structured-output and ledger path cannot represent a needed worker handoff | Slice A value | Adds ceremony with no measurable gain |
| `[UNVERIFIED]` Advisor receipts detect material issues early enough to offset cost/latency and privacy risk | Slice B value | Duplicates staged review and adds noise or creates unintended egress |
| `[UNVERIFIED]` Memory-maintenance approval can be scope-bound without disrupting its existing recovery contract | Slice C feasibility | Audit records may misrepresent actual mutation scope |
| OMP's public documentation accurately reflects current behavior | Research accuracy | Deeper source review may alter implementation conclusions |

### Research Validation Plan

- Run `npm run harness:docs:check` after this research artifact is added.
- This brief is complete when its dispositions are internally consistent, reference existing owners accurately, and pass the documentation contract check.
- A later owner-specific implementation brief must provide the focused test/fixture, acceptance gate, and rollback plan before modifying shared orchestration behavior.
- Advisor evaluation must use `decision-eval.mjs` and its existing evidence floor; no new threshold is invented by this research artifact.

## Architect Challenge Seed

**Challenge:** The proposal may add machine-readable artifacts and advisory calls that duplicate existing run bundles, reviews, and decision sidecar logic, or create unreviewed task-data egress.

**Response required before implementation:** name the exact implementation owner, demonstrate a concrete unmet handoff or review failure on representative tasks, prove the smallest extension improves it without changing stage authority or adding concurrent writers, and pass an owner-specific Architecture Brief and review cycle.

## External Sources

- `https://omp.sh/`
- `https://omp.sh/docs`
- `https://github.com/can1357/oh-my-pi`