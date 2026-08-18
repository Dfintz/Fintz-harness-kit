---
summary: "Review Breadth/Depth + Feedback - T3/T5/T6 Today-Implementation (Human Override)"
artifact_family: review
immutability: frozen
immutable_since: 2026-08-18
type: brief
status: active
source: human
created: 2026-08-18
updated: 2026-08-18
tags: [review-breadth, review-depth, feedback, wayfinder, t3, t5, t6]
---
## Review Breadth
resource: .github/harness/memory/briefs/wayfinder-t3-t5-t6-today-implementation-2026-08-18.md, scripts/harness/context-compaction.mjs, scripts/harness/run-experiment.mjs, scripts/harness/plan-review.mjs, scripts/harness/git-guard.mjs

### Findings

| # | Severity | Finding | Evidence | Disposition |
|---|---|---|---|---|
| 1 | Info | The override of the trigger-gate is explicitly recorded (brief, decision map, all three radar entries), not silently absorbed. | Grep/read of updated files confirms "human-override-2026-08-18" decision-log rows exist in all three radar entries. | No action. |
| 2 | Major (caught, fixed) | `git-guard.mjs` unconditionally executed its own CLI `main()` on module import, hijacking any importer's `process.argv` and calling `process.exit()`. | Reproduced directly: `node scripts/harness/run-experiment.mjs --list` printed `[git-guard] allow: --list` instead of listing loops, before the fix. | Fixed with an `import.meta.url === pathToFileURL(process.argv[1]).href` entry-point guard; `--list` now works, and `git-guard`'s own 27-case self-test is unaffected. |
| 3 | Minor | T5's scratch-notes file path (`${journalFile}.notes.md`) is not covered by any existing cleanup/retention job. | Code review of the new scratch-notes plumbing in `run-experiment.mjs`. | Accept for now — feature ships default-off; a retention policy is deferred to whenever a real pilot enables it on a specific loop, per the radar entry's own "Exit criteria." |
| 4 | Info | T6's "Recap" block is O(1) per iteration (fixed set of fields: goal, best-so-far, iterations remaining) — cannot itself become a context-growth problem. | Code review of the appended block in `composeImprovementPrompt`. | No action. |
| 5 | Info | No live agent CLI was exercised end-to-end; validation relied on unit-level compaction smoke tests, syntax checks, and `--list` proving the script loads. | Documented explicitly in the Architecture Brief's Assumptions and risks. | Accept — consistent with this repo's existing validation depth for `run-experiment.mjs` (it had no self-test infrastructure before this pass either). |

### Completeness check
- All three tickets (T3, T5, T6) from the override instruction are addressed; T4 correctly untouched
  (no trigger, nothing to implement); T7 untouched.
- `harness:docs:check` and `harness:plan-review:self-test` (33/33) and `harness:git-guard:self-test`
  (27/27) all green after the full change set.
- No Blocker findings. One Major finding was caught and fixed within this same pass (see #2).

## Review Depth

### Gate verdicts

| Gate | Verdict | Rationale |
|---|---|---|
| 1. Domain/module alignment | PASS | `context-compaction.mjs` sits beside `context-growth-guard.mjs`; the git-guard fix stays inside its own file. |
| 2. Generality | PASS | Compaction thresholds are config-driven; the entry-point guard is a standard, reusable Node idiom. |
| 3. Ownership | PASS | Each composer calls the shared compaction helper independently; scratch-notes/recitation are fully owned by `run-experiment.mjs`, which is the only script with a stateless-per-iteration agent model that needs them. |
| 4. Boundary integrity | PASS | T3/T6 are additive prompt-shaping with unchanged control flow (33/33 plan-review self-test unchanged); T5 is behind an explicit default-off flag; the git-guard fix changes only the import-vs-direct-invocation behavior, which is exactly the bug. |
| 4b. Isolation/safety | PASS | No network calls, no new dependencies; scratch-notes files live under the already-trusted `.github/harness/runs/` directory. |
| 5. Reuse | PASS | One shared compaction module for both composers instead of duplicated logic. |

### Brief conformance
- The override is documented as an override, not retroactively justified as if trigger evidence existed — matches the Architecture Brief's explicit framing.
- T4/T7 were correctly left out of scope, consistent with "Do NOT" constraints in both this brief and the original milestone plan.

### Verdict: PASS — no structural rework required.

## Feedback

### Verdict table

| # | Challenge/Question | Outcome | Evidence | Confidence | Action |
|---|---|---|---|---|---|
| 1 | Was the trigger-gate override actually authorized, not just assumed? | Upheld | Direct, explicit user instruction ("i want them to be implemented today") following a same-day checkpoint that found no trigger evidence. | HIGH | None — recorded in all touched documents. |
| 2 | Did fixing git-guard.mjs go beyond the requested scope? | Upheld as necessary | The fix was required to validate T3/T5/T6 at all (`run-experiment.mjs` could not run as a CLI beforehand); scope was kept to the minimal entry-point guard, not a broader refactor. | HIGH | None. |
| 3 | Does T5 shipping default-off satisfy "implement it today"? | Upheld | The ticket is implemented (code exists, is wired, is testable via an explicit opt-in); "implemented" and "enabled by default" are different questions, and the Brief states the default-off choice and its evidence explicitly. | HIGH | If the user wants it enabled globally, that is a one-line follow-up, not a re-implementation. |
| 4 | Any regression to existing loop behavior for users who take none of these new opt-ins? | Not found | `plan-review.mjs` self-test (33/33) and `git-guard.mjs` self-test (27/27) both pass unchanged; T3/T6 changes are additive with safe defaults. | HIGH | None. |

### Final status
- T3: **shipped** — deterministic compaction wired into both composers.
- T5: **shipped, default-off** — opt-in scratch-notes for `run-experiment.mjs`.
- T6: **shipped** — bounded recap block appended to every composed prompt.
- T4: unchanged (watchlist, no trigger). T7: unchanged (parked, no ticket).
- Bonus: fixed a real, previously-undiscovered bug in `git-guard.mjs` that silently broke
  `run-experiment.mjs` as a runnable CLI.
