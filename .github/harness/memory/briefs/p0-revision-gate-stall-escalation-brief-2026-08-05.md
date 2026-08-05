---
summary: "Architecture Brief - P0 Revision-gate stall escalation"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [wayfinder, p0, run-loop, plan-review, escalation]
---
# Architecture Brief - P0 Revision-gate stall escalation
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, scripts/harness/run-loop.mjs, scripts/harness/plan-review.mjs, .github/harness/loops/plan-review.json, .github/harness/LOOPS.md

## Architecture Brief

### Objective
- Normalize a three-attempt revision cap, stalled-finding detection, and human-escalation signaling across `run-loop` and `plan-review` without weakening existing safety/approval guardrails.

### Scope and boundaries
- In scope:
  - `plan-review` default round cap normalization to three attempts.
  - Deterministic stalled-finding detection in `plan-review` when unresolved findings repeat across rounds.
  - Explicit human-escalation messaging and journal signals on `stuck`/`exhausted` terminals in `run-loop` and `plan-review`.
  - Self-test updates for new `plan-review` terminal behavior.
- Out of scope:
  - New CLI commands or flags for operator policy bypass.
  - Changes to non-target loop definitions.
  - Any relaxation of review approval bars or existing terminal-state semantics.

### Artifacts to create
- None.

### Artifacts to modify
- `scripts/harness/plan-review.mjs` - set three-round default, add stalled-finding signature detection, and add explicit escalation output.
- `.github/harness/loops/plan-review.json` - align workflow loop max iteration cap from 5 to 3 for policy consistency.
- `scripts/harness/run-loop.mjs` - add explicit human-escalation guidance on `stuck`/`exhausted` outcomes.

### Key decisions
- Decision: Keep terminal state vocabulary unchanged (`converged`, `stuck`, `exhausted`, `incomplete`) while tightening when `stuck` is reached.
  - Evidence: existing loop contracts and journal consumers depend on these states.
- Decision: Detect stalled findings in `plan-review` via repeated non-approved critique signature across consecutive rounds.
  - Evidence: current no-op-only stuck detection misses cases where author changes text but leaves identical blockers unresolved.
- Decision: Normalize revision cap to 3 rounds for `plan-review` default and loop definition.
  - Evidence: roadmap directive explicitly calls for three-attempt cap normalization.
- Decision: Escalation should be additive messaging, not control-flow bypass.
  - Evidence: preserves safety while making human handoff deterministic.

### Constraints
- Maintain deterministic self-test pass for `plan-review`.
- Do not weaken read-only reviewer protections or verdict parsing contract.
- Do not alter exit-code meanings.
- Keep changes minimal and local to target artifacts.

### Validation plan
- `npm run harness:plan-review:self-test`
- `npm run harness:plan-review -- --help`
- `npm run harness:loop -- --list`
- `npm run harness:graph -- status`

### Do NOT
- Do NOT auto-approve deadlocked review loops.
- Do NOT add ambiguous escalation text that hides terminal state.
- Do NOT introduce state labels outside existing loop protocol.
- Do NOT modify unrelated loops or route policy.

### Assumptions and risks
- [UNVERIFIED] No external consumer hard-codes `plan-review` default rounds as 5.
  - Affects: operator expectation and historical cadence.
  - Risk if wrong: medium; mitigated by explicit help/output messaging and unchanged optional override (`--max-rounds`).
- [UNVERIFIED] Repeated critique signatures are a sufficient proxy for stalled findings.
  - Affects: potential early `stuck` on stylistically repetitive reviewers.
  - Risk if wrong: low-medium; mitigated by requiring consecutive identical non-approved signatures.

## Understand output (impact map)

- Graph status: fresh, provider ready.
- Changed components (planned):
  - `scripts/harness/plan-review.mjs`
  - `scripts/harness/run-loop.mjs`
  - `.github/harness/loops/plan-review.json`
- Affected components:
  - `package.json` command surfaces for `harness:plan-review` and `harness:loop` (behavioral dependency only).
  - `.github/harness/LOOPS.md` contract semantics (terminal-state interpretation only).
- Affected layers:
  - Harness runtime loop-execution layer.
  - Review workflow governance layer.
- Residual risk: medium-low; behavior change is bounded but alters default review cadence.

## Inline skeptical pass (architect-challenge fallback)

- Fallback reason: router classified task as assistant and omitted `architect-challenge`; per task contract, inline skeptical pass executed in Architect.
- Challenge prompt: Could lowering default rounds from 5 to 3 reduce approval opportunities for complex reviews?
  - Response: yes, but this is intentional per P0 policy; operators retain explicit `--max-rounds` override when needed.
  - Mitigation: keep override and make escalation messaging explicit so unresolved work routes to human judgment.
- Challenge prompt: Could repeated-critique signature matching produce false stall detections?
  - Response: possible with low-quality reviewer output.
  - Mitigation: detect only consecutive identical non-approved signatures and preserve manual override path by rerun with higher `--max-rounds` or different reviewer.
- Challenge prompt: Does escalation messaging risk acting like an automatic blocker?
  - Response: no, if messaging is advisory and preserves existing terminal states/exit codes.
  - Mitigation: keep escalation additive in output text and journal metadata, not as new fail logic.
