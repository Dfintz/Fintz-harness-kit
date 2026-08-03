---
summary: "Architecture Brief"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [plan, review, path, safety]
---
## Architecture Brief
resource: scripts/harness/plan-review.mjs,.github/instructions/03-ARCHITECT.md

### Objective
Reduce the remaining static-analysis file-inclusion warnings in plan-review via a minimal path-safety wrapper hardening pass, without changing runtime behavior or CLI contracts.

### Scope
- In scope:
  - Add small, explicit path-trust wrappers inside scripts/harness/plan-review.mjs.
  - Route all repository-bound path resolution and file reads through those wrappers.
  - Preserve existing repository-bound checks and read-only protections.
- Out of scope:
  - Any new CLI flags or user-visible behavior changes.
  - Changes to prompt-router policy, stage routing, or non-plan-review files.

### Impact map (Understand handoff)
- Primary changed component: scripts/harness/plan-review.mjs
- Adjacent behavior touched: reviewer/author command execution path setup, context loading, journal/log path generation.
- Affected layer: harness workflow tooling (high-centrality file, moderate blast radius risk).

### Architectural gates
- Gate 1 Domain alignment: PASS
  - Change stays within plan-review responsibility (safe orchestration of file inputs).
- Gate 2 Generality: PASS
  - Reusable local wrappers for trusted repo paths and trusted file reads avoid repeated ad hoc reads.
- Gate 3 Data ownership: PASS
  - No ownership transfer; data remains file-local orchestration state.
- Gate 4 Boundary integrity: PASS
  - Keep existing function signatures and exit semantics; wrapper insertion is internal.
- Gate 4b Safety/isolation: PASS
  - Tighten explicit path validation boundaries; do not weaken current assertions.
- Gate 5 Reuse: PASS
  - Consolidate repeated resolve/read patterns into canonical helpers.

### Decisions
1. Introduce helper wrappers:
   - resolveRepoBoundPath(candidate, label)
   - readTrustedUtf8(pathValue, label)
   - writeTrustedUtf8(pathValue, content, label)
2. Replace direct readFileSync/writeFileSync calls on user-influenced paths with wrapper calls in main/review/revise paths.
3. Keep assertPathInsideRepo as canonical boundary gate and make wrappers delegate through it.

### Constraints
- No semantic changes to verdict parsing, loop transitions, reviewer preflight, or JSON outputs.
- Keep line-level edits minimal and local.
- Maintain deterministic self-test pass.

### Validation plan
- npm run harness:plan-review:self-test
- node scripts/harness/plan-review.mjs --lens plan --plan .github/harness/memory/briefs/plan-review-path-safety-wrapper-hardening-brief-2026-07-27.md --reviewer "node -e \"process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('ok\\nVERDICT: APPROVED\\n'));\"" --max-rounds 1
- get_errors on scripts/harness/plan-review.mjs to compare remaining file-inclusion diagnostics

### Do NOT
- Do NOT relax repo-bound path checks.
- Do NOT introduce shell execution paths.
- Do NOT alter reviewer/read-only tamper guard behavior.

### Assumptions and risks
- [UNVERIFIED] The static analyzer will recognize wrapper hardening and reduce warning count.
- Risk: analyzer may still conservatively flag trusted wrappers; mitigation is preserving stronger explicit checks and documenting residual diagnostics in review artifacts.
