# Architecture Brief: Radar Triage and Eval Taxonomy Adoption
resource: .github/skills/ai-techniques-radar/SKILL.md, .github/harness/loops/technique-triage.json, .github/harness/memory/radar/, .github/harness/memory/radar/eval-capability-regression-taxonomy.md, scripts/harness/eval/lib/tasks.mjs, scripts/harness/eval/run-eval.mjs, scripts/harness/eval/tasks/
Status: active

## Architecture Brief

### Objective

- Complete a deterministic triage audit of all radar items and implement the highest-value bounded adopted item that is both unshipped and policy-ready: capability/regression eval taxonomy.

### Scope and boundaries

- Triage inventory: 80 radar entries excluding README/template; 39 adopted, 32 parked, 9 rejected, zero candidate/missing statuses, zero frontmatter/last-decision mismatches.
- Triage conclusion: the review-only candidate loop is already converged. Do not rewrite terminal statuses merely because shipped evidence is sparse.
- Adoption audit: produce a 39-entry disposition matrix with concrete evidence or an explicit remaining-work handoff. Matched-baseline scoring, batch failure packets, structured absence, changed-surface validation, and several instruction patterns are already shipped despite weak keyword signals.
- Implementation scope: add `evalKind: capability | regression` normalization and grouped reporting to the deterministic eval harness.
- Out of scope: implementing every adopted backlog entry in one run, reclassifying parked items without a changed trigger, external skill-pattern adoption without SkillSpector/waiver, changing release gates, or changing verifier/dangerous-diff behavior.
- Primary boundary: task metadata normalization in `eval/lib/tasks.mjs`; reporting in `eval/run-eval.mjs`; explicit classifications in three task fixtures.
- Understand status: graph snapshot matches HEAD `b01ec72`; `loadTasks` has consumers in `run-eval.mjs` and `ablate-artifact.mjs`. `runWithAgent` context retrieval demonstrated the shipped `context_budget_exhausted` fallback and required direct source reading.

### Artifacts to create

- `.github/harness/memory/briefs/radar-triage-eval-taxonomy-adoption-implementation-2026-09-24.md` - proof and self-review handoff.
- `.github/harness/memory/briefs/radar-adopted-disposition-2026-09-24.md` - auditable disposition for every adopted item: shipped, selected, blocked, or remaining-work handoff.
- `scripts/harness/test/eval-kind-taxonomy-test.mjs` - deterministic loader/list/self-test/agent-run journal and text-output compatibility test.
- `scripts/harness/test/fixtures/eval-taxonomy-agent.mjs` - deterministic local agent that solves the three eval fixtures without model/network use.
- `scripts/harness/eval/README.md` - task-author contract for eval kinds, defaults, grouped output, and safety boundaries.
- `.github/harness/memory/briefs/eval-taxonomy-reporting-and-metric-integrity-follow-up-2026-09-24.md` - accountable deferred dashboard/OTel and metric-integrity work.

### Artifacts to modify

- `scripts/harness/eval/lib/tasks.mjs` - normalize missing `evalKind` to `regression` and reject invalid values with the task id.
- `scripts/harness/eval/run-eval.mjs` - expose eval kind in list/run records, compute grouped scores, and self-test the grouping contract.
- `scripts/harness/eval/tasks/build-fix/task.json` - explicit `regression` classification.
- `scripts/harness/eval/tasks/planted-bug-review/task.json` - explicit `regression` classification.
- `scripts/harness/eval/tasks/metric-improve/task.json` - explicit `capability` classification.
- `package.json` - expose the focused taxonomy test and include it in the core CI aggregate.
- `.github/harness/memory/radar/eval-capability-regression-taxonomy.md` - append shipped evidence only after reviews and Feedback approve.

### Key decisions

- Decision: default omitted `evalKind` to `regression` for backward compatibility and conservative release protection.
- Decision: default only an absent own property. Explicit `null`, empty string, wrong type, or values outside `capability | regression` fail with a diagnostic naming the task; silent coercion would make grouped reports untrustworthy.
- Decision: classify `build-fix` and `planted-bug-review` as regression tasks because they protect known syntax/security-review behavior. Classify `metric-improve` as capability because it probes improvement against a target rather than protecting a release invariant.
- Decision: preserve the current overall aggregate (`baselineScore`, `harnessScore`, `delta`) and add `byEvalKind` alongside it. No task is removed from the total.
- Decision: grouped records contain `taskCount`, `baselineScore`, `harnessScore`, and `delta` for each present kind.
- Decision: grouped capability results are informational and no new gate or exit-code branch uses `evalKind`. Capability scores still contribute to the unchanged overall mean consumed by harness-evolve; isolating optimization or release policy by kind requires a separate architecture decision.
- Decision: `byEvalKind` contains only kinds present in the run. Each group uses its own task count as denominator; means are computed unrounded, reported values round to four decimals, and delta is computed from unrounded means before rounding. An empty suite keeps existing overall behavior and emits an empty grouped object.
- Decision: `ablate-artifact.mjs` receives normalized tasks but does not change behavior; classification is additive metadata there.
- Decision: task-author documentation must state defaulting, validation, informational grouping, overall-score influence, and dangerous-diff invariants.
- Decision: repair the existing missing `existsSync` import in `run-eval.mjs`; deterministic agent-run coverage makes that previously dormant defect executable.
- Decision: the 39-entry disposition artifact is the continuation handoff. This run may implement one bounded slice while explicitly naming blocked and remaining adopted work; it must not imply backlog completion.
- Decision: preserve the existing evolve metric extractor contract in this slice by asserting that the overall `harnessScore` precedes grouped scores; replace regex/stdout extraction only in the named follow-up.
- Gate 1, domain alignment: PASS. Task taxonomy belongs with task loading and eval reporting.
- Gate 2, generality: PASS. Two stable kinds cover current eval intent without verifier-specific branching.
- Gate 3, ownership: PASS. Loader owns defaults/validation; runner owns aggregation; fixtures own explicit intent.
- Gate 4, boundary integrity: PASS. Security verifiers and evolve scoring remain independent of taxonomy.
- Gate 4b, isolation and safety: PASS. Dangerous-diff rejection remains absolute across both kinds.
- Gate 5, reuse: PASS. One grouping function feeds JSON and text output plus self-test evidence.

### Constraints

- Existing task files without `evalKind` must continue loading as regression tasks.
- Omitted means absent property only; malformed explicit values must fail.
- Existing overall score fields and exit codes must not change.
- Invalid explicit kinds must fail with a task-specific diagnostic.
- Do not treat capability gains as compensation for dangerous-diff findings or failed regression verifiers.
- Keep fixture classifications explicit and reviewable.

### Validation plan

- Start with a red self-test expectation for normalized task kinds and grouped scores.
- Run `npm run harness:eval:self-test` and its JSON mode.
- Run `npm run harness:eval -- --list --json` and assert all tasks expose expected kinds.
- Add synthetic grouped-score checks covering both kinds, per-kind denominators, four-decimal reporting, and empty grouping.
- Add loader fixture checks for absent, `null`, empty, wrong-type, and unknown values with task-specific diagnostics.
- Run a deterministic fake-agent integration through `run-eval --agent` and assert journal records, `byEvalKind`, existing top-level aggregate keys, JSON output, text grouped lines, exit behavior, and dangerous-diff verdict.
- Run `ablate-artifact.mjs --self-test --json` and `--list` to preserve relevance filtering and output compatibility.
- Run `npm run harness:evolve:test` after fixture metadata changes; accept a new suite hash only from the fresh task contents and preserve manifest integrity behavior.
- Run `npm run test:harness:core`, `npm run harness:docs:check`, Snyk Code on changed JavaScript, Sonar file analysis, and scoped whitespace checks.
- Run independent Review Breadth and Review Depth against this Brief before updating radar shipped evidence.

### Do NOT

- Do not change verifier implementations, task prompts, solved fixtures, dangerous-diff rules, or sandboxing.
- Do not add a capability/regression release policy in this slice.
- Do not claim capability scores are isolated from the overall optimization metric; they remain part of the unchanged mean.
- Do not bulk-edit all 80 radar entries or claim that keyword-based shipped detection is authoritative.
- Do not implement adopted external skill patterns lacking current scan/waiver evidence.
- Do not mark the eval-taxonomy radar entry shipped until Feedback approves.

### Assumptions and risks

- `[UNVERIFIED]` Downstream consumers tolerate additive task-record and aggregate fields; local repository consumers will be searched and tested.
- Classification is policy metadata and can be wrong even when syntactically valid; explicit fixture review mitigates this.
- The adopted backlog remains larger than one safe run. This Brief selects one bounded slice based on verified gap, current value, and policy readiness rather than pretending all adopted items can land atomically.
- `run-eval.mjs` currently references `existsSync` in agent mode without importing it; implementation must repair and prove this path rather than treating integration failure as taxonomy failure.