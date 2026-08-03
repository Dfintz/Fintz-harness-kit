---
summary: "Architecture Brief — acceptance-gate zero-warning cleanup and fusion model discrimination"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [acceptance-gate, analyzer, fusion-audit, 2026]
---
# Architecture Brief — acceptance-gate zero-warning cleanup and fusion model discrimination

resource: scripts/harness/acceptance-gate.mjs, scripts/harness/plan-review.mjs, scripts/harness/test/acceptance-gate-test.mjs, package.json, .github/harness/memory/briefs/slice-a-hardening-and-fusion-followup-2026-08-03.md, .github/harness/memory/briefs/external-harness-live-execution-audit-2026-08-03.md

## Architecture Brief

### Objective

- Eliminate the remaining static file-inclusion warnings in `scripts/harness/acceptance-gate.mjs` without changing helper behavior or weakening path safety.
- Run one more fusion audit with a different validator model to determine whether the gate-file acceptance failure is model-specific or harness-specific.

### Scope and boundaries

- In scope: `scripts/harness/acceptance-gate.mjs`, its focused validation, one additional fusion runtime audit, and persisted harness memory artifacts for this run.
- Out of scope: widening `command-validation` policy, changing acceptance-gate semantics, modifying fusion-harness or SSSF source, or claiming hosted-provider conclusions without credentials.

### Artifacts to create

- `.github/harness/memory/briefs/acceptance-gate-zero-warning-and-fusion-model-discrimination-2026-08-03.md` - architecture brief for this slice.
- Follow-up implementation and review memory artifacts for this run.

### Artifacts to modify

- `scripts/harness/acceptance-gate.mjs` - align repo-contained path resolution and trusted read/write wrappers more closely with the proven `plan-review.mjs` pattern so the analyzer sees the trust boundary more clearly.

### Artifacts explicitly not being created

- No new shared path-safety utility: rejected because this slice only needs one local helper cleanup and a shared abstraction would widen scope.
- No fusion-specific adapter or recovery helper: rejected because the audit is observational and must not couple external runtime behavior into Slice A.

### Context sufficiency check

#### Artifact inventory

| Artifact | What it contains | Owning surface or layer | Domain / workflow area |
| --- | --- | --- | --- |
| `scripts/harness/acceptance-gate.mjs` | Slice A acceptance helper with three residual analyzer warnings | runtime helper | harness validation |
| `scripts/harness/plan-review.mjs` | nearby trusted path wrapper pattern that already reduced similar warnings | runtime helper | harness review |
| `scripts/harness/test/acceptance-gate-test.mjs` | deterministic regression coverage for helper behavior | test surface | harness validation |
| `package.json` | operator entrypoints for acceptance helper tests and CLI | command surface | harness tooling |
| prior Slice A follow-up brief | prior hardening decision record and known residual warnings | memory surface | harness planning |
| prior external live execution audit brief | previous fusion and SSSF runtime findings | memory surface | external audit |

**Scope:** software / workflow / audit evidence
**Primary boundary:** local helper safety-cleanup plus external model-discrimination evidence, with no orchestration expansion

#### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Hosted-provider credentials for fusion’s default roster | whether the gate-file acceptance issue also reproduces under intended cloud models |

Proceeding is safe because the local helper has focused tests and the alternate fusion run can still answer the model-specificity question using a different local validator.

### Key Decisions

1. Keep the code change local to `acceptance-gate.mjs` and target only the three current analyzer findings.
2. Prefer the `plan-review.mjs` trust-boundary shape directly over inventing a new abstraction.
3. Use one additional local validator model as the discriminating fusion audit because hosted-provider access is unavailable in this environment.
4. If the refactor still matches the residual helper-boundary warnings already present in `plan-review.mjs`, stop the local cleanup there and record that zero-warning analysis requires a broader analyzer-specific strategy.

### Constraints

- Preserve current CLI behavior and exit semantics for `scaffold`, `verify`, and `baseline`.
- Preserve repo-root containment and `shell: false` proof-command execution.
- Do not change existing tests unless the helper contract actually changes.

### Do-NOTs

- Do NOT weaken path validation merely to satisfy static analysis.
- Do NOT expand the helper into a broader workflow orchestrator.
- Do NOT overclaim the fusion result; only state what the alternate model run demonstrates.

### Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| The remaining warnings are due to analyzer trust-modeling at helper boundaries rather than a real escape path | helper refactor choice | a local refactor may not reach zero warnings |
| A second local validator model is sufficient to distinguish model behavior from harness behavior at the same failure seam | fusion audit interpretation | the alternate model may fail differently for unrelated reasons |

### Status after implementation

- The local wrapper refactor preserved behavior but still converged on the same helper-boundary warning class that exists in `plan-review.mjs`.
- The alternate `devstral:24b` fusion run failed at the same gate-file acceptance seam as prior local-model runs, but with weaker tool compliance than `qwen2.5-coder:32b`.

### Validation plan

- `npm run test:harness:acceptance`
- `get_errors` for `scripts/harness/acceptance-gate.mjs`
- one additional fusion execution with an alternate local validator model and captured terminal output

### Architectural gates

#### Gate 1 — Domain / module alignment

Pass. The path-safety cleanup belongs in `acceptance-gate.mjs`; the alternate fusion run belongs in audit evidence.

#### Gate 2 — Generality

Pass. The helper will reuse an existing generic trust-boundary pattern rather than adding feature-specific logic.

#### Gate 3 — Ownership

Pass. `acceptance-gate.mjs` owns acceptance-spec path handling; fusion evidence stays outside shipped runtime code.

#### Gate 4 — Boundary integrity

Pass. The helper remains thin and bounded to scaffold/verify/baseline responsibilities.

#### Gate 4b — Isolation / safety boundary

Pass. Repo-root containment remains explicit and no external runtime writes are folded into the local product surface.

#### Gate 5 — Reuse

Pass. Reusing the `plan-review.mjs` wrapper shape is justified because similar analyzer behavior already exists nearby.
