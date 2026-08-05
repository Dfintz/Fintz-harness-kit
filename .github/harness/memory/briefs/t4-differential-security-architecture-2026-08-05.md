---
summary: "Architecture Brief - T4 Differential Security Scan Workflow"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t4, security, differential, lurkr]
---
# Architecture Brief - T4 Differential Security Scan Workflow
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, scripts/harness/lurkr-check.mjs, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md

## Architecture Brief

### Objective
- Start Ticket T4 by adding a repeatable, deterministic before/after findings report path for optional security scans, based on the existing Lurkr wrapper model.

### Scope and boundaries
- In scope:
  - Add a differential security report command that compares base ref vs HEAD scanner output.
  - Reuse existing safe command token policy from current Lurkr wrapper.
  - Document local and CI usage for optional review evidence.
  - Update review-breadth security guidance to reference differential evidence path.
- Out of scope:
  - Mandatory CI enforcement.
  - Hard dependency on a Lurkr-specific JSON schema.
  - Broad security policy changes outside optional-gate workflows.

### Artifacts to create
- `scripts/harness/lurkr-core.mjs` - shared command parsing, safety checks, and scanner execution helper.
- `scripts/harness/lurkr-diff.mjs` - differential scanner report generator.
- `.github/harness/memory/briefs/t4-differential-security-understand-2026-08-05.md`.
- `.github/harness/memory/briefs/t4-differential-security-architecture-2026-08-05.md`.

### Artifacts to modify
- `scripts/harness/lurkr-check.mjs` - consume shared helper.
- `package.json` - add `harness:security:lurkr:diff` command.
- `SETUP.md` - add before/after workflow usage.
- `.github/instructions/05-REVIEW-BREADTH.md` - add differential evidence command path.

### Key decisions
- Decision: keep scanner command configuration surface unchanged (`HARNESS_LURKR_COMMAND` / `--command`).
  - Evidence: avoids breaking existing local and CI setups.
- Decision: differential evidence format is deterministic line-based diff over scanner stdout/stderr.
  - Evidence: scanner-agnostic and resilient when JSON output is unavailable.
- Decision: use temporary git worktree for base snapshot.
  - Evidence: enables same scanner command to run against both refs without destructive checkout.
- Decision: in non-required mode, write a report artifact even when skipped due to missing command.
  - Evidence: ensures reproducible artifact path required by T4 acceptance.

### Constraints
- Preserve optional security behavior; do not turn warning mode into hard-fail by default.
- Keep command parsing safety invariant equivalent to existing `lurkr-check` policy.
- Keep changes additive and project-agnostic.

### Validation plan
- Syntax checks:
  - `node --check scripts/harness/lurkr-core.mjs`
  - `node --check scripts/harness/lurkr-check.mjs`
  - `node --check scripts/harness/lurkr-diff.mjs`
- Behavior checks:
  - `npm run harness:security:lurkr:diff -- --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-smoke.json`
  - `node scripts/harness/lurkr-diff.mjs --command "node -v" --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-nodev.json`

### Do NOT
- Do NOT require Lurkr installation for baseline harness usage.
- Do NOT introduce destructive branch checkout for base scan comparison.
- Do NOT weaken existing command-token safety checks.

### Assumptions and risks
- [UNVERIFIED] Scanner output is stable enough for useful line-level drift summaries.
  - Affects: added/removed findings accuracy.
  - Risk if wrong: noisy diffs; mitigation is to use scanner command flags that reduce volatile output.
- [UNVERIFIED] Local git worktree commands are available in all operator environments.
  - Affects: differential command execution in constrained CI containers.
  - Risk if wrong: command failures; mitigated by optional mode and explicit required-mode signal.

## Architectural gates
- Gate 1 (Domain alignment): PASS - security workflow enhancement belongs in optional harness security tooling.
- Gate 2 (Generality): PASS - scanner-agnostic output diff keeps pattern reusable beyond one scanner variant.
- Gate 3 (Ownership): PASS - runtime logic in harness scripts, policy text in setup/instructions.
- Gate 4 (Boundary integrity): PASS - no cross-coupling into unrelated loops, graph, or MCP runtime.
- Gate 4b (Isolation/safety): PASS - retains existing token safety boundary and optional-only default.
- Gate 5 (Reuse): PASS - shared helper avoids command-parse duplication between lurkr commands.
