# Review Breadth: F-D4 Appendix A Cleanup (2026-09-29)

Scoped Breadth review of the F-D4 maintenance implementation authorized by
[Appendix A](../briefs/decision-calibration-review-workflow-2026-09-28.md) and the
[F-D4 Challenge APPROVED verdict](architect-challenge-verdict.md). Stage contract:
[05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). This file holds six passes on the
same day: **Pass 6 (current, latest)** verifies only the P5-n1 repair; **Pass 5
(superseded)** is the final scoped re-review after the post-Pass 4
residual repairs; **Pass 4 (superseded)** re-reviewed the Pass 3 residual repairs; **Pass 3
(superseded)** re-reviewed the Pass 2 repair; **Pass 2 (superseded)** re-reviewed the repair of
B1–B5; **Pass 1 (superseded)** is the original finding record. No pass changed source, test,
fixture, config or private files. Findings only; repairs go back to Implement.

## Pass 6 — Narrow verification of the P5-n1 repair (current, latest)

### Pass 6 verdicts

- **P5-n1: Closed.** Scope was the P5-n1 repair only; no other surface was re-reviewed.
- **Overall F-D4 Breadth: no findings** (no Blocker, Major, Minor or Nit open). Breadth does not
  close F-D4; Feedback disposition is still pending.
- **Overall release: BLOCKED (F-S1)**, unchanged from Pass 5. No new Snyk or Sonar result exists;
  none was attempted in this pass.

### Pass 6 context

| Artifact | State reviewed |
| --- | --- |
| Pass 5 ledger (P5-n1) | this file |
| Brief Appendix A.10 | read; records `test:harness:decision-eval` PASS at 20 tests, written before the bounds/linked test was added. The current count is 21. A.10 was not edited. |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) | working tree (untracked), lines 58–74, 841–889 |

### Pass 6 closure evidence (direct)

| Check | Result |
| --- | --- |
| Oversized and 101-entry rows call the helper | Loop at 851–856 calls `assertReportInputRejectedForBoth(root, pathname, pattern, label)`. |
| Linked row calls the helper | 871–876 calls `assertReportInputRejectedForBoth` with `/must not use symbolic links or junctions/`. |
| No inline copies remain | Warning literal occurs only in the helper (67) and in the exact-stderr compatibility assertion (763). There is no other `split(warning)` count. |
| `--queue`: exact warning once | Helper counts the full warning line including `\n` and requires exactly 1 (67–68). |
| `--queue`: error after warning | Pattern is matched against `stderr.slice(warning.length)` (69). |
| `--reviewed`: no warning | Helper asserts `stderr` has no `deprecated` (62). |
| Error shape, exit, stdout | Both flags: `status !== 0` (60), `stdout === ""` (61), and the validation pattern is matched (63, 69). |
| Link branch not skipped | TAP run: `ok 1`, `# skipped 0`, no `# SKIP` directive. |

### Pass 6 proof run by this review

| Command | Result |
| --- | --- |
| `node --test --test-name-pattern="report bounds and linked review inputs" --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` | `ok 1`; tests 1, pass 1, fail 0, cancelled 0, skipped 0 |
| `npm run test:harness:decision-eval` | tests 21, pass 21, fail 0, cancelled 0, skipped 0 |
| `git status --short` (evaluator, test, eval dir, config) | evaluator modified, test and eval README untracked. `decision-intent-cases.json` and `harness.config.json` are unchanged. |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | `[docs-contracts] OK`; `[memory-references] OK` (863 Markdown files scanned) |

No source, test, fixture, config or private file was changed or read beyond the paths above.

### Pass 6 residual classification

| Residual | Classification |
| --- | --- |
| P2-n1, P2-n2, P3-m1, P3-n1, P3-n2, P3-n3, P4-n1, P5-n1 | Closed |
| F-S1 (Snyk 401, Sonar MCP startup exit 1, `ENOENT` path echo, IDE diagnostics) | Open, release blocker, not an F-D4 code defect |

### Pass 6 handoff

Breadth: no Implement repair is required and F-D4 has no open Breadth findings. Next step:
Feedback disposition of F-D4. F-S1 still needs successful Snyk Code scans and Sonar analysis of
the evaluator and the test, with automatic analysis restored, followed by triage. **Release is
BLOCKED.**

## Pass 5 — Final scoped re-review after post-Pass 4 repairs (superseded by Pass 6)

### Pass 5 verdicts

- **F-D4 Breadth verdict: static correctness PASS (no Blocker, no Major, no Minor).** P3-m1,
  P3-n1, P3-n2, P3-n3, P2-n1, P2-n2 and P4-n1 are closed. B1–B5 stay closed. The exact A.7
  command selects the named test. One optional trivial nit (P5-n1) is recorded. Breadth does not
  close F-D4: **Feedback disposition is still pending** (and Depth, if the parent sequence requires
  a re-run).
- **Overall release: BLOCKED (F-S1).** Final scans failed again; these are tool failures, **not a
  pass**:
  - Snyk Code, evaluator and test: HTTP 401 on both (parent's final attempt). No Snyk result.
  - Sonar: the MCP server fails at startup with exit code 1. This review re-tried
    `toggle_automatic_analysis` (enable) at the end of this pass; it returned "MCP server could
    not be started: Process exited with code 1". Automatic analysis could not be disabled at start
    and **could not be re-enabled**; `analyze_file_list` cannot run. No Sonar result.
  - No scan result, triage or disposition exists for either code file. F-S1 stays with the parent
    execution agent / release verification owner. No waiver, credential or configuration change
    was made. No blanket security pass was performed (out of scope).

### Pass 5 context sufficiency

| Artifact | State reviewed | Surface |
| --- | --- | --- |
| Pass 4 ledger (P3-m1, P3-n1–n3, P2-n1–n2, P4-n1) | this file | contract for this pass |
| [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) | working tree (tracked, modified), lines 80–106, 407–408, 478, 638–639 | CLI / evaluator |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) | working tree (untracked), lines 58–74, 662–679, 726–839, 841–889 | test |
| [eval/README.md](../../eval/README.md) | working tree (untracked), lines 45–77 | operator guide |

**Scope:** mixed (software + documentation).

> MISSING: an isolated Pass 4 → Pass 5 repair diff (test and guide are untracked).
> LIMITATION: end state is judged against the Pass 4 ledger and Appendix A.7.
> RISK: low — every closure below was checked in source and by running the tests.

### Pass 5 closure of residuals

| Finding | Pass 5 status | Evidence (direct) |
| --- | --- | --- |
| Exact A.7 name pattern | **Selected** | The exact A.7 command reports `✔ reviewed report compatibility preserves both spellings and output`; tests 1, pass 1, fail 0, skipped 0. |
| P3-m1 no-write proof brackets successful runs | **Closed** | Fixture, config, history, calibration-listing snapshots and the selected-input byte snapshot `selectedReviewBeforeReports` are taken at test 748–752, **before** the first report invocation (format loop, 754). They are compared after the compact, `--json`, compact-vs-JSON and repeat runs (783–787) and again after the all-pending run (799–803). |
| P3-n1 raw error-code/path pin | **Closed** | The missing row checks only the shape `/^\[decision-eval\] [^\n]+\n$/` (810). No `ENOENT`, `stat '` or absolute-path literal is in the test. |
| P3-n2 exact warning once | **Closed** | The shared helper (58–70) counts the full warning line with newline, requiring exactly 1 for `--queue`, and matches the error after the warning (`slice(warning.length)`). For `--reviewed` it asserts no `deprecated` text. Bounds and linked rows count the warning once (860, 883). |
| P3-n3 oversized, 101 entries, link/junction for both flags | **Closed** | Test `report bounds and linked review inputs apply to both spellings` (841): 1 MiB + 1 rejects with `exceeds the 1048576-byte limit`; 101 entries rejects with `bounded versioned candidate queue`; a junction/dir link inside the calibration root rejects with `must not use symbolic links or junctions`. Every row asserts nonzero exit and empty stdout. The link row ran on this host (TAP `ok 1`, no `# SKIP`). |
| Missing, malformed, schema, status, outside-root for both flags | **Covered** | `assertReportInputRejectedForBoth` is called for the four invalid inputs (823) and the outside-root path (825): nonzero exit, `stdout === ""`, validation error, and the warning rule above. |
| P2-n1 duplicate conflict check | **Closed** | One conflict check in `parseArgs` (evaluator 80), before legacy normalization (81–94). Conflict rows for different paths (662–679) and identical paths in both orders (826–831) assert exact stderr and empty stdout. |
| P2-n2 README import/default wording | **Closed** | README 51–53: "`--queue` selects the private candidate batch … If omitted, it defaults to …". |
| P4-n1 unused test helpers | **Closed** | Both helpers now have call sites (823, 825). The IDE no longer reports a Cognitive Complexity diagnostic for the compatibility test (was 16 at Pass 4). |

### Pass 5 B1–B5 re-check

- **B1:** evaluator 638–639 writes the exact warning to stderr only when `legacyReportQueue`;
  the compatibility test asserts exact legacy stderr and empty canonical stderr (762–763).
- **B2:** `candidateQueue` is defined at 106 and consumed at 478; report reads only
  `options.reviewed` (407–408).
- **B3:** exact name at test 726; mixed 2/3/5 plus one pending, no `pending` key; raw stdout
  equal for both spellings in compact and `--json`; compact differs from `--json` (777).
- **B4:** no-batch unmeasured (789–790), all-pending 0/0/0 (798), both-spelling error rows and
  conflicts present.
- **B5:** README report block uses `--reviewed` (64); exact warning, stderr-only (67–72);
  both-flag rejection (74); import `--queue` not deprecated (74–76).

### Pass 5 findings ledger

No Blocker, Major or Minor.

#### Pass 5 Nit

- **P5-n1 — Bounds and linked loops still inline the helper's checks (trivial, optional).** The
  loops at test 855–862 and 878–885 repeat the rejection checks instead of calling
  `assertReportInputRejected`. They are slightly weaker: they match the error against the full
  stderr, not the text after the warning, and they count the warning without its newline. Evidence:
  direct. Impact: duplication only; a regression that put the error before the warning would
  still pass these rows, but the helper rows cover that ordering for the same reader. Remedy: call
  `assertReportInputRejected(root, pathname, flag, pattern, label)` in both loops. Feedback may
  accept this as-is.

#### Pass 5 residual classification

| Residual | Classification |
| --- | --- |
| P2-n1, P2-n2, P3-m1, P3-n1, P3-n2, P3-n3, P4-n1 | Closed |
| P5-n1 | Open, trivial, non-blocking |
| F-S1 (Snyk 401, Sonar startup exit 1, `ENOENT` path echo in evaluator stderr, IDE diagnostics) | Open, release blocker, not an F-D4 code defect |

#### Pass 5 FYI

- **IDE diagnostics (untriaged, F-S1).** Path-flow classes unchanged: evaluator 27, 99–106, 111,
  123–124, 132, 141, 156, 303, 408, 479; test helpers 97, 101, 105. Production complexity
  unchanged: `parseArgs` 28, `exportCandidates` 23, `importReviewed` 26, `main` 22, `summarise` 17.
  Style notes at 267, 439, 721. **Test complexity diagnostic is gone** (was 16 on the compatibility
  test at Pass 4). Appendix A forbids scanner-driven refactoring here; not F-D4 findings.
- **Diff hygiene.** Scoped `git status` shows the evaluator (modified), the test and README
  (untracked); `.github/harness/eval/decision-intent-cases.json` and `harness.config.json` are
  unchanged; `.github/harness/runs/*` is ignored (`.gitignore:11`). Test data is invented and
  temp-root only. Private file contents were not read.

### Pass 5 proof run by this review

| Command | Result |
| --- | --- |
| `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs` | named test ✔; tests 1, pass 1, fail 0, cancelled 0, skipped 0 |
| `node --test --test-name-pattern="report bounds and linked review inputs" --test-reporter=tap …` | `ok 1`, no `# SKIP`; tests 1, pass 1, fail 0, skipped 0 |
| `npm run test:harness:decision-eval` | tests 21, pass 21, fail 0, skipped 0, cancelled 0 |
| `npm run test:harness:decision-sidecar` (aggregate) | exit 0: policy 5/5, sidecar HTTP 9/9, advisory 8/8, router PASS, backend-openai 14/14, freeze PASS (7 invariants + negative control), eval 21/21 |
| `git status --short` (scoped), `git check-ignore -v` | as in Pass 5 FYI |
| Sonar `toggle_automatic_analysis` (enable) | MCP server could not be started, exit 1 (not a pass) |
| Snyk Code, evaluator and test | HTTP 401 on both (parent's final attempt; not a pass) |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after this ledger update; results in the session report |

### Pass 5 handoff

Breadth: no Implement repair required; P5-n1 is optional. Next: Feedback disposition of F-D4
(pending). F-S1 needs successful Snyk Code scans of the evaluator and test, a working Sonar MCP
server with analysis of both and automatic analysis restored, and triage. **Release is BLOCKED.**

## Pass 4 — Final scoped re-review of Pass 3 residuals (superseded by Pass 5)

### Pass 4 verdicts

- **F-D4 Breadth verdict: static correctness PASS (no Blocker, no Major, no Minor).** P3-m1,
  P3-n1, P3-n2, P3-n3, P2-n1 and P2-n2 are closed. B1–B5 stay closed. The exact A.7 name pattern
  selects the named test. One new trivial nit (P4-n1, unused test helpers) is recorded with direct
  evidence; it does not block. Breadth does not close F-D4: **Feedback disposition is still
  pending** (and Depth, if the parent sequence requires a re-run).
- **Overall release: BLOCKED (F-S1).** Final scans were attempted this pass and failed again:
  - Snyk Code on the evaluator and on the test: HTTP 401 on both files (reported by the parent
    execution for this pass). No Snyk result exists.
  - Sonar: `toggle_automatic_analysis` (disable, required at task start) was re-tried by this review
    and returned "MCP server could not be started: Process exited with code 1". Automatic analysis
    therefore could not be disabled at start or re-enabled at end, and `analyze_file_list` cannot
    run. No Sonar result exists.
  - These are tool failures, **not a pass**. No scan result, triage or disposition exists for
    either code file. F-S1 stays with the parent execution agent / release verification owner. No
    waiver, credential or configuration change was made.

### Pass 4 context sufficiency

| Artifact | State reviewed | Surface |
| --- | --- | --- |
| Appendix A (A.4, A.5, A.7, A.10) | current brief, read directly | contract |
| Pass 3 ledger (P3-m1, P3-n1–n3, P2-n1–n2 carried) | this file | contract for this pass |
| [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) | working tree (tracked, modified), lines 30–95, 99–107, 407–408, 478, 638–639 | CLI / evaluator |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) | working tree (untracked), lines 58–74, 662–679, 726–857, 860–907 | test |
| [eval/README.md](../../eval/README.md) | working tree (untracked), lines 45–77 | operator guide |

**Scope:** mixed (software + documentation).

> MISSING: an isolated Pass 3 → Pass 4 repair diff (test and guide are untracked).
> LIMITATION: end state is judged against Pass 3 fixes and Appendix A.7.
> RISK: low — every closure below was checked in source and by running the tests.

### Pass 4 closure of Pass 3 residuals

| Finding | Pass 4 status | Evidence (direct) |
| --- | --- | --- |
| Exact A.7 name pattern | **Selected** | The exact A.7 command reports `✔ reviewed report compatibility preserves both spellings and output`; tests 1, pass 1, skipped 0. The new bounds/linked test name does not match the pattern. |
| P3-m1 no-write proof after successful runs | **Closed** | Fixture, config, history and calibration-listing snapshots, plus a byte snapshot of the selected input (`selectedReviewBeforeReports`), are taken at test lines 748–752, **before** the format loop (754). They are compared after the compact, `--json`, compact-vs-JSON and repeat runs (783–787), and again after the all-pending run (799–803). |
| P3-n1 raw error-code/path pin | **Closed** | The missing row uses the shape `/^\[decision-eval\] [^\n]+\n$/` (810). No `ENOENT`, `stat '` or absolute-path literal remains in the test. |
| P3-n2 exact warning once | **Closed** | Legacy rows count the exact warning with `split(...).length - 1 === 1`: invalid inputs (832, the full line with newline), outside-root (842), bounds (879) and linked (902). Canonical rows assert no `deprecated` text. Invalid rows match the error after the warning (`slice(warning.length)`). |
| P3-n3 oversized, 101 entries, link/junction | **Closed** | New test `report bounds and linked review inputs apply to both spellings` (860). For both flags: 1 MiB + 1 bytes rejects with `exceeds the 1048576-byte limit` (867, 871); 101 entries rejects with `bounded versioned candidate queue` (868); a junction/dir link inside the calibration root rejects with `must not use symbolic links or junctions` (889–903). Each row asserts nonzero exit and empty stdout. The link row ran on this host (TAP `ok 1`, no `# SKIP`). |
| P2-n1 duplicate conflict check | **Closed** | `parseArgs` has one conflict check (evaluator line 80), before legacy normalization (81–85). Conflict tests in both orders, different paths (662–679) and identical paths (845–850), still assert exact stderr and empty stdout. |
| P2-n2 README import wording | **Closed** | README now reads "`--queue` selects the private candidate batch … If omitted, it defaults to …" (51–53). |

### Pass 4 B1–B5 re-check

- **B1:** evaluator 638–639 writes the exact warning to stderr only when `legacyReportQueue`;
  the compatibility test asserts exact legacy stderr and empty canonical stderr.
- **B2:** `candidateQueue` defined at 106 and consumed at 478; report reads only
  `options.reviewed` (407–408).
- **B3:** exact name at test 726; mixed 2/3/5 plus one pending, no `pending` key; raw stdout bytes
  equal in compact and `--json`; compact differs from `--json` (777).
- **B4:** no-batch unmeasured, all-pending 0/0/0, both-spelling error rows and conflicts present.
- **B5:** README report block uses `--reviewed`; exact warning, stderr-only; both-flag rejection;
  import `--queue` not deprecated.

### Pass 4 findings ledger

No Blocker, Major or Minor.

#### Pass 4 Nit

- **P4-n1 — Two unused test helpers (trivial).** `assertReportInputRejected` and
  `assertReportInputRejectedForBoth` (test lines 58–74) have no call sites; a grep finds only their
  definitions. The same checks are written inline at 821–843, 874–880 and 897–903. Evidence:
  direct. Impact: dead code only; behaviour and proof are unaffected. Remedy (reuse the canonical
  helper, or delete it): call the helper from those loops, or delete the 17 lines. Feedback may
  accept this as trivial.

#### Pass 4 residual classification

| Residual | Classification |
| --- | --- |
| P2-n1, P2-n2 | Closed |
| P3-m1, P3-n1, P3-n2, P3-n3 | Closed |
| P4-n1 | Open, trivial, non-blocking |
| F-S1 (scanner results, `ENOENT` path echo in evaluator stderr, IDE diagnostics) | Open, release blocker, not an F-D4 code defect |

#### Pass 4 FYI

- **IDE diagnostics (untriaged, F-S1).** Unchanged classes: path-flow on evaluator 27, 99–106,
  111, 123–124, 132, 141, 156, 303, 408, 479 and test helpers 97, 101, 105. Complexity:
  `parseArgs` 28 (was 30 after the P2-n1 collapse), `exportCandidates` 23, `importReviewed` 26,
  `main` 22, `summarise` 17. New this pass: the compatibility test (726) is at complexity 16.
  Style notes at 267, 439, 721. Appendix A forbids scanner-driven refactoring here; not F-D4
  findings.
- **Diff hygiene.** `git status` shows only the evaluator (modified), the test and README
  (untracked) in scope; the fixture and `harness.config.json` are unchanged;
  `.github/harness/runs/*` is ignored (`.gitignore:11`). Test data is invented and temp-root
  only. Private file contents were not read.

### Pass 4 proof run by this review

| Command | Result |
| --- | --- |
| `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs` | named test ✔; tests 1, pass 1, fail 0, skipped 0 |
| `node --test --test-name-pattern="report bounds and linked review inputs" --test-reporter=tap …` | `ok 1`, no `# SKIP`; tests 1, pass 1, skipped 0 |
| `npm run test:harness:decision-eval` | tests 21, pass 21, fail 0, skipped 0, cancelled 0 |
| `git status --short` (scoped), `git check-ignore -v` | as in Pass 4 FYI |
| Sonar `toggle_automatic_analysis` | MCP server could not be started, exit 1 (not a pass) |
| Snyk Code, evaluator and test | HTTP 401 on both (parent attempt this pass; not a pass) |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after this ledger update; results in the session report |

Not re-run (no F-D4 change touches them since Pass 1): decision-freeze, decision-sidecar, config
self-test.

### Pass 4 handoff

Breadth: no Implement repair required. P4-n1 is optional. Next: Feedback disposition of F-D4
(pending). F-S1 needs successful Snyk Code scans of the evaluator and test, Sonar analysis of both,
and triage. **Release is BLOCKED.**

## Pass 3 — Pass 2 closure re-review (superseded by Pass 4)

### Pass 3 verdicts

- **F-D4 Breadth verdict: APPROVED for Breadth (no Blocker, no Major).** P2-M1 is closed: the
  exact A.7 command now selects the renamed test. P2-m3 is closed as scoped. P2-m1 and P2-m2 are
  mostly closed; each leaves a small residual (P3-m1, P3-n1). B1–B5 stay closed. Feedback must
  accept or repair P3-m1 and the listed nits before F-D4 is closed; Breadth does not close F-D4.
- **Overall release: BLOCKED (F-S1).** No scanner was run in this pass; the user scoped out a
  blanket security pass. The Pass 2 scanner state stands: Sonar MCP failed to start and Snyk was
  unauthenticated or unreachable. No Snyk Code or Sonar result exists for the evaluator or its
  test. F-S1 triage, including the raw `ENOENT` path echo, remains open.

### Pass 3 context sufficiency

| Artifact | State reviewed | Surface |
| --- | --- | --- |
| [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) | current working tree (tracked, modified) | CLI / evaluator |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) | current working tree (untracked), test at line 708 | test |
| [eval/README.md](../../eval/README.md) | current working tree (untracked), lines 45–77 | operator guide |
| Pass 2 findings P2-M1, P2-m1–m3, P2-n1–n2 | this file | contract for this pass |

**Scope:** mixed (software + documentation).

> MISSING: an isolated Pass 2 → Pass 3 repair diff (test and guide are untracked).
> LIMITATION: the end state is judged against the Pass 2 fixes and Appendix A.7.
> RISK: low — every claim below was checked in source, by the exact A.7 command and by a probe.

### Pass 3 closure of Pass 2 findings

| Pass 2 finding | Pass 3 status | Evidence (direct) |
| --- | --- | --- |
| P2-M1 A.7 command vacuous | **Closed** | Test renamed to exactly `reviewed report compatibility preserves both spellings and output` (line 708). The exact A.7 command reports that named test, `tests 1`, `pass 1`, exit 0. |
| P2-m1 ENOENT/absolute path pinned | **Mostly closed; residual P3-n1** | The missing-file row now matches `/ENOENT/` (line 775), not the full message, so the absolute path is no longer pinned. The raw error code is still pinned. |
| P2-m2 missing A.7 assertions | **Mostly closed; residual P3-m1** | Compact and `--json` stdout differ (753). `humanLabelled` 0 and `deficit` 100 are asserted (743–744). Byte and listing checks exist (809–812), but the snapshots are taken after the successful report runs (770–773). |
| P2-m3 error-path parity | **Closed as scoped** | These rows run for both spellings: missing, malformed, wrong-schema and invalid-entry (774–796); outside-root traversal (797–802). Each asserts nonzero exit, `stdout === ""` and the error text. The legacy row also asserts the warning prefix. The identical-path conflict is checked in both orders with exact stderr (803–808). |
| P2-n1 duplicate conflict check | Open, optional | Evaluator lines 82 and 94 are unchanged. Behaviour is correct. |
| P2-n2 README import wording | Open, optional | README lines 51–53 still say "must name" and then give the default. The text is accurate, only slightly awkward. |

The README (B5) was strengthened and checked against behaviour:

- the only report code block uses `--reviewed` (64);
- the exact warning is given as stderr-only, with stdout unchanged (67–72);
- supplying both flags rejects before any read or write (74); `parseArgs` throws first;
- import `--queue` is not deprecated (74–76).

All of these match the probe.

### Pass 3 findings ledger

#### Pass 3 Minor

##### P3-m1 — No-write proof does not bracket the successful report runs

1. **Artifact:** test lines 730–768 (successful runs) and 770–773, 809–812 (snapshots and checks).
2. **Finding:** The fixture, config and history snapshots and the calibration-directory listing are
   taken **after** the compact, `--json`, repeat, no-batch and all-pending report runs. The test
   therefore proves no writes only for the invalid-input and conflict runs. It also does not compare
   the bytes of the selected review input (`report-review.json`). It checks only that directory
   names are unchanged, and it does not check the repository root, where `outside-review.json`
   lives.
3. **Evidence:** Direct (test source). The probe, run on a temp root with invented data, walked
   every file under the root before and after all successful, invalid and conflict runs for both
   spellings. Result: 8 files before, 8 after, 0 changed or new. Current behaviour is correct.
4. **Impact:** Low. A regression that wrote during a successful report, or rewrote its input, would
   pass this test.
5. **Confidence:** HIGH.
6. **Fix:** Move the four existing snapshot lines to just before the format loop (line 730). Add
   one byte snapshot of `reviewPathname` and compare it at the end. No new helper is needed.
   Alternatively, Feedback records this as an accepted residual, citing the probe.

#### Pass 3 Nit

- **P3-n1 — `/ENOENT/` still couples the test to the raw error code.** If an F-S1 repair sanitizes
  missing-file errors, this pattern must change. Optional remedy: assert the shape
  `/^\[decision-eval\] [^\n]+\n$/` after the warning, or record the coupling as intentional until
  F-S1 triage.
- **P3-n2 — Legacy warning count and traversal warning are not asserted exactly.** Error rows use
  `startsWith(WARNING)`, which does not fail on a duplicated warning. The traversal rows do not
  assert the warning for `--queue` or its absence for `--reviewed`. The probe found exactly one
  warning, and an error identical to the canonical one, for all six bad inputs. Optional remedy:
  assert `stderr.split(WARNING).length === 2` and apply the same prefix check to the traversal rows.
- **P3-n3 — A.7 items still uncovered for the report spellings:** linked (symlink/junction) review
  input; oversize and too-many for `--reviewed` (lines 586–588 cover `--queue` only). Structural
  argument: `parseArgs` normalizes both spellings to `options.reviewed` before any read, so one
  reader serves both. Feedback should accept this explicitly or ask Implement for one
  link-conditional row.
- P2-n1 and P2-n2 are carried forward unchanged (see above).

#### Pass 3 FYI

- **B1–B5 confirmed still closed.**
  - B1: exact warning at evaluator line 640; the test asserts exact stderr (739).
  - B2: `candidateQueue` is defined at line 107 and consumed at 479; no `options.queue` report read.
  - B3: exact name (708); mixed 2/3/5 plus one pending, with no `pending` key; stdout is compared
    as raw bytes in both formats.
  - B4: unmeasured, all-pending zero counts, both-spelling errors and conflicts.
  - B5: README as listed above.
- **Probe results** (temp root, invented data; probe script and root deleted):
  - Mixed batch 1/2/3 with one pending: alias stdout equals canonical stdout in both formats.
    Compact output has 1 newline and pretty output has 155. Canonical stderr is `""`. Legacy stderr
    is exactly the warning.
  - Missing, malformed, schema, status, outside-root and `..` traversal each exit 1 with
    `stdout === ""` for both spellings. Legacy output has exactly one warning, followed by the
    canonical error text byte for byte. Canonical output has no warning.
  - Error texts:
    - `reviewed submission contains invalid JSON`
    - `... must be a bounded versioned candidate queue`
    - `... contains an invalid review entry`
    - `... must stay inside its allowed local directory`
    - missing file: the raw `ENOENT ... stat '<absolute path>'` (F-S1)
  - Identical-path conflict in both orders: exit 1, empty stdout, exact conflict line, no warning.
  - No file was written or changed anywhere under the root.
- **Diff hygiene.**
  - `git status` and `git diff --stat` show no change to
    `.github/harness/eval/decision-intent-cases.json` or `harness.config.json`.
  - `.github/harness/runs/decision-calibration/` is ignored (`.gitignore:11`) and absent from the
    diff.
  - The test and README contain only invented or temp-root data. The only `decision-calibration`
    paths are documented placeholders and temp-root joins. Neither file names
    `private-maintainer-labels`.
  - Private file contents were not read.
  - Other working-tree entries (radar notes, briefs, prompt-packs, `package*.json`) predate this
    pass or belong to other tasks. They are not F-D4 source.

### Pass 3 proof run by this review

| Command | Result |
| --- | --- |
| `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs` | `✔ reviewed report compatibility preserves both spellings and output`; tests 1, pass 1, fail 0; exit 0 |
| `npm run test:harness:decision-eval` | tests 20, pass 20, fail 0, skipped 0, cancelled 0; exit 0 |
| Throwaway probe in `%TEMP%` (invented data; deleted, `Test-Path` False) | as in Pass 3 FYI |
| `git status --short`, `git diff --stat`, `git check-ignore -v` | fixture, config and private directory are not in the diff |
| Snyk / Sonar | not run (user excluded a blanket security pass); F-S1 still BLOCKED |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after this ledger update; results in the session report |

### Pass 3 coverage note

Covered:

- closure of every Pass 2 finding;
- the exact A.7 selection;
- both-spelling report error paths, stdout and stderr, and no-write behaviour;
- the README report and import text;
- diff hygiene for the fixture, config and private files.

Not covered:

- Depth (structural);
- scanner or security triage (F-S1);
- live inference;
- private file contents;
- linked report inputs (not probed).

### Pass 3 handoff

Breadth: no Implement repair is required. Next are Depth and Feedback on F-D4. Feedback must
either accept or send back P3-m1, and must accept or dismiss P3-n1–n3 and P2-n1–n2. F-S1 stays
with the parent execution agent / release verification owner, and needs:

- successful Snyk Code scans of the evaluator and test;
- Sonar analysis of both;
- triage, including the `ENOENT` path echo and the IDE path-flow and complexity diagnostics.

**Release is BLOCKED.**

## Pass 2 — Re-review after B1–B5 Implement (superseded by Pass 3)

### Pass 2 verdicts

- **F-D4 Breadth verdict: REVISE (one Major, narrow).** Implementation behaviour matches every
  Appendix A command-contract row, and B1, B2, B4 (as scoped) and B5 are resolved. B3 is resolved
  except its exact-name requirement: the A.7 "run first" command still selects zero subtests and
  passes vacuously (P2-M1). The fix is a one-line test rename. Minors below do not block Breadth,
  but Feedback must accept or repair each explicitly.
- **Prior functional corrective findings (2026-09-28): remain closed and tested.** This pass did
  not reopen them.
- **Overall release: BLOCKED (F-S1).** Sonar MCP still fails to start (`toggle_automatic_analysis`:
  "MCP server could not be started: Process exited with code 1", re-tried this pass). No Snyk auth
  or scan tool was reachable in this session, so the recorded HTTP 401 / `Authentication Error`
  state stands unverified-as-changed. No scan results exist for either code file. Scanner state is
  a release blocker, not an F-D4 code defect.

### Pass 2 context sufficiency

| Artifact | State reviewed | Surface |
| --- | --- | --- |
| [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) | current working tree (tracked, modified) | CLI / evaluator |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) | current working tree (untracked) | test |
| [eval/README.md](../../eval/README.md) | current working tree (untracked) | operator guide |
| Appendix A (A.4, A.5 command contract, A.7, A.10) and Challenge F-D4 section | read directly | contract |

**Scope:** mixed (software + documentation).

> MISSING: an isolated F-D4 repair diff (evaluator diff vs HEAD is +580/−25 and includes the
> 2026-09-28 cycle; test and guide are untracked).
> LIMITATION: end state is judged against Appendix A; the repair delta cannot be attributed.
> RISK: low — every contract row was checked directly in code, test and a behaviour probe.

Implement proof used: A.10 claim plus the parent's 20/20 rerun. Both were re-run below, not trusted.

### Pass 2 findings ledger

#### Pass 2 Major

##### P2-M1 — A.7 named proof command is still vacuous (B3 exact name not done)

1. **Artifact:** test `reports prefer --reviewed and retain --queue as a warned alias` (line 708).
2. **Finding:** A.7 requires a test named with `reviewed report compatibility`, run first via
   `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs`.
   The test was strengthened but not renamed, so that command selects no subtest.
3. **Evidence:** Direct. TAP output of the A.7 command: only `ok 1 - scripts\\harness\\test\\decision-eval-test.mjs`,
   `# tests 1` (file-level entry). Pattern `warned alias` selects the real test (`ok 1 - reports prefer --reviewed ...`).
4. **Impact:** The approved first-run proof command reports success while testing nothing — the
   exact failure mode that let Pass 1 B1 through.
5. **Confidence:** HIGH.
6. **Fix:** Rename the test so its name contains `reviewed report compatibility` (for example
   `reviewed report compatibility: --reviewed is canonical and --queue is a warned alias`). No
   other change. Re-run the A.7 command and confirm a named subtest is reported.

#### Pass 2 Minor

##### P2-m1 — Missing-file assertion pins the raw ENOENT message and absolute path

1. **Artifact:** test line 772.
2. **Finding:** The legacy missing-file check asserts the whole stderr, including
   `ENOENT: no such file or directory, stat '<absolute path>'`. That locks in the pre-existing raw
   path disclosure that Pass 1 routed to F-S1 triage.
3. **Evidence:** Direct (test source).
4. **Impact:** An F-S1 repair that sanitizes this message would fail an F-D4 compatibility test, and
   the test now documents path echo as intended behaviour.
5. **Confidence:** HIGH.
6. **Fix:** Keep the exact-once warning check, but assert the error line by shape only, e.g.
   `stderr.startsWith(WARNING)` plus `/^\[decision-eval\] [^\n]+\n$/` for the remainder.

##### P2-m2 — Report-compatibility test still omits some A.7 assertions

1. **Artifact:** test lines 708–775.
2. **Finding:** Not asserted: fixture/config/history bytes unchanged after report runs; compact
   output differs from `--json` output (only alias-vs-canonical bytes are compared, so a regression
   that ignored `--json` for both spellings would pass); unchanged human count/deficit.
3. **Evidence:** Direct (test source). Throwaway probe confirms current behaviour is correct:
   compact stdout has exactly 1 newline, pretty has 155, alias bytes equal in both formats, no writes.
4. **Impact:** Low; the core parity and count checks now discriminate.
5. **Confidence:** HIGH.
6. **Fix:** Inside the existing test, snapshot the three files before and compare after; assert
   compact stdout has one newline and differs from the `--json` stdout; assert `humanLabelled` and
   `deficit` equal the no-batch run.

##### P2-m3 — Alias error-path parity covers only the missing file

1. **Artifact:** test lines 586–588, 644–661, 763–772.
2. **Finding:** A.7 asks for BOTH spellings on malformed JSON, wrong schema, invalid status,
   overflow, traversal and link. Committed coverage: missing file for both; oversize/too-many for
   `--queue` only; malformed/schema/traversal for neither report spelling. The conflict test uses
   two different paths, not the identical-path case, and does not assert unchanged bytes.
3. **Evidence:** Direct (test source). Probe (temp root, invented data): malformed, schema, invalid
   status and traversal each exit 1 with empty stdout for both spellings, with the same error text;
   legacy adds exactly one warning line first. Identical-path conflict exits 1, empty stdout, no
   warning, in both orders; import with both flags also rejects.
4. **Impact:** Low. Normalization runs in `parseArgs` before any read, so both spellings reach the
   same `options.reviewed` reader; the gap is literal A.7 coverage, not behaviour.
5. **Confidence:** HIGH for the gap and current behaviour.
6. **Fix:** Loop the existing missing-file block over a small table of bad inputs (missing,
   malformed, schema, status, traversal) for both spellings, and add one identical-path conflict
   row. Or Feedback records this as an accepted residual with the structural argument above.

#### Pass 2 Nit

- **P2-n1 — Two identical conflict checks in `parseArgs`** (evaluator lines 82 and 94). They cover
  disjoint cases today, so behaviour is correct. Remedy (collapse duplicate branches): move the
  single `values.queue && values.reviewed` check above the legacy block and delete line 82.
  Same error, same precedence; lowers `parseArgs` complexity slightly. Optional.
- **P2-n2 — README import wording** (lines 51–53): "`--queue` must name the private candidate
  batch" is followed by its default. "`--queue` names the candidate batch ...; when omitted it
  defaults to ..." reads without tension. Optional.

#### Pass 2 FYI (direct verification of B1–B5 and cleanups)

- **B1 closed.** Evaluator line 640 writes exactly
  `[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.\n`,
  only to stderr, only when `legacyReportQueue`, after `parseArgs` validation and before
  `resolveRepoRoot` or any read. Test line 739 asserts exact equality; line 738 asserts canonical
  stderr `""`; line 736 asserts alias stdout equals canonical stdout. `--limit 0` style argument
  errors throw in `parseArgs`, so no warning precedes them.
- **B2 closed.** `pathsFor` defines `candidateQueue` (line 107); `importReviewed` consumes
  `paths.candidateQueue` (line 479). No `paths.queue` remains. `deterministicBaseline` reads only
  `options.reviewed` (lines 408–409). Flag, default `candidates.json` and containment unchanged.
- **B3 closed except P2-M1.** Raw stdout string equality for `[]` and `["--json"]` (lines 730–736);
  trailing newline (737); mixed batch 2 accepted / 3 deferred / 5 rejected / 1 pending asserted
  exactly, with no `pending` key (741–742). The counts differ from A.7's literal 1/2/3 but are
  pairwise distinct, so a key swap fails; accepted as meeting the intent. No `task`, `reviewedBy`
  or `sourceRef` in the report (743–745); repeated output identical and warning-free (748–751).
- **B4 closed as scoped.** No-batch `"unmeasured"` (753–754); all-pending 0/0/0 (756–761);
  missing file for both spellings, nonzero, empty stdout (763–770); both-order conflict with exact
  stderr and empty stdout (644–661); import warning-free with default queue (210) and explicit
  `--queue` (465); accepted `sourceRef` mismatch rejected with "does not match the local candidate
  queue" and fixture unchanged (248–252). Residuals are P2-m2 and P2-m3.
- **B5 closed.** README lines 61–77: `--reviewed` is the only report code block; exact warning,
  stderr-only, stdout unchanged; both-flag rejection; import `--queue` not deprecated; omitted
  `--queue` default (52–53). No wider guide rewrite.
- **Cleanups verified.** `legacyCandidates` and `loadCases` are absent from the evaluator (the
  test's `legacyCandidate` variables are unrelated hash-id fixtures). The accepted loop (496–499)
  has no source existence/`sourceRef` equality guard; it keeps `sourceById.get`, the duplicate
  id/task/source guard and the preceding whole-batch `validateReviewedEntries` (482).
  `evaluatorEnv` (18–27) no longer sets `HARNESS_REPO_ROOT`; `HARNESS_PROJECT_ROOT`, its unset
  control (444), endpoint override, `--repo-root` and the write-fault hook remain.
- **Preservation.** `git status` shows `harness.config.json`, the fixture and `.github/harness/runs`
  unchanged. Private calibration files are git-ignored; metadata only (content unread):
  `candidates.json` and `private-maintainer-labels-2026-09-28.json` last written 2026-09-28,
  before F-D4.
- **Scope.** No change outside the evaluator, its test and the eval guide was found for F-D4. No
  refactor beyond Appendix A.

### Pass 2 static analyzer diagnostics (IDE, untriaged — F-S1)

Unchanged from Pass 1: path-flow "potential file inclusion" on evaluator lines 27, 100–107, 112,
124–125, 133, 142, 157, 304, 409, 480 and test lines 79, 83, 87; cognitive complexity `parseArgs`
30, `importReviewed` 26, `exportCandidates` 23, `main` 22, `summarise` 17; optional-chain (268,
440) and `replaceAll` (722) style notes; README none. Not treated as F-D4 defects. Appendix A forbids
scanner-driven refactoring here; they stay open under F-S1.

### Pass 2 proof run by this review

| Command | Result |
| --- | --- |
| `npm run test:harness:decision-eval` | tests 20, pass 20, fail 0, skipped 0, cancelled 0 |
| A.7 command with `--test-reporter=tap` | file-level `ok 1` only, no subtest (P2-M1) |
| `--test-name-pattern="warned alias"` | `ok 1 - reports prefer --reviewed and retain --queue as a warned alias` |
| Throwaway probe in `%TEMP%` (invented data; probe and root deleted) | counts 1/2/3 with a pending entry; alias bytes equal in compact and pretty; compact 1 newline, pretty 155; alias stderr exactly the warning; identical-path conflict both orders exit 1, empty stdout, no warning; import with both flags rejects; malformed/schema/status/traversal fail for both spellings with empty stdout; no writes |
| `git status --short` on fixture/config/runs | clean |
| Sonar `toggle_automatic_analysis` | MCP server failed to start, exit 1 |
| Snyk auth/scan | tool not reachable this session; no scan attempted; no credential change |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after writing this pass; results in the session report |

Not re-run this pass (Pass 1 results stand, no F-D4 change touches them): decision-freeze,
decision-sidecar, config self-test.

### Pass 2 coverage note

Covered: all A.5 command-contract rows, A.4 deletions and rename, A.7 checks as listed, README,
current IDE diagnostics, preservation of fixture/config/private files. Not covered: structural
ownership (Depth), live inference, private file contents (deliberately unread), symlink report
inputs (not probed on this host).

### Pass 2 handoff

Implement: rename the test (P2-M1). P2-m1–m3 and nits are optional for Breadth; repair or have
Feedback record acceptance. Then Depth and Feedback on F-D4. F-S1 stays with the parent execution
agent / release verification owner: successful Snyk Code scans and Sonar analysis of evaluator and
test, plus triage. Release is not cleared.

## Pass 1 — Initial review (superseded by Pass 2)

### Pass 1 verdicts

- **F-D4 cleanup verdict: REVISE.** Implementation behaviour is correct in the parts that matter,
  but it does not yet meet the approved contract: the warning text differs from the exact required
  string, the `candidateQueue` rename was not done, and the regression proof is weaker than A.7
  requires. F-D4 cannot close until B1–B4 are fixed and re-reviewed (Depth, then Feedback).
- **Overall release: BLOCKED (F-S1, not affected by this cleanup).** Snyk auth status still returns
  `Authentication Error` and the Sonar MCP still fails to start (exit 1). No scan results exist for
  either file. This review does **not** claim Snyk or Sonar clearance. See the static-diagnostics
  section below.

### Pass 1 context sufficiency

| Artifact | Change | Surface |
| --- | --- | --- |
| [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) | report `--queue` normalized in `parseArgs`, warning in `main`, four deletions | CLI / evaluator |
| [decision-eval-test.mjs](../../../../scripts/harness/test/decision-eval-test.mjs) | `HARNESS_REPO_ROOT` removed from `evaluatorEnv`; new alias test | test |
| [eval/README.md](../../eval/README.md) | `--reviewed` report prose plus deprecated alias note | operator guide |

**Scope:** mixed (software + documentation)

> MISSING: an isolated F-D4 diff. The evaluator diff against HEAD also contains the earlier
> corrective cycle, and the test file and README are untracked.
> LIMITATION: only the end state is reviewed against Appendix A. Pre-F-D4 behaviour (for example
> `parseArgs` complexity before this change) cannot be compared.
> RISK: an unrelated F-D4-era edit hidden inside the combined diff would not be attributed.

No Implement proof summary was supplied. Proof below was re-run by this review.

### Pass 1 findings ledger

#### Pass 1 Major

##### B1 — Deprecation warning text does not match the exact contract

1. **Artifact:** `decision-eval.mjs` `main` (line 640); test line 710.
2. **Finding:** The emitted warning is
   `[decision-eval] --queue is deprecated for reports; use --reviewed instead` plus a newline.
   Appendix A requires exactly
   `[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.`
   plus a newline (different wording, and a trailing period).
3. **Evidence:** Direct. Probe stderr for the legacy report was byte-for-byte the implemented
   string. The test uses a regex on the implemented wording, so it fixes the wrong text in place.
4. **Impact:** This is the only compatibility-visible change Appendix A allows, and the Challenge
   approved it on the basis of a fixed text. Anyone matching the documented text will not match.
5. **Confidence:** HIGH.
6. **Fix:** Use the exact string. Assert `legacy.stderr === "<exact warning>\n"` (exactly once),
   not a regex.

##### B2 — Import-only path not renamed to `candidateQueue`

1. **Artifact:** `decision-eval.mjs` `pathsFor` (line 107) and `importReviewed` (line 479).
2. **Finding:** The resolved import path is still named `queue` and is still built for every mode.
   Appendix A.4 requires naming it `candidateQueue` where it is defined and where it is used.
3. **Evidence:** Direct. Code reads `queue: options.queue ? resolve(options.queue) : join(calibrationRoot, "candidates.json")`
   and `loadReviewSubmission(paths.queue, ...)`. Report logic no longer reads `options.queue`
   (`deterministicBaseline` uses only `options.reviewed`), so the report half of the change is done.
4. **Impact:** Half of the overloaded-name finding (Depth D-m4 item 1) is still open. The approved
   scope is not fully implemented.
5. **Confidence:** HIGH.
6. **Fix:** Rename the path field and its one consumer to `candidateQueue`. Keep the `--queue` flag,
   the default `candidates.json` and containment unchanged. Add no mode framework.

##### B3 — The compatibility test cannot detect the regressions it is meant to catch

1. **Artifact:** test `reports prefer --reviewed and retain --queue as a warned alias`.
2. **Finding:** Compared with A.7, the test:
   - uses counts of 1/1/1 with no pending entry, so a swap of accepted, deferred and rejected keys
     would still pass;
   - compares parsed JSON rather than stdout bytes;
   - checks only `--json`, never compact output or the trailing newline;
   - checks that canonical stderr has no "deprecated" match rather than that it is empty;
   - does not check that nothing is written, that repeated output is identical, or that the report
     leaks no task, reviewer or source fields.

   The required command
   `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs`
   selects **zero** subtests and still reports `pass 1` (one file-level entry, 74 ms). It passes
   without testing anything.
3. **Evidence:** Direct (test source, plus that command's output).
4. **Impact:** The stated proof for alias parity is weaker than the approved contract. B1 already
   got through for this reason.
5. **Confidence:** HIGH.
6. **Fix:** Rename the test so it contains `reviewed report compatibility`. Use one mixed batch
   (1 accepted, 2 deferred, 3 rejected, 1 pending) and assert the counts are exactly 1/2/3. For
   both compact and `--json` output, assert `canonical.stdout === legacy.stdout`, a trailing newline
   and exit 0. Assert canonical stderr is `""` and legacy stderr is exactly the warning. Assert
   fixture, config and history bytes are unchanged, repeated runs match, and the report has no
   `task`/`reviewedBy`/`sourceRef`.

##### B4 — Required error-path and neighbouring-contract coverage is missing

1. **Artifact:** `decision-eval-test.mjs`.
2. **Finding:** No committed tests cover these A.7 items:
   - no-batch `"unmeasured"` counts;
   - all-pending exported queue gives three zero counts;
   - error paths for **both** spellings (missing file, malformed JSON, wrong schema, invalid
     status, traversal, link), each with nonzero exit, empty stdout and unchanged bytes, and the
     legacy path warning once before the error;
   - both-flag conflict in **both** orders, with identical paths, and with no warning;
   - import `--queue` producing empty stderr;
   - an accepted `sourceRef` mismatch rejected by `validateReviewedEntries` now that the loop guard
     is gone.

   Oversize and too-many checks exist only for legacy `--queue` (lines 586–588). The conflict test
   (line 637) covers one order and checks only the exit code.
3. **Evidence:** Direct (grep for `unmeasured`, `does not match` and `stderr` in the test). This
   review's throwaway probe (temp root, invented data) found the **behaviour** correct:
   - unmeasured with no batch; 0/0/0 for all-pending; 1/2/3 for the mixed batch;
   - both conflict orders exit 1 with no warning and empty stdout;
   - legacy missing and traversal inputs warn once, then give the existing error, with empty stdout;
   - a legacy call with `--limit 0` rejects in `parseArgs` without warning;
   - a `sourceRef` mismatch rejects with "does not match the local candidate queue" and leaves the
     fixture unchanged;
   - import with explicit or default `--queue` exits 0 with empty stderr;
   - import with `--queue` plus `--reviewed` rejects.
4. **Impact:** The behaviour is right today, but no regression test guards it. F-D4 closure depends
   on this proof.
5. **Confidence:** HIGH for the gap; HIGH for current behaviour (probe).
6. **Fix:** Add these checks to the existing suite using its temp-root helpers. Do not add a new
   suite or broaden fault injection.

#### Pass 1 Minor

##### B5 — README omits contract details

1. **Artifact:** [eval/README.md](../../eval/README.md), lines 45–70.
2. **Finding:**
   - The only report code block is the no-batch command; `--reviewed` appears in prose only.
   - The warning is described as "emits a warning", without its text, that it goes to stderr, or
     that stdout is unchanged.
   - Rejection of `--queue` together with `--reviewed` is not stated.
   - The import section says `--queue` "must name" the candidate batch, but when omitted it defaults
     to `candidates.json`.
3. **Evidence:** Direct. The other statements are accurate: counts are per selected batch,
   unmeasured when no batch is given, and import `--queue` selects the candidate batch.
4. **Impact:** Operators may not know the canonical form or the stderr-only warning. Low risk.
5. **Confidence:** HIGH.
6. **Fix:** Add a `--deterministic-only --reviewed <batch> --json` code block. Give the exact
   warning (stderr only, stdout unchanged), the both-flag rejection, and the omitted-`--queue`
   default. No wider rewrite.

#### Pass 1 FYI

- **Verified deletions (direct):**
  - `pathsFor().legacyCandidates` is gone.
  - `loadCases` is gone, and every call site uses `loadValidatedCases`.
  - The accepted loop no longer repeats the source existence/`sourceRef` check; it keeps
    `sourceById.get` for projection and the duplicate-source guard, after whole-batch
    `validateReviewedEntries` (line 482).
  - `evaluatorEnv` no longer sets `HARNESS_REPO_ROOT`. `HARNESS_PROJECT_ROOT`, its unset control
    (line 436), endpoint overrides, `--repo-root` and the write-fault hook are kept.
  - Per the Challenge, the variable is not claimed to be globally inert (`config.mjs` reads it).
- **Normalization placement:** Normalization happens in `parseArgs`, applies only when
  `--deterministic-only` is combined with `--queue`, and checks the conflict before rewriting.
  The warning is written in `main` after validation and before root resolution or any read.
  When both a report flag and a legacy flag are wrong, the conflict error now wins over "offline
  modes are mutually exclusive". Both reject, so this is not a defect.
- **Pre-existing, out of F-D4 scope:** A missing report file surfaces the raw `ENOENT` message,
  including the absolute local path, on stderr for both spellings. The 2026-09-28 cycle already
  suppresses raw JSON parser details. Record this under F-S1 triage; it is not an F-D4 change.
- **Contract preservation (direct):** `git status` shows the fixture, `harness.config.json` and
  `.github/harness/runs` unchanged. No private labels were read. The `package.json` and
  `package-lock.json` changes are from the earlier cycle (adding the `test:harness:decision-eval`
  script), not F-D4.

### Pass 1 static analyzer diagnostics (IDE state at Pass 1, untriaged — F-S1)

| File | Diagnostic | Status vs 2026-09-28 |
| --- | --- | --- |
| evaluator | Path-flow "potential file inclusion" at lines 27, 100–107, 112, 124–125, 133, 142, 157, 304, 409, 480 | Same class as before. Report (line 409) and import (line 480) inputs go through `assertContained` in `loadReviewSubmission`; the triage decision still belongs to F-S1. |
| evaluator | Cognitive complexity: `parseArgs` 30, `importReviewed` 26, `exportCandidates` 23, `main` 22, `summarise` 17 | `parseArgs` is newly listed and the normalization adds branches (baseline unknown). `importReviewed` dropped from 31 to 26 and `summarise` from 28 to 17; `main` is unchanged at 22. |
| evaluator | Optional-chain suggestions (lines 268, 440); `replaceAll` (line 722) | Style only. |
| test | Path-flow on `reviewPath`, `queuePath` and `fixturePath` helpers (lines 79, 83, 87) | Test-only temp paths. |
| README | none | — |

No refactoring for complexity is recommended in F-D4. Appendix A forbids scanner-driven refactoring
here. These diagnostics stay open under F-S1 until a working scanner produces results that can be
triaged.

### Pass 1 proof

| Command | Result |
| --- | --- |
| `npm run test:harness:decision-eval` | 20/20 pass, 0 skipped |
| `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs` | `pass 1`, but no subtest selected (vacuous; see B3) |
| Throwaway probe in `%TEMP%` (invented data, removed afterwards) | Behaviour listed in B1 and B4; stdout bytes identical for canonical and alias in compact and pretty output |
| `npm run test:harness:decision-freeze` | PASS (7 invariants + negative control) |
| `npm run test:harness:decision-sidecar` | exit 0, final suite 20/20 pass |
| `npm run harness:config:self-test` | PASS |
| Snyk `snyk_auth_status` | `Authentication Error` (api.snyk.io); no scan attempted; no credential change made |
| Sonar `toggle_automatic_analysis` | MCP server failed to start, exit 1; `analyze_file_list` unavailable |
| `npm run harness:docs:check`, `npm run harness:memory:references:check` | run after writing this artifact; results are in the session report |

### Pass 1 coverage note

Covered: every Appendix A command-contract row, the four mechanical deletions, the README, the
committed tests, adjacent regression gates, and current IDE diagnostics for all three files.

Not covered:

- structural ownership, left to Depth;
- live sidecar inference;
- private review files (deliberately unread);
- symlink cases for report paths, which were not probed on this host.

### Pass 1 handoff

Implement: fix B1–B4 (and B5 if it is in scope) under the approved Appendix A bounds only, then
re-run the focused and adjacent gates. Then run Depth and Feedback on F-D4. F-S1 is still owned by
the parent execution agent / release verification owner and needs:

- successful Snyk Code scans of both code files;
- Sonar analysis of both;
- triage of all findings.

Release is not cleared by this review.
