# Decision Calibration Review Workflow Feedback (2026-09-28)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-review-workflow-2026-09-28.md

## Feedback Verdict Record

**IMPLEMENTATION/LOCAL PROOF ACCEPTED; RELEASE/SECURITY VERIFICATION BLOCKED.** This final
Feedback adjudication supersedes the historical REVISE / return-to-Implement verdict below.
All required corrective findings are closed by the latest separately routed reviewers. No
additional implementation pass, optional refactor or new acceptance criterion is requested.
Acceptance here does not waive mandatory scans or authorize shipment, publication or unfreeze.

### Final context sufficiency

- Governing evidence: [approved brief](../briefs/decision-calibration-review-workflow-2026-09-28.md),
  the prior Feedback retained below, [Breadth corrective and final BR-1 assertion verification](decision-calibration-review-workflow-breadth-2026-09-28.md),
  and [Depth corrective and latest structural status](decision-calibration-review-workflow-depth-2026-09-28.md).
- Breadth final: PASS for static correctness, zero required findings. Depth latest: PASS for
  structure. Full stages were routed separately as requested; this pass is Feedback only under
  `07-FEEDBACK`, not a substitute implementation or repeat review.
- Reviewer proof: normal focused suite 19 passed, 0 failed, 0 skipped; the exact mutation removing
  only history containment yields 18 passed, 1 failed. Parent final freeze proof: seven invariants
  plus negative control passed. These are attributed results, not tests rerun in this docs pass.
- Parent final baseline against source-root config: 12 synthetic, 1 correct, 11 abstained,
  0 wrong; real accuracy null; zero accepted/publishable real cases, deficit 100. Promotion false,
  readiness not established, sidecar not measured. This is offline smoke evidence only.
- Parent final scan attempts on BOTH evaluator and test failed Snyk HTTP 401 Unauthorized /
  SNYK-0005. Final Sonar `analyze_file_list` failed MCP startup exit 1. IDE path-flow and complexity
  findings remain untriaged risk; no clean security/quality gate exists.
- MISSING: successful final scan results and finding dispositions. CANNOT ADJUDICATE release or
  security clearance; assuming scanner failure means clean code would falsely favor shipment.
- Three user-labelled cases remain private in ignored storage; publication was denied. No private
  tasks, labels or identity were opened or copied in this pass. The original committed 12-case
  synthetic fixture is unchanged. No private case counts as accepted publication evidence.
- No graph refresh or fresh dependency assurance is claimed; this is record-grounded adjudication.

### Final point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| F-D1 / D-m1 | Fixture reads could inflate real counts or accept hash-linked IDs | Challenge upheld; correction closed | Breadth corrective verification and Depth ownership ledger: shared fixture validation now enforces provenance, unique sources and opaque history-linked IDs | High | Accept local implementation; retain invariants. |
| F-D2 / D-m2 | Export inputs lacked containment and its proof was nondiscriminating | Challenge upheld; code and proof closed | Corrective reviews plus final BR-1 mutation: 19 pass normally, 18 pass / 1 fail with only history containment removed | High | No further containment repair requested. |
| F-D3 / D-m3 | Unvalidated flags hid missing-evidence reasons | Challenge upheld; correction closed | Both corrective reviews: flag read removed, missing held-out/family reasons unconditional, eligibility false | High | Preserve report-only behavior. |
| F-N1 / n1 | Guide overstated re-export reuse | Challenge upheld; correction closed | Breadth corrective verification: reuse qualified to before import; changed selection refuses replacement | High | Accept existing guide correction. |
| F-P1 / BR-1 | History-link test passed without the intended guard | Challenge upheld; proof closed | Breadth final history-specific stderr assertion, correct no-queue targets and exact mutation result | High | Accept discriminating regression proof. |
| F-P1 / BR-2 | History bound admitted 10,001 records without final newline | Challenge upheld; correction closed | Breadth final bound verification and accepted 10,000-record control; final suite 19/19 | High | Accept logical-record bound and its proof. |
| F-P1 remainder | Approved bounds and actual write-failure proof were missing | Challenge upheld; required proof closed by reviewer | Corrective verification covers bounded rejection and post-validation injected atomic-write failure; BR-1/BR-2 subsequently closed | High | Retain reviewer-noted limits, including unexercised rename cleanup, without inventing new gates. |
| Prior B/M/m findings | Earlier defects still imply an Implement return | Current corrected decision holds | Breadth historical closure tables and latest zero-required-findings status; Depth latest PASS | High | Preserve audit history; retire stale current REVISE. |
| F-D4 / D-m4 | Optional names/dead fields/scaffolding cleanup | Challenge upheld as maintainability follow-up; deferred | Depth inventory and corrective note; not reopened by final reviews | Medium | Track the explicitly owned repository follow-up below; no refactor now. |
| F-S1 | Local acceptance or failed scans imply release clearance | Insufficient evidence; BLOCKED | Both final Snyk failures, Sonar startup failure and IDE path-flow/complexity findings | High | Release verification owner must obtain scans and triage results; no waiver. |
| Privacy and denominator | Three private labels imply publication or three accepted cases | Current privacy decision holds | Explicit publication denial; unchanged committed synthetic fixture | High | No import/publication; zero publishable real cases, deficit 100. |
| Calibration / freeze | Local proof establishes real accuracy, readiness or promotion | Current frozen decision holds | Source-root offline baseline and final freeze proof | High | Real accuracy null; promotion false; readiness not established; sidecar not measured. |

### Final accepted changes

- Accept implementation and local proof for the bounded offline workflow, with required D-m1,
  D-m2, D-m3, n1, BR-1 and BR-2 closed. No mandatory implementation correction remains open.
- Update only this task-specific verdict and the brief's current completion boundary. Preserve
  all previous adjudications as history; scope, consent, thresholds and freeze do not change.

### Final rejected challenges

- Reject treating earlier REVISE as current after the discriminating proof and reviewer closure.
- Reject treating passing tests, static PASS, private labels or failed scans as release clearance,
  publishable evidence, measured calibration, promotion or unfreeze approval.

### Final deferred points and owners

- **F-S1: BLOCKED, mandatory; owner: parent execution agent / release verification owner.**
  Coordinate Snyk authentication restoration and Sonar MCP startup recovery with the authorized
  tooling operator; do not request or record credentials here. Obtain successful final Snyk Code
  scans for BOTH evaluator and adjacent test and Sonar `analyze_file_list` for both. Record results,
  triage IDE and scanner path-flow/complexity findings, and route any required repairs and proof
  before release clearance. No automatic credential/configuration change or user assignment is
  authorized. Failed attempts satisfy neither mandatory scan gate.
- **F-D4: OPEN, optional repository-artifact follow-up; owner: future assigned evaluator coding
  agent, assignment to be accepted before work starts.** This F-D4 entry is the tracking artifact;
  it replaces the earlier self-assignment below and does not claim an active assignee or schedule.
  At a future scoped maintenance task, assess unused `legacyCandidates`, the `loadCases` alias,
  redundant checks, inert test scaffolding and `--reviewed`/`--queue` naming. Preserve public CLI
  behavior and validation, prove unchanged behavior with existing tests, and keep guide/parser
  agreement. Do not reopen that cleanup in this cycle. Scanner-confirmed defects belong to F-S1,
  not an optional-cleanup waiver. The user is not assigned this work.
- Future real-case collection needs separate genuine labels and explicit publication consent;
  the present private batch remains denied. Calibration and independent unfreeze evidence remain
  separate future work, not outstanding implementation defects or authorization to collect now.

### Final brief updates and completion boundary

- Current brief status now accepts implementation/local proof and blocks release/security
  verification. Prior REVISE and corrective handoffs remain visibly historical.
- Final Feedback record reconciliation is complete; release/security verification is incomplete.
  No source, test, fixture, config, freeze or private-data edits; no live inference or publication.
- Documentation validation for this pass is reported separately from the attributed runtime
  evidence. It cannot establish security, calibration or release readiness.

### Final response notes

Required repairs and local proof are accepted after independent reviewer closure. The final scan
attempts produced no clearance, so release remains blocked pending F-S1. D-m4 stays an optional,
explicitly tracked maintenance follow-up. Private labels remain unpublishable and uncounted.

## Historical Feedback Verdict Record (superseded)

The following verdict, handoff obligations and ownership describe the earlier cycle only. The final
record above governs current closure, release blockers and F-D4 ownership.

**REVISE: return to Implement. Release proof BLOCKED.** Feedback adjudication is recorded;
implementation acceptance and workflow completion are not established. Depth D-m1, D-m2 and
D-m3 are required Major corrections to the approved contract, despite the reviewers' Minor
classification. No new publication, inference, promotion or unfreeze authority is granted.

### Context sufficiency

- Governing contract: [approved brief](../briefs/decision-calibration-review-workflow-2026-09-28.md)
  and the task-specific APPROVED calibration section of
  [architect challenge](architect-challenge-verdict.md). Its unrelated top-level verdict is not
  evidence for this task.
- Available reviews: [breadth final verify and historical findings](decision-calibration-review-workflow-breadth-2026-09-28.md)
  and [depth gate ledger](decision-calibration-review-workflow-depth-2026-09-28.md).
  Their static PASS verdicts do not override approved requirements or unmet release gates.
- Directly checked: evaluator fixture validation, export reads, containment helper and promotion
  reasons; relevant focused tests; operator guide. This pass changes documents only and does not
  claim a new runtime reproduction or a fresh full code review.
- Parent evidence: independent final focused rerun, 16 passed, 0 failed, 0 skipped. Reviewers
  also record passing sidecar aggregate, freeze invariants, config and documentation checks.
  These results are attributed evidence, not commands rerun by Feedback.
- Latest user/parent evidence: three labels were supplied privately, publication declined, consent
  false. They remain in ignored local storage. This stage did not open, copy or validate that
  private submission. The committed fixture remains 12 synthetic cases, zero publishable or
  accepted committed real cases, deficit 100. Private answers do not authorize import or count
  toward the accepted denominator. Their contents are not needed for these adjudications.
- Graph evidence remains stale by 3 commits / 13 source changes, not refreshed. Findings are
  source-grounded; no fresh dependency-map assurance is claimed.
- Missing release evidence: successful final Snyk scans on BOTH evaluator and test, successful
  Sonar analysis on those files, and resulting finding triage. Parent attempts failed with
  Snyk HTTP 401 / SNYK-0005 on both files and Sonar startup exit 1; neither produced scan results.
  CANNOT ADJUDICATE security/quality clearance; assuming no findings would falsely favor release.
- Missing required proof: the approved size/count boundary and actual atomic-write-failure tests
  still identified by the ledgers. Passing existing tests cannot substitute for them.

### Point-by-point verdicts

Accepted means challenge upheld; rejected means current decision holds; deferred means explicitly
owned unresolved work. Resolved historical findings remain part of the audit, not new open defects.

| # | Feedback point / competing position | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| B1 | Count-only promotion versus frozen/report-only contract | Accepted; resolved for eligibility | Breadth final, hard-false `promotionDecision` | High | Preserve false eligibility; D-m3 separately repairs reasons. |
| B2 | Uncertain wrong high-probability rows omitted from confident-wrong | Accepted; resolved | Breadth re-review, focused regression | High | Preserve wrong-count-before-abstention semantics. |
| M1 | Config and fixture use different roots | Accepted; resolved | Breadth final, rooted loader and unset-environment regression | High | Preserve rooted config and repeated-root rejection. |
| M2 | No next-batch collection path | Accepted; resolved with M2-R | Breadth final, offset and selected queue | High | Retain bounded batching, not a new workflow service. |
| M2-R | Offset drift and duplicate source imports | Accepted; writer fixes resolved | Breadth final synthetic probes and tests | High | Preserve source-anchored selection; close read-time gap under D-m1. |
| M3 | New IDs reveal private source hashes | Accepted; resolved for exports | Breadth final UUID evidence | High | Keep opaque persisted IDs. |
| M3-R | Legacy hash queues can still import | Accepted; resolved for import | Breadth final rejection/unchanged-fixture proof | High | No legacy publication; D-m1 covers fixtures loaded without this writer. |
| M4 | Guide omits required review fields and batch workflow | Accepted; resolved | Current guide, breadth final | High | Retain placeholder-only examples and explicit confirmation. |
| m1 | Offline network-denial test was vacuous | Accepted; resolved | Breadth endpoint-variable and local-stub positive control evidence | High | Do not confuse stub testing with live provider/model evidence. |
| m2 | Import may redirect fixed fixture with `--cases` | Accepted; resolved | Breadth final rejection test | High | Retain fixed import target. |
| m3 | Arbitrary confirmation metadata copied into fixture | Accepted; resolved with m3-R | Breadth fixed-key projection and metadata caps | High | Preserve allowlisted projection. |
| m3-R | Nonboolean family confirmation copied | Accepted; resolved | Breadth final strict-true copy test | High | Retain strict boolean handling. |
| m4 | Duplicated writes and complexity obscure checks | Accepted in part; helper work resolved, cleanup deferred | Breadth helper extraction, depth D-m4 | Medium | Remaining cleanup owned in F-D4 below; scanner findings remain a release gate. |
| m5 | Queue/reviewed ambiguity and conflicting flags | Accepted; conflict resolved, naming deferred | Breadth final rejects both flags; depth D-m4 | High | No unreviewed CLI compatibility change; F-D4 owns remaining naming. |
| m6 | Rooted-config regression inherited the target environment | Accepted; resolved | Breadth final unset-environment test | High | Keep discriminating regression. |
| m7 | Link tests can skip on restricted platforms | Accepted as proof caveat; current run satisfied | Parent/reviewers: 0 skipped | High | New D-m2 link tests must execute on a supported platform; skips are not proof. |
| FYI | Brief says not approved despite approved calibration challenge | Accepted | Task-specific challenge APPROVED section | High | Correct historical approval and current REVISE state, not to completed. |
| n1 | Guide promises repeated export reuse after import changes selection | Accepted; open doc correction | Breadth probe, current guide, export selection comparison | High | F-N1: qualify reuse to unchanged selection; after import conflicts, retain/reuse existing queue. |
| D-m1 | Import-only invariants allow duplicate-source/hash-ID fixture counts; called optional | Accepted; reclassified Major, required | Direct `validateFixture` lacks source/opaque checks; depth synthetic reproduction | High | F-D1 before workflow acceptance; false promotion does not excuse false counts. |
| D-m2 | Export cases/history inputs bypass containment; called optional | Accepted; reclassified Major, required | Direct export reads; depth outside-root probe; Brief Gate 4b | High | F-D2 before workflow acceptance; contained output does not satisfy safe-input requirement. |
| D-m3 | Unvalidated top-level evidence flags suppress missing-evidence reasons; called optional | Accepted; reclassified Major, required | Direct `promotionDecision`, test-only flag, approved report contract | High | F-D3 before workflow acceptance; keep truthful reasons and false eligibility. |
| D-m4 | Dead fields, aliases, repeated checks, overloaded queue naming | Accepted as cleanup; deferred, not a safety waiver | Depth inventory; no demonstrated independent contract violation | Medium | F-D4 self-assigned below; do not block this repair on an API redesign. |
| Proof gaps | Depth treats approved bound/write-failure tests as no longer required | Rejected; approved validation plan holds | Brief validation plan, test inventory, both review ledgers | High | F-P1 closes existing obligations; do not silently lower exit criteria. |
| Release gates | Static PASS or failed scanner attempts imply clearance | Rejected | Parent 401 / SNYK-0005 and startup exit 1, no results | High | F-S1 remains blocked, not clean or security-complete. |
| Privacy | Supplied labels could justify publication or accepted-case counts | Rejected | Latest explicit no-publication instruction | High | Keep private, no import, no raw labels/tasks in tracked artifacts. |
| Readiness | Tool/test completion establishes calibration or unfreeze | Rejected | Approved evidence/freeze contract; no live model proof | High | Preserve freeze; collection, calibration and release remain separate. |

### Accepted changes

Required handoff owner: **Implement stage, evaluator owner**; this record defines the pending work,
not an assertion that a new implementer has executed it. Reuse the existing source and test file.

- **F-D1 (D-m1):** extend `validateFixture` using the existing opaque-ID predicate and a source
  reference set. Require nonempty source linkage for `history-derived` cases; reject duplicate
  nonempty source references across real cases and nonopaque IDs on history-linked cases,
  including `human-labelled` cases carrying handoff provenance. Keep genuine separately confirmed
  non-history human cases valid without invented history references. Preserve the 12 synthetic
  cases. In the existing CLI tests, hand-add two distinct redacted synthetic test scenarios with
  different UUIDs but one source; baseline must reject, not count two. Separately test missing
  history provenance and a legacy hash-shaped ID; valid distinct-source controls must pass.
  Exercise the shared validation through export and import as well, with no writes on rejection.
- **F-D2 (D-m2):** call the existing `assertContained` for `paths.cases` against the repository root
  and for `paths.history` against its canonical runs root before either read in `exportCandidates`.
  This retains contained `--cases` compatibility and adds no path abstraction. Extend the CLI
  containment test with outside-root cases, a linked cases path and linked history file/ancestor.
  Each must fail before creating/changing a queue; history, fixture and outside targets stay
  byte-identical. A normal contained export is the positive control. Record actual link-test
  execution; an unsupported-platform skip cannot establish that branch.
- **F-D3 (D-m3):** remove reliance on `fixture.calibrationEvidence` in `promotionDecision` and retain
  both missing held-out/family evidence reasons unconditionally in this current report-only
  workflow, which has no validated measured-evidence producer. Do not infer calibration merely
  from a held-out case's existence. Update the pure-function test so absent, true and malformed
  top-level flags all leave those reasons present and eligibility false, including an otherwise
  fully matched 100-case synthetic test set. Keep frozen, unavailable and confident-wrong reasons.
  No new live-evidence schema or provider run is required or authorized.
- **F-N1 (n1), owner Implement stage / operator documentation:** qualify the guide's re-export
  sentence to unchanged selection before import; a subsequent changed selection is refused and
  the saved queue is reused. This documents existing safe behavior, not permission to overwrite.
- **F-P1, owner Implement stage / focused proof:** add missing approved boundary tests to the
  existing suite: history and fixture 10 MiB / 10,000 limits; private review/queue 1 MiB and
  100-entry limits; generated-output size rejection; and an actual write/rename failure after
  valid review validation, asserting original fixture bytes unchanged and no partial publication.
  Use isolated synthetic inputs and deterministic failure injection at the file-write boundary,
  not invalid-input rejection renamed as atomic-write proof. Reuse existing coverage where it
  already proves a listed limit. This restores the approved validation plan, not a new policy.
- **F-S1, owner parent execution agent / release verification:** after corrective code is final,
  obtain successful Snyk code scans of BOTH source and test and Sonar `analyze_file_list` for both;
  triage actual results, including existing path-flow/complexity diagnostics. Authentication or
  service startup failure must remain BLOCKED. This does not assign authentication work to the
  user or authorize credentials/configuration changes.

Run the focused evaluator tests after each correction, then the brief's freeze/sidecar aggregate,
config, docs and memory-reference gates. Re-enter Breadth and Depth for the corrected slice, then
Feedback. Actual test results and scanner output must replace pending obligations before closure.

### Rejected challenges

- The reviewers' optional-hardening classification for D-m1 through D-m3 is rejected. Distinct
  counts, input containment and explicit missing-evidence reporting were approved requirements.
  Hard-false eligibility limits immediate promotion risk but does not repair those violations.
- No weakening of the brief, no authenticated-signing requirement, no history digest service,
  no source-retention redesign and no new live calibration policy are needed for these fixes.
- The existing same-selection conflict refusal holds. Qualify documentation rather than allow
  destructive queue replacement. Metadata remains completeness evidence, not authentication.

### Deferred points

**F-D4: OPEN, self-assigned to GitHub Copilot (author of this Feedback record), owning surface
`decision-eval.mjs` and its adjacent test.** Track D-m4 and remaining breadth m4/m5 cleanup here.
At the next evaluator maintenance change, assess/remove unused `legacyCandidates`, pass-through
`loadCases`, redundant validated source checks and inert test environment scaffolding; clarify
`--reviewed` versus `--queue` without silently removing a documented CLI behavior. Acceptance:
unchanged public behavior under existing tests, guide/parser agreement and no weakened validation.
This is explicitly deferred maintainability work, not a claim of scheduled execution or an
assignment to the user. Any scanner-confirmed defect must be triaged under F-S1, not hidden here.

Other depth residuals remain limitations, not speculative new must-fixes: line-index source
references assume immutable history; concurrent import locking and crash-left temporary siblings
are not covered by a new contract in this adjudication. They do not excuse the already required
atomic write-failure proof. Human-review metadata is intentionally not authenticated. Legacy
private queues remain private and unimportable; no migration/publication is authorized now.

### Brief updates

- Record the task-specific architecture approval accurately, followed by this REVISE handoff.
- Preserve scope, privacy rules, thresholds, freeze and all Do NOT constraints unchanged.
- Correct current-state claims: three private labels exist by parent report, no publication
  consent, zero accepted committed real cases. Earlier no-label statements describe the earlier
  implementation pass only, not the final state.
- Record D-m1 through D-m3 and outstanding original proof as required work; update release limits
  with exact failed scan attempts. Approval to implement is not approval to ship.
- Retire uncertainty about this batch's publication choice: it was declined. Real-use label
  content and correctness are not adjudicated here and were not read.

### Completion limits and document verification

- Feedback output and brief conclusions are the only edits authorized in this pass. No source,
  test, fixture, private submission, configuration or freeze changes; no import or publication.
- Existing proof: parent 16/16, zero skips; reviewer aggregate/config/docs success. No new live
  provider/model run, measured calibration, latency/memory proof, readiness or unfreeze.
- Outstanding required actions: F-D1, F-D2, F-D3, F-N1, F-P1, F-S1 and scoped independent re-review.
  The approved workflow is not fully complete; release gates remain blocked with no scan results.
- Focused document check: `npm run harness:memory:references:check` passed (860 Markdown files,
  no missing local targets). Document diagnostics also exposed pre-existing hard-tab warnings in
  the brief's historical proof section; those unrelated lines are unchanged. Document validation
  cannot certify implementation or security.

### Response notes

The three supplied labels remain private and uncounted as publishable cases. Static review and
passing tests are useful evidence, but three existing contract violations and missing approved
proof require a narrow Implement return. Scanners produced no results, so release remains blocked.
The runtime freeze and independent unfreeze requirements are unchanged.
