# Review Breadth: F-S1 Scanner Triage Remediation (2026-09-29)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-scanner-triage-2026-09-29.md, .github/harness/memory/reviews/decision-calibration-scanner-triage-feedback-2026-09-29.md, .github/harness/memory/reviews/decision-calibration-scanner-triage-depth-2026-09-29.md, .github/instructions/05-REVIEW-BREADTH.md

## Pass 10 (current, final) — supersedes Pass 9

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md) and its latest
"Final S1 Receipt And Proof Correction" append (445–480). This pass is read-only for source, test,
guide, fixture, config, brief and private data, and edits only this record. F-D4 stays closed. This
pass ran the focused evaluator test, read-only hash, whitespace and wording probes, and
`get_errors`. It made no scanner, Sonar, authentication or automatic-analysis call. Scanner, MCP,
Sonar, WSL and sidecar facts are parent-supplied and labelled as such.

### Verdict (Pass 10)

- **Breadth: PASS.** 0 Blocker, 0 Major, 0 Minor, 1 Nit (B10-n1, new, record hygiene). B9-m1,
  B9-n1, B5-n3 (b) and B8-n1 are **closed**. B5-m1, B5-n1, B5-n2, B5-n4 and B7-m1 stay closed.
- **No F-D4 or F-Breadth defect remains open** on the current source, test and brief hashes.
- **Tests pass now.** The focused evaluator suite ran 30/30 with 0 fail, 0 cancelled and 0 skipped,
  exit 0, with identical pre/post source and test hashes.
- **Local acceptance: not complete.** Depth Pass 2 (13:16:51) predates the current test (13:25:01)
  and brief (13:27:06). Fresh Depth and terminal Feedback on the current hashes are still owed.
- **F-S1 and overall release: BLOCKED** on external evidence (Sonar, supported-platform
  file-symlink run). This PASS grants no release or security clearance.

### Context sufficiency (Pass 10)

| Artifact | SHA-256 (freshly computed) | Last write |
| --- | --- | --- |
| Evaluator (854 lines) | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` (unchanged) | 12:02:52 |
| Test (1472 lines, 1471 CRLF) | `C3438CC376BE6BC48341498F34971977300C8A9EF5D19E796E960FA387801DBF` (new) | 13:25:01 |
| Brief (480 lines) | `430A54FDD246F382DA1422C8C30FA379BC678CF63E959BE7F6880283D284E481` (new) | 13:27:06 |
| Depth (Pass 2) | `B703F9BE15E3BE1F1DCE70498534722458DE297FF74B1A0BC08A3BE07B169D80` (unchanged, now stale) | 13:16:51 |
| Feedback | `9F66E483182D0E2BE2A1550708D9A0E8C8EE556A96164C6593759030BC0CBC7B` (unchanged, stale) | 12:49:46 |
| This record, before Pass 10 | `F6DAC19B9959D5CFDBA68834592964295B8C611BEEED3ED745A508257A83DC3E` | 13:21:01 |
| Guide / config | `DC40252E…87CA76AD` / `41274EA6…4FC520FDB` (unchanged) | — |

- The test hash equals the parent-supplied `C3438CC3…01DBF` and the brief receipt at 455. Config is
  absent from scoped `git status`. The evaluator (`M`) and test (`??`) are uncommitted remediation.
- **Read directly:** `atomicWrite` and cleanup (source 226–289), the HTTP stub (test 233–242), test
  23 (1031–1078), brief 199–202, 270–300 and 380–480.
- **Missing:** Sonar results and a supported-platform file-symlink run. **Private data:** none opened.

### Prior-finding closure (Pass 10)

| ID | Status | Direct evidence |
| --- | --- | --- |
| B9-n1 | **Closed** | Test 23 now asserts `unlink` === 1 unconditionally (1063), so the `close` scenario is covered. The branch-only duplicate was removed, and the line count is unchanged at 1472. In the `close` scenario the wrapper runs the real close, nulls `descriptor`, records `close`, then throws (1051). Source catch (280–283) calls `closeDescriptor` (a no-op on null) and then `cleanUpOwnedTemporary` once, which unlinks the owned regular temporary. `close` === 1 (1062) and an absent temporary (1072) still hold. |
| B9-m1 | **Closed** | The parent-supplied scan hash `C3438CC3…01DBF` equals the current raw test hash and the brief receipt (455). This pass's pre/post `Get-FileHash` around the test run matched it. The scanner-side pre/post capture is parent-supplied; this pass did not observe the scans. |
| B5-n3 (b) | **Closed** | Brief 282–285 now scope `assertChildOutcome` to preload/fault paths and state that validation-rejection tests assert rejection only. Brief 470–472 repeat this scope. The 13 `notEqual(status, 0)` rejection paths are therefore no longer overclaimed. |
| B8-n1 | **Closed** | The receipt opening (413–417) now supersedes only claims explicitly marked historical by a later hash-bound receipt. The conflicting closing clause is gone; the section ends at 443. This agrees with the latest append (447–450). |

### Direct re-verification (Pass 10)

- Line 236 is `http.createServer` and 240 is `listen(0, "127.0.0.1", …)`. The receipt's LOW HTTP
  location is accurate for the current hash.
- Test 23 is unchanged apart from the 1063 assertion. Tests 18–22 keep their Pass 9 assertions,
  because the edit sits after them and the line count is unchanged.
- The brief says automatic-analysis state and restoration are "unverified" (478–479), which agrees
  with the parent's "state unknown". It claims no Sonar result, triage, clearance or waiver.

### Findings ledger (Pass 10)

#### Nit (Pass 10)

##### B10-n1 — Earlier brief sections were revised in place without an in-document marker

- **Artifact:** brief 273–285 (a section self-described as "append-only") and 411–443.
- **Finding:** the wording that Passes 8 and 9 quoted is gone:
  - "Synchronous child proof paths require …" (282)
  - "for any earlier test-file hash" (412)
  - "same-hash result" (438–439)

  Probes found none of the three strings. The corrections were made by rewriting those sections,
  not only by appending. The 445 append partly covers this ("old proof sentence … superseded",
  "Child-exit evidence is scoped accurately"), but it does not list the in-place edits.
- **Impact:** the current text is accurate and no current claim is false. Historical review
  citations by line number (Pass 8/9, Depth, Feedback) no longer resolve against the brief. Their
  recorded brief hashes (`29EB1BD1…`) show that the brief changed. The finding concerns record
  hygiene only; it is not a correctness or proof defect.
- **Fix (optional, proof owner, append-only):** add one line to the latest append. It should state
  that 282–285 and 413–417 were revised in place on 2026-09-29, and that the old 438–439 closing
  clause was removed.

#### FYI (Pass 10)

- Tests 20 and 21 still classify close state with `fstat(descriptor)` → `EBADF`. This is unchanged
  from Pass 8/9. A misclassification can only fail the test; it cannot mask a defect.
- `get_errors`: 21 evaluator path-flow reports (unchanged) and 0 in the test. These are not Sonar
  results.
- Test file: 0 trailing-whitespace lines, 0 tabs.

### Remaining items (Pass 10)

| Item | Class | Owner | Closes with |
| --- | --- | --- | --- |
| Fresh Depth, then terminal Feedback | Required, local process | Independent reviewers | Verdicts on `F4081…` / `C3438CC3…` / brief `430A54FD…` |
| B10-n1 (Nit) | Optional, local | Proof owner | A one-line append noting the in-place revisions; no rescan needed |
| Supported-platform file-symlink run | F-S1 external/environment | Release owner | Test 24 `temporary link coverage: file`, `skipped 0` on Linux, macOS or privileged Windows |
| Sonar analysis and restoration | F-S1 external | Release owner / authorized operator | Final-file analysis, triage, and confirmed automatic-analysis state and restoration |

### Scanner and environment status (Pass 10, parent-supplied unless marked)

| Surface | Status |
| --- | --- |
| Native Snyk, evaluator | `F408…7F84`: exit 0, 0 issues. The hash matches current content (this pass). |
| Native Snyk, test | `C3438CC3…01DBF`: completed, exit 1, one open LOW HTTP at 236, 0 ignored. The hash matches current content (this pass). The finding stays visible under the approved test-context disposition; nothing was suppressed. |
| Snyk MCP | Evaluator 0; test 1 LOW HTTP at 236. The authentication-status call still errors. Receipts are separate from native. |
| Sonar | Startup failures. No analysis or restoration; automatic-analysis state is unknown. |
| Platform | Windows `junction` fallback (reconfirmed by this pass). No file-symlink run; WSL2 has no Node (parent-supplied). |
| Sidecar aggregate | 30/30 evaluator within an all-pass sidecar run (parent-supplied; not rerun). |

These receipts are not scan clearance. Snyk is one scanner, and Sonar has produced no result.

### Validation (Pass 10)

| Command | Result |
| --- | --- |
| `Get-FileHash` / `Get-Item` / scoped `git status --short` | As above. |
| `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` (this pass) | Pre/post `F4081…7F84` / `C3438CC3…01DBF` unchanged. Tests 30, pass 30, fail 0, cancelled 0, skipped 0, todo 0; `temporary link coverage: junction`; exit 0; no `not ok` lines. |
| Whitespace and wording probes (this pass) | Test: 1471 CRLF, 0 trailing whitespace, 0 tabs. Brief: none of the three strings Pass 8/9 quoted remain. |
| `get_errors` (this pass) | Evaluator: 21. Test: 0. |
| After this edit | `npm run harness:memory:references:check`, `npm run harness:docs:check`, and `git diff --check --no-index` on this file. |

### Handoff (Pass 10)

1. Fresh Depth, then terminal Feedback, on the current hashes. B10-n1 may be taken as a brief-only
   append that needs no rescan.
2. Release owner: supported-platform test 24 run and authorized Sonar analysis and restoration.

F-S1 remains **BLOCKED**, and it blocks overall release. F-D4 stays closed.

## Pass 9 (historical) — superseded by Pass 10

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md) and its "Final
Scanner Receipt Correction" append (410–440). Read-only for source, test, guide, fixture, config,
brief and private data; this pass edits only this record. F-D4 stays closed. This pass ran the
evaluator test and read-only hash probes. It made no scanner, Sonar, authentication or
automatic-analysis call; scanner, MCP and Sonar facts are parent-supplied and labelled as such.

- **Record note.** The request called this pass "Pass 8" and described Pass 7 as the latest ledger,
  with edits addressing B5-m1/n1/n2 since then. Pass 8 already exists (13:08:29). It closed
  B5-m1/n1/n2 on the current test hash. No reviewed artifact changed after Pass 8: the evaluator,
  test and brief hashes and write times are identical. This pass is therefore Pass 9, a
  re-verification on unchanged content.

### Verdict (Pass 9)

- **Breadth: PASS.** 0 Blocker, 0 Major, 1 Minor (B9-m1, new, evidence provenance only), 3 Nit
  (B5-n3 (b) and B8-n1 carried, B9-n1 new). B5-m1, B5-n1, B5-n2, B5-n4 and B7-m1 stay closed.
- **Tests pass now.** The evaluator suite ran 30/30 with 0 fail, 0 cancelled and 0 skipped, exit 0,
  with identical pre/post hashes. There is no current test failure.
- **Local acceptance: not complete.** Depth Pass 2 (13:16:51) now covers the current hashes.
  Terminal Feedback on the current hashes is still owed (Feedback 12:49:46 predates the test).
- **F-S1 and release/security clearance: BLOCKED** on Sonar and supported-platform file-symlink
  evidence. This PASS grants no release or security approval.

### Context sufficiency (Pass 9)

| Artifact | SHA-256 (freshly computed) | Last write |
| --- | --- | --- |
| Evaluator (854 lines) | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` (unchanged) | 12:02:52 |
| Test (1472 lines, CRLF) | `73F6878B898B015204EF188F2527173702E5D834A603027DF9C825236371E8C0` (unchanged since Pass 8) | 13:02:37 |
| Brief (440 lines) | `29EB1BD1373CC5F93386928A28E7161677226DA9F09139065021622655680D92` (unchanged) | 13:03:56 |
| Depth (Pass 2 current) | `B703F9BE15E3BE1F1DCE70498534722458DE297FF74B1A0BC08A3BE07B169D80` (new) | 13:16:51 |
| Feedback | `9F66E483182D0E2BE2A1550708D9A0E8C8EE556A96164C6593759030BC0CBC7B` (unchanged) | 12:49:46 |
| This record, before Pass 9 | `72566A0CA4F33F0D8AE77E1B4C50AD5103E508D161C7B6592A124540218512FE` | 13:08:29 |
| Guide / config / fixture | `DC40252E…87CA76AD` / `41274EA6…4FC520FDB` / `3928B7B9…959315C2` (unchanged) | — |

- Config and fixture are tracked and absent from scoped `git status`. Evaluator (`M`) and test
  (`??`) are uncommitted remediation, as expected.
- **Read directly:** `atomicWrite` and cleanup (source 226–289); runners and `assertChildOutcome`
  (test 1–100); HTTP stub (233–242); tests 18–23 (730–1075); brief 238–252 and 260–440.
- **Missing:** Sonar results and a supported-platform file-symlink run. The parent-supplied fresh
  test-scan receipt names a hash this pass cannot match (B9-m1). **Private data:** none opened.

### Direct assertion re-verification (Pass 9)

| Check | Result | Evidence (current lines) |
| --- | --- | --- |
| Tests 20 and 21: exactly one `rename-after-close` and zero `rename-before-close` | Holds | 887–888 and 975–976, in the rename branch only. The partial-write branch asserts `partial-write` === 1 (881, 969). |
| Test 23: `close` recorded only after the original close returns | Holds | 1050: `originalCloseSync` runs first, then `descriptor = null`, then `events.push('close')`, then the injected throw for `close`. |
| Test 23: rename marker from descriptor-null and a recorded close, not `fstat` | Holds | The 1051 marker is `descriptor === null && events.includes('close')`, and no `fstat` original is captured in this preload. Tests 20 and 21 still use `fstat` → `EBADF` (see FYI). |
| Cleanup event counts | Exact for cleanup scenarios | Test 20: `open`, `close` and `unlink` === 1 (877–879). Test 21: `open`, `close` and `unlink` === 1 (965–967). Test 23: `close` === 1 for all scenarios (1062); `unlink` === 1 for both cleanup scenarios (1069). Test 22: `unlink` === 0 (1023). See B9-n1 for the `close` scenario. |
| Collision receipt | Exactly one `EEXIST` | 768: `deepEqual` against `{ operation: "exclusive-create", collisions: ["EEXIST"] }`. Test 21 collision events `["sentinel", "collision"]` (958). |
| Partial contents | Exact prefix | `"{\n  \"sch"` (884, 972), with `byteLength === partialBytes` (883, 971) and `0 < partialBytes < intendedBytes` (882, 970). |
| `assertChildOutcome` before receipt reads (tests 18 and 20–23) | Holds | 763 → 768, 869 → 871, 947 → 948, 1012 → 1013–1014, 1056 → 1057. |
| Titles (tests 18–23) | Accurate | Each title at 730, 776, 811, 898, 985 and 1031 matches the asserted behaviour. |
| Source order | Matches | write → `descriptor = null` → `closeSync` → containment → `renameSync` (264–278). Cleanup unlinks only owned, contained, regular non-link temporaries (232–239). |

### Appendix proof-claim accuracy (Pass 9)

- **Native Snyk: test completed with a LOW finding vs the earlier no-result.** Brief 246–248
  recorded the native test scan as failed on network (`SNYK-CLI-0022`, no result) and bound no
  hash. The final receipt (412–418, 430–432) binds `73F6878…E8C0` to a completed native scan: exit
  1, one open LOW HTTP finding at line 236, 0 ignored. It states that the failure applied to a
  prior hash. That is consistent with chronology: the test has changed at least four times since
  (`A846…`, `9225AB78…`, `845CF…`, `A34DEFA…`). Line 236 is `http.createServer`, and 240 is
  `listen(0, "127.0.0.1")` in current source. **Accurate as recorded.** The receipt itself is a
  parent-supplied proof-owner record; Breadth did not rerun it.
- The MCP Code column (417–418) and the note that the MCP authentication-status error is not a scan
  failure (431–432) are parent-supplied. They agree with this request's packet (MCP 0/1, status
  error).
- "Supersedes prior scanner claims for any earlier test-file hash" (412) correctly retires
  `845CF…` and line 232 (326, 354, 374). B8-n1 (the 438–439 wording) is still open.
- Brief 282 is still broader than the test proof: B5-n3 (b) is open, and 13 `notEqual(status, 0)`
  rejection paths remain.
- Test-proof claims (434–436: 30/30, zero skips, junction not file symlink, WSL without Node) match
  this pass's run, except the WSL claim, which was not re-checked.

### Findings ledger (Pass 9)

#### Minor (Pass 9)

##### B9-m1 — The parent-supplied fresh test-scan receipt does not match the current test content

- **Artifact:** the Pass 9 review packet (not a repository file).
- **Finding:** the packet reports fresh native and MCP scans with the test at `E2F…1C87` (one LOW
  HTTP finding at line 236). The current test is `73F6878…E8C0` both on raw bytes (CRLF) and as
  the brief records it. Its LF-normalised form is `E6D7291F…0757DC4D`. No other
  `decision-eval-test*` copy exists in the workspace. The evaluator hash `F408…7F84` does match.
- **Impact:** this pass cannot use the "fresh" test receipt as evidence for current content. It is
  either a transcription error or a scan of different bytes. The brief's `73F6878…` receipt stays
  the only binding, and it is unaffected. The finding is not Major because no repository record
  makes a false claim and the recorded receipt is hash-consistent.
- **Confidence:** HIGH that the hashes differ; the cause is unknown.
- **Fix (parent / proof owner):** confirm the scanned test hash with pre/post `Get-FileHash`, or
  rerun both scans with that capture. No brief edit is needed if the result is `73F6878…E8C0` with
  the same LOW finding at 236.

#### Nit (Pass 9)

- **B5-n3 (b), carried:** brief 282 is unscoped. The fix is unchanged (proof owner, append-only).
- **B8-n1, carried:** the 438–439 closing clause does not match 412. The fix is unchanged (optional).
- **B9-n1 (new):** test 23's `close` scenario asserts that the temporary is absent (1071–1072) but
  does not count `unlink`. A duplicate cleanup attempt would go unseen, because its `ENOENT` is
  swallowed by `cleanUpOwnedTemporary`. The source makes that unreachable (one cleanup call per
  failure), so this is proof completeness only. Fix (optional, test-only): assert
  `unlink` === 1 in that branch. Doing so would change the test hash and require both native scans
  to be rerun and rebound.

#### FYI (Pass 9)

- Tests 20 and 21 still classify close state with `fstat(descriptor)` → `EBADF` (857, 940). As in
  Pass 8, descriptor reuse can only produce a false `rename-before-close` and fail the test. It
  cannot mask a real ordering defect. No flake occurred on this run.
- `get_errors`: 21 evaluator path-flow reports (unchanged; classified in Depth Pass 2) and 0 in the
  test. These are not Sonar results.

### Remaining items (Pass 9)

| Item | Class | Owner | Closes with |
| --- | --- | --- | --- |
| Terminal Feedback | Required, local process | Independent reviewer | A verdict on `F4081…` / `73F6878…` / brief `29EB1BD1…` (Depth Pass 2 already covers these) |
| B9-m1 (Minor) | Required, evidence provenance | Parent / proof owner | A test-scan receipt bound to `73F6878…E8C0` |
| B5-n3 (b) (Nit) | Required, local (accepted by Feedback) | Proof owner | One brief line scoping 282 |
| B8-n1, B9-n1 (Nit) | Optional, local | Proof owner / Implement | A wording append; one test assertion (which requires a rescan) |
| Supported-platform file-symlink run | F-S1 external/environment | Release owner | Test 24 `temporary link coverage: file`, `skipped 0` on Linux, macOS or privileged Windows |
| Sonar analysis and restoration | F-S1 external | Release owner / authorized operator | Final-file analysis, triage, successful automatic-analysis re-enable |

### Scanner and environment status (Pass 9, parent-supplied unless marked)

| Surface | Status |
| --- | --- |
| Native Snyk, evaluator | `F408…7F84`: 0 issues. The hash matches current content (this pass). |
| Native Snyk, test | Packet: `E2F…1C87`, 1 LOW HTTP at 236. **Not bound to current content** (B9-m1). Brief receipt: `73F6878…`, exit 1, same LOW, 0 ignored. |
| Snyk MCP | Code 0/1, the same as native; the status call returns an authentication error. Not hash-bound by this pass. |
| Sonar | Startup and mode toggles fail. No analysis, no restoration; automatic analysis stays unrestored. |
| Platform | Windows `junction` coverage (reconfirmed by this pass). No file-symlink run. |
| Sidecar aggregate | All pass (parent-supplied; not rerun by this pass). |

### Validation (Pass 9)

| Command | Result |
| --- | --- |
| `Get-FileHash` / `Get-Item` / scoped `git status --short` / `git ls-files -s` | As above. |
| `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` (this pass) | Pre/post `F4081…7F84` / `73F6878…E8C0` unchanged. Tests 30, pass 30, fail 0, cancelled 0, skipped 0, todo 0; `temporary link coverage: junction`; exit 0; no `not ok` lines. |
| Line-ending and hash probe on the test (this pass) | 1471 CRLF; the CRLF form hashes to `73F6878…`; the LF form hashes to `E6D7291F…`. Neither is `E2F…1C87`. |
| `get_errors` (this pass) | Evaluator: 21. Test: 0. |
| After this edit | `npm run harness:memory:references:check`, `npm run harness:docs:check`, and `git diff --check --no-index` on this file. |

### Handoff (Pass 9)

1. Parent / proof owner: resolve B9-m1 by confirming or rebinding the test-scan hash.
2. Terminal Feedback on the current hashes. It may take B5-n3 (b) and B8-n1 as a brief-only
   append, which needs no rescan. B9-n1 is optional; if taken, it reopens the test hash, both scans,
   and Depth.
3. Release owner: supported-platform test 24 run and authorized Sonar analysis/restoration.

F-S1 remains **BLOCKED**. F-D4 stays closed.

## Pass 8 (historical) — superseded by Pass 9

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md), its "Final Scanner
Receipt Correction" append (410–440), and the post-Pass-6
[Feedback](decision-calibration-scanner-triage-feedback-2026-09-29.md) slice. Read-only for source,
test, guide, fixture, config, brief and private data; this pass edits only this record. F-D4 stays
closed. No scanner, Sonar or authentication call was made by this pass; scanner, MCP, Sonar and WSL
facts are parent-supplied and labelled as such.

- **Record note.** The request summarised Pass 7 as leaving B5-m1 and B5-n1 open. The recorded Pass 7
  had already closed both on `A34DEFA…`; Pass 6 is the pass that left them open. Pass 8 re-verifies
  both on the current hash `73F6878…E8C0`.

### Verdict (Pass 8)

- **Breadth: PASS.** 0 Blocker, 0 Major, 0 Minor, 2 Nit (B5-n3 narrowed, B8-n1 new). B7-m1 and
  B5-n4 are **closed**. B5-m1, B5-n1 and B5-n2 stay closed on the current test hash.
- **Local acceptance: not complete.** Fresh Depth and Feedback on the current hashes are still
  required. B5-n3 (narrowed to brief 282 scope) was accepted into the Feedback slice. It stays a
  proof-owner record item, not a correctness defect.
- **F-S1 and release/security clearance: BLOCKED** on Sonar and supported-platform file-symlink
  evidence. This PASS does not grant release or security approval.

### Context sufficiency (Pass 8)

| Artifact | SHA-256 | Last write |
| --- | --- | --- |
| Evaluator | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` (unchanged) | 12:02:52 |
| Test | `73F6878B898B015204EF188F2527173702E5D834A603027DF9C825236371E8C0` (new, 1472 lines) | 13:02:37 |
| Brief | `29EB1BD1373CC5F93386928A28E7161677226DA9F09139065021622655680D92` (new append) | 13:03:56 |
| Feedback | `9F66E483182D0E2BE2A1550708D9A0E8C8EE556A96164C6593759030BC0CBC7B` (unchanged) | 12:49:46 |
| Depth | `07BFBBBE5CC5C4284FB31EC17246B413F2E583054157E37E711AE27BFEE8AC42` (unchanged) | 11:05:36 |
| This record, before Pass 8 | `737570B4E8E220D28E1E817E5E2CA9608D0D919D24BF5749EE0B4F59C82AB1AA` | 13:01:51 |
| Guide / config | `DC40252E…87CA76AD` / `41274EA6…4FC520FDB` (unchanged) | — |

- The test hash equals the parent-supplied `73F687…8C0`. Config is absent from scoped `git status`.
  Evaluator and test are uncommitted remediation (`M` / `??`), as expected.
- **Read directly:** `atomicWrite` and cleanup (source 226–287), runners and `assertChildOutcome`
  (test 31–85), HTTP stub (236–240), tests 18–23 (730–1075), 1183–1192, and brief 265–440.
- **Missing:** Sonar results; supported-platform file-symlink run. **Private data:** none opened.
- Depth (11:05:36) and Feedback (12:49:46) both predate the current test (13:02:37) and brief
  (13:03:56).

### Prior-finding closure (Pass 8, current lines)

| ID | Status | Direct evidence |
| --- | --- | --- |
| B5-m1 | **Closed (re-verified)** | Test 18: collisions accumulate (744, 750); the receipt is exactly `{ operation: "exclusive-create", collisions: ["EEXIST"] }` (768). Test 20: `open`, `close`, `unlink` === 1 (877–879); `partial-write` === 1 (881); `rename-after-close` === 1 and `rename-before-close` === 0 (887–888). Test 21: `["sentinel", "collision"]` and `["pre-open"]` exact (958, 962); the same counts (965–976). Test 23: `close` === 1 (1062); `partial-write` === 1 (1064); `rename-after-close` === 1 and `rename-before-close` === 0 (1066–1067); `unlink` === 1 (1069). |
| B5-n1 | **Closed (re-verified)** | `assertChildOutcome` precedes each receipt read: 763 → 768, 869 → 871, 947 → 948, 1012 → 1014, 1056 → 1057. |
| B5-n2 | **Closed (re-verified)** | `partialContents === "{\n  \"sch"` (884, 972) with `byteLength === partialBytes` (883, 971) and `0 < partialBytes < intendedBytes` (882, 970). |
| B5-n4 | **Closed** | 1187–1191 are uniformly 4-space; 1188 `assertChildOutcome(writeFailure, …)` is re-indented. The file has no trailing whitespace or tab lines. |
| B7-m1 | **Closed** | Brief append 410–440 binds evaluator `F4081…7F84` (native exit 0, 0 issues) and test `73F6878…E8C0` (native exit 1, 1 open LOW HTTP at line 236, 0 ignored). It supersedes scanner claims for every earlier test hash (412), which retires `845CF…`/line 232. Line 236 is `http.createServer` and 240 is `listen(0, "127.0.0.1")` in current source. |
| B5-n3 | **Narrowed, open (Nit)** | Part (a) closed: 412 supersedes the scanner claims at 321/324/353 made against `A846…`/`9225AB78…`, and says the `SNYK-CLI-0022` failure applied to a prior hash. Part (b) is open: 282 ("Synchronous child proof paths require … the expected status") is still unscoped. The test still has 13 `assert.notEqual(<result>.status, 0)` rejection paths (89, 298, 316, 327, 333, 346, 358, 381, 605, 623, 1264, 1305, 1420). A signal or timeout (`status === null`) would satisfy them. This is the scope limit the Feedback slice kept out of B3-M2; it is not reopened. |
| B6-n1 | Closed (record) | Unchanged. Test 24 is the only file-symlink proof. |

Tests 18–23 add fault-injection detail beyond the Pass 7 ledger. Test 23's close wrapper calls
`originalCloseSync` first, then nulls `descriptor` and records `close` (1050). Its rename marker
depends on `descriptor === null && events.includes('close')` (1051), not on `fstat`. Tests 20 and 21
still classify close state with `fstat(descriptor)` → `EBADF` (857, 940). Descriptor reuse between
close and rename can only turn a correct order into `rename-before-close` and fail the test. It
cannot mask a real rename-before-close. This is a theoretical flake direction, not a false pass,
and it did not occur on this run. The source order (write → null → `closeSync` → containment →
`renameSync`, 264–278) matches every counted lifecycle.

### Findings ledger (Pass 8)

#### Nit (Pass 8)

- **B5-n3 (narrowed):** brief 282 is broader than the tests (see closure table). Fix (proof owner,
  append-only): one line scoping 282 to preload/fault and parse-JSON children.
- **B8-n1 (new):** the append's closing sentence (438–439) marks prior sections historical only
  "where this receipt states a newer same-hash result." No earlier section concerns `73F6878…`, so
  read literally that clause supersedes nothing. It conflicts with the broader opening scope at 412.
  412 governs, so no reader is misled about the final identity. Fix (optional, append-only): say
  "for any earlier test-file hash" in the closing clause as well.

#### FYI (Pass 8)

- The MCP Snyk Code receipt in the append table (418) is parent-supplied. This pass did not
  independently bind it to `73F6878…`. Native CLI receipts are the gating proof.
- `get_errors` still shows 21 evaluator path-flow reports and none in the test. These are not Sonar
  results.

### Remaining items (Pass 8): required local vs F-S1 external

| Item | Class | Owner | Closes with |
| --- | --- | --- | --- |
| Fresh Depth, then Feedback | Required, local process | Independent reviewers | Current-hash records on `F4081…` / `73F6878…` / brief `29EB1BD1…` |
| B5-n3 (b) (Nit) | Required, local (accepted by Feedback) | Proof owner | One brief line scoping 282 |
| B8-n1 (Nit) | Optional, local | Proof owner | Closing-clause wording aligned with 412 |
| Supported-platform file-symlink run | F-S1 external/environment | Release owner | Test 24 `temporary link coverage: file`, `skipped 0` on Linux, macOS or privileged Windows |
| Sonar analysis and restoration | F-S1 external | Release owner / authorized operator | Final-file analysis, triage, successful automatic-analysis re-enable |

A brief-only append for B5-n3/B8-n1 does not change source or test hashes. No native rescan is
needed for it.

### Scanner and environment status (Pass 8, parent-supplied unless marked)

| Surface | Status |
| --- | --- |
| Native Snyk, evaluator | `F4081…7F84`: exit 0, 0 issues. |
| Native Snyk, test | `73F6878…E8C0`: exit 1, 1 open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at line 236, 0 ignored. This pass verified line 236 against current source. The loopback test-context disposition applies and the finding stays visible with no suppression. |
| MCP Snyk Code | Same results (evaluator 0; test 1 LOW at 236). Not independently hash-bound by this pass. |
| Sonar | Unavailable (MCP server exit 1). No analysis, no restoration; automatic analysis is unrestored. |
| Platform | No supported-platform file-symlink run. Windows coverage is `junction` (reconfirmed by this pass). |

### Validation (Pass 8)

| Command | Result |
| --- | --- |
| `Get-FileHash` / `Get-Item` / scoped `git status --short` | As above. |
| `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` (this pass) | Pre/post hashes `F4081…7F84` / `73F6878…E8C0` unchanged. Tests 30, pass 30, fail 0, cancelled 0, skipped 0, todo 0; `temporary link coverage: junction`; exit 0. |
| Indentation and whitespace probe on the test (this pass) | 1187–1191 4-space; 0 trailing-whitespace lines; 0 tab lines. |
| `get_errors` (this pass) | Evaluator: 21 path-flow reports (unchanged). Test: 0. |
| After this edit | `npm run harness:memory:references:check`, `npm run harness:docs:check`, and `git diff --check --no-index` on this file. |

### Handoff (Pass 8)

1. Fresh Depth, then Feedback, on evaluator `F4081…`, test `73F6878…` and brief `29EB1BD1…`.
2. Proof owner (optional, may run with step 1): one brief append for B5-n3 (b) and B8-n1.
3. Release owner: supported-platform test 24 run and authorized Sonar analysis/restoration.

F-S1 remains **BLOCKED**. F-D4 stays closed.

## Pass 7 (historical) — superseded by Pass 8

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md) and the post-Pass-6
[Feedback](decision-calibration-scanner-triage-feedback-2026-09-29.md) accepted slice. Read-only for
source, test, guide, fixture, config, brief and private data; this pass edits only this record.
F-D4 stays closed. No scanner, Sonar or authentication call was made by this pass; scanner, MCP,
Sonar and WSL facts below are parent-supplied and are labelled as such.

### Verdict (Pass 7)

- **Breadth: PASS on assertion correctness; local acceptance NOT complete.** 0 Blocker, 0 Major,
  1 Minor (B7-m1, new), 2 Nit (B5-n3, B5-n4, still open). B5-m1, B5-n1 and B5-n2 are **closed** on
  the current test hash. B6-n1 stays closed (record-only correction).
- **Remaining required local items (not F-S1 external):** B7-m1 and B5-n3 (proof owner, brief
  append only) and B5-n4 (Implement, test whitespace). All three were accepted into the post-Pass-6
  Feedback slice; none is a correctness defect.
- **F-S1 and release/security clearance: BLOCKED** on external/environment gates (see
  classification). This PASS implies no release or security approval.

### Context sufficiency (Pass 7)

| Artifact | SHA-256 | Last write |
| --- | --- | --- |
| Evaluator | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` (unchanged) | 12:02:52 |
| Test | `A34DEFA44432959553841CBA5081F21F79608556DCE487F319D6528F884CA775` (new) | 12:56:05 |
| Brief | `AB73F63F785F4B4ACA8D13C02BC988D92F3361C066746AA9E6B93B2455289EC1` (unchanged) | 12:28:17 |
| Feedback | `9F66E483182D0E2BE2A1550708D9A0E8C8EE556A96164C6593759030BC0CBC7B` | 12:49:46 |
| Depth | `07BFBBBE5CC5C4284FB31EC17246B413F2E583054157E37E711AE27BFEE8AC42` | 11:05:36 |
| This record, before Pass 7 | `B96840EB911F7485301559FCA8324434A435B202C236C10043525331E44A48F4` | 12:41:36 |
| Guide / config | `DC40252E…87CA76AD` / `41274EA6…4FC520FDB` (unchanged) | — |

- Evaluator and test hashes equal the parent-supplied values. Config and fixture are absent from
  scoped `git status`.
- **Read directly:** runners and `assertChildOutcome` (14–64), HTTP stub (233–240), tests 18–25
  (730–1195), brief 270–408, Pass 5/6 and post-Pass-6 Feedback.
- **Missing:** Sonar results; a current-hash scanner receipt written by an owner record (B7-m1).
  **Private data:** none opened.
- Depth (11:05:36) and the post-Pass-6 Feedback (12:49:46) both predate the test's 12:56:05 write.

### Prior-finding closure (Pass 7, current lines)

| ID | Status | Direct evidence |
| --- | --- | --- |
| B5-m1 | **Closed** | Test 18: collisions accumulate (750) and the receipt is exactly `{ operation: "exclusive-create", collisions: ["EEXIST"] }` (768). Test 20: `partial-write` === 1 (881); `rename-after-close` === 1 and `rename-before-close` === 0 (887–888). Test 21: the same counts (969, 975–976); collision `["sentinel", "collision"]` and pre-open `["pre-open"]` are exact. Test 23: `partial-write` === 1 (1064); `rename-after-close` === 1 and `rename-before-close` === 0 (1066–1067). `open`, `close` and `unlink` counts stay exact. Fault wrappers are scenario-gated, so no cross-scenario event can appear. |
| B5-n1 | **Closed** | `assertChildOutcome` now precedes every receipt read: test 18 (763 → 768), 20 (869 → 871), 21 (947 → 948), 22 (1012 → 1013–1014) and 23 (1056 → 1057). |
| B5-n2 | **Closed** | Tests 20 and 21 assert `partialContents === "{\n  \"sch"` (884, 972), an exact 8-byte ASCII prefix. With `byteLength(partialContents) === partialBytes` (883, 971), this fixes `partialBytes` at exactly 8, and `0 < partialBytes < intendedBytes` still holds. |
| B5-n3 | **Open (Nit)** | The brief hash and write time are unchanged since 12:28:17. Brief 321, 324 and 353 (stale hashes `A846…` and `9225AB78…`) and the broad 282 are still not withdrawn. No correction exists in any repository record. |
| B5-n4 | **Open (Nit)** | Line 1188 `assertChildOutcome(writeFailure, …)` still has 2-space indentation between 4-space lines 1187 and 1189 (checked byte-exact). |
| B6-n1 | Closed (record) | Unchanged. Test 24 is the only file-symlink proof. |

### Findings ledger (Pass 7)

#### Minor (Pass 7)

##### B7-m1 — The brief's "final" test identity and scanner receipt are stale for the current test

- **Artifact:** brief "Final Scanner And Proof Correction" (361–379).
- **Finding:** the brief names test `845CF…FBF0` as the final adjacent-test SHA-256 and binds the
  native LOW to line 232. The current test is `A34DEFA…CA775`. The parent-supplied native receipt
  for this hash reports the LOW at line 236, and line 236 is `http.createServer` in current source
  (`listen(0, "127.0.0.1")` at 240). No owner record binds the `A34DEFA…` receipt, and the brief has
  not changed since 12:28:17.
- **Impact:** a reader of the governing brief would take a superseded hash and line as final. This is
  the same attribution class B3-M1 closed on `845CF…`. It is not rated Major because a matching
  current-hash receipt exists and no clean-scan claim is made.
- **Confidence:** HIGH (hash, source line and brief text).
- **Fix (proof owner, append-only):** append the final identities (evaluator `F4081…7F84`, test
  `A34DEFA…CA775`). Bind the native results to them: evaluator exit 0 with 0 issues; test exit 1 with
  1 open LOW HTTP at line 236 and 0 ignored. Mark 845CF/line 232 historical. Record MCP as below.
  Combine this with the B5-n3 correction. If B5-n4 is fixed first, bind to that later hash instead.

#### Nit (Pass 7)

- **B5-n3** and **B5-n4**: carried unchanged. Their fixes are as in Pass 5. Fixing B5-n4 changes the
  test hash, so both native scans must be rerun and rebound before B7-m1 is written.

#### FYI (Pass 7)

- MCP Snyk status reports `Authentication Error` while the MCP Code scan still succeeds (parent
  supplied). This inconsistency is recorded and not resolved; native CLI receipts are the proof.

### Remaining items: required local vs F-S1 external

| Item | Class | Owner | Closes with |
| --- | --- | --- | --- |
| B7-m1 (Minor) | Required, local | Proof owner | A brief append binding the final hashes and native receipts |
| B5-n3 (Nit) | Required, local (accepted by Feedback) | Proof owner | A brief append superseding 321/324/353 and scoping 282 |
| B5-n4 (Nit) | Required, local (accepted by Feedback) | Implement | Re-indent 1188, rerun tests and both native scans, rebind the hash |
| Fresh Depth, then Feedback | Required, local process | Independent reviewers | Current-hash records after the items above |
| Supported-platform file-symlink run | F-S1 external/environment | Release owner | Test 24 `temporary link coverage: file`, `skipped 0` on Linux, macOS or privileged Windows |
| Sonar analysis and restoration | F-S1 external | Release owner / authorized operator | Final-file analysis, triage, successful automatic-analysis re-enable |
| MCP Snyk authentication | F-S1 external (not gating native proof) | Release owner | A consistent status; not inferred from CLI login |

### Scanner and environment status (Pass 7, parent-supplied unless marked)

| Surface | Status |
| --- | --- |
| Native Snyk, evaluator | `F4081…7F84`: exit 0, 0 issues. |
| Native Snyk, test | `A34DEFA…CA775`: 1 open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at line 236. The line was verified against current source by this pass. The loopback test-context disposition applies, and the finding stays visible with no suppression. |
| MCP Snyk | Status `Authentication Error`; the Code scan succeeded with the same results (evaluator 0, test 1 LOW). Not independently hash-bound by this pass. |
| Sonar | The toggle-disable retry failed at startup (exit 1). No analysis and no restoration. Automatic analysis is unrestored. |
| Platform | No supported-platform file-symlink run. WSL has no Node. Windows coverage is `junction` (reconfirmed by this pass). |

### Validation (Pass 7)

| Command | Result |
| --- | --- |
| `Get-FileHash` / `Get-Item` / scoped `git status --short` | As above. |
| `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` (this pass) | Pre/post hashes `F4081…7F84` / `A34DEFA…CA775` unchanged. Tests 30, pass 30, fail 0, cancelled 0, skipped 0; `temporary link coverage: junction`; exit 0. |
| Sidecar aggregate, config self-test, docs and references | Pass (parent-supplied). |
| `get_errors` (this pass) | Evaluator: 21 path-flow reports (unchanged). Test: 0. |
| After this edit | `npm run harness:memory:references:check`, `npm run harness:docs:check`, `git diff --check` on this file, Markdown diagnostics. |

### Handoff (Pass 7)

1. Implement: B5-n4. Rerun the tests, both native scans and the hash capture.
2. Proof owner: one brief append covering B7-m1 and B5-n3, bound to the resulting final hashes.
3. Fresh Depth, then Feedback, on those hashes.
4. Release owner: the supported-platform test 24 run and authorized Sonar analysis/restoration.

F-S1 remains **BLOCKED**. F-D4 stays closed.

## Pass 6 (historical) — superseded by Pass 7

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md), both
[Feedback](decision-calibration-scanner-triage-feedback-2026-09-29.md) verdicts, and the brief's
"Final Scanner And Proof Correction" append. Read-only for source, test, guide, fixture, config,
brief and private data; this pass edits only this record. F-D4 stays closed.

- **Numbering.** The request named this pass "Pass 5". Pass 5 already exists (12:36) for the same
  hashes, so this re-verification is recorded as Pass 6.
- **Scanner calls made by this pass:** two native `snyk code test` runs bound to pre/post SHA-256.
  No MCP Snyk call and no Sonar call (no operator recovery signal).

### Verdict (Pass 6)

- **Breadth: PASS for local repair acceptance, unchanged from Pass 5.** 0 Blocker, 0 Major,
  1 Minor (B5-m1, still open), 4 prior Nits (B5-n1–n4, still open), 1 new Nit (B6-n1, record-only).
  No new required finding. Nothing changed after Pass 5: every reviewed artifact hash and write time
  equals the Pass 5 snapshot.
- **F-S1 and release/security clearance: BLOCKED.** Remaining gates, none closable by Implement:
  - **Supported-platform file-symlink run — environment block.** Native Windows file-symlink creation
    is denied on this host: test 24's probe (1074–1091) falls back to `junction` only on
    `EPERM`/`EACCES`, and the run reports `temporary link coverage: junction`. WSL2 is present
    (`Linux 6.6.87.2-microsoft-standard-WSL2`), but `command -v node` and `command -v nodejs` both
    return nothing. Installing is not authorized. The gate therefore stays open. It is owned by the
    release owner and closes only with a run on Linux, macOS or privileged Windows (Pass 5 remediation,
    as corrected by B6-n1).
  - **Sonar — external block.** MCP startup failure; no final-file analysis; automatic analysis
    unrestored.
  - **Fresh Depth and Feedback** on the current files are still owed (Depth 11:05:36 and Feedback
    11:58:26 both predate the test's 12:25:06 write).

### Context sufficiency (Pass 6)

| Artifact | SHA-256 | Last write |
| --- | --- | --- |
| Evaluator | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` | 12:02:52 |
| Test | `845CF7905BE4D1CE8F630844529627A22F31BA65F6F059B76FBD762B8C75FBF0` | 12:25:06 |
| Brief | `AB73F63F…B2455289EC1` (unchanged) | 12:28:17 |
| Feedback | `AA7B5A92…9949C2AA` | 11:58:26 |
| Depth | `07BFBBBE…BFEE8AC42` | 11:05:36 |
| Guide | `DC40252E…87CA76AD` (unchanged) | 11:39:23 |

- Evaluator and test hashes equal the parent-supplied final hashes. Config and fixture are absent from
  scoped `git status`.
- **Read directly:** test helpers 1–228; tests 17–26 (677–1243); tests 28–30 (1264–1470); brief
  240–408; the Feedback B2-M2 scope (187, 198).
- **Scope:** mixed (test proof and evidence record). **Missing:** Sonar results (same limitation as
  Pass 5). **Private data:** none opened.

### Focus re-verification (Pass 6)

- **B3-M1 attribution: accurate for the current hashes.**
  - The brief append (365–384) binds native CLI results to hashes: evaluator `F4081…` → 0 issues;
    test `845CF…` → exit 1, one LOW HTTP at line 232, 0 ignored.
  - It marks `SNYK-CLI-0022` historical for that test hash only.
  - It keeps MCP Code results (evaluator 0, test 1 LOW) separate as historical and unbound, and
    records that the fresh MCP attempt stopped at `Authentication Error` with no Code scan.
  - It states that CLI login is not scan proof.
  - This pass's own receipts match exactly (see the table below). The stale-hash lines 321, 324 and
    353 and the broad line 282 are still not expressly withdrawn: B5-n3, unchanged.
- **Operation check counts (tests 20, 21, 23), unchanged from Pass 5:**
  - Exact counts: `open`, `close`, `unlink`, `partial-write`, and collision/pre-open event arrays.
  - Presence-only checks (B5-m1): `rename-after-close` (887, 971), and `partial-write`/`rename` in
    test 23 (1058–1059). Test 18's receipt is still overwrite-per-`EEXIST` (745).
- **`assertChildOutcome` on every scanner/fault fixture child:** tests 17 (714), 18 (765), 19 (801),
  20 (874), 21 (947), 22 (1006), 23 (1052), 24 (1134), 25 (1172, 1179) and 26 (via `parseJson` 79
  and 1237). The receipt-before-outcome order (B5-n1) is unchanged at 872, 945 and 1050.
- **Real import and fault tests.**
  - Test 17 exercises a real consent-complete import with the legacy switch on that child only.
  - Test 21 exercises a real changing reviewed import for all four fault scenarios.
  - Test 22 is a no-fault real import. Its exact bytes are checked against the independent
    `expectedImportedFixture` (192–212). Status 0 is asserted before `JSON.parse`, and config and
    history are unchanged.
  - All wrappers call the real `fs` originals, so the faults are injected at the real syscall boundary.
- **Root and path flows (tests 28 and 30).**
  - Linked root, linked parent, outside-root cases, linked history and linked review all reject.
  - The contained-export positive control succeeds, and no queue is created on rejection.
  - Fixture and config bytes are unchanged.
  - Both tests executed (0 skipped) using `junction` on this host.
  - Rejections use `notEqual(status, 0)` (1278–1284, 1296). These are validation rejections, outside
    the B2-M2 fault-child mandate (Feedback 187). See FYI.

### Findings ledger (Pass 6)

Carried open, unchanged, and re-derived from current lines: **B5-m1** (Minor), **B5-n1–n4** (Nit).
Their fixes are as in Pass 5.

#### Nit

- **B6-n1 — Pass 5's platform remediation overstates the file-symlink scope of tests 28 and 30.**
  - **Artifact:** this record, Pass 5 "Omitted (mandatory, platform-bound)".
  - **Finding:** tests 28 (1271–1272, 1294) and 30 (1446) create directory links: `junction` on
    win32 and `dir` elsewhere. They never create file symlinks. On this host they did not skip.
  - **Impact:** test 24 is the only file-symlink proof. A POSIX run of tests 28 and 30 adds POSIX
    `dir`-symlink coverage, not file-symlink coverage.
  - **Confidence:** HIGH (source).
  - **Fix:** this Pass 6 record carries the correction. The required supported-platform run is test 24
    with `temporary link coverage: file` and `skipped 0`. Running tests 28 and 30 there with
    `skipped 0` is recommended for POSIX `dir`-link coverage.

#### FYI

- Validation-rejection calls that use `notEqual(status, 0)` would accept a timed-out child, because
  `status` is then `null`.
  - The shared 30-second `CHILD_TIMEOUT_MS` (18, 37, 51) bounds such a child, so no hang is possible.
  - Where a stderr assertion follows (for example 1297), an empty-stderr kill still fails.
  - No action is required under the current Feedback scope.

### Scanner status for the record (Pass 6)

| Scanner | Status |
| --- | --- |
| Native Snyk, evaluator | CLI 1.1305.2, 12:40:01–12:40:13. Pre/post `F4081…7F84`. **Exit 0, 0 issues.** |
| Native Snyk, test file | 12:40:13–12:40:24. Pre/post `845CF…FBF0`. **Exit 1: 1 open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at line 232; 0 ignored.** This is the loopback `listen(0, "127.0.0.1")` stub (236) under the approved test-context disposition, and it stays visible. |
| MCP Snyk | Historical and unbound; not rerun; not used as proof. |
| Sonar | Blocked (MCP startup failure, no project key); automatic analysis unrestored; no call. |

### Validation run by this pass (Pass 6)

| Command | Result |
| --- | --- |
| `Get-FileHash` / `Get-Item` / scoped `git status --short` | As above. |
| `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` | Tests 30, pass 30, fail 0, cancelled 0, skipped 0; `temporary link coverage: junction`; exit 0. |
| `npm run test:harness:decision-sidecar` | Exit 0; per-file 5/5, 9/9, 8/8, 14/14, 30/30; 0 fail, 0 cancelled, 0 skipped; evaluator coverage `junction`. |
| `npm run harness:config:self-test` | PASS. |
| `get_errors` | Evaluator: 21 path-flow reports. Test: 0. |
| `wsl.exe -e sh -c "uname -sr; command -v node …"` (read-only) | WSL2 kernel present; `node:none`, `nodejs:none`. |
| Both native Snyk scans | As above. |
| After this edit | `npm run harness:memory:references:check`, `npm run harness:docs:check`, `git diff --check` on this file. |

### Handoff (Pass 6)

- **Implement (optional, test only):** B5-m1, then B5-n1, B5-n2 and B5-n4. Any test edit makes the
  `845CF…` receipts stale; rerun and rebind both native scans.
- **Proof owner (append-only):** B5-n3.
- **Next:** fresh Depth on the current files, then Feedback.
- **Release owner, external/environment:**
  - The supported-platform test 24 file-symlink run (plus tests 28 and 30 for POSIX `dir` links).
  - Authorized Sonar analysis, triage and automatic-analysis restoration.
- F-S1 remains **BLOCKED**. This PASS implies no release or security approval.

## Pass 5 (historical) — superseded by Pass 6

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md), both
[Feedback](decision-calibration-scanner-triage-feedback-2026-09-29.md) verdicts, and the brief's
"Final Scanner And Proof Correction" append. Read-only for source, test, guide, fixture, config,
brief and private data; this pass edits only this record. F-D4 stays closed.

- **Numbering.** The request named this pass "Pass 4". This record already held a Pass 4 (written
  12:22, before the test's final write), so this pass is recorded as Pass 5. IDs verified: B3-M1/M2,
  B3-m1/m2, B3-n1–n3.
- **Scanner calls made by this pass:** two native `snyk code test` runs, one per file, each bound to
  pre/post SHA-256. No MCP Snyk call and no Sonar call (no operator recovery signal; the brief
  permits a Sonar retry only after one).

### Verdict (Pass 5)

- **Breadth: PASS for local repair acceptance.** 0 Blocker, 0 Major, 1 Minor, 4 Nit. Every Pass 3
  Major is closed on current evidence. The Minor is a residual "fault fired exactly once" gap and
  does not block local acceptance.
- **F-S1 and release/security clearance: BLOCKED.** Remaining gates:
  - no Sonar final-file analysis, and automatic analysis is still unrestored;
  - no supported-platform file-symlink run (this host executed `junction` only);
  - fresh Depth and Feedback on the current files are still owed. The Depth record (11:05) and
    Feedback record (11:58) both predate the current test (12:25).

### Context sufficiency (Pass 5)

All times are local, 2026-09-29.

| Artifact | SHA-256 | Last write | Read |
| --- | --- | --- | --- |
| Evaluator | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` (unchanged since Pass 3) | 12:02:52 | `atomicWrite`/cleanup 220–289 re-read |
| Test | `845CF7905BE4D1CE8F630844529627A22F31BA65F6F059B76FBD762B8C75FBF0` (new; was `9225AB78…`) | 12:25:06 | helpers 1–228, tests 17–26 (677–1243) in full |
| Brief | `AB73F63F785F4B4ACA8D13C02BC988D92F3361C066746AA9E6B93B2455289EC1` | 12:28:17 | full, including the 361–408 append |
| Guide | `DC40252E…87CA76AD` (unchanged) | 11:39:23 | — |
| Config / fixture | `41274EA6…4FC520FDB` / `3928B7B9…959315C2` | not in scoped `git status` | — |

- **Scope:** mixed (test proof plus the evidence record).
- **Ordering:** the brief append (12:28) postdates the final test write (12:25). This pass's scans
  (12:32–12:33) postdate both.
- **Missing:** Sonar results. This limits metric and duplicate-analysis coverage and does not affect
  the findings below.
- **Private data:** none opened. All roots are `mkdtemp` roots with synthetic history and reviews.

### Prior-finding closure (Pass 5, re-derived from current lines)

| ID | Status | Direct evidence |
| --- | --- | --- |
| B3-M1 | **Closed** | See the scan receipts below. The brief append (367–379) matches them on hash, exit, count, rule and line 232, and marks `SNYK-CLI-0022` historical for this hash. Stale-hash wording remains: B5-n3. |
| B3-M2 | **Closed** | `assertChildOutcome` covers every preload/fault child: tests 17 (714), 18 (765), 19 (801), 20 (874), 21 (947), 22 (1006), 23 (1052), 24 (1134), 25 (1172, 1179) and 26 (1237, plus `parseJson` 79). Test 18 has exact stderr (767) and root absence (768). Test 20 has exact stderr (876) and root absence (877). Timeouts come from the shared `CHILD_TIMEOUT_MS` in `run`/`runWithPreload` (18, 37, 51). |
| B3-m1 | **Mostly closed** | Receipts for tests 20, 21 and 23 persist `pid` and assert it equals `result.pid` (878, 951, 1055). Unlink counts are exact at 881, 965 and 1060. Residual: B5-m1. |
| B3-m2 | **Closed** | Tests 20 and 21 record the `fstatSync` size, the intended UTF-8 byte length and the contents read back from the temporary. They assert `0 < partialBytes < intendedBytes` and a content-length match (884–885, 968–969). Content equality is B5-n2. Test 23 `cleanup-write` records no bytes. That is acceptable: it proves primary-error preservation, and the retained owned temporary (1061) shows the file was created. |
| B3-n1 | **Closed** | `get_errors` now reports 21 evaluator path-flow reports and 0 for the test file, matching brief 407. The older "10" at brief 357 is superseded. |
| B3-n2 | **Closed** | Test 22 compares config and history bytes (1015–1016) after the status-0 check (1006). |
| B3-n3 | **Closed** | Test 17 is renamed "generated fixture output and failed import preserve existing bytes" (677). It asserts temporary absence at `failedImport.pid` (717) and uses `assertChildOutcome` (714). |

**B3-M1 scan receipts:**

- Test file: `snyk code test scripts/harness/test/decision-eval-test.mjs` (CLI 1.1305.2), 12:32:20–12:32:35.
  Pre- and post-scan hashes were both `845CF…FBF0`. Exit 1: 1 open LOW, `Cleartext Transmission - HTTP Instead of HTTPS`, line 232, 0 ignored.
- Evaluator: `snyk code test scripts/harness/decision-eval.mjs`, 12:32:42–12:33:01. Pre- and post-scan
  hashes were both `F4081…7F84`. Exit 0, 0 issues.

### Focus verification (Pass 5)

- **Native scan status correction:** confirmed by this pass's own receipts above. Line 232 is still
  the loopback `http.createServer`. It binds `listen(0, "127.0.0.1")` (236), asserts 0 offline
  requests and >0 live requests, and tears down in `finally`. The approved test-context disposition
  stands, and the finding stays visible.
- **Child status, error, signal and timeout:** `assertChildOutcome` (55–60) rejects a spawn error, a
  non-null signal, a non-integer status and the wrong status. `spawnSync` reports a timeout through
  `error` and `signal`, so a timeout fails the check.
  - About 40 validation-rejection `run()` calls still use `notEqual(status, 0)`, for example 85,
    294, 698 and 1255. These are not preload-fault proofs and are outside the B2-M2 mandate.
  - The brief's wording is B5-n3.
- **Same-PID temporary receipts:**
  - Tests 20, 21 and 23 bind the receipt PID to the spawn PID.
  - Tests 18, 19 (sentinel case) and 21 (collision) prove PID equality through the sentinel found at
    `${destination}.${result.pid}.tmp`.
  - Test 22 adds a `readdirSync` check for no `*.tmp` (1019).
  - Test 17 and the test 19 absence case rely on PID equality proven elsewhere, which holds for a
    direct `process.execPath` spawn.
- **Partial-write byte count:** see B3-m2. The wrapper writes the prefix through the real descriptor,
  then measures the real temporary with retained `fstatSync`/`readFileSync`.
- **Successful import:** status 0 is asserted before `JSON.parse` (1006–1007).
  - The receipt PID and temporary path are bound to the child (1010–1011).
  - Events are exactly `open, write, close, rename-after-close`.
  - The descriptor's write bytes and the destination bytes both equal `expectedImportedFixture`
    (192–212), which is built independently.
  - Config and history bytes are unchanged, and there is no unlink and no `*.tmp`.
  - The rename wrapper throws if `fstatSync` does not give `EBADF`.
- **Exact fault counts:** the collision (956), pre-open (960) and partial-write (883, 967) faults are
  exact. The rename and cleanup faults are not; see B5-m1.
- **Cleanup primary error:** evaluator unchanged.
  - Close ownership moves to a local before close (268–271).
  - The catch (283–287) swallows close and cleanup errors through `closeDescriptor` (226) and
    `cleanUpOwnedTemporary` (232), and rethrows marked or validation errors.
  - Test 23 asserts exact `write`, `write` and `replace` stderr for `close`, `cleanup-write` and
    `cleanup-replace`; exactly one close; one unlink attempt; and the owned temporary retained only
    when cleanup fails.

### Findings ledger (Pass 5)

#### Minor

##### B5-m1 — Rename, cleanup and export-collision faults are not asserted to fire exactly once

- **Artifact:** the test assertions below.

  | Test | Line | Assertion |
  | --- | --- | --- |
  | 20 | 887 | `events.includes("rename-after-close")` |
  | 21 | 971 | `events.includes("rename-after-close")` |
  | 23 | 1058 | `includes("partial-write")` |
  | 23 | 1059 | `includes("rename")` |

  In test 18, the receipt is overwritten on each `EEXIST` (745), so a repeated collision cannot
  be seen.
- **Finding:** Appendix A requires "Assert the selected operation was reached and the fault fired
  exactly once." The other faults are counted exactly; these are only checked for presence.
- **Impact:** low. The evaluator calls `renameSync` and `openSync` once per `atomicWrite` with no
  retry path, so a double fire needs a future code change that these tests would not catch.
- **Confidence:** HIGH (source).
- **Fix (Implement, test only):**
  - Replace each `includes` with `filter(...).length === 1`.
  - In tests 20 and 21 also assert that `rename-before-close` is absent.
  - In test 18, append collision events to an array receipt instead of overwriting it, and assert
    `["exclusive-create:EEXIST"]` exactly.

#### Nit

- **B5-n1:** tests 20 (872), 21 (945) and 23 (1050) parse the receipt *before* `assertChildOutcome`
  (874, 947, 1052).
  - A crashed or timed-out child still fails the test, but with `ENOENT` or `SyntaxError` instead of
    the child-outcome message.
  - Brief 389–391 ("before accepting stdout or a receipt") slightly overstates this.
  - Fix: move `assertChildOutcome` above the receipt read.
- **B5-n2:** the partial-write proof checks that byte count and content length agree, but not that
  `partialContents` equals the serialized payload's prefix. Fix: record the intended 8-character
  prefix in the receipt and assert equality, or assert `partialBytes === 8`.
- **B5-n3 (brief record):** two earlier statements are still standing and are not expressly
  withdrawn by the append (363: "supersedes only the earlier scanner-status statements that it
  expressly corrects").
  - 321, 324 and 353 claim authentication and test-scan completion against the stale hashes
    `A846…` and `9225AB78…`, which conflicts with the user-authoritative `SNYK-CLI-0022` status for
    that period.
  - 282 ("Synchronous child proof paths require …") is broader than the tests (see B3-M2 closure).

  Gating is unaffected, because the current-hash receipt now exists. Fix (proof owner, append-only):
  one line marking 321/324/353 superseded as stale-hash claims, and one scoping 282 to preload/fault
  children.
- **B5-n4:** 1179 is indented two spaces inside a four-space block. Cosmetic.

### Required tests (Pass 5)

- **Run by this pass:**
  - The brief's focused regression and both compatibility regressions.
  - The full evaluator suite and the sidecar aggregate.
  - `harness:config:self-test`.
  - After this edit: memory references, docs check and `git diff --check`.
- **Omitted (mandatory, platform-bound): the supported-platform file-symlink run.**
  - **Source:** `temporaryLinkType` (1072–1091) tries `["file", "junction"]` on win32 (1074). This
    host denied file symlinks, so test 24 (1103) reported `temporary link coverage: junction`
    (1117). Tests 28 (1264) and 30 (1424) likewise skip or fall back (1274, 1449).
  - **Remediation:** on Linux, macOS, or Windows with symlink privilege (Developer Mode or
    `SeCreateSymbolicLinkPrivilege`), run:
    - `node --test --test-name-pattern="atomic write preserves unowned temporary links" --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`. Require the diagnostic `temporary link coverage: file` and `skipped 0`.
    - The "symlink or junction roots" and "report bounds and linked review inputs" patterns, requiring `skipped 0`.
    - Record the OS, the executed link kind and the test hash.
    - Depth's macOS `/var` temporary-directory ancestry warning applies.
- **Omitted (mandatory, external): Sonar.**
  - **Required:** `analyze_file_list` for both files, finding triage, and a successful re-enable of
    automatic analysis.
  - **Blocker:** MCP startup exit 1 and no project key. The release owner coordinates the authorized
    operator; this pass requested no credentials and changed no configuration.

### Scanner status for the record (Pass 5)

| Scanner | Status |
| --- | --- |
| Native Snyk, evaluator | **Completed, 0 issues, exit 0.** Reproduced by this pass against `F4081…7F84`. |
| Native Snyk, test file | **Completed, exit 1, 1 open LOW HTTP at line 232, 0 ignored.** Reproduced by this pass against `845CF…FBF0`. Visible under the test-context disposition. |
| MCP Snyk | User-supplied: auth/status may have failed; Code evaluator 0, test 1 LOW. Not hash-bound and not rerun here. Consistent with native; not used as final proof. |
| Sonar | Blocked (MCP startup failure, no project key); automatic analysis unrestored. No call by this pass. |

### Validation run by this pass (Pass 5)

| Command | Result |
| --- | --- |
| `Get-FileHash` / `Get-Item` / scoped `git status` | As above; config and fixture unmodified. |
| `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` | 30 tests: 30 pass, 0 fail, 0 cancelled, 0 skipped. Diagnostic `temporary link coverage: junction`. |
| `--test-name-pattern` runs for "atomic write preserves unowned temporary sentinel", "reviewed report compatibility" and "report bounds and linked review inputs" | Each: 1 test, 1 pass, 0 fail, 0 skipped, exit 0. |
| `npm run test:harness:decision-sidecar` | Exit 0; per-file 5/5, 9/9, 8/8, 14/14, 30/30; 0 fail, 0 skipped. |
| `npm run harness:config:self-test` | PASS. |
| `get_errors` | Evaluator 21 path-flow reports; test 0. |
| Both native Snyk scans | As above. |
| After this edit | `npm run harness:memory:references:check`, `npm run harness:docs:check`, `git diff --check` on this file. |

### Handoff (Pass 5)

- **Implement (optional, test only):** B5-m1, then B5-n1, B5-n2 and B5-n4. Any test change makes the
  `845CF…` scan receipt stale, so rerun the native test-file scan and bind it to the new hash.
- **Proof owner (append-only):** B5-n3.
- **Next:** a fresh Depth on the current files, then Feedback. Then the supported-platform
  file-symlink run and the authorized Sonar analysis and restoration.
- F-S1 remains **BLOCKED**. No release or security approval is implied by this PASS.

## Pass 4 (historical) — superseded by Pass 5

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md) and both
[Feedback](decision-calibration-scanner-triage-feedback-2026-09-29.md) verdicts. Read-only for
source, test, guide, fixture, config, brief and private data; this pass edits only this record.
No Snyk or Sonar call was made. F-D4 stays closed.

- **Numbering.** The request named this pass "Pass 3" and the prior one "Pass 2". This record
  already held a Pass 3 (written 12:17), so this final pass is recorded as Pass 4. The requested
  IDs B3-M3, B3-m3 and B3-m4 do not exist in any review record. This pass verifies every ID that
  does exist: B3-M1/M2, B3-m1/m2, B3-n1–n3, and each B2-* item via the Pass 3 supersession table.

### Verdict (Pass 4)

- **Breadth: FAIL -> REVISE (narrow), unchanged from Pass 3.** 0 Blocker, 2 Major, 2 Minor, 3 Nit.
- **No repair landed after Pass 3.** Evaluator and test hashes equal the Pass 3 snapshot, and every
  reviewed artifact was last written before the Pass 3 record:

  | Artifact | SHA-256 | Last write |
  | --- | --- | --- |
  | Evaluator | `F4081EAC…A507F84` | 12:02 |
  | Test | `9225AB78…F21039404` | 12:08 |
  | Brief | `E0AD7FB5AD1731234CB76636E9CB440D410598DE341444DB4A4CF80C46E539DE` | 12:10 |
  | Guide | `DC40252E…87CA76AD` (unchanged) | — |
  | Config / fixture | `41274EA6…` / `3928B7B9…`, unmodified in scoped `git status` | — |

  Each Pass 3 finding was re-derived from the current lines below; none is copied forward unchecked.
- **F-S1 and release/security clearance: BLOCKED.**
  - No hash-bound native test-file scan receipt exists. The parent's parallel native scans had not
    been supplied when this pass ran, and none is inferred.
  - Sonar is still blocked (MCP startup failure, no project key).
  - The supported-platform file-symlink run is still owed.

### Residual mandatory findings (Pass 4)

| ID | Sev | Status | Direct evidence (current lines) |
| --- | --- | --- | --- |
| B3-M1 | Major | **Open** | See the B3-M1 detail below. |
| B3-M2 | Major | **Open** | See the B3-M2 detail below. |
| B3-m1 | Minor | **Open** | Receipts in tests 20, 21 and 23 persist `{ events }` only; only test 22 records `pid: process.pid` (974). Temp-absence checks rely on `result.pid`; unlink checks use `includes` (872, 948, 1031), not an exact count of one. |
| B3-m2 | Minor | **Open** | The partial-write wrappers (tests 20, 21 and 23 `cleanup-write`) write `slice(0, 8)` and throw without recording `fstat` size. |
| B3-n1 | Nit | **Open, widened** | Brief 357 reports 10 test diagnostics and brief 335 says "no test-file errors"; `get_errors` shows 11 (41, 122×2, 126×2, 130, 186, 187, 1044, 1048, 1066). Evaluator: 21, which matches. |
| B3-n2 | Nit | **Open** | Test 22 (958–996) does not compare config or history bytes. |
| B3-n3 | Nit | **Open** | Test 17's legacy-switch half (704–720) is pre-create, and the title still says "failed atomic replacement". There is no `${fixturePath}.${pid}.tmp` absence check, and status uses `notEqual` (714). |

#### B3-M1 detail

- Brief 319–331 and 342–359 still claim the following. The user's authoritative status says the
  native test-file scan failed with `SNYK-CLI-0022` and produced no result.
  - "Native CLI authentication completed" (321).
  - The native test-file scan "completed against the test hash" (324).
  - The MCP results are called "historical" (330).
  - "Both native scans were rerun … test completed" (353).
- No direct final receipt was provided to this pass.

#### B3-M2 detail

- These tests still use `assert.notEqual(status, 0)`, which also accepts `null`:
  - 714 (test 17)
  - 764 (test 18, the Appendix-named red regression)
  - 798 (test 19)
  - 867 (test 20)
  - 1105 (test 24)
  - 1150 (test 25)
- `assertChildOutcome` is used only at 79, 931, 1024 and 1208.
- Test 18 (760–770) still has no exact stderr and no root-absence check. Test 20 has no exact stderr.
- Brief 282 claims "Synchronous child proof paths require no spawn error, null signal, an integer
  status, and the expected status". That overstates the tests.

Fixes are unchanged from Pass 3: test file, plus a brief append. No evaluator change is needed.
B3-M1 closes only when the proof owner appends the user-authoritative status, or a direct
hash-bound native receipt for `9225AB78…`. Either way, withdraw brief 321/324/353 as written.

### Focus verification (Pass 4, direct)

- **Test 17, `generated fixture output and failed atomic replacement…` (677–723).**
  - It restores the canonical fixture and exports offset 1. It then runs a consent-complete
    accepted import with `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE: "1"` on that child only.
  - It asserts empty stdout, exact `cases fixture write failed`, and byte-equal
    fixture/history/config.
  - The import reaches the write stage: import writes only through `atomicWrite` (evaluator 653),
    after `serializeBounded` and all validation. With the switch set, `cases fixture write failed`
    can come only from `atomicWrite`'s `mkdir` (244) or its switch branch (254–256).
  - The fault really is verified at the import. The residual is B3-M2's status assertion and
    B3-n3's naming.
- **`atomic replacement failures…`, test 21 (883–956).** Covers all four scenarios (collision,
  pre-open, partial-write, rename) on a changing reviewed import:
  - `assertChildOutcome(…, 1)` (931);
  - exact `write`/`replace` stderr, root absence, and byte-equal fixture/config/history;
  - collision: exact `["sentinel","collision"]` and the sentinel preserved at `result.pid`. This
    also proves the child PID matches the spawn PID for that scenario;
  - pre-open: exact `["pre-open"]`, no temporary;
  - partial-write and rename: one open, one close, unlink, and `rename-after-close`.

  Residual: B3-m1 and B3-m2.
- **`reviewed import replaces…`, test 22 (958–996).** Covers the exact bytes and the lifecycle:
  - receipt PID equals `processResult.pid`, and the temporary equals `${destination}.${pid}.tmp`;
  - exact events `open, write, close, rename-after-close`, with no unlink;
  - the wrapper throws if `fstat` does not give `EBADF` before rename;
  - the descriptor's write bytes and the destination bytes both equal `expectedImportedFixture`
    (192–212), which is independently built two-space JSON with a trailing newline;
  - no `*.tmp` remains.

  Residual: B3-n2.
- **Error categories and cleanup.** Evaluator:
  - The private marker is the `FILESYSTEM_FAILURE` symbol (23), set by `filesystemFailure`
    (128–132) and checked by `isFilesystemFailure` (134). Pass 3 cited line 130 for the marker;
    the correct lines are these.
  - Each native call maps to its own step: open, write and close map to `write`; rename maps to
    `replace` (257–279).
  - Close ownership moves to a local before close (268).
  - The catch (283–287) swallows close and cleanup errors (`closeDescriptor` 226,
    `cleanUpOwnedTemporary` 232) and rethrows marked or validation errors.
  - Test 23 (998–1036) proves exact primary categories, including `cleanup-replace` → `replace`,
    one close, and that the owned temporary is left only when cleanup itself fails.
- **Compatibility switch.**
  - Evaluator 254: `=== "1"`, before `openSync`, before ownership, `write` category.
  - `runWithPreload` deletes the inherited switch unless the test sets it (44).
  - Tests 17, 19 and 25 cover it. Test 19 covers the absent-temporary case and preservation of an
    unowned sentinel.
- **Prototype check in the scoring child, test 26 (1159–1213).**
  - It compares the full own string-keyed descriptor set of `Object.prototype`
    (`value`/`get`/`set` identity and all three flags), key-set equality and prototype identity.
  - It asserts total, configured key order and exact own tallies.
  - The unknown-label run is checked with `assertChildOutcome(…, 1)`, empty stdout and the
    specific error.
- **Code proof and scan facts.**
  - Evaluator: 21 IDE path-flow reports, unchanged, which support the Pass 2 dispositions.
  - Test file: 11 reports, all synthetic `mkdtemp` or literal paths.
  - The S1-HTTP stub is unchanged at test 232: loopback, port 0, `finally` teardown.
  - No scanner result is asserted by this pass.
- **No user data.** All roots come from `mkdtemp`, with synthetic history (`setupRoot`, 101–119)
  and synthetic review entries. Only the committed fixture and config are copied into temporary
  roots. No private runs, queues, labels or consent were opened.

### Scanner status for the record (Pass 4)

| Scanner | Status |
| --- | --- |
| Native Snyk, evaluator | Completed, 0 issues (user-supplied) |
| Native Snyk, test file | Last user-authoritative result: `SNYK-CLI-0022`, no result. The parent's parallel rerun is pending and was not supplied to this pass, so no success is claimed. |
| MCP Snyk | Evaluator 0; test file 1 LOW, loopback HTTP (user-supplied) |
| Sonar | Blocked (MCP startup failure, no project key); automatic analysis not restored |

### Validation run by this pass (Pass 4)

- `Get-FileHash` on the evaluator, test, guide, config, fixture and brief; `Get-Item` last-write
  times; scoped `git status --short`. Results as above.
- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`: tests 30, pass 30,
  fail 0, cancelled 0, skipped 0. Diagnostic: `temporary link coverage: junction`.
- `npm run test:harness:decision-sidecar`: exit 0. Per-file summaries were 5/5, 9/9, 8/8, 14/14 and
  30/30 pass, with 0 fail and 0 skipped.
- `get_errors` on both files: evaluator 21, test 11, all path-flow.
- After this edit: `npm run harness:memory:references:check`, `npm run harness:docs:check` and
  `git diff --check` on this file.

### Handoff (Pass 4)

- **Implement (test file only):**
  - B3-M2: `assertChildOutcome(result, 1)` at 714, 764, 798, 867, 1105 and 1150. Test 18 gets
    exact `candidate queue write failed` stderr and root absence; test 20 gets exact stderr.
  - Then B3-m1, B3-m2 and optionally B3-n2/n3.
  - Rerun the named tests, then the full suite.
- **Proof owner (brief append):** B3-M1, B3-n1 and the brief 282 correction. Bind any new native
  receipt to the post-repair test hash. If the test file changes, the `9225AB78…` receipt is stale.
- Then fresh Depth on the current files, then Feedback.
- F-S1 remains **BLOCKED** until the native test-file receipt, Sonar analysis and restoration, and
  the supported-platform file-symlink run are in place.

## Pass 3 (historical) — superseded by Pass 4

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md), the Pass 2
[Feedback verdict](decision-calibration-scanner-triage-feedback-2026-09-29.md) and its accepted
actions. Read-only for source, test, guide, fixture, config, brief and private data; this pass
edits only this review record. F-D4 stays closed. No Snyk or Sonar call was made.

### Verdict (Pass 3)

- **Breadth: FAIL -> REVISE (narrow).** 0 Blocker, 2 Major, 2 Minor, 3 Nit.
- The code-level defects from Pass 1 and Pass 2 are repaired. What remains: one incomplete
  test-assertion action (B2-M2) and a brief proof record that contradicts the user's final scanner
  status. Both fixes are small; neither needs an architecture change.
- **F-S1 and release/security clearance: BLOCKED.** No completed native scan of the test file, no
  Sonar analysis or restoration, and no supported-platform file-symlink run.

### Context sufficiency (Pass 3)

| Artifact | Snapshot | Surface |
| --- | --- | --- |
| `scripts/harness/decision-eval.mjs` | SHA-256 `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84`, read in full | Evaluator runtime |
| `scripts/harness/test/decision-eval-test.mjs` | `9225AB78663DCDF3A37D26BF68D0B51579B8BDBFA0295A2E72CEBFDF21039404`; helpers and tests 17–26 read in full | Adjacent tests |
| `.github/harness/eval/README.md` | `DC40252EE560669C920E9C8FE69DB57DBB0855FF8B0F10C44C34F23287CA76AD` (unchanged since Pass 2) | Operator guide |
| Brief: Appendix A, Current Status, Implementation Correction, Native Snyk Receipts, Final Receipt Correction | Contract and proof claims | Architect / Implement |
| Pass 2 Breadth, both Feedback records, Depth (Pass 1-era, historical) | Accepted actions; IDs | Review chain |

- **Scope:** mixed (test proof plus an evidence record).
- The hashes match the brief's Final Receipt Correction. Committed config
  (`41274EA6…`) and fixture (`3928B7B9…`) are unmodified per scoped `git status`.
- MISSING: raw scanner receipts. LIMITATION: this pass cannot tell whether the brief's
  native-test-scan claims or the user's final status packet describe the actual native run. RISK:
  the evidence record may be false. The user packet is treated as authoritative, as in both
  Feedback records.
- MISSING: a Depth pass on the current files. The existing Depth describes Pass 1-era code.
- No private runs, queues, labels or consent were opened.

### Findings ledger (Pass 3)

#### Major

##### B3-M1 — The brief claims a completed native test-file scan; the user's final status says it failed

- **Artifact:** brief "Native Snyk Receipts" (line 319 onward) and "Final Receipt Correction"
  (line 342 onward).
- **Finding:** the brief says `snyk code test scripts/harness/test/decision-eval-test.mjs`
  "completed" with 1 LOW, first against hash `A846…` and then rerun against the final hash
  `9225AB78…` (line 353: "Both native scans were rerun … test completed with the same 1 open
  LOW"). It also says "Native CLI authentication completed" (line 321). The user's final status
  for the post-edit files says otherwise:

  | Scan | Result |
  | --- | --- |
  | Native evaluator | 0 issues |
  | Native test file | `SNYK-CLI-0022`, no result |
  | MCP evaluator | 0 issues |
  | MCP test file | 1 LOW HTTP |

  The brief also calls the MCP results "earlier … historical evidence" (line 330), but per the
  user they are final-state results. The line 232 location it gives for the LOW belongs to the MCP
  result.
- **Evidence:** brief lines 319–331 and 342–359 compared with the user's Pass 3 packet. This
  repeats the Pass 1 B-M1 provenance defect in a new section.
- **Impact:** the release record would show the Brief's mandatory BOTH-native-scans gate as met
  when it is not. F-S1 gating depends on this.
- **Confidence:** HIGH on the contradiction. Neither run is independently verified.
- **Fix (proof owner, append-only):** add a dated correction that supersedes lines 319–331 and
  353–356. It should state:
  - Native evaluator scan: completed, 0 issues.
  - Native test-file scan: failed with `SNYK-CLI-0022`, producing no result or count. Withdraw
    both "completed" claims and the authentication-completed claim.
  - MCP Code, evaluator: 0 issues. MCP Code, test file: 1 LOW `Cleartext Transmission` at the
    loopback `http.createServer` (test line 232), kept visible under the approved conditional
    test-context disposition.
  - Hash binding for MCP scans only if a receipt shows it.
  - The native test-file scan is still owed.
  - Fold in B3-n1 (IDE count).

##### B3-M2 — B2-M2 is only partly done: four preload-fault tests, including the Appendix-named red regression, still accept any nonzero status

- **Artifact:** test lines 764 (test 18, `atomic write preserves unowned temporary sentinel`), 798
  (test 19), 867 (test 20) and 1105 (test 24). Also the related run-based faults at 714 (test 17)
  and 1150 (test 25).
- **Finding:**
  - Done: both `run` and `runWithPreload` now pass `timeout: 30_000`. `assertChildOutcome`
    (lines 55–60) correctly rejects a spawn error, a signal, a non-integer status and the wrong
    status. On timeout `spawnSync` sets `error` (ETIMEDOUT) and `signal`, so a timeout fails the
    check. It is used by `parseJson` and tests 21, 23 and 26.
  - Not done: the tests listed above still use `assert.notEqual(status, 0)`, which also passes on
    `null`.
  - Test 18 is the Appendix A red-proof regression. Its mandated invariant is "normal child exit
    with nonzero status, no signal/timeout/spawn error". It also still lacks the exact
    `candidate queue write failed` stderr and a root-absence check (the export half of B2-m3).
  - Test 20 has no exact stderr either.
  - The brief (line 282) says "Synchronous child proof paths require no spawn error, null signal,
    an integer status, and the expected status". That overstates what the tests do.
- **Impact:** the timeout bounds any hang, and receipts prove the fault operations were reached,
  so a false pass is unlikely. But in test 18 a child killed between `EEXIST` and cleanup would
  leave the sentinel in place and pass. That is exactly the preservation claim the red/green
  proof rests on. Pass 2 required "use it in every preload-fault test".
- **Confidence:** HIGH.
- **Fix (Implement):**
  - Replace those status assertions with `assertChildOutcome(result, 1, result.stderr)` before
    reading receipts or checking preservation.
  - In test 18, assert stderr equals `[decision-eval] candidate queue write failed\n` and does not
    contain the root.
  - Give test 20 exact stderr (`write` for the partial-write fault, `replace` for the rename
    fault).
  - Correct brief line 282 in the same proof append.

#### Minor

##### B3-m1 — Failure receipts omit the writer PID, and "fault fired exactly once" is not asserted

- **Artifact:** tests 20, 21 and 23 (receipt reads at 866, 930 and 1023; `includes("unlink")` at
  872, 948 and 1031).
- **Finding:**
  - Only test 22 records `process.pid` in its receipt and checks it against `result.pid`.
  - The failure tests prove temporary removal with `existsSync(`${destination}.${result.pid}.tmp`)`.
    Their `unlink` event is pushed *before* the real `unlinkSync`, and `cleanUpOwnedTemporary`
    swallows unlink errors. So removal proof depends on the spawn PID matching the writer PID.
    That holds for a direct `process.execPath` spawn, and test 22 confirms it on the success path,
    but the failure receipts do not show it.
  - Faults are checked with `includes`, not a count of exactly one. Appendix A: "Assert the
    selected operation was reached and the fault fired exactly once."
- **Impact:** low. A PID mismatch would make the absence checks vacuous, and a repeated fault
  would go unnoticed.
- **Confidence:** HIGH (source).
- **Fix:** persist `pid` in every failure receipt and assert it equals `result.pid`. Or, as test
  22 does, assert that no `*.tmp` entry remains in the destination directory. Replace `includes`
  with exact counts for the fault event and `unlink`.

##### B3-m2 — The partial-write fault does not show that bytes reached the real temporary

- **Artifact:** partial-write wrappers in tests 20 and 21.
- **Finding:** the wrapper writes an 8-character prefix and then throws, but never records the
  temporary's size or contents. Appendix A: "Observe that bytes reached the real temporary before
  throwing."
- **Impact:** low. Ownership-on-open is still shown by open → close → unlink, but the "partial"
  state itself is not observed.
- **Confidence:** HIGH.
- **Fix:** after the prefix write, record `originalFstatSync(descriptor).size` (expected 8) in the
  receipt and assert it.

#### Nit

- **B3-n1:** the Final Receipt Correction (line 357) reports 10 test-file IDE reports. Current
  `get_errors` shows 11 (lines 41, 122×2, 126×2, 130, 186, 187, 1044, 1048, 1066). Evaluator: 21,
  which matches. Fold into the B3-M1 append.
- **B3-n2:** the test 22 success control does not assert that config and history are unchanged.
  Feedback item 2 lists these. Add two byte comparisons.
- **B3-n3:** test 17's second half is a *pre-create* failure (legacy switch), not a rename or
  replacement failure. The title says "failed atomic replacement", and there is no check that the
  temporary is absent. Test 21 covers real replacement faults, so this is naming only. Rename the
  test or add `existsSync(`${fixturePath}.${failedImport.pid}.tmp`) === false`.

#### FYI

- **Test 17 (`generated fixture output and failed atomic replacement…`, lines 677–723) is now
  real.**
  - It restores the canonical fixture and exports offset 1. It runs a consent-complete accepted
    import that would add a case, with `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE=1` on that child
    only.
  - It asserts empty stdout, exact `cases fixture write failed`, and byte-equal
    fixture/history/config.
  - Only `atomicWrite` can produce `cases fixture write failed`, so the import reached the write
    stage; validation did not reject it first.
- **Is the import fault matrix enough for Appendix A? Yes, in substance (subject to B3-M2 and
  B3-m1/m2).** Test 21 runs collision, pre-open, partial-write and rename on a changing reviewed
  import over an existing fixture. It checks, per case:
  - exact stderr (`write` or `replace`), root absence, and byte-equal fixture/config/history;
  - `assertChildOutcome(…, 1)`;
  - collision: exact events `["sentinel","collision"]` (real `EEXIST`, no open, no unlink) and the
    sentinel still present;
  - pre-open: exact `["pre-open"]` and no temporary;
  - partial-write and rename: one open, one close, owned-temporary cleanup, and
    `rename-after-close` for the rename case.

  Test 22 adds the no-fault replacement: receipt PID equals spawn PID, exact
  `open, write, close, rename-after-close`, no unlink, and written bytes and destination bytes equal
  an independently built serialization. It also checks that no `*.tmp` remains. Test 2 is the
  uninstrumented import control. Appendix A's "outside payload" applies to the link scenarios
  (test 24), not to these.
- **Prototype receipt (test 26).**
  - Inside the scoring child it compares the full own *string-named* property set of
    `Object.prototype`. For each key it checks `value`/`get`/`set` identity and all three flags,
    which covers the `__proto__` accessor, `constructor` and `toString`. It also checks prototype
    identity.
  - It asserts total, configured key order, exact own tallies, and a normal status-1 rejection
    with the specific unknown-label error. Symbol-keyed properties are not compared; JSON labels
    cannot produce them.
- **Error categories (B2-m1).** A private symbol marker (evaluator line 130) replaces the message
  regex, and each native call is mapped at its own step. The fallback at line 286 still passes any
  `Error` without a `code` through unchanged. That is acceptable: every such error here comes from
  local validation, and every native fs call is already wrapped.
- **Unchanged since Pass 2.**
  - Legacy switch at evaluator 254 (`=== "1"`, pre-create, no ownership).
  - Descriptor moved to a local before close (268).
  - Residual path-flow dispositions (evaluator 21 reports, test 11) as proposed in Pass 2.
  - S1-HTTP stub: loopback, port 0, offline 0 requests / live > 0, `finally` teardown, at test
    line 232.
  - `runAsync` (HTTP test only) has no timeout. It is not a preload child and is outside the B2-M2
    mandate.
  - Depth's macOS `/var` temporary-directory ancestry warning still applies to the pending
    file-symlink run.

### Supersession (Pass 3)

| Prior finding | Current status (re-derived from source/tests) |
| --- | --- |
| B-M1 / D-M4 / B2-M3 scanner provenance | **Reopened → B3-M1.** The factual correction was appended, but the later Implementation/Final Receipt sections reintroduce a completed-native-test-scan claim |
| B-M2 / D-M2 / D-M3 vacuous test, import faults | Resolved (tests 17, 21, 22) |
| B-M3 / D-M1 write categories, cleanup proof | Resolved (marker; tests 21 and 23, including `cleanup-replace`) |
| B-m1 switch removal | Resolved (restored; tests 17, 19, 25) |
| B-m2 / D-m1 double close | Resolved (local transfer at 268; test 23 counts one close) |
| B-m3 races | Accepted boundary, unchanged |
| B-m4 / D-m3 / B2-m4 temp links | Resolved on this host: file attempted first, `junction` executed and reported by diagnostic. File-symlink platform run still owed |
| B-m5 / D-m4 / B2-m2 prototype | Resolved (test 26) |
| B-m6 / D-m6 optional chain | Resolved (no style diagnostics) |
| B-m7 / D-m5 README | Resolved (hash unchanged since Pass 2) |
| B2-M1 success replacement | Resolved (test 22); B3-n2 residual |
| B2-M2 bounded normal exit | **Partial → B3-M2** |
| B2-m1 regex categories | Resolved |
| B2-m3 matrix gaps | Import collision and destination-absence resolved; export-collision stderr/root → B3-M2 |
| B2-n1 rename-primary cleanup | Done (`cleanup-replace`) |
| B2-n2 README switch note | Optional; not done; holds |

### Coverage note (Pass 3)

- Inspected: the evaluator in full; test helpers and tests 1–2 and 16–26; the brief's proof
  sections from Appendix A onward; Pass 2 Breadth; both Feedback records; Depth.
- Not re-read: tests 3–15 and 27–30 (unchanged areas, passing). Private data, raw scanner output
  and macOS/Linux runtimes were not inspected.

### Validation run by this pass

- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`: 30 tests,
  30 pass, 0 fail, 0 skipped, 0 cancelled. Diagnostic: `temporary link coverage: junction`.
- File hashes and scoped `git status` as listed under Context sufficiency.
- `get_errors`: evaluator 21 path-flow reports, test 11. No other diagnostics.
- Parent-supplied, not rerun here: `npm run test:harness:decision-sidecar` (all pass, including the
  freeze invariants and negative cases), `npm run harness:config:self-test`, and docs/references.

### Handoff (Pass 3)

- **Implement:** B3-M2, then B3-m1, B3-m2 and optionally B3-n2/n3. Test file only; no evaluator
  change needed. Rerun each named test, then the full suite.
- **Proof owner:** the B3-M1 append (plus B3-n1 and the brief line 282 correction). Scanner status
  after the append:

  | Scanner | Status |
  | --- | --- |
  | Native Snyk, evaluator | Completed, 0 issues |
  | Native Snyk, test file | Failed (`SNYK-CLI-0022`), no result; still owed |
  | MCP Snyk, evaluator | 0 issues |
  | MCP Snyk, test file | 1 LOW, loopback HTTP |
  | Sonar | Unavailable |

- If only the test file changes, rescan it natively and cite a hash-bound receipt.
- Then a fresh Depth pass on the current files, then Feedback.
- F-S1 remains **BLOCKED**.

## Pass 2 (historical) — superseded by Pass 3

Stage contract: [05-REVIEW-BREADTH](../../../instructions/05-REVIEW-BREADTH.md). Governing contract:
[brief Appendix A](../briefs/decision-calibration-scanner-triage-2026-09-29.md) and the accepted
actions in [Feedback](decision-calibration-scanner-triage-feedback-2026-09-29.md). Read-only pass:
no source, test, guide, fixture, config, brief or private-data edits. F-D4 stays closed.

### Verdict

- **Breadth: FAIL -> REVISE.** 0 Blocker, 3 Major, 4 Minor, 2 Nit.
- Most Pass 1 and Depth defects are repaired in current source and tests (see the supersession
  table). The remaining Majors are mandatory proof gaps from Appendix A or Feedback, plus a stale
  proof record.
- **F-S1 and release/security clearance: BLOCKED.** Sonar is unavailable, file-symlink proof on a
  supported platform is missing, and no native scan receipts are tied to the reviewed hashes.

### Context sufficiency

| Artifact | Snapshot / what changed | Surface |
| --- | --- | --- |
| `scripts/harness/decision-eval.mjs` | 843 lines, SHA-256 prefix `B6F8BF8894E74879`, read in full | Evaluator runtime |
| `scripts/harness/test/decision-eval-test.mjs` | 1345 lines, `41088FE21A3222ED`, all 30 tests read | Adjacent test suite |
| `.github/harness/eval/README.md` | `DC40252EE560669C`, read in full | Operator guide |
| Brief body, Appendix A, Final Implementation Proof, Complexity Follow-up | Contract and proof claims | Architect / Implement |
| Feedback and Depth records | Accepted actions; D-/B- IDs | Review chain |

- **Scope:** mixed (software, test proof and operator docs).
- MISSING: the Pass 1 Breadth report was a session temp file and is not in the repo. Its B-* IDs
  are known only through the Feedback record's summaries. Every status below was re-derived from
  current source, not copied.
- MISSING: raw Snyk receipts with scan-time hashes. LIMITATION: this pass cannot tell whether the
  user-supplied final native scans (evaluator 0; test 1 LOW HTTP) ran against the hashes above.
  RISK: the scan and the files may not match.
- MISSING: Sonar analysis and automatic-analysis restoration. Per instruction, no Sonar or Snyk
  calls were made.
- No private runs, queues, labels or consent data were opened.

### Findings ledger

#### Major

##### B2-M1 — The successful-replacement control is vacuous, and the no-fault instrumented replacement is missing

- **Artifact:** test `reviewed import replaces the fixture without leaving a temporary file`
  (test lines 919–932).
- **Finding:** line 928 checks for `${destination}.${process.pid}.tmp`. That is the parent test
  process PID. The evaluator names its temporary file with the child PID, so this assertion can
  never fail. The test checks only the last case's `task`, not the exact destination bytes. No
  pass-through preload proves open → close → rename order and zero unlinks on the success path.
- **Evidence:** `run()` returns the `spawnSync` result, but the test passes it straight into
  `parseJson` and discards `pid`. Tests 20 and 21 use `result.pid` correctly. Appendix A requires
  a "no-fault successful replacement with no remaining temporary and exact intended destination
  bytes". Feedback accepted-change 3 requires "a no-fault instrumented replacement showing exact
  intended bytes, close-before-rename and no leftover temporary".
- **Impact:** a leaked temporary, or a wrong serialization, on the replace-existing path (the path
  that behaves differently on Windows) goes undetected.
- **Confidence:** HIGH.
- **Fix:** keep the result object. Assert that `${destination}.${result.pid}.tmp` is absent and
  that the eval directory contains no `*.tmp` entries. Compare exact destination bytes with the
  expected serialization (pre-import fixture plus the projected case, two-space JSON, trailing
  newline). Add one preload run with pass-through wrappers that must record exactly
  `open, close, rename-after-close` and no `unlink`.

##### B2-M2 — Preload children have no timeout, and fault tests accept signal or spawn termination

- **Artifact:** `runWithPreload` (test lines 38–50) and every preload-fault test (tests 18–21, 23,
  24 and 26).
- **Finding:** `spawnSync` has no `timeout`. No test asserts `result.error === undefined` or
  `result.signal === null`. `assert.notEqual(result.status, 0)` also passes when `status` is
  `null`. Tests 18 (collision) and 24 (links) do not assert exact stderr, so a crash or kill after
  preload setup would still satisfy their status and preservation checks.
- **Evidence:** Feedback accepted-change 1: "Add bounded child timeouts and reject spawn error,
  signal or timeout as proof of an intended fault." Appendix A red-proof invariant: "normal child
  exit with nonzero status, no signal/timeout/spawn error".
- **Impact:** a hung child blocks the suite with no bound, and an abnormal termination can be
  mistaken for the intended fault. The chance of this in practice is low, but the requirement is
  mandatory and unmet.
- **Confidence:** HIGH.
- **Fix:** add a bounded `timeout` to `runWithPreload`. Add one local helper that asserts
  `error === undefined`, `signal === null`, `status === 1` and `stdout === ""`, and use it in every
  preload-fault test.

##### B2-M3 — The brief's proof record is stale and in places false

- **Artifact:** brief sections "Appendix A Final Implementation Proof" and "Complexity Follow-up".
- **Finding:** the proof no longer describes the reviewed files:
  - It says "the production `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE` branch was removed". The branch
    is restored at evaluator lines 247–249 and exercised by tests 17, 19 and 25.
  - It says temporary-link coverage was "skipped". On this host, test 24 now runs the junction
    branch and passes.
  - It reports 25 pass / 1 skip. This pass observed 30 tests, 30 pass, 0 skipped.
  - It reports "6 test-only synthetic-path reports". Current IDE diagnostics show 11.
  - Its "final native scans completed" wording for the test file was already corrected by Feedback
    (the native test-file attempt failed with SNYK-CLI-0022).
  - No section records the Feedback-driven rework. The Implement report's "25 pass / 1 skip" also
    does not match the current files.
- **Evidence:** direct source reads, the TAP run and `get_errors` output (see Validation below).
- **Impact:** release evidence of record contradicts the shipped code. Downstream reviewers cannot
  tie scanner results to file state.
- **Confidence:** HIGH.
- **Fix:** the proof owner appends a dated correction; nothing is rewritten. It records:
  - the current hashes;
  - exact test counts and the link type that executed;
  - that the switch is restored;
  - current diagnostic counts;
  - native Snyk receipts (command, completion status, counts, locations) tied to those hashes.

  Acceptance: every number in the proof can be reproduced at the recorded hashes.

#### Minor

##### B2-m1 — Write-path categories are classified by message regex, and revalidation rejections lose their category

- **Artifact:** evaluator `atomicWrite`, lines 264–265 and 275.
- **Finding:** the catch block rethrows only errors whose message matches
  `/^(?:.+) (?:write|replace) failed$/`. Everything else becomes `<label> write failed`. That
  includes the pre-rename `assertContained` link and containment rejections, and
  `path inspection failed`. Unexpected programming errors are relabelled as write failures too.
- **Impact:** nothing is disclosed (safe). But the useful category (`must not use symbolic links
  or junctions`) is lost on this path, and category ownership depends on message text.
- **Confidence:** HIGH (source). Low severity.
- **Fix:** make the type boundary explicit. `filesystemFailure` returns a local marked error (a
  private class or symbol). The catch rethrows marked errors and containment errors unchanged, and
  maps only unmarked native errors. No new race-injection test is required.

##### B2-m2 — The prototype receipt compares only key names

- **Artifact:** test 26, lines 1079–1125 (receipt at 1107–1108).
- **Finding:** these points apply to the child-process check:
  - The check runs in the scoring child, which is correct and relevant. The old bracket-access
    pollution would add keys such as `correct` to `Object.prototype`, and this check catches that.
  - `descriptors` is `Object.keys(getOwnPropertyDescriptors(...))`, so it duplicates `keys`.
  - The values and identities of existing members are never compared. Two of the tested labels are
    `toString` and `constructor`, which already exist on `Object.prototype`. An overwrite of either
    would pass.
  - `plainObjectPrototype` is always true.
  - `deterministic.total` is not asserted.
  - The unknown-label rejection asserts only a nonzero exit.
- **Evidence:** Feedback B-m5 requires baseline and post-scoring "prototype keys/descriptors",
  "exact totals/own entries and unknown-label rejection".
- **Confidence:** HIGH.
- **Fix:** capture the descriptor objects in the preload. At exit, compare each key's
  `value`/`get`/`set` by `===`, plus its flags. Assert that `deterministic.total` equals the
  fixture case count and that the confusion key order equals the configured labels. Assert that
  the unknown-label run's stderr contains `unsupported expected intent`.

##### B2-m3 — Gaps remain in the preservation matrix

- **Artifact:** tests 18, 21 and 23.
- **Finding:**
  - There is no same-PID sentinel collision on an existing-fixture import. Feedback
    accepted-change 3 lists collision alongside pre-open, partial-write and rename for imports.
  - Test 18 asserts neither the stderr category nor that the root is absent from stderr.
  - Test 23 (close and cleanup failures) never asserts that the destination is absent.
- **Impact:** the code path is shared with the export collision and is proven there. The risk is
  low, but these are mandated matrix items.
- **Confidence:** HIGH.
- **Fix:** add an import collision scenario that checks sentinel bytes, fixture bytes and exact
  stderr `cases fixture write failed`. Assert `candidate queue write failed` and root absence in
  test 18. Assert the destination is absent in both test 23 scenarios.

##### B2-m4 — The executed link type is not observable, and Windows never attempts a file symlink

- **Artifact:** `temporaryLinkType` (test line 979) and test 24.
- **Finding:** on win32 the helper always uses a junction. The file-symlink and dangling-file-link
  cases therefore run only on POSIX. The skip text names Windows on every platform. A passing
  result does not record which link type ran.
- **Impact:** proof summaries can mistake junction coverage for file-symlink coverage. Feedback
  keeps file-symlink proof as a separate deferred gate.
- **Confidence:** HIGH.
- **Fix:** emit `context.diagnostic` with the link type and make the skip text platform-neutral.
  Optionally, try a file symlink first on win32 and report the junction fallback.

#### Nit

- **B2-n1:** the test 23 cleanup-failure scenario uses a partial-write primary error. Its category
  (`write`) equals the generic fallback. A rename-primary variant (`replace failed`) would also
  discriminate category preservation. Exact stderr already rules out raw cleanup-error propagation.
- **B2-n2:** the README does not mention the retained `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE`
  switch as an operator-environment trust assumption. Optional; Appendix A records it.

#### FYI

- **Legacy switch.** The trigger (`=== "1"`, pre-create, no ownership, sentinel preserved) matches
  Appendix A and the D4 Depth record. The switch's exact prior error text cannot be recovered
  (`HEAD` predates D4), so message compatibility is unverified (LOW). The current text is the safe
  category.
- **Top-level catch.** The catch at evaluator lines 836–843 no longer sniffs `code`. It prints the
  message for `Error` instances and `operation failed` otherwise. The reported "any object with
  code → generic filesystem" behavior is **not present** in current source. Every `node:fs` call is
  wrapped at its I/O owner, so no native path-bearing message reaches it.
- **Cleanup does not mask the primary error.** `cleanUpOwnedTemporary` (225–232) swallows its own
  errors inside the primary catch. Test 23 proves this with exact stderr and the owned temporary
  left behind.
- **Residual path-flow dispositions (reviewer-proposed; warnings stay visible).** These rest on
  source review. Snyk's evaluator result of 0 issues is not evidence that Snyk modeled these guards.
  - Evaluator, 21 IDE reports:
    - Line 46 is operator root selection, which is explicit authority.
    - Lines 112–119, 201, 452, 497 and 631 derive paths. Each is later read or written through
      `assertContained` with an independently chosen repo, runs or calibration root.
    - Lines 141, 154–155 and 163 are inside the guard itself (`lstat` only).
    - The sinks `readFileSync` (183) and `openSync` (250) are immediately preceded by containment
      and `lstat` link rejection.
    - Proposed disposition: not a vulnerability under the accepted stable, operator-owned tree.
      Swaps by a hostile same-user writer (TOCTOU) remain explicitly out of scope.
  - Test file, 11 reports:
    - Lines 39, 112, 116, 120, 176–177, 977–978 and 988 build paths only from `mkdtemp` roots and
      literals, with no external input.
    - Proposed disposition: test-only, not a vulnerability.
- **S1-HTTP.** The stub at test lines 197–241 is unchanged: loopback, port 0, synthetic root,
  0 offline and more than 0 live requests, `finally` teardown. The approved test-context
  disposition holds; the finding stays visible.
- **README.** The root-precedence, CWD-relative, designated-directory, link-ancestry and
  fixed-category text matches `resolveRepoRoot` and `assertContained`.
- **Depth's untested macOS observation still applies:** the `/var` temporary-directory ancestry
  would reject synthetic roots. Relevant to the supported-platform link run.

### Pass 1 / Depth supersession

| Prior finding | Current status (re-derived) |
| --- | --- |
| B-M1 / D-M4 scanner provenance | Open → B2-M3 |
| B-M2 / D-M2 / D-M3 vacuous test, missing import faults | Failure matrix fixed (tests 17, 21). Success control vacuous → B2-M1. Import collision → B2-m3 |
| B-M3 / D-M1 write categories, cleanup proof | Resolved in substance (sink categories; test 21 asserts `replace`/`write`; test 23). Residual brittleness → B2-m1 |
| B-m1 switch removed | Resolved (restored; tests 19, 17, 25) |
| B-m2 / D-m1 double close | Resolved (evaluator 257–263; test 23 counts 1 close) |
| B-m3 races | Accepted boundary, unchanged |
| B-m4 / D-m3 temp-link skip | Resolved on this host via junction (test 24 ok). Visibility → B2-m4 |
| B-m5 / D-m4 prototype | Moved into the scoring child; key-only comparison → B2-m2 |
| B-m6 / D-m6 optional chain | Resolved (no style or complexity diagnostics) |
| B-m7 / D-m5 README | Resolved |
| B-n1 suite split | Decision holds |

### Coverage note

- Inspected: all evaluator source; all 30 tests; the README; brief Appendix A and its proof
  sections; the Feedback and Depth records.
- Not inspected: private runs; raw scanner output; macOS/Linux runtime. Sonar and Snyk were not
  invoked.

### Validation run by this pass

- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`: 30 tests, 30 pass,
  0 fail, 0 skipped.
- `npm run test:harness:decision-sidecar`: exit 0. The evaluator tail showed 30/30.
- `get_errors`:
  - Evaluator: 21 path-flow reports only; no complexity or optional-chain reports.
  - Test file: 11 path-flow reports.
- Scoped `git status`: `harness.config.json` and the committed fixture are unmodified.
- File hashes as listed under Context sufficiency.

### Handoff

- Route B2-M1, B2-M2 and the Minors to Implement (a model distinct from the review stages).
- Route B2-M3 to the proof owner.
- Then re-run Depth and Feedback, run the native Snyk scans on both final hashes, and complete the
  Sonar subgate and the supported-platform file-symlink run.
- F-S1 remains **BLOCKED**.
