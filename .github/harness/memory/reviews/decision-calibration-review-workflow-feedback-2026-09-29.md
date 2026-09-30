# Decision Calibration Review Workflow Feedback (2026-09-29)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-review-workflow-2026-09-28.md

## Feedback Verdict Record

**F-D4 CLOSED. IMPLEMENTATION/LOCAL PROOF ACCEPTED. RELEASE/SECURITY VERIFICATION BLOCKED
UNDER MANDATORY F-S1.** This record adjudicates the authorized maintenance follow-up under
[07-FEEDBACK](../../../instructions/07-FEEDBACK.md). No further F-D4 code change or optional
cleanup is requested. This is not a scanner pass, waiver, shipment approval or all-review clearance.

### Context sufficiency

| Available evidence | Decision supported |
| --- | --- |
| [Brief Appendix A](../briefs/decision-calibration-review-workflow-2026-09-28.md) | Approved scope, compatibility contract, preservation constraints and proof obligations |
| [F-D4 Architect Challenge approval](architect-challenge-verdict.md) | Scoped Implement approval, including the bounded legacy-spelling exception; the unrelated top-level challenge is not evidence for this task |
| [Breadth Pass 6 and prior closure ledgers](decision-calibration-review-workflow-breadth-2026-09-29.md) | B1-B5 and subsequent repairs verified; latest overall Breadth has no findings |
| [Final Depth pass after Pass 6](decision-calibration-review-workflow-depth-2026-09-29.md) | Structure PASS; zero Blocker, Major, Minor or Nit; P5-n1 reuse verified |
| [Prior Feedback](decision-calibration-review-workflow-feedback-2026-09-28.md) | Earlier corrective closures, privacy boundary and mandatory F-S1 ownership |
| Parent final handoff | Full aggregate and exact-filter proof, config/docs/references/diff-check passed; no subsequent source/test changes, only review artifacts; latest scanner failures |

The user's request to fix all review findings is satisfied for F-D4 by repairs, not by accepting
optional residuals. This is record-grounded Feedback, not a new source review or inference run.
The reviewers' lack of an isolated F-D4-only diff remains an attribution limit; both reviewed the
end state against Appendix A. No critical evidence is missing for maintainability adjudication.
Fresh graph status is stale by 3 commits / 13 source files, refresh readiness ready; it was not
refreshed and supplies no fresh dependency assurance.

MISSING: successful final Snyk Code scans and Sonar analysis of both code files, automatic-analysis
restoration evidence, and finding dispositions/required repair proof.
CANNOT ADJUDICATE: release/security clearance under F-S1.
ASSUMPTION REJECTED: failed scanner startup/authentication or passing local tests imply clean code.
RISK: that assumption would falsely clear mandatory release gates and untriaged production risks.

### Point-by-point verdicts

| # | Feedback point / competing positions | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| B1 | Different warning text versus the exact approved contract | Challenge upheld; CLOSED by repair | Breadth exact stderr assertion; final Depth warning edge | High | Retain exactly one specified stderr-only warning after argument validation and before reads. |
| B2 | Overloaded queue ownership versus separate report/import inputs | Challenge upheld; CLOSED by repair | Final Depth: `candidateQueue` definition/consumer; reporting reads only `options.reviewed` | High | Preserve one boundary normalization and import naming. |
| B3 / P2-M1 | Weak or vacuous proof versus a named discriminating compatibility test | Challenge upheld; CLOSED by repair | Breadth Pass 5 exact named filter 1/1; raw compact/pretty alias parity and distinct counts; final suite 21/21 | High | Accept the non-vacuous proof; no test rename or extra proof requested. |
| B4 | Missing edge-contract coverage versus Appendix A.7 | Challenge upheld; CLOSED by repair | Breadth closure: unmeasured/all-pending counts, both-spelling failures/conflicts, warning-free imports and source mismatch rejection | High | Preserve existing contract and rejection checks. |
| B5 | Operator guide mismatch versus canonical `--reviewed` | Challenge upheld; CLOSED by repair | Breadth/Depth guide verification: report example, exact warning, both-flag rejection and nondeprecated import `--queue` | High | Accept guide/parser agreement. |
| P2-m1 / P3-n1 | Tests pin raw missing-file path/error code versus allowing F-S1 triage | Challenge upheld; CLOSED by repair | Breadth final error-shape assertion no longer pins `ENOENT` or absolute paths | High | Close test coupling only; production path echo remains F-S1 risk. |
| P2-m2 / P3-m1 | Incomplete or late no-write snapshots versus successful-report proof | Challenge upheld; CLOSED by repair | Breadth snapshots precede successful runs and compare selected-input, fixture/config/history bytes and directory listing; format/count checks retained | High | Accept repaired proof, not the earlier residual. |
| P2-m3 / P3-n2 / P3-n3 | Missing both-spelling error, warning and bounds/link proof | Challenge upheld; CLOSED by repair | Breadth Pass 6 helper enforces exact-once warning before error, no canonical warning, nonzero exit and empty stdout; bounds/link TAP 1/1 with no skip | High | Close coverage gaps; no additional F-D4 tests requested. |
| P2-n1 | Duplicate conflict checks versus single parser ownership | Challenge upheld; CLOSED by repair | Breadth/Depth: one check before normalization; both orders and identical paths reject | High | Retain single check. |
| P2-n2 | Ambiguous import/default wording versus explicit optional selection | Challenge upheld; CLOSED by repair | Breadth guide verification: selects candidate batch, defaults when omitted | High | No further wording cleanup. |
| P4 test complexity / P4-n1 | Complexity and unused helpers versus test-local reuse | Challenge upheld; CLOSED by repair | Breadth Pass 5: helper call sites present, compatibility-test complexity diagnostic gone; final Depth Gate 5 | High | Close this test-maintenance issue only; production complexity is not cleared. |
| P5-n1 | Bounds/link loops duplicate weaker helper checks | Challenge upheld; CLOSED by repair | Breadth Pass 6 and final Depth: all relevant rows call the shared test-local helper | High | No optional duplication debt remains open. |
| F-D4 / D-m4 | Earlier deferred cleanup versus completed authorized maintenance | Current corrected decision holds; CLOSED | Challenge approval, removal/ownership ledgers, Breadth no findings, final Depth PASS and final local proof | High | Supersede prior OPEN/pending status; no more F-D4 changes. |
| F-S1 | Local acceptance versus mandatory release verification | Insufficient evidence; mandatory BLOCKED | Both latest Snyk 401 failures; Sonar MCP startup exit 1 for analysis and disable/re-enable; automatic analysis not restored; untriaged IDE risks | High | Retain owner and recovery obligations below; no pass or waiver. |
| Privacy / freeze | Three private labels or tests imply publication/readiness | Current privacy/frozen decision holds | Explicit publication denial, parent preservation evidence and freeze proof | High | No private read, import, publication, inference or authority change. |

### Final local proof

These are the final reviewer/parent results, not runtime commands rerun in this documentation pass.
No source/test changes followed the parent's final checks; subsequent edits were review artifacts.

| Command / source | Exact result |
| --- | --- |
| `npm run --silent test:harness:decision-sidecar`, final Depth and parent aggregate | Exit 0; policy 5/5, sidecar HTTP 9/9, advisory 8/8, router PASS, backend-openai 14/14, freeze PASS (7 invariants plus negative control), evaluator 21/21 |
| `npm run --silent test:harness:decision-eval`, final Depth; Breadth Pass 6 confirms | 21 tests, 21 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo (todo recorded by Depth) |
| `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs`, Breadth Pass 5 and parent final filter | Named compatibility test selected; 1 test, 1 passed, 0 failed, 0 cancelled, 0 skipped |
| `node --test --test-name-pattern="report bounds and linked review inputs" --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`, Breadth Pass 6 | `ok 1`; 1 test, 1 passed, 0 failed, 0 cancelled, 0 skipped; link branch executed, no `# SKIP` |
| `npm run --silent test:harness:decision-freeze`, final Depth | PASS: 7 invariants plus negative control |
| `npm run --silent harness:config:self-test`, final Depth and parent | PASS |
| `npm run harness:docs:check`, `npm run harness:memory:references:check`, parent final checks | PASS; Breadth Pass 6 separately records `[docs-contracts] OK`, `[memory-references] OK` (863 Markdown files) |
| `git diff --check`, parent final check | PASS |

### Accepted changes

- Accept all corrected F-D4 findings, including minors/nits previously offered as optional. No
  residual was waived to satisfy the request. Earlier functional corrective closures remain closed.
- Add this verdict and append Brief A.11 with the final 21-test proof and F-D4 closure. A.10's
  20-test result predates the bounds/linked-input test and remains accurate historical evidence.
- Update the Brief's current-status pointers; retain earlier challenge, Implement and Feedback
  statements as history rather than silently rewriting past verdicts.

### Rejected challenges

- Earlier OPEN/deferred/pending F-D4 wording no longer governs after final repairs and reviews.
- Keeping the approved legacy report alias is not unfinished cleanup. Literal removal would be
  a separately authorized breaking change; no further optional finding is reopened.
- Local proof, clean scoped reviews and failed scanners do not establish release clearance.
  Test-complexity closure does not dispose of production scanner-class diagnostics.

### Deferred points

**F-S1 remains OPEN, mandatory and BLOCKED. Owner: parent execution agent / release verification
owner, retaining the existing assignment and responsibility for recovery and closure evidence.**

Latest Snyk Code attempts on BOTH evaluator and adjacent test returned HTTP 401; the earlier
record identifies Unauthorized / SNYK-0005. Sonar `analyze_file_list` and automatic-analysis
disable/re-enable attempts failed MCP startup with exit 1. Automatic analysis is still not
restored. These are tool failures, not passes; no scan result or clearance exists from them.
Production path-flow and complexity diagnostics, test path-flow diagnostics, and the raw
missing-file path echo remain untriaged release risks, not waived F-D4 findings.

Recovery/closure requirements:

1. The owner coordinates Snyk authentication and Sonar MCP startup recovery with the authorized
   tooling operator. Do not assign authentication work to the user, request/store credentials,
   change configuration or suppress diagnostics under this Feedback scope.
2. Obtain successful final Snyk Code scans of BOTH
   [evaluator](../../../../scripts/harness/decision-eval.mjs) and
   [test](../../../../scripts/harness/test/decision-eval-test.mjs), plus Sonar analysis of both.
3. Restore Sonar automatic analysis and record successful restoration explicitly. A failed
   toggle or unavailable tool cannot satisfy this requirement.
4. Record scanner and IDE finding dispositions; route required repairs through focused proof
   and appropriate review, then obtain final scan evidence on the resulting files before
   recording F-S1 clearance. Until then, release stays blocked. No scan gate is waived.

This Feedback pass makes no new scanner or automatic-analysis recovery claim. Future consented
collection, held-out calibration and independent unfreeze evidence remain separate work, not
authority to read or publish this batch or reopen optional maintenance.

### Brief updates

- A.11 now governs current F-D4 status and final proof; prior OPEN/deferred assignment and
  pending-stage statements are superseded for this follow-up only.
- No material architecture decision, threshold, scope boundary, consent requirement or Do NOT
  rule changes. No new Implement return is required for F-D4.
- The three user-provided labels stay private, publication-denied, unread and unpublished.
  Zero accepted committed real cases and deficit 100 remain; the 12 synthetic cases are unchanged.
  Fixture/config/freeze are unchanged. No sidecar/model inference, import or publication occurs.
  Promotion remains false, readiness not established and sidecar metrics not measured.
- This pass changes only the two documentation artifacts. Its docs/reference checks and document
  diagnostics validate record consistency, not runtime behavior, scanner clearance or release.

### Feedback document validation

- `npm run harness:docs:check`: `[docs-contracts] OK`.
- `npm run harness:memory:references:check`: 864 Markdown files scanned;
  `[memory-references] OK`.
- Touched-document diagnostics identified pre-existing MD010 hard tabs in the Brief's untouched
  historical sections. They are outside this closure edit and are not a scanner disposition.

### Response notes

F-D4 is closed after all scoped review repairs and final Breadth/Depth approval. Implementation
and local proof are accepted, including the final 21/21 evaluator suite and passing aggregate.
Release remains blocked by mandatory F-S1: both code files still need successful scans, Sonar
automatic-analysis restoration, finding triage and any required repair proof. No more F-D4
changes are requested, and no private labels or frozen policy were touched.
