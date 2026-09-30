# Review Depth: F-S1 Scanner Triage Remediation (2026-09-29)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-scanner-triage-2026-09-29.md, .github/harness/memory/reviews/architect-challenge-verdict.md, .github/harness/memory/reviews/decision-calibration-scanner-triage-breadth-2026-09-29.md, .github/harness/memory/reviews/decision-calibration-scanner-triage-feedback-2026-09-29.md, .github/instructions/06-REVIEW-DEPTH.md

> Current verdict: [Pass 3 (final)](#pass-3-current-final--2026-09-29) at the end of this record.
> Passes 1 and 2 below are historical; their bodies are unchanged.

Depth pass for the active F-S1 remediation authorized by
[Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md) of the scanner-triage
brief and the appended challenge records in [the verdict file](architect-challenge-verdict.md).
Stage contract: [06-REVIEW-DEPTH](../../../instructions/06-REVIEW-DEPTH.md). Read-only for source,
test, guide, fixture, config and private files. F-D4 stays closed and is not re-reviewed.

## Verdict

- **F-S1 Depth verdict: FAIL.** 0 Blocker, 4 Major, 6 Minor. Majors route back through Implement;
  D-M2 first needs a Feedback decision on the removed compatibility switch.
- **Local repair accepted in part:** rooted read sinks, owned-temporary acquisition at
  `openSync(..., "wx", 0o600)`, close-before-rename, and `Map` tallies are structurally sound.
- **F-S1 and release/security clearance: BLOCKED.** Sonar unavailable; the native Snyk test-file
  scan is not evidenced (see Scanner evidence). This record makes no scanner, waiver or release claim.

## Context sufficiency

| Artifact | Role | Owner / area |
| --- | --- | --- |
| `scripts/harness/decision-eval.mjs` (827 lines, read in full) | Evaluator: path checks, bounded reads, atomic write, scoring, CLI | Evaluator runtime |
| `scripts/harness/test/decision-eval-test.mjs` (lines 1–975 read; rest located by search) | Public CLI tests, child `--import` preload faults | Adjacent test suite |
| `.github/harness/eval/README.md` | Operator offline workflow guide | Operator docs |
| Brief body, Appendix A, Final Implementation Proof, Complexity Follow-up | Contract and implementer's proof claims | Architect / Implement |
| Breadth S1 findings | Supplied in the Depth task packet; **no saved Breadth S1 file exists** under `reviews/` | Breadth |

- MISSING: saved Breadth S1 report and raw Snyk CLI/MCP output. BLOCKED GATE: none structural;
  only the scanner-evidence finding (D-M4) depends on them. ASSUMPTION: the packet's statement
  that the native test-file CLI scan failed on network while MCP reported the LOW HTTP issue.
  RISK: D-M4 confidence is medium, not high.
- `git show HEAD:scripts/harness/decision-eval.mjs` predates the uncommitted D4 slice, so no
  isolated F-S1 diff exists. F-S1 deltas were judged against Appendix A and the proof text.
- No private runs, queues, labels or consent data were opened.

## Gate ledger

| Path | G1 | G2 | G3 | G4 | G4b | G5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read sinks `readBounded` / `parseBoundedJson` / `loadConfig` (evaluator 168–203) | Pass | Pass | Pass | Pass | Pass | Pass | Each read takes an independent allowed root, runs `assertContained` + `lstat` link rejection at the sink, and projects failures to `<label> read failed`. |
| Allowed-root selection (`pathsFor` 111–121; callers 430–436, 480, 612–614) | Pass | — | Pass | Pass | Pass | Pass | Config/cases/fixture use repo root; history uses `runs`; queue/review/import use `decision-calibration`. None is derived from the target's own dirname. |
| `atomicWrite` ownership (234–261) | Pass | Pass | Pass | **Fail** | Conditional | Pass | Ownership is set right after `openSync` (247–248). Writes go through the descriptor. Cleanup unlinks only owned regular files (225–232). Error projection is incomplete (D-M1). Replacement-fault proof is missing (D-M3). |
| CLI entry catch (818–826) | Pass | — | **Fail** | **Fail** | Pass | — | The thin entry classifies errors by sniffing `"code" in error`. Resource/operation category ownership has moved out of the I/O boundary (D-M1). |
| `scoreDeterministic` `Map` tallies (442–462) | Pass | Pass | Pass | Pass | Pass | Pass | A missing key fails closed. `Object.fromEntries` in configured order at the JSON boundary gives own data properties. |
| Removed `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE` | — | — | **Fail** | — | Pass | — | Appendix A says "retain for compatibility in this slice"; removal needs separate approval (D-M2). |
| Test "generated fixture output and failed atomic replacement…" (633–670) | — | — | — | — | **Fail** | — | Lines 661–667 snapshot and then assert the same bytes with no import in between. The assertions are vacuous (D-M2). |
| Test preload fault harness (38–46, 672–839) | — | — | Pass | Pass | **Fail** | Minor | Collision, partial-write and rename faults run on the export target only, with the destination absent. There is no replacement-import scenario (D-M3). The temp-link test skips (D-m3). |
| Test reserved labels (874–909) | — | — | — | — | Partial | — | Own-entry assertions are valid. The prototype check at 902 tests the wrong process and key (D-m4). |
| Test HTTP stub (185–229) | Pass | — | Pass | Pass | Pass | Pass | Binds `127.0.0.1` on port 0 with synthetic temp-root data. Offline modes make 0 requests; live makes more than 0. The server is closed in `finally`. Test-context disposition is upheld; this is not production HTTP approval. |
| Operator guide (README) | Pass | — | Pass | Minor | Minor | — | It omits `--repo-root`, root trust, containment and link rules, and safe failure categories (D-m5). |
| Freeze / privacy | Pass | — | Pass | Pass | Pass | — | Scoped `git status` shows `harness.config.json` and `decision-intent-cases.json` unmodified. All tests use `mkdtemp` roots. |
| Proof / evidence record (brief Final Implementation Proof, Complexity Follow-up) | — | — | **Fail** | — | — | — | The native test-scan "completed" claim is contradicted by the Breadth packet (D-M4). |

## Structural findings ledger

### Major

#### D-M1 — Write-path failure categories are owned by the CLI entry, not the I/O boundary

- Artifact: evaluator `atomicWrite` 234–261 and `main` catch 818–826.
- Gate / check: Gate 4 (boundary integrity); Gate 3 (who owns the error category); Brief S1-ERROR.
- Evidence: `readBounded` projects failures at the sink (`filesystemFailure(label, "read")`), and
  `atomicWrite` does so only for `mkdirSync` (237–240). Raw `openSync`, `writeFileSync`,
  `closeSync` and `renameSync` errors propagate. `main` then maps any error with a `code` property
  to `filesystem operation failed`. The fault tests assert only that the root is absent from stderr
  (781), not the category. No test covers a write-failure category.
- Why wrong: S1-ERROR requires fixed resource/operation messages at local I/O boundaries that keep
  useful categories. The sniffing in `main` drops the resource label (`candidate queue` or
  `cases fixture`) and the operation. It also mislabels any other coded error as a filesystem
  failure, including coded errors from live mode.
- Fix: in `atomicWrite`, wrap the open, write, close and rename steps so they throw
  `filesystemFailure(label, "write" | "replace")` after cleanup. Keep path and message
  interpolation out. Narrow or remove the `code` branch in `main` so it cannot reclassify errors.
  Add fault-test assertions for `candidate queue write failed` and `cases fixture replace failed`
  (or the chosen category names).
- Confidence: High.
- Classification: **Structural + contract.**

#### D-M2 — Compatibility switch removed against Appendix A; its test degraded to self-comparison

- Artifact: evaluator (switch absent); test 633–670.
- Gate / check: Brief conformance ("Existing switch disposition: retain for compatibility in this
  slice… Removing the switch requires separate compatibility approval"); Gate 4b (proof of
  existing-destination preservation).
- Evidence: the proof section states "The production `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE`
  branch was removed." The test's second half copies the fixture, exports and writes a review,
  then snapshots `fixtureBefore`, `historyBefore` and `configBefore`. It immediately asserts each
  equals itself (661–667) and never runs a failing import. The test name still claims "failed
  atomic replacement leave existing files unchanged".
- Why wrong: this is an unapproved Brief divergence, and it silently removed the only fault on the
  import replacement path. Removing the switch may be the better security choice, since it drops a
  production-visible environment denial, but Feedback owns that decision.
- Fix: Feedback decides whether to restore the switch or approve its removal. Either way, Implement
  replaces 657–667 with a real reviewed import that fails through the child preload. Snapshot bytes
  before launch and assert nonzero exit, empty stdout, and an unchanged fixture, history and config.
- Confidence: High.
- Classification: **Contract** (Brief divergence). The vacuous test is a proof defect caused by it.

#### D-M3 — Owned-temporary faults never exercise replacing an existing fixture

- Artifact: test 672–839.
- Gate / check: Gate 4b; Appendix A "Exact child command" item 4 and "Private sink
  fault-injection mechanism".
- Evidence: every preload scenario runs `--export-candidates` with an absent destination. Appendix
  A requires the same `--import` shape for a consent-complete reviewed import that actually changes
  the synthetic fixture, with bytes snapshotted before launch. It also requires an uninstrumented
  successful-import control, a pre-open `openSync` fault, and a no-fault replacement that leaves no
  temporary behind. None of these exist.
- Why wrong: the highest-value invariant is unproven: an existing destination survives a partial
  write or rename failure, and a successful rename over an existing file leaves exactly the
  intended bytes. On Windows, replacement semantics differ from rename to an absent target.
- Fix: parameterise the fault preload by command (export vs import) and destination state. Add the
  import partial-write, rename, pre-open and no-fault replacement cases with byte comparisons and
  the uninstrumented control.
- Confidence: High.
- Classification: **Contract / proof** (Gate 4b). Not a code-shape defect.

#### D-M4 — Final Snyk evidence misrecorded for the test file

- Artifact: brief Final Implementation Proof and Complexity Follow-up.
- Gate / check: Gate 3 (evidence ownership / provenance); Brief validation plan ("Record … completion/error
  status … Exit 1 with a completed findings report differs from authentication/startup failure").
- Evidence: the proof says "Final native scans completed" and that `snyk code test` on the test file
  reported exactly one LOW HTTP issue. The Breadth packet says the native CLI scan of the test file
  failed on network, and that the LOW HTTP issue came from Snyk MCP. Depth could not re-verify
  either run.
- Why wrong: F-S1 gating depends on scan provenance. An MCP result is not a completed native CLI
  scan, and it does not show that the earlier MCP 401 is resolved.
- Fix: the proof owner corrects the record to separate tool, command, completion status and
  finding source. Rerun the native test-file scan when the network allows. Depth did not edit the
  brief.
- Confidence: Medium (depends on unsaved Breadth evidence).
- Classification: **Contract** (evidence record).

### Minor

#### D-m1 — `closeSync` can run twice on the same descriptor

- Artifact / gate: evaluator 250–257; Line-level Structure and Gate 3 (descriptor ownership).
- Evidence: if `closeSync(descriptor)` at 250 throws, `descriptor` is still set, so
  `closeDescriptor` at 257 calls close again. The swallowed `EBADF` is harmless in synchronous
  code, but it contradicts "exactly one close per acquired descriptor".
- Fix: move the descriptor to a local and set `descriptor = null` before calling `closeSync`.
- Confidence: High.
- Classification: **Breadth-only.**

#### D-m2 — Cleanup failure is silent and unproven

- Artifact / gate: evaluator 225–232; Gate 4b proof.
- Evidence: the `catch {}` correctly keeps the primary error. No test injects an `unlinkSync`
  failure, so there is no evidence that the primary category survives and the leftover temporary
  is only the owned one.
- Fix: add a preload scenario that fails `unlinkSync` once.
- Confidence: High.
- Classification: **Breadth-only** (the D-M1 category fix makes this testable).

#### D-m3 — Temporary-link test skips although junctions work here

- Artifact / gate: test 795–839; Appendix A (a skipped link branch is incomplete proof, not a pass).
- Evidence: this pass ran 26 tests: 25 passed, 1 skipped (test 20, file-symlink `EPERM`). Test 22
  created directory junctions successfully on the same host.
- Fix: on Windows, fall back to a junction at the temporary path. `lstat` reports it as a link, and
  exclusive open collides with it.
- Confidence: Medium (existing-target case). A dangling junction was not probed.
- Classification: **Breadth-only / proof.**

#### D-m4 — Prototype assertion checks the wrong process and the wrong key

- Artifact / gate: test 902; Brief risk slice 2 (verify prototypes "in the scoring process, not
  only the parent process").
- Evidence: `Object.hasOwn(Object.prototype, "reserved-label-0")` runs in the parent test process
  and checks a case id, not a label.
- Fix: run the scoring child with a preload that records after-exit `Object.prototype` own keys
  and `Object.getPrototypeOf({})` into a receipt, then compare them to a baseline.
- Confidence: High.
- Classification: **Contract** (proof conformance). Minor because own-entry output checks already
  hold and pollution was never demonstrated.

#### D-m5 — The guide does not state root-trust or containment rules

- Artifact / gate: README; Gate 4 (operator instruction versus automation contract).
- Evidence: the README does not mention `--repo-root` or its precedence over
  `HARNESS_PROJECT_ROOT`. It does not say that `--cases` and review paths must stay inside the
  selected root, that links or junctions anywhere on the root ancestry reject, or that failures
  report fixed categories.
- Fix: add a short paragraph. The brief allows edits "only if needed", and these operator-visible
  constraints make it needed.
- Confidence: High.
- Classification: **Breadth-only (docs).**

#### D-m6 — Optional-chain style findings remain

- Artifact / gate: evaluator 340 and 510; Brief S1-STYLE.
- Evidence: the current IDE diagnostics still flag both lines. The proof's "2 optional-chain style
  reports" matches.
- Fix: apply the brief-mandated narrow guards.
- Confidence: High.
- Classification: **Breadth-only.**

## Structural vs breadth-only summary

| ID | Structural | Contract | Breadth-only |
| --- | --- | --- | --- |
| D-M1 error categories | Yes (Gate 3/4) | Yes (S1-ERROR) | — |
| D-M2 switch removal + vacuous test | — | Yes (Appendix A) | — |
| D-M3 replacement fault coverage | — | Yes (Appendix A proof) | — |
| D-M4 Snyk provenance | — | Yes (evidence record) | — |
| D-m1 double close | — | — | Yes |
| D-m2 cleanup-failure proof | — | — | Yes |
| D-m3 temp-link skip | — | — | Yes (proof) |
| D-m4 prototype assertion | — | Yes (validation plan) | — |
| D-m5 README | — | — | Yes (docs) |
| D-m6 optional chain | — | — | Yes |

## Brief divergence

- The compatibility switch was removed; Appendix A requires retention (D-M2).
- The replacement-import command shape, pre-open fault and uninstrumented control are absent (D-M3).
- The prototype check is not in the scoring process (D-m4).
- S1-ERROR asks for useful categories at the I/O boundary; write failures get a generic
  entry-point category instead (D-M1).
- No other divergence. Artifacts modified match the brief. There is no new module, export, loader
  hook or scanner suppression. Freeze and privacy hold.

## Observations (not F-S1 findings)

- Root-ancestor link rejection (evaluator 140–151, 159) is preserved D4 behavior. On macOS,
  `os.tmpdir()` normally resolves under the `/var` symlink, so the suite may reject every
  synthetic root on the likely "supported-platform" link run. Tests may need a real-path temp base
  there. Medium confidence; not run on macOS. Refer to Feedback.
- Export stdout includes the absolute `candidatePath`. This is the pre-existing D4 contract
  documented in the README; it is out of F-S1 scope.
- IDE path-flow snapshot: 21 evaluator and 6 test reports, matching the proof's counts. All remain
  visible, none suppressed. This is not a Sonar run.

## Scanner evidence (accurate as known to Depth)

- **Snyk, evaluator:** the Complexity Follow-up records `snyk code test scripts/harness/decision-eval.mjs`
  as 0 issues. Breadth did not dispute this; Depth did not rerun it.
- **Snyk, test file:** no completed native CLI scan is evidenced; per Breadth, the CLI failed on
  network. Snyk MCP reported 1 LOW HTTP finding at `http.createServer` (now test line 188). That
  finding stays visible under the approved test-context disposition. Nothing was suppressed.
- **Sonar:** unavailable (earlier attempts failed with MCP server exit code 1; no project key or
  scanner). Not retried in this pass: the Appendix bounded-retry rule allows a retry only after an
  authorized operator reports recovery, and none has. No `analyze_file_list`, no toggle, and no
  change to automatic-analysis state by this pass.

## Validation run by this pass

- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`: 26 tests,
  25 pass, 0 fail, 1 skipped (test 20, link privilege), exit 0. All roots were synthetic temp roots.
- Scoped `git status` on `harness.config.json` and the committed fixture: unmodified.
- Documentation checks for this file are recorded in the final handoff.

## Handoff

Route D-M1, D-M3 and D-M4 plus the Minors to Implement (a model distinct from the review stages).
Route D-M2 to Feedback first (retain the switch or approve its removal), then to Implement for the
test repair. After repair: re-run Breadth and Depth, run a fresh native Snyk scan on both final
files, and complete the Sonar subgate. F-S1 remains **BLOCKED**.

## Pass 2 (historical) — superseded by Pass 3

Supersedes the Pass 1 verdict above; Pass 1 findings, evidence and chronology stay intact. Stage
contract: [06-REVIEW-DEPTH](../../../instructions/06-REVIEW-DEPTH.md). Governing contract: the
[brief](../briefs/decision-calibration-scanner-triage-2026-09-29.md) body, Appendix A (149–197)
and its Final Scanner Receipt Correction (410–440). Read-only for source, test, guide, fixture,
config, brief and private data; this pass edits only this record. F-D4 stays closed and is not
re-reviewed. This pass ran no Snyk, Sonar or authentication call and made no automatic-analysis
toggle; scanner, MCP, Sonar and WSL facts are parent-supplied and labelled as such.

### Verdict (Pass 2)

- **Depth: PASS.** 0 Blocker, 0 Major, 0 Minor, 2 Nit (both proof-document wording, owned by
  Feedback / proof owner). All Pass 1 findings (D-M1–D-M4, D-m1–D-m6) are closed or bounded to
  external evidence on the current hashes. No structural breach; code and tests are **not**
  reopened and nothing routes back to Implement.
- **Local structural acceptance: yes**, pending terminal Feedback on the current hashes, which is
  tasked to amend brief line 282 (B5-n3). That amendment is documentary only.
- **F-S1 and release/security clearance: BLOCKED** (see Release blockers). This PASS is not a
  security approval, a waiver, or a zero-warning claim.

### Context sufficiency (Pass 2)

| Artifact | SHA-256 (freshly read) | Last write | Role |
| --- | --- | --- | --- |
| Evaluator (854 lines) | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` | 12:02:52 | Runtime owner; read in full |
| Adjacent test (1472 lines) | `73F6878B898B015204EF188F2527173702E5D834A603027DF9C825236371E8C0` | 13:02:37 | Runners 1–100, tests 681–1253 read directly; rest located by search |
| Guide | `DC40252EE560669C920E9C8FE69DB57DBB0855FF8B0F10C44C34F23287CA76AD` | 11:39:23 | Operator contract (lines 6–11 read) |
| Brief | `29EB1BD1373CC5F93386928A28E7161677226DA9F09139065021622655680D92` | 13:03:56 | Body, Appendix A, all proof appends read |
| Breadth (Pass 8 current) | `72566A0CA4F33F0D8AE77E1B4C50AD5103E508D161C7B6592A124540218512FE` | 13:08:29 | Latest ledger (lines 1–129) |
| Feedback (post-Pass-6 current) | `9F66E483182D0E2BE2A1550708D9A0E8C8EE556A96164C6593759030BC0CBC7B` | 12:49:46 | Latest decision; predates current test |
| This record before Pass 2 | `07BFBBBE5CC5C4284FB31EC17246B413F2E583054157E37E711AE27BFEE8AC42` | 11:05:36 | Pass 1 |
| Frozen config / committed fixture | `41274EA6…4FC520FDB` / `3928B7B9…959315C2` | — | Scoped `git status`: unmodified |

- Evaluator and test hashes equal the brief's final receipt (evaluator `F4081…7F84`, test
  `73F6878…E8C0`) and Breadth Pass 8. They were stable across this pass's test run.
- MISSING: raw Snyk output (receipts are the brief's parent-supplied table), Sonar results,
  supported-platform file-symlink run. BLOCKED GATE: none structural; these bound only the
  release verdict. ASSUMPTION: the brief 410–440 receipts are accurate. RISK: evidence
  provenance only, not code shape.
- No isolated F-S1 diff exists: HEAD predates both the uncommitted F-D4 slice and F-S1. Deltas
  were judged against Appendix A, Pass 1 and the proof appends. Unrelated worktree edits
  (`http-adapter`, `mcp-server`, `run-loop`, `stage-state` and their tests) are out of scope.
- No private runs, queues, labels or consent data were opened.

### Pass 1 finding closure (current lines)

| ID | Status | Direct evidence |
| --- | --- | --- |
| D-M1 error categories | **Closed** | `atomicWrite` (241–289) projects open/write/close to `write` and rename to `replace` at the I/O boundary via a module-private `Symbol` marker (23, 128–136). The `main` catch (845–853) prints `Error.message` or a fixed fallback and no longer sniffs `code`. Tests assert exact categories: 765, 874, 951, 1060, 1190. |
| D-M2 switch + vacuous test | **Closed** | Switch retained at 254 (`=== "1"`, before open, no ownership). Test 681 now runs a real failing import (712–717) and asserts status 1, empty stdout, exact stderr, no temporary, unchanged fixture/history/config (718–724). Test 776 covers absent and unowned-sentinel temporaries. |
| D-M3 replacement faults | **Closed** | Test 898 runs collision, pre-open, partial-write and rename on a changing reviewed import with byte snapshots and PID receipts. Test 985 is the no-fault replacement: exact `open, write, close, rename-after-close`, exact bytes, no unlink, no `.tmp` left. Uninstrumented imports: 279/286. |
| D-M4 Snyk provenance | **Closed (record)** | Brief 410–440 separates native CLI and MCP receipts per final hash. Not re-verified by Depth. |
| D-m1 double close | **Closed** | Descriptor moved to a local and nulled (268–269) before `closeSync`; test 1031 `close` asserts one close. |
| D-m2 cleanup failure | **Closed** | Test 1031 `cleanup-write` / `cleanup-replace`: primary category survives, one unlink attempt, only the owned temporary remains. |
| D-m3 link skip | **Closed on Windows; file-link external** | Test 1112 executed with `junction`, 0 skipped this pass. File-symlink evidence is a release blocker, not a code defect. |
| D-m4 prototype check | **Closed** | Test 1197 checks `Object.prototype` own-descriptor identity and `getPrototypeOf({})` inside the scoring child through an exit receipt, plus configured key order and unsupported-label rejection. |
| D-m5 guide | **Closed** | Guide 6–11 states root precedence, operator trust, containment, link/junction rejection and fixed failure categories. |
| D-m6 optional chain | **Closed** | Current IDE diagnostics contain no style reports. |

### Gate ledger (Pass 2)

| Path | G1 | G2 | G3 | G4 | G4b | G5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read sinks `readBounded` / `parseBoundedJson` / `loadConfig` / `loadValidatedCases` (175–210, 394–398) | Pass | Pass | Pass | Pass | Pass | Pass | Each sink takes a caller-supplied allowed root, runs `assertContained` and `lstat` link rejection before `stat`/read, and projects failures to `<label> read failed`. No unchecked overload exists. |
| Allowed-root selection (`pathsFor` 112–122; callers 208, 444–455, 463, 508, 642, 653) | Pass | — | Pass | Pass | Pass | Pass | Config and cases use the repository root; history uses `runs`; queue, review and import inputs use `decision-calibration`. No root is derived from a target's own dirname. |
| Sink-root ownership in `atomicWrite` (241–289) | Pass | Pass | Pass | Pass | Pass (stable-tree trust) | Pass | Destination checked before and after `mkdir`; temporary checked before open; ownership set immediately after `openSync("wx", 0o600)` (258–262); both paths re-checked before rename (275–276); ownership released after rename (282). |
| Temporary error and lifecycle (226–239, 283–289) | Pass | — | Pass | Pass | Pass | Pass | Cleanup runs only when owned, contained and still a regular non-link file; its errors are swallowed so the primary category survives. A failed open (including `EEXIST`) never confers ownership. |
| Compatibility switch (254) | Pass | — | Pass | Pass | Pass (operator-env trust) | — | See Compatibility switch trust below. |
| `scoreDeterministic` `Map` output (470–490) | Pass | Pass | Pass | Pass | Pass | Pass | A missing key fails closed (475–476). `Object.fromEntries` at the JSON boundary creates own data properties in configured order. No other bracket-indexed tally uses unvalidated keys. |
| CLI entry (825–853) | Pass | — | Pass | Pass | Pass | — | Thin: parse, warn, dispatch, print. Error category ownership now sits at the I/O boundary. |
| Test preload extension (40–64, 730–1253) | Pass | — | Pass | Pass | Pass | Nit (observation) | See Test preloads below. |
| HTTP stub (236–240) | Pass | — | Pass | Pass | Pass | Pass | Loopback `127.0.0.1`, port 0, synthetic root, closed in `finally`; approved test-context disposition. Not production HTTP approval. |
| Guide 6–11 | Pass | — | Pass | Pass | Pass | — | Operator constraints match the automation contract. |
| Freeze / privacy | Pass | — | Pass | Pass | Pass | — | Config and fixture unmodified; every test root is `mkdtemp`. |
| Proof record (brief 271–440) | — | — | Pass (Nit) | — | — | — | Receipts are hash-bound. Line 282 overclaims scope (DP2-n1); 438–439 wording (DP2-n2). |

### Sink-root ownership, temporary error and lifecycle

- The operator owns the repository root (`--repo-root` → `HARNESS_PROJECT_ROOT` → source root).
  The evaluator owns each narrower resource root and every temporary it acquires. Each sink
  receives its root from the caller; no sink infers one. This matches brief Root contract 1–5.
- Exactly one flag (`ownsTemporary`) records ownership, set only after a successful exclusive
  open and cleared only after a successful rename. Descriptor ownership is separate: the local
  `descriptor` is nulled before `closeSync`, so the catch never double-closes.
- Error projection is uniform: every fallible filesystem call inside `atomicWrite` is wrapped. The
  residual `"code" in error` fallback at 286 sits at the correct owner and is unreachable for
  current calls. That is defence in depth, not a finding.
- Limit carried from the brief: checks are path-based, so they cannot defeat a hostile same-user
  swap of an ancestor between check and use. This is the documented `[UNVERIFIED]` stable-tree
  assumption, not a new gap.

### Compatibility switch trust

- `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE === "1"` only throws `<label> write failed` before any
  open. It can deny a write; it cannot redirect, enable, publish or delete anything, and it never
  confers ownership, so cleanup cannot touch a sentinel (test 776). Trust rests on the inherited
  operator environment, which Appendix A records as an explicit operator trust assumption.
- Child fault tests strip the switch and `NODE_OPTIONS` from the child environment only (44–45).
  The parent is never mutated.
- Provenance: the switch is absent from HEAD. It entered with the uncommitted F-D4 slice, was
  accepted by the D4 Depth record, and Appendix A retains it for this slice. The line-level rule
  on compatibility with unshipped code would otherwise question it. Its removal is a separate
  compatibility decision owned outside F-S1, so it is recorded here as an observation (DP2-o1),
  not a finding.

### Test preloads and no app surfaces

- Every preload is generated at run time into the disposable synthetic root, loaded through a
  file URL with `--import`, and launches the real evaluator as `argv[1]`. `runWithPreload`
  bounds the child at 30 s and rejects spawn error, signal or missing status before returning.
- Wrappers match only the exact temporary path, the `(temporary, destination)` pair, or the
  captured descriptor. Receipts use retained originals and carry the child PID, so they cannot
  satisfy their own counters or be confused with another process.
- No committed preload module, loader hook, `register()` call, test-only export or new
  environment switch exists in the evaluator. Its only exports remain the F-D4 pair `summarise`
  and `promotionDecision`. The `test:harness:decision-eval` script and its sidecar-aggregate hook
  belong to F-D4. No new CLI option, endpoint, MCP/HTTP surface or config key was added.
- **No new shared abstraction or overly broad API.** New evaluator helpers (`filesystemFailure`,
  `isFilesystemFailure`, `lstatOrMissing`, `closeDescriptor`, `cleanUpOwnedTemporary`) are
  file-private. The failure marker is a module-private `Symbol`, not `Symbol.for`, so no other
  module can forge a safe category. This matches Gate 2 (local helpers, no shared filesystem
  framework).
- DP2-o2 (observation, not required): five fault tests (730, 811, 898, 985, 1031) repeat an
  inline wrapper skeleton for `open` / `write` / `close` / `rename` / `unlink`. A test-local
  builder could shorten them. Keeping each scenario literal is a defensible choice for audit, and
  it creates no structural breach, so tests are not reopened for it.

### IDE path-flow diagnostics: source-level classification

Current `get_errors` shows 21 evaluator reports ("Potential file inclusion attack via reading
file") and 0 in the test. This is an IDE snapshot, not a completed Sonar analysis. The native Snyk
evaluator receipt (0 issues, parent-supplied) comes from a different engine and does not clear
these reports.

| Group | Lines (duplicates counted) | Source-level disposition |
| --- | --- | --- |
| Operator root selection | 47 (1) | **Truly uncontained by design.** The taint is real. The root is the operator trust anchor (brief Root contract 1), and no containment can apply to it. Its disposition rests on the operator-trust assumption, not on a guard. |
| Root-derived fixed paths | 113, 114, 117, 119×2, 208 (6) | False-positive candidate. Fixed segments or a validated integer offset under the selected root; every consuming sink re-checks containment. |
| Operator path arguments | 116×2, 120×2, 508, 642 (6) | False-positive candidate. Resolved against the process working directory, then contained at the sink to the repository root (cases) or calibration root (queue, review, import). |
| Containment guard internals | 148, 161, 162, 170×2 (5) | False-positive candidate at the guard itself. Line 148 deliberately runs `lstat` on the root's ancestors above the root; this is metadata-only link inspection with projected errors, not a content read. |
| Guarded sinks | 190 `readFileSync`, 258 `openSync`, 463 history read (3) | False-positive candidate. Each sink runs after `assertContained` with an independently supplied root and `lstat` link rejection. |

- **Result:** by source inspection, no content sink (read, open, write, rename, unlink) is reachable
  on an uncontained path. One report (47) is a correct taint on an intentionally trusted input.
  Twenty are source-level false-positive **candidates**; the TOCTOU limit above still applies to them.
- Not claimed: a zero-warning state, analyzer agreement, or Sonar confirmation. All 21 remain
  visible, none is suppressed, and they need the Sonar subgate's triage before release.

### Structural findings ledger (Pass 2)

No Blocker, Major or Minor findings.

#### Nit

- **DP2-n1 (= Breadth B5-n3 residual).** Artifact: brief 282–284. Check: Gate 3 (evidence
  ownership) / Line-level Comments. Evidence: the line says synchronous child proof paths require
  no spawn error, a null signal, an integer status and the expected status. That holds for
  `runWithPreload`, `assertChildOutcome` and `parseJson`. Rejection paths through `run()` still use
  `assert.notEqual(status, 0)` (Breadth lists 13; this pass's direct search confirms at least 89,
  298, 316, 327, 333, 346, 358, 1264, 1305, 1420). A timeout or signal (`status === null`) would
  satisfy those. Why it matters: the proof document overclaims; the code shape is sound and B3-M2
  scope was deliberately bounded. Fix: Feedback (tasked) appends one line scoping 282 to preload,
  fault and JSON-parse children. No test change. Confidence: High.
- **DP2-n2 (= Breadth B8-n1).** Artifact: brief 438–439. Check: Gate 3 (evidence ownership).
  Evidence: "historical where this receipt states a newer same-hash result" supersedes nothing
  when read literally, because no earlier section covers `73F6878…`. Line 412 ("for any earlier
  test-file hash") governs, so nobody is misled. Fix: optional append aligning the closing clause
  with 412. Confidence: High.

#### Observations (not findings)

- **DP2-o1:** switch provenance and future compatibility decision (see Compatibility switch trust).
- **DP2-o2:** preload wrapper repetition (see Test preloads).
- **DP2-o3:** `runAsync` (66–80, used by the live HTTP control) has no child timeout. A hang would
  stall rather than falsely pass. Not a structural breach; optional hardening.
- **DP2-o4 (carried from Pass 1):** root-ancestor link rejection may reject every macOS
  `os.tmpdir()` root, because `/var` is a symlink there. For the supported-platform file-symlink run,
  prefer a Linux host (or real-path temp roots). Medium confidence; not run on macOS.

### Brief divergence (Pass 2)

- None structural. Artifacts match the brief: evaluator and adjacent test modified, guide created,
  no new module, export, loader hook, dependency, suppression, or config/fixture change. The
  switch is retained per Appendix A. Map accumulation, rooted sinks and owned-temporary lifecycle
  match Root contract 3–4 and Appendix A Production ownership.
- Proof-document only: brief 282 scope (DP2-n1).

### Scanner and environment status (parent-supplied unless marked)

| Surface | Status |
| --- | --- |
| Native Snyk, evaluator `F4081…7F84` | Exit 0, 0 issues. |
| Native Snyk, test `73F6878…E8C0` | Exit 1, 1 open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at `http.createServer` line 236, 0 ignored. This pass confirmed line 236 is the loopback stub. Disposition: approved test context, visible, not suppressed. |
| Snyk MCP Code | Evaluator 0; test the same 1 LOW at 236. Separate receipt from native. |
| Sonar | Startup unavailable (MCP server exit 1). No final-file analysis, no triage. **Automatic analysis not restored.** |
| Platform | Windows ran junction coverage only (reconfirmed by this pass). WSL has no Node. No file-symlink run. |
| Aggregate (parent) | Sidecar aggregate with evaluator 30/30, config self-test, freeze, docs and references all pass. |

### Validation run by this pass

- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`: tests 30, pass 30,
  fail 0, cancelled 0, skipped 0, todo 0; `temporary link coverage: junction`; exit 0. Evaluator and
  test hashes were identical before and after. All roots were synthetic temp roots.
- `get_errors` snapshot: evaluator 21 path-flow reports, test 0.
- `git show HEAD:` inspection for switch provenance; scoped `git status` shows config and fixture
  unmodified.
- Memory-reference and docs checks for this record are listed in the final handoff.

### Release blockers

1. **Sonar subgate (external):** an authorized operator reports recovery. Then run a bounded
   final-file analysis of both files, triage the 21 path-flow reports against the classification
   above, and **re-enable automatic analysis successfully**. It is currently unrestored, which is
   an operational hazard beyond F-S1.
2. **Supported-platform file-symlink evidence (external):** test 1112 must report
   `temporary link coverage: file` with 0 skipped, on Linux (preferred, see DP2-o4), macOS or
   privileged Windows. WSL needs a Node runtime first; installation is not authorized here.
3. **Terminal Feedback on current hashes (local process):** covers evaluator `F4081…`, test
   `73F6878…`, and the brief after the DP2-n1 amendment (DP2-n2 optional). A brief-only append
   changes no source or test hash, so no rescan and no new Depth pass is required. Any
   source or test edit reopens Depth and both native scans.

Not release blockers: the visible LOW HTTP test finding under its approved disposition, and the
IDE path-flow reports, except as input to blocker 1.

### Handoff (Pass 2)

- Feedback: record the terminal verdict and append the DP2-n1 scope line (and optionally DP2-n2).
  Do not reopen code or tests.
- Release owner: blockers 1 and 2 through authorized operators, with no guessed project key,
  credential request or tooling install.
- Effective model for this pass: GitHub Copilot on Claude Opus 5.5, matching the routed Depth
  requirement. Implementer identity is not re-attested here.

F-S1 remains **BLOCKED**. F-D4 stays closed.

## Pass 3 (current, final) — 2026-09-29

Supersedes the Pass 2 verdict; Passes 1 and 2 stay intact as chronological evidence. Stage
contract: [06-REVIEW-DEPTH](../../../instructions/06-REVIEW-DEPTH.md). Governing contract: the
[brief](../briefs/decision-calibration-scanner-triage-2026-09-29.md) body, Appendix A (149–197),
and its latest "Final S1 Receipt And Proof Correction" (445–484). Inputs read: Depth Pass 2,
[Breadth Pass 10](decision-calibration-scanner-triage-breadth-2026-09-29.md), the current
[Feedback record](decision-calibration-scanner-triage-feedback-2026-09-29.md) (post-Pass-6 verdict)
and the brief's final receipt. This pass is read-only for source, test, guide, fixture, config,
brief and private data. It edits only this record: the header pointer, the Pass 2 heading label,
and this append. F-D4 stays closed and is not re-reviewed.

This pass ran no Snyk, Sonar, authentication or automatic-analysis call. Scanner, Sonar, WSL and
sidecar-aggregate facts are parent-supplied and labelled as such. Sonar was not retried. The parent
reports that disable, `analyze_file_list` and re-enable all still fail with MCP exit 1, and the
Appendix bounded-retry rule allows a retry only after an authorized operator reports recovery.
Repeating an identical failing call would add no evidence.

### Verdict (Pass 3)

- **Depth gate: PASS on the current exact files.** 0 Blocker, 0 Major, 0 Minor, 0 Nit. All earlier
  Depth findings (D-M1–D-M4, D-m1–D-m6, DP2-n1, DP2-n2) are closed on current bytes. Nothing
  routes back to Implement.
- **Latest test delta accepted.** The single assertion added to test 23 closes the proof gap
  that Breadth found (B9-n1) and Depth Pass 2 missed. The evaluator did not change.
- **Code correctness and local test disposition: accepted.** Local structural acceptance still
  needs terminal Feedback on the current hashes.
- **Release: F-S1 remains mandatory and BLOCKED.** No complete security clearance is given.
  This PASS is not a security approval, waiver, Sonar result or zero-warning claim.
- **F-D4 stays closed.**

### Prior Depth record mismatch (stated plainly)

Depth Pass 2 called itself "current, final", but it no longer matches the current files. It also
contained statements that were stale, overstated or incomplete:

1. **Stale bytes.** Pass 2 (written 13:16:51) reviewed test `73F6878…E8C0` (13:02:37) and brief
   `29EB1BD1…0D92`. The test was rewritten at 13:25:01 (`C3438CC3…01DBF`). The brief was
   rewritten twice: `430A54FD…E481` at 13:27:06, then `8F7555B2…35AD5` at 13:31:37. Breadth
   Pass 10 was right to call Pass 2 stale.
2. **Scan binding taken on trust.** Pass 2's scanner table bound native and MCP test receipts to
   `73F6878…` because the brief said so. It did not check that binding against the parent packet.
   Breadth Pass 9 (B9-m1) then found that the packet named `E2F…1C87`. Those receipts are now
   historical. The only binding for the current test is brief 459 (`C3438CC3…`).
3. **Sonar overstated.** Pass 2 said automatic analysis was "not restored" (scanner table and
   release blocker 1). The disable call also failed, so the true state is **unknown**. The
   restoration is **unverified**, not proven absent. Brief 482–483 and Breadth Pass 10 state
   this correctly.
4. **Proof gap missed.** Pass 2 closed D-m1 and D-m2 on test 23. It did not notice that the
   `close` scenario asserted no `unlink` count. Breadth caught this (B9-n1), and 1063 now fixes it.
5. **Brief citations no longer resolve.** Pass 2 cited brief 282, 410–440 and 438–439. That text
   was later revised in place. The brief discloses this in its correction note at 452–454. Pass 2
   routed DP2-n1 to Feedback as an append. In fact the proof owner made the fix: an in-place
   revision (282–285) plus a scoped restatement (474–476). The outcome is acceptable, but the
   route differed from what Pass 2 said.
6. **No terminal Feedback yet.** Pass 2 said "pending terminal Feedback, which is tasked to amend
   brief line 282". The Feedback record has not changed: `9F66E483…BC7B`, 12:49:46. It still
   covers test `8EDD9D31…E151`, so no Feedback verdict exists on any later hash.

The Pass 2 structural conclusions still hold. Its gate ledger and source-level path-flow
classification rest on evaluator bytes that are unchanged. Only the evidence and record claims
listed above are corrected here.

### Context sufficiency (Pass 3)

| Artifact | SHA-256 (computed by this pass) | Last write | Lines |
| --- | --- | --- | --- |
| Evaluator | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` (unchanged) | 12:02:52 | 854 |
| Test | `C3438CC376BE6BC48341498F34971977300C8A9EF5D19E796E960FA387801DBF` | 13:25:01 | 1472 |
| Guide | `DC40252EE560669C920E9C8FE69DB57DBB0855FF8B0F10C44C34F23287CA76AD` (unchanged) | 11:39:23 | 89 |
| Brief | `8F7555B2FC4CC4E977009D1143E705A7BB6CF3093A577842041FAA9BDD135AD5` | 13:31:37 | 484 |
| Breadth (Pass 10 current) | `CB61AC09E9C537099DDDC34F989269EA81FBA79A125B70098A0BC8866EDE19F6` | 13:30:53 | 1581 |
| Feedback (post-Pass-6 current) | `9F66E483182D0E2BE2A1550708D9A0E8C8EE556A96164C6593759030BC0CBC7B` | 12:49:46 | 452 |
| This record before Pass 3 | `B703F9BE15E3BE1F1DCE70498534722458DE297FF74B1A0BC08A3BE07B169D80` | 13:16:51 | 502 |
| Frozen config / committed fixture | `41274EA6…4FC520FDB` / `3928B7B9…959315C2` | — | — |

- The evaluator and test hashes match the parent-supplied `F4081EAC…` and `C3438CC3…`, brief
  receipt 458–459, and Breadth Pass 10.
- Scoped `git status`: evaluator `M`, test and guide `??`. Config and fixture do not appear,
  so they are unmodified.
- **Brief freshness.** Breadth Pass 10 reviewed brief `430A54FD…` (480 lines). The current brief
  (`8F7555B2…`, 484 lines) is newer. The four extra lines match the correction note (452–454) and its blank separator,
  which this pass read directly. The brief is untracked, so no byte diff is available.
- **Test delta.** The test is untracked (`??`), so its delta cannot be diffed. Evidence that the
  change is localised: the line count is still 1472; all 30 test titles are at the same lines
  that Pass 2 cited (681, 730, 776, 811, 898, 985, 1031, 1112, 1197); the HTTP stub is still at
  236/240; and Breadth Pass 10 read the whole of test 23 directly. The claim "one assertion
  added, nothing else changed" rests on this evidence plus the parent's statement. Byte-level
  proof does not exist.
- **Missing:** raw scanner output, any Sonar result, and a supported-platform file-symlink run.
  These bound only the release verdict. No structural gate is blocked.
- **Private data:** none opened.

### Changed path traced (test 23, `close` scenario, 1031–1078)

1. Entry: `runWithPreload` launches the real evaluator with `--export-candidates --json`. The
   export destination is absent, so the write reaches `atomicWrite`.
2. Evaluator `atomicWrite` (241–289): `openSync("wx")` succeeds, so ownership is set (258–262).
   The descriptor write succeeds. The descriptor moves to a local and is nulled (268–269).
   `closeSync` is then called.
3. The preload `closeSync` wrapper (1050) calls the real close, nulls its copy of the descriptor,
   records `close`, and throws `EIO`. The evaluator projects this to
   `filesystemFailure(label, "write")` (270–273).
4. Catch (283–288): `closeDescriptor(null)` does nothing, so there is no double close.
   `cleanUpOwnedTemporary` runs once, checks containment and that the file is a regular non-link,
   and calls `unlinkSync(temporary)`. The wrapper (1052) records `unlink` and passes the call
   through to the real unlink. It does not throw, because the scenario is not `cleanup-*`.
5. Assertions: `assertChildOutcome(…, 1)` before any receipt read (1056); empty stdout;
   `candidate queue write failed` (1060); matching PID (1061); `close` === 1 (1062); **`unlink`
   === 1 (1063, new, unconditional)**; temporary absent (1072); destination still absent (1074).

Result: the new assertion checks what the source guarantees, which is exactly one cleanup call per
failure. For all three scenarios it is at least as strong as the old branch-only check. A duplicate
cleanup whose `ENOENT` was swallowed is now visible. No production behavior changed.

### Gate ledger (Pass 3)

| Path | G1 | G2 | G3 | G4 | G4b | G5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Evaluator: read sinks, root selection, `atomicWrite`, cleanup, switch, `Map` tallies, CLI entry | Pass | Pass | Pass | Pass | Pass (stable-tree and operator-env trust) | Pass | Bytes are identical to Pass 2 (`F4081…`). Pass 2's row-by-row evidence still applies. This pass re-read 220–292. |
| Test 23 close/cleanup matrix (1031–1078) | Pass | — | Pass | Pass | Pass | Pass | The trace above. The receipt uses retained originals and the child PID; exact counts for `close`, `unlink`, `partial-write`, `rename-after-close` and `rename-before-close`. |
| Other preload tests 18–22, 24 (730–1030, 1112) | Pass | — | Pass | Pass | Pass | Observation (DP2-o2) | Positions unchanged. Breadth Pass 10 re-verified their assertions. This pass re-ran them: 30/30, junction. |
| HTTP stub (233–242) | Pass | — | Pass | Pass | Pass | Pass | `http.createServer` at 236, `listen(0, "127.0.0.1")` at 240. Approved test-context disposition; the finding stays visible. |
| Guide 6–11 | Pass | — | Pass | Pass | Pass | — | Unchanged (`DC40252E…`). |
| Freeze / privacy | Pass | — | Pass | Pass | Pass | — | Config and fixture unmodified. All test roots are `mkdtemp`. |
| Proof record (brief 271–484) | — | — | Pass | — | — | — | Receipts are hash-bound to the current bytes. Child-exit scope is correct (282–285, 474–476). The correction note (452–454) discloses the in-place revisions. |

### Compatibility with the brief

- **Artifacts.** Only the evaluator and adjacent test were modified, plus the guide. There is no
  new module, export, loader hook, dependency, test-only production hook, CLI option or config
  key. Committed config and fixture are unchanged.
- **Appendix A.** The switch is retained (`=== "1"`, pre-open, confers no ownership). Ownership is
  set at `openSync("wx", 0o600)`. Close happens before rename. Cleanup touches only owned,
  contained, regular, non-link temporaries and never masks the primary error. Child preloads use
  `--import` with a file URL and `syncBuiltinESMExports`, and the child environment is stripped
  only in the child.
- **Do NOT rules.** None violated. No suppression, NOSONAR, ignore, TLS bypass, scanner install,
  guessed project key, credential request, private-data read, or F-D4 reopening.
- **Validation plan.** Both native scans were rerun after the final test edit (brief 456–459), as
  the plan's "repeat both if code changes after scanning" rule requires. Parent-supplied.
- **Divergence.** None structural. The external subgates (Sonar, supported-platform file symlink)
  are still open, which the brief expects.

### Structural findings ledger (Pass 3)

No Blocker, Major, Minor or Nit findings.

Observations carried from Pass 2, none required:

- **DP2-o1:** the switch's provenance and any future decision to remove it.
- **DP2-o2:** the repeated preload wrapper skeleton in tests 18–23.
- **DP2-o3:** `runAsync` has no child timeout.
- **DP2-o4:** macOS `/var` symlink risk for the file-symlink run; prefer Linux.

### Code correctness vs release blockers

| Class | Item | Status |
| --- | --- | --- |
| Code correctness | Evaluator ownership, containment, error categories, `Map` scoring | **Accepted** (unchanged bytes, gates pass) |
| Local test disposition | 30/30 evaluator suite; junction link coverage on Windows; approved loopback LOW HTTP disposition | **Accepted** as local proof. Junction coverage is not file-symlink proof. |
| Local process | Terminal Feedback on evaluator `F4081…`, test `C3438CC3…`, brief `8F7555B2…` | **Owed** (Feedback record still at test `8EDD9D31…`) |
| External release | Sonar: authorized recovery, final-file analysis of both files, triage of the 21 path-flow reports, confirmed automatic-analysis state and restoration | **BLOCKED** |
| External release | Supported-platform file-symlink run: test 24 reports `temporary link coverage: file`, skipped 0 | **BLOCKED** (WSL has no Node; installation not authorized) |

### Scanner and environment receipts (Pass 3, parent-supplied unless marked)

| Surface | Receipt |
| --- | --- |
| Native Snyk Code CLI, evaluator `F4081EAC…7F84` | Completed, exit 0, 0 issues. |
| Native Snyk Code CLI, test `C3438CC3…01DBF` | Completed, exit 1, one open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at `http.createServer`, line 236, 0 ignored. This pass confirmed line 236 on the current bytes. The approved test-context disposition applies and nothing was suppressed. |
| Snyk MCP Code | Evaluator 0 issues; test the same 1 LOW HTTP at 236. This is a separate receipt from the native one. The MCP auth-status endpoint still errors (brief 464–465). |
| Sonar | Toggle-off, `analyze_file_list` and toggle-on each fail (MCP server exit 1). No project key, connected-mode config or scanner. No result or triage exists. Automatic-analysis state is **unknown**. |
| Platform | Windows junction proof ran (reconfirmed by this pass: `temporary link coverage: junction`). The file-symlink attempt was denied and fell back to a junction, so there is no file-symlink execution. WSL Ubuntu is present without `node`/`nodejs`; installation was not authorized. |
| Sidecar aggregate | Full `test:harness:decision-sidecar` after the edit: evaluator 30 pass, 0 skip, all pass. Parent-supplied; not rerun by this pass. |
| IDE diagnostics (this pass) | `get_errors`: 21 evaluator path-flow reports at the same lines as Pass 2's classification (47, 113, 114, 116×2, 117, 119×2, 120×2, 148, 161, 162, 170×2, 190, 208, 258, 463, 508, 642); test 0. The Pass 2 grouping still holds. This is not a Sonar result. |

### Validation run by this pass

- Hash, write-time and line-count capture for all artifacts above; scoped `git status`.
- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`: before and after
  hashes `F4081EAC` / `C3438CC3` unchanged. Tests 30, pass 30, fail 0, cancelled 0, skipped 0,
  todo 0; `temporary link coverage: junction`; exit 0; no `not ok` lines. All roots were
  synthetic temp roots.
- `get_errors` on both files (above).
- After this edit: `npm run harness:memory:references:check` and `npm run harness:docs:check`.
  Their results are reported in the handoff, not asserted here.

### Residual actionable items and handoff (Pass 3)

- **No residual Depth finding.** Code and tests are not reopened.
- **Local (required):** terminal Feedback records its verdict on evaluator `F4081…`, test
  `C3438CC3…` and brief `8F7555B2…`. Any later source or test edit reopens Depth and both native
  scans. A brief-only append does not.
- **External (release owner, through authorized operators):**
  1. Sonar recovery, then bounded final-file analysis, triage, and confirmed automatic-analysis
     state and restoration.
  2. A supported-platform file-symlink run of test 24.

  No guessed key, credential request or tooling install is authorized.
- Effective model for this pass: GitHub Copilot on Claude Opus 5.5, matching the routed Depth
  requirement. Implementer identity is not re-attested.

F-S1 remains **mandatory and BLOCKED**, so no complete security clearance exists. F-D4 stays
closed.
