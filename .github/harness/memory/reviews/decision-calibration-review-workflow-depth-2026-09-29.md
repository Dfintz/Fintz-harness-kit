# Review Depth: F-D4 Appendix A Cleanup (2026-09-29)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-review-workflow-2026-09-28.md, .github/harness/memory/reviews/architect-challenge-verdict.md, .github/harness/memory/reviews/decision-calibration-review-workflow-breadth-2026-09-29.md, scripts/harness/config.mjs

Scoped Depth passes for the F-D4 maintenance implementation authorized by
[Appendix A](../briefs/decision-calibration-review-workflow-2026-09-28.md) and the
[F-D4 Challenge APPROVED verdict](architect-challenge-verdict.md). Stage contract:
[06-REVIEW-DEPTH](../../../instructions/06-REVIEW-DEPTH.md). This file holds two passes: the
**Final Depth pass (current)**, entered after
[Breadth Pass 6](decision-calibration-review-workflow-breadth-2026-09-29.md), and the **Initial
Depth pass (superseded for status)**, entered after Breadth Pass 5. The
[2026-09-28 Depth record](decision-calibration-review-workflow-depth-2026-09-28.md) covers the
earlier cycle and is not superseded for that scope. Both passes were read-only for source, test,
fixture, config and private files.

## Final Depth pass — after Breadth Pass 6 (current)

### Final verdicts

- **F-D4 Depth verdict: PASS for structure.** 0 Blocker, 0 Major, 0 Minor, 0 Nit. The only change
  since the Initial pass is the test-only P5-n1 repair; evaluator and report API are unchanged from
  the Initial pass. No new finding; no finding changes F-D4 scope.
- **P5-n1: Closed (Gate 5).** Confirms Breadth Pass 6.
- **F-D4 closure:** not closed by Depth. **Feedback disposition is pending.**
- **Overall release: BLOCKED (F-S1).** Latest Snyk Code attempts on evaluator and test: HTTP 401
  on both. Sonar MCP fails at startup (exit 1); this pass re-tried `toggle_automatic_analysis`
  (disable, at start) and got "MCP server could not be started: Process exited with code 1".
  Automatic analysis cannot be re-enabled and `analyze_file_list` cannot run. These are tool
  failures, **not passes**. F-S1 is not pursued as a structural code change (Appendix A.8) and
  stays with the parent execution agent / release verification owner.

### Final context sufficiency

Inputs: 06-REVIEW-DEPTH, Appendix A (A.4, A.5 command contract, A.8, A.10), the Initial Depth
pass below, and Breadth Pass 6. The source was re-read directly: evaluator 80–106, 407–408,
465, 478, 638–639; test 18–74, 456–494, 726–889; README 45–77. No new structural context is
missing. The MISSING/LIMITATION note from the Initial pass (no isolated diff) still applies with
the same low risk.

### Final gate ledger (delta and re-confirmation)

| Path | G1 | G2 | G3 | G4 | G4b | G5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Test helper reuse (test 58–74; call sites 823, 825, 855, 871) | — | — | Pass | Pass | — | Pass | The bounds, 101-entry and linked rows now call `assertReportInputRejectedForBoth`. The warning literal appears once in the helper (67) and once in the exact-stderr compatibility assertion (763). There is one `split(warning)` count (68). The helper is test-local, has four call sites and adds no export or fault-injection surface. |
| Parser normalization and conflict (evaluator 80–85, 94) | Pass | Pass | Pass | Pass | Pass | Pass | Unchanged. The conflict check runs before normalization; report `--queue` becomes `reviewed` and `queue` is cleared. |
| Import `--queue` / `candidateQueue` (106, 478) | Pass | — | Pass | Pass | Pass | Pass | Unchanged. `legacyReportQueue` requires `--deterministic-only`, and offline modes are mutually exclusive, so import never warns. The test asserts empty stderr for explicit import `--queue` (test 481). |
| Canonical `--reviewed` report consumer (407–408) | Pass | — | Pass | Pass | Pass | Pass | Reads only `options.reviewed`. No `options.queue ??`, `paths.queue`, `loadCases` or `legacyCandidates` remains. There is one mismatch throw (465). |
| Warning edge (`main` 638–639) and README (45–77) | Pass | — | Pass | Pass | Pass | Pass | Unchanged. The exact warning goes to stderr only. The README uses `--reviewed` for reports, documents the alias warning and both-flag rejection, and states that import `--queue` is not deprecated. |
| Privacy / freeze / F-S1 wording | Pass | — | Pass | Pass | Pass | — | The fixture and `harness.config.json` are absent from scoped `git status`; `.github/harness/runs/*` is ignored (`.gitignore:11`). Freeze PASS. No artifact claims a scan result, waiver or release clearance. |

### Final Appendix A conformance

- **A.4:** artifacts modified are only the evaluator, the adjacent test and the existing guide.
  No second suite was added.
- **A.5 command contract:** every row is still met.
- **A.8 Do NOT:** not violated. No scanner-driven refactoring was done.
- **A.10 count:** A.10 records 20 tests. The current count is 21 because the bounds/linked test
  was added in the Breadth cycle. This is historical, not a divergence; A.10 was not edited.

### Final structural findings ledger

Blocker: none. Major: none. Minor: none. Nit: none open. The FYI items in the Initial pass stand
unchanged, except that the "Nit (carried)" entry below is now closed.

### Final proof run by this review

| Command | Result |
| --- | --- |
| `npm run --silent test:harness:decision-sidecar` (aggregate) | exit 0: policy 5/5, sidecar HTTP 9/9, advisory 8/8, router PASS, backend-openai 14/14, freeze PASS (7 invariants + negative control), eval 21/21 |
| `npm run --silent test:harness:decision-eval` | tests 21, pass 21, fail 0, cancelled 0, skipped 0, todo 0 |
| `node --test --test-name-pattern="report bounds and linked review inputs" --test-reporter=tap …` | `ok 1`, no `# SKIP`; tests 1, pass 1, fail 0, skipped 0 |
| `npm run --silent test:harness:decision-freeze` | PASS (7 invariants + negative control) |
| `npm run --silent harness:config:self-test` | PASS |
| Scoped `git status --short`, `git check-ignore -v` | evaluator modified; test and eval README untracked; fixture/config unchanged; calibration dir ignored (`.gitignore:11`) |
| Grep for removed names and consumers | no matches, as described in the gate ledger |
| Sonar `toggle_automatic_analysis` (disable at start, re-enable at end) | both: MCP server could not be started, exit 1 (not a pass; automatic analysis not restored) |
| Snyk Code, evaluator and test | HTTP 401 on both (latest attempt; not a pass) |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after this artifact; results in the session report |

### Final handoff

Depth: no Implement repair required; F-D4 has no open Breadth or Depth findings. Next:
**Feedback** disposition of F-D4. **Release is BLOCKED (F-S1)** until successful Snyk Code scans of
evaluator and test, a working Sonar analysis of both with automatic analysis restored, and triage
or repair proof exist.

## Initial Depth pass — after Breadth Pass 5 (superseded for status)

No scanner was re-attempted in this pass.

### Verdicts

- **F-D4 Depth verdict: PASS for structure.** 0 Blocker, 0 Major, 0 Minor. Breadth nit P5-n1 is
  confirmed as optional and trivial (Gate 5, test-local); it is not an architecture blocker and is
  left to Feedback. No finding changes F-D4 scope.
- **F-D4 closure:** not closed by Depth. **Feedback disposition is pending.**
- **Overall release: BLOCKED (F-S1).** Snyk Code on evaluator and test failed HTTP 401; Sonar MCP
  fails at startup (exit 1), so `analyze_file_list` never ran and automatic analysis could not be
  toggled. These are recorded as external tool failures, **not passes**, in Breadth Pass 5,
  Appendix A.6/A.10 and the Challenge verdict. No artifact reviewed here claims a scan result,
  waiver or release clearance. F-S1 stays with the parent execution agent / release verification
  owner.

### Context sufficiency

| Artifact | Role | Owning surface |
| --- | --- | --- |
| Appendix A (A.2–A.10) | scope, exact command contract, Do NOT rules | brief |
| Challenge F-D4 verdict | accepts the bounded legacy-spelling exception; scopes the env removal | challenge record |
| Breadth Pass 5 | correctness ledger, P5-n1, F-S1 state | breadth record |
| [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) (tracked, modified) | `parseArgs`, `pathsFor`, `deterministicBaseline`, `validateReviewedEntries`, `importReviewed`, `main` | evaluator / CLI |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) (untracked) | CLI contract proof | test |
| [eval/README.md](../../eval/README.md) (untracked, existing guide) | operator contract | docs |
| [config.mjs](../../../../scripts/harness/config.mjs) | `HARNESS_REPO_ROOT` consumer (transitive) | shared config |

> MISSING: an isolated F-D4-only diff (HEAD predates the 2026-09-28 cycle; test and guide are
> untracked).
> LIMITATION: structure is judged on the current end state against Appendix A and a targeted grep
> for every removed name.
> RISK: low — each removal and each consumer was located directly in source.

No critical structural context is missing. The graph was not refreshed; ownership is
source-grounded, as in Appendix A.9.

### Gate ledger

| Path | G1 | G2 | G3 | G4 | G4b | G5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Canonical parser normalization with backwards alias (`parseArgs` 80–94, `main` 638–639) | Pass | Pass | Pass | Pass | Pass | Pass | The conflict check (80) runs once, before normalization (81–85), so the alias cannot overwrite an explicit `--reviewed`. Report-mode `--queue` becomes `reviewed` and `queue` is cleared, so no dual-purpose field reaches report logic. The warning is written in `main` after all parse validation and before any root or input read. No deprecation registry or mode framework was added. |
| Report consumer (`deterministicBaseline` 407–408) | Pass | — | Pass | Pass | Pass | Pass | Reads only `options.reviewed` through the shared `loadReviewSubmission`; `options.queue ?? options.reviewed` is gone (grep: no match). |
| Import `candidateQueue` separation (`pathsFor` 106, `importReviewed` 478) | Pass | — | Pass | Pass | Pass | Pass | The resolved import-only path is named `candidateQueue`, with one definition and one consumer; `paths.queue` has no match. In report mode `options.queue` is null after normalization, so the unused default path is inert. |
| Removed dead code: `loadCases`, `legacyCandidates` | Pass | — | Pass | — | — | Pass | No matches remain. `loadValidatedCases` is called directly at every former site. Deletion reduces concepts; nothing was relocated. |
| Removed redundant guard (accepted loop 496) | Pass | — | Pass | Pass | Pass | Pass | The only `does not match the local candidate queue` throw is in `validateReviewedEntries` (465), which runs over the full batch (481) before the loop. The loop keeps its `sourceById` lookup for projection and duplicate checks. The mismatch test (267–270) proves that the remaining owner rejects with no fixture change. |
| Removed test env assignment (`evaluatorEnv` 18–27) | — | — | Pass | Pass | Pass | — | Only `HARNESS_REPO_ROOT` was dropped. `HARNESS_PROJECT_ROOT`, the `includeProjectRoot: false` control (462), endpoint overrides, `--repo-root` and the write-fault hook stay. This matches the Challenge scope ("do not claim the variable is globally inert"). |
| Test helpers (58–74) and suite shape | — | — | Pass | Pass | — | Pass (P5-n1) | The helpers sit with the other top-level helpers and have call sites (823, 825). There is still one suite, with no new fault-injection surface. The bounds and linked loops (855–862, 878–885) inline weaker copies of the helper checks, which is P5-n1. |
| Docs ownership (README 45–77) | Pass | — | Pass | Pass | Pass | Pass | The operator guide owns the command contract: `--reviewed` report example, exact stderr-only warning, both-flag rejection, and import `--queue` not deprecated. The brief owns decisions. A repo grep finds no other operator surface advertising report `--queue`; memory records only cite it historically. |
| Privacy / freeze | Pass | — | Pass | Pass | Pass | — | Warning text contains flag names only. Tests use invented temp-root data. `decision-intent-cases.json` and `harness.config.json` are absent from scoped `git status`. `.github/harness/runs/*` is ignored (`.gitignore:11`). Freeze PASS (7 invariants + negative control). Private file contents were not read. |
| F-S1 release gate | — | — | Pass | — | Pass | — | The owner and blocked state are consistent across brief, challenge and breadth records. A grep for pass, cleared, verified or waived wording near F-S1 or release finds only negations. |

### Trace: legacy report invocation end-to-end

1. Entry: `--deterministic-only --queue <batch>`.
2. `parseArgs`: rejects a flag without a value; the conflict check (80); then normalize (81–85);
   offline-mode exclusivity, bounds and `--cases` rules; sets `legacyReportQueue` (94).
3. `main`: exactly one warning line on stderr (638–639), then root resolution and dispatch.
4. `deterministicBaseline`: contained, bounded, versioned read of `options.reviewed`; counts only;
   no write.
5. Errors: validation throws exit nonzero with empty stdout. The warning precedes the error. The
   ordering and single warning are pinned by the helper rows.
6. No isolation boundary is crossed. The containment, link and bounds checks are the same code
   path as the canonical spelling.

The stored `legacyReportQueue` flag cannot be derived after normalization, so storing it is
justified (Line-level: Derivability).

### Complexity-reduction test

Report logic now holds one input concept (`reviewed`) instead of a coalesced pair. Import holds one
named candidate path. The four mechanical removals delete a wrapper, a dead field, a repeated guard
and an env assignment. Compatibility adds one parse branch and one stderr write at the CLI edge.
Net: fewer concepts in consumers, and the compatibility cost sits at the boundary Appendix A.5
assigns to it. **Reduces complexity**; nothing was relocated.

### Structural findings ledger

#### Blocker

None.

#### Major

None.

#### Minor

None.

#### Nit (carried, not new; closed in the Final pass)

- **P5-n1 confirmed (Gate 5, reuse; test-local).** The warning literal appears four times in the
  test (67, 763, 860, 883), and the bounds and linked loops re-implement a weaker form of
  `assertReportInputRejected`. There is no deeper structural cause: production owns the literal once
  (639), and tests pinning the contract text rather than importing it is correct. Remedy, if
  Feedback wants it: call the helper from both loops. Confidence: HIGH. **Optional; not an
  architecture blocker.**

#### FYI (no action under F-D4)

- **Pre-existing overlap.** Test 612–616 still exercises report bounds with `--queue` only. It
  predates F-D4 and is now covered for both spellings by 841–889. Under the scope limit, this is
  not a finding.
- **Traversal form.** The outside-root row uses an absolute sibling path, not a literal `..`
  segment. `resolve()` normalizes both before `assertContained`, so they share one code path.
  Breadth Pass 3 probed `..` for both spellings.
- **Ambient `HARNESS_REPO_ROOT`.** Child processes now inherit any caller value.
  [config.mjs](../../../../scripts/harness/config.mjs) resolves it at import without reading
  files. Evaluator fixture, config and calibration paths come only from `--repo-root` and
  `HARNESS_PROJECT_ROOT`. The Challenge accepted this residual; tests remain deterministic for
  evaluator outputs.
- **Scanner-class IDE diagnostics** (path-flow, `parseArgs` complexity 28, others) remain
  untriaged under F-S1. Appendix A.8 forbids scanner-driven refactoring here.

### Brief divergence

None material. A.4 says to normalize "at the existing CLI dispatch boundary". Conversion happens in
`parseArgs`, and the warning is written in `main`. Together they satisfy A.5: normalize once, then
warn after argument validation and before report reads. This split keeps `parseArgs` free of I/O.
Standalone `--queue` and `--reviewed` no-ops outside their modes are preserved. Deprecation applies
only with `--deterministic-only`. The A.8 Do NOT rules were not violated.

### Proof run by this review

| Command | Result |
| --- | --- |
| `npm run --silent test:harness:decision-eval` | tests 21, pass 21, fail 0, skipped 0, cancelled 0 |
| `npm run --silent test:harness:decision-freeze` | PASS (7 invariants + negative control) |
| Scoped `git status --short`, `git check-ignore -v` | evaluator modified; test and README untracked; fixture/config unchanged; calibration dir ignored (`.gitignore:11`) |
| Grep for removed names and consumers | no `loadCases`, `legacyCandidates`, `paths.queue` or `options.queue ??`; one mismatch throw (465) |
| Snyk / Sonar | not re-attempted (per task); F-S1 BLOCKED as recorded in Breadth Pass 5 |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after this artifact; results in the session report |

Previous aggregate `test:harness:decision-sidecar` (Breadth Pass 5): exit 0 including eval 21/21.

### Handoff

Depth: no Implement repair required. Next: **Feedback** disposition of F-D4, including P5-n1
(accept or trivial repair). **Release is BLOCKED (F-S1)** until successful Snyk Code scans of
evaluator and test, a working Sonar analysis of both with automatic analysis restored, and triage
or repair proof exist.
