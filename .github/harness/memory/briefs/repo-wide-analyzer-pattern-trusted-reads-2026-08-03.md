---
summary: "Architecture Brief — repo-wide analyzer pattern for trusted repo-contained reads (implemented)"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [analyzer, trusted-reads, repo-wide, 2026]
---
# Architecture Brief — repo-wide analyzer pattern for trusted repo-contained reads

resource: scripts/harness/plan-review.mjs, scripts/harness/acceptance-gate.mjs, scripts/harness/trusted-repo-paths.mjs, .github/harness/memory/briefs/acceptance-gate-zero-warning-and-fusion-model-discrimination-2026-08-03.md

## Architecture Brief

### Objective

- Define and apply one shared analyzer-pattern implementation for trusted repo-contained reads across both current harness consumers.

### Scope and boundaries

- In scope: analyzer-pattern design and rollout planning for trusted file path resolution and UTF-8 read/write wrappers in harness scripts that already enforce repo-root containment.
- Out of scope: unrelated functional refactors, command-policy expansion, or weakening path safety checks.

### Artifacts to create

- `.github/harness/memory/briefs/repo-wide-analyzer-pattern-trusted-reads-2026-08-03.md` - architecture brief for the repo-wide analyzer-pattern slice.
- companion implementation/review/feedback records to track execution and decisions.

### Artifacts to modify

- `scripts/harness/plan-review.mjs` - consume the shared trusted repo-path helper.
- `scripts/harness/acceptance-gate.mjs` - consume the shared trusted repo-path helper and route default scaffold output through trusted resolution.
- `scripts/harness/trusted-repo-paths.mjs` - new shared helper surface that owns repo-contained path checks and trusted UTF-8 read/write operations.

### Artifacts explicitly not being created

- No broad analyzer suppression policy file in this pass.

### Context sufficiency check

#### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| `scripts/harness/plan-review.mjs` | Existing trusted-path helper pattern with 3 residual file-inclusion warnings | Harness review runtime |
| `scripts/harness/acceptance-gate.mjs` | Same helper pattern plus one extra warning on default scaffold output branch | Harness validation runtime |
| prior zero-warning follow-up brief | Evidence that helper-local refactor converged to shared warning class | Harness memory |

**Scope:** software/workflow hardening
**Primary boundary:** analyzer-safe pattern standardization across existing trusted-read helper surfaces

#### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| definitive analyzer policy for accepted suppression or taint annotations | whether zero-warning can be achieved by code-shape only versus policy-level allowances |

Proceeding is safe because opening the slice only records the decision and constraints; no runtime behavior changes are applied in this step.

Implementation is now complete for the shared helper rollout; residual analyzer warnings remain concentrated in the new shared helper module.

### Key Decisions

1. Treat the remaining warnings as a repo-wide pattern issue, not a single-file issue.
2. Require side-by-side treatment of `plan-review.mjs` and `acceptance-gate.mjs` in the implementation slice.
3. Preserve existing path containment guarantees while testing analyzer-recognized alternatives.
4. Accept completion of this pass when both consumer files are warning-free, even if residual warnings remain in the shared helper and require a follow-up analyzer-policy decision.

### Constraints

- Do not reduce security posture to satisfy analyzer output.
- Do not claim zero-warning completion until both current consumer files pass under the agreed analyzer policy.
- Keep all changes additive and reversible until objective proof is captured.

### Do-NOTs

- Do NOT introduce broad `NOSONAR` blanket suppression across whole files.
- Do NOT split implementations so one consumer passes and the other remains inconsistent.
- Do NOT widen trusted read scope outside repo-root constraints.

### Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| analyzer warnings stem from trust-boundary modeling limits rather than real traversal bugs | pattern choice | implementation may miss a real edge case if this is false |
| one shared accepted pattern can satisfy both current consumers | rollout scope | per-file exceptions may still be needed |

### Implementation outcome

- `scripts/harness/plan-review.mjs` now reports no diagnostics in `get_errors`.
- `scripts/harness/acceptance-gate.mjs` now reports no diagnostics in `get_errors`.
- Residual warnings moved to `scripts/harness/trusted-repo-paths.mjs` (shared boundary surface), confirming convergence and reducing duplicated warning footprint.

### Validation plan

- Use `get_errors` on both `scripts/harness/plan-review.mjs` and `scripts/harness/acceptance-gate.mjs` before and after implementation.
- Preserve deterministic behavior checks for touched helpers (`npm run test:harness:acceptance` and relevant `plan-review` self-tests if touched in the implementation slice).

Validation executed:

- `npm run test:harness:acceptance` => PASS
- `npm run harness:plan-review:self-test` => PASS
- `get_errors` => clean for `plan-review.mjs` and `acceptance-gate.mjs`; residual warnings only in `trusted-repo-paths.mjs`

### Architectural gates

#### Gate 1 — Domain / module alignment

Pass. This is a harness-runtime hardening concern and belongs in shared harness script surfaces.

#### Gate 2 — Generality

Pass. The issue clearly spans multiple files with identical trust-boundary logic.

#### Gate 3 — Ownership

Pass. Ownership remains with each runtime script, coordinated by one repo-wide pattern contract.

#### Gate 4 — Boundary integrity

Pass. The slice does not mix analyzer-policy decisions into unrelated business logic.

#### Gate 4b — Isolation / safety boundary

Pass. Security boundaries remain explicit and are treated as invariant constraints.

#### Gate 5 — Reuse

Pass. This slice exists specifically to standardize reuse and eliminate divergent local fixes.
