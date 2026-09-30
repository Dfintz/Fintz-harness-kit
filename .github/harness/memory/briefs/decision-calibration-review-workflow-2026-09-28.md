# Decision Calibration Review Workflow

resource: scripts/harness/decision-eval.mjs, .github/harness/eval/decision-intent-cases.json, .github/harness/memory/briefs/jev-decision-sidecar-freeze-2026-09-25.md, .github/harness/memory/radar/decision-model-workload-calibration.md, .github/instructions/03-ARCHITECT.md, harness.config.json, package.json

## Architecture Brief

### Objective

- Deliver a bounded, offline workflow for realistic maintainer-labelled routing scenarios, extending the existing evaluator. Workflow completion is not collection of 100 labels, calibration completion, or permission to unfreeze.
- Current status: **implementation/local proof accepted; F-D4 CLOSED; release/security verification BLOCKED under mandatory F-S1**, per [follow-up Feedback](../reviews/decision-calibration-review-workflow-feedback-2026-09-29.md) and Appendix A.11. The task-specific architecture challenge approved Implement; subsequent required D-m1/D-m2/D-m3/n1/BR-1/BR-2 corrections and proof remain closed. Earlier REVISE/Implement handoffs and pending F-D4 statuses below are historical, not current. Mandatory scans remain unmet; acceptance is not shipment approval, publication consent, calibration readiness, promotion or unfreeze.

### Scope and boundaries

- Scope: mixed evaluation tooling and operator documentation. Primary boundary: private routing history -> human-reviewed, redacted fixture -> report-only evidence. Runtime routing and model authority are outside this boundary.
- Context inventory: supplied Understand packet owns discovery evidence; `scripts/harness/decision-eval.mjs` owns case loading/scoring/reporting and imports decision-advisory and prompt-router; the fixture owns examples and evidence thresholds; config and the freeze brief own runtime policy; `package.json` owns operator/test commands; the calibration radar entry owns follow-up requirements.
- Direct source findings: `loadCases` checks only a nonempty list; provenance trusts `labelledBy`; eligibility counts human strings and confident-wrong without availability coverage. The 12 fixture cases are model-authored, covering turnkey-coding, multi-agent-orchestration, drop-in-memory, wayfinder, coder, assistant. Supplied Understand found no tests importing the evaluator.
- Supplied graph evidence: stale by 3 commits / 13 source changes; evaluator is newer than snapshot and absent from graph. Revision-time status confirms the same drift but reports refresh readiness ready, superseding the earlier missing-plugin-root observation. Proceed with source-grounded harness design, not a claimed fresh dependency map. Do not change graph configuration in this task.
- Supplied private-history inventory: ignored `.github/harness/runs/handoffs.jsonl` contains 407 records / 389 distinct tasks. Neither prompt text nor recorded routing decisions are ground truth. No raw prompts need to enter this brief or architecture review.
- In scope: candidate export, review-ready JSON, explicit reviewed-only import, schema/provenance checks, offline deterministic baseline, fail-closed evidence reporting, focused tests/docs.
- Out of scope: live comparisons, models/providers, annotation UI, retrieval/compaction/security datasets, tuning, runtime freeze changes. No critical ownership context is missing; actual labels and publication consent are later human gates, not assumptions to fill with agent output.

### Artifacts to create

- `scripts/harness/test/decision-eval-test.mjs` (planned): one adjacent test file for public evaluator/CLI contracts, isolated temporary files and stubbed receipts; needed because evaluator coverage is missing.
- `.github/harness/eval/README.md` (planned): focused operator contract for export, local review, explicit import, offline reporting, privacy and evidence limitations. Reuse an existing equivalent eval guide instead if present; do not create duplicate guidance.
- Ignored `.github/harness/runs/decision-calibration/` artifacts (planned, generated only): `candidates.json` for private local review, operator-selected `reviewed.json` for import, and optional task-free baseline report. Keep any needed source mapping inside local candidate JSON; no separate mandatory manifest or confirmation digest. Never commit these or upload as CI artifacts.

### Artifacts to modify

- `scripts/harness/decision-eval.mjs`: keep validation, candidate lifecycle and evidence reporting with their existing owner; add small importable functions and thin CLI dispatch, not a new framework.
- `package.json`: expose only the focused evaluator test and include it in the existing decision-sidecar test aggregate, already reached by core tests. Use the existing eval command for export, import and deterministic-only flags; no additional workflow commands, dependencies or lockfile changes.
- `.github/harness/eval/decision-intent-cases.json`: append only genuinely maintainer-confirmed, publication-approved redacted cases through explicit import. Preserve all 12 synthetic examples and existing promotion requirements. Without human confirmation, leave this file unchanged.

### Key decisions

- Gate 1, domain alignment: evaluator owns offline evidence; router only supplies predictions and advisory only supplies receipts. No production routing change is necessary.
- Gate 2, generality: bounded case review is reusable across adopting projects, but only intent evaluation needs it now. Keep helpers local; do not build generic annotation infrastructure.
- Gate 3, ownership: history owns source records, maintainer owns expected labels and publication consent, fixture owns accepted cases, evaluator owns validation/counting. An agent or router cannot cross the human-label boundary.
- Gate 4, boundary integrity: export/import/baseline are mutually exclusive offline modes dispatched before transient sidecar-enabling configuration. Baseline uses `planTask` as prediction only; never invoke advisory, handoff writing, or network calls in offline modes, even when environment variables request an endpoint.
- Gate 4b, privacy/safety: raw prompts remain local and ignored. Export projects only allowed fields, never history routing/model predictions, rationale, arbitrary metadata or credentials into labels. Ignored storage is not access control: refuse unsafe paths/symlinks, avoid shared directories, prohibit uploads, and require manual redaction/publication review before any committed case. Automated secret checks supplement, never replace, consent.
- Gate 5, reuse: extend the existing eval CLI, fixture and Node test conventions. Reuse `planTask` without copying routing heuristics. Reject a separate service, UI, command executor, new provider or shared schema subsystem.
- Topology: Producer-Reviewer. Routed Architect produces this brief; independent Challenge returns a verdict; routed Implement produces code/proof; independent Breadth/Depth review and Feedback follow. Parent collects maintainer labels via questions only after a local offline queue exists.
- Routed model identifiers (handoff requirements, not an assertion of actual execution): Understand `claude-opus-5-5`; Architect `gpt-6-astra`; Challenge `gpt-6-sol`; Implement `gpt-5.6-terra`; Review Breadth and Review Depth `claude-opus-5-5`; Feedback `gpt-6-astra`.
- Export contract (planned `--export-candidates`): read local handoff JSONL without modifying it; stable first-occurrence ordering and exact normalized-task deduplication; default 25 candidates, explicit positive limit capped at 100. Cap input at 10 MiB / 10,000 records and each task at 8 KiB; reject exceeded bounds without truncation or partial publication. Report malformed/empty/duplicate counts without prompt text. These are safety bounds, not representativeness guarantees.
- Queue contract: bounded versioned local JSON with stable candidate ID, original task for private review, `expected: null`, `reviewedBy: null`, `reviewedAt: null`, pending status, and a local source reference sufficient to distinguish the originating history record. Stable IDs plus a local record reference prevent source/label confusion; no snapshot digest, separate manifest, signature or trust service is required. Repeated export of the same input/selection is idempotent; refuse conflicting existing output. Strip all predicted labels, even if available in history. No automatic category assignment.
- Review contract: maintainer chooses one of the six existing expected intents, or rejects/defers an ambiguous/out-of-set case; no forced label or seventh intent. Require actual maintainer confirmation of each final redacted task, expected intent and publication decision, with nonempty real-use provenance, reviewer identifier and valid ISO review timestamp. Agents may present questions and record the user's explicit answers, never supply labels, identity or consent themselves. Refused, pending and deferred items remain outside the fixture and accepted denominator.
- Split contract: task-family and train/calibration/held-out annotations are optional during small-batch collection. A genuine confirmed label without them may be imported and counted as collected data, with split/coverage incomplete. Before a case is used as held-out evidence, require predeclared splits and human-checked family separation before examining model predictions; reject leakage as evidence, not the genuine label as collected data. Cases already exposed to predictions cannot be retroactively claimed as held-out. Tags may describe real ambiguous/misleading/contradictory scenarios; agents may not invent usage to fill coverage.
- Import contract (planned `--import-reviewed <file>`): explicitly select a bounded local reviewed submission after the maintainer has confirmed its final contents; selecting a file or populating metadata alone is not confirmation. Any subsequent change to final text, label or publication decision requires renewed confirmation, not a digest ceremony. Validate the entire submission and resulting fixture before writing to the fixed fixture target. Check history-derived IDs/source references against local candidate JSON, reject missing/conflicting provenance, invalid accepted entries and duplicate IDs/tasks within a batch; exclude refused/deferred/pending items and reject an empty accepted submission. Identical already-imported cases are no-ops; conflicting repeats fail. Use atomic replacement only after successful full validation; validation/write failure leaves the original fixture unchanged, with no partial import. Preserve existing fixture fields and all 12 synthetic cases.
- Review trust: nonempty provenance metadata and actual user confirmation are both required, but neither is authentication. Local JSON cannot authenticate reviewer identity or prove consent; this workflow relies on explicit maintainer confirmation in the parent interaction, operator-selected import and later human code review. Agents must never self-assign `reviewedBy`, synthesize confirmation or convert model-authored examples into human evidence. Keep private source mappings local and ignored; committed provenance uses opaque source IDs, not raw prompts, machine paths or raw-source hashes. New non-history human cases require separately confirmed real-use provenance under the same review contract. Authenticated signing is outside scope.
- Baseline contract (planned `--deterministic-only`): validate accepted fixtures, separate synthetic smoke cases from confirmed real cases, and report denominators, accepted real count and deficit to 100, per-intent coverage, deterministic confusion/accuracy/abstention, and split counts including unassigned. Show missing/zero categories and known rejected/deferred counts from the selected local review batch; mark unknown counts unmeasured rather than inventing zeroes. Never include task text. Sidecar metrics are explicitly `not measured`, never successful zeroes. Keep deterministic ordering and no fresh timestamps in comparable output; report reproducibility does not require a provenance digest system.
- Evidence contract: validate schema version, unique IDs, nonempty bounded task, allowed expected labels, real-case provenance and confirmation completeness before counting. Missing/invalid thresholds fail; reject requirements weaker than 100 genuine human/history cases and zero confident-wrong. Accepted human count measures data collection, not readiness, even at 100. Missing splits, family-separation checks or held-out calibration evidence block readiness without blocking collection. Synthetic smoke cases never satisfy human counts or mask real-case errors.
- Report contract: frozen/offline `promotionEligible = false`, with explicit reasons; offline calibration-evidence readiness is `not established` and sidecar metrics are `not measured`. If a readiness boolean is exposed, it is false offline. No offline accuracy or fabricated receipt can establish readiness. For any future measured-evidence gate, require a fully observed genuine labelled set meeting unchanged thresholds, finite policy threshold and receipt probabilities, valid intents/statuses and zero confident-wrong across that set. Invalid, missing or unavailable outcomes make readiness false; uncertain outcomes remain abstentions, not confident successes. This specifies fail-closed semantics only, not a new live evaluation workflow.
- Independent unfreeze gates remain unchanged: durable permissively licensed compatible sourcing, pinned model/readout, `jevcompat` conformance, held-out workload calibration, real latency/memory proof, rollback proof, fresh architecture and explicit human approval. Data collection and even future evidence readiness do not satisfy these gates automatically; missing evidence stays not established.

### Small-batch operator path (planned)

1. Use the existing eval CLI's `--export-candidates` mode with a small positive limit to produce the canonical ignored local `candidates.json`; no minimum collection batch or mandatory splits.
2. Review selected real tasks locally. The parent asks the maintainer for final redacted text, expected intent and publication approval per case; record only explicit answers in local `reviewed.json`. Defer or reject uncertain cases. Add split/family annotations only when planning eligible held-out evidence before predictions are seen.
3. Explicitly select the confirmed submission with `--import-reviewed <file>`; validate and atomically import accepted cases only. Do not automatically import the queue or upload the review files.
4. Use `--deterministic-only` on the resulting fixture; report collected count, deficit, coverage gaps and deterministic baseline, with promotion false, sidecar metrics not measured and readiness not established. No endpoint, network or sidecar calls are needed or authorized anywhere in this path.

### Constraints

- Preserve `enabled: false`, `mode: shadow`, `freeze.status: frozen`, freeze criteria and all existing guardrails/tests. Retain decision code, fixtures and tests; no new promotion authority, second provider/failover or machine-specific model pin. Do not lower or silently default away the 100-case or zero-confident-wrong requirements.
- Canonical private output root: `.github/harness/runs/decision-calibration/`, already under the ignored runs subtree. Keep generated candidates, reviewed submissions and any saved baseline reports there; reject traversal and symlink escape on input/output resolution, including the fixed fixture target. Candidate/review JSON and saved reports are capped at 1 MiB each and candidate/review batches at 100 entries; tasks are capped at 8 KiB. History and existing/resulting fixture reads are capped at 10 MiB / 10,000 records or cases. Enforce bounds before publication/write and reject overflow without truncation or partial results. No raw-task stdout, reports, exceptions or committed source mappings; require human publication review of final text before import. Source history is immutable. Containment and bounds are local safety checks, not a new trust system.
- Preserve legacy synthetic fixtures as smoke evidence; human/history assertions lacking complete confirmation metadata fail closed. Counts are distinct accepted real scenarios, not handoff frequency or copied variants. Maintainer family review mitigates paraphrase duplicates beyond exact deduplication.
- Risk-first sequence after independent re-challenge: (1) review/provenance validation and fail-closed reporting with adversarial tests; (2) bounded local export and atomic idempotent import; (3) offline baseline/docs; (4) parent obtains a small batch of real labels and explicit publication consent, then controlled import and baseline proof. Stop if the confirmation contract cannot be met; lack of calibration splits does not prevent collection.
- Preserve unrelated working-tree changes, including package-lock changes, prior radar edits and untracked briefs/prompts. All code work is delegated to the routed implementer after challenge; this stage does not collect or approve labels.

### Validation plan

- Architect exit: immediately after writing this brief, run `npm run harness:memory:references:check`; use narrow Markdown diagnostics if unrelated repository reference failures prevent a clean global result. Report actual output; this validates the document, not design approval.
- Falsifiable implementation hypothesis: existing evaluator boundaries suffice for offline collection and deterministic baseline without network or runtime changes. Disconfirm with CLI tests that deny all network/advisory calls under populated endpoint environment variables; import must leave config/history byte-identical.
- Planned focused check: `node --test scripts/harness/test/decision-eval-test.mjs`. Exercise public evaluator/CLI contracts: export determinism/blinding, malformed JSONL, every input/output bound, unsafe paths, input immutability, empty submissions, missing confirmation, invalid intent/date/provenance, duplicate conflicts, rejected/deferred cases, atomic validation/write failure and repeated-import no-op. A small confirmed batch without splits must import and increase only the collection count; missing splits/calibration and family leakage must block readiness. Tests validate metadata and recorded confirmation requirements, not actual reviewer identity; human review checks renewed confirmation after edits.
- Regression matrix: absent/weakened thresholds, forged-by-omission human metadata, small batches and 99 versus 100 distinct confirmed cases, confident-wrong, all/partly unavailable, missing observations, null selection, invalid/NaN/out-of-range probability, empty evidence, synthetic-only fixture and frozen policy. Assert offline/frozen `promotionEligible = false`, offline readiness `not established` (false if boolean) and sidecar metrics `not measured`, including at 100 collected labels. Fabricated test receipts test future fail-closed plumbing only, never supply calibration evidence or make offline readiness true. Deny network/advisory calls in each offline CLI mode even with endpoint environment variables populated.
- Baseline proof: two runs on identical fixture/config/local-review inputs produce identical reports; predictions never populate expected labels; original 12 cases remain smoke-only; sidecar metrics are not measured. Report accepted count/deficit, per-intent and unassigned-split coverage, missing categories and known deferred counts. Human review checks actual confirmation, publication consent, local source linkage and real-case plausibility independently of passing tests.
- Implement regression gates: `npm run test:harness:decision-freeze`, `npm run test:harness:decision-sidecar`, `npm run harness:config:self-test`, `npm run harness:docs:check`, and memory references check for documentation changes. Run required code security/quality checks on final changed code. No live inference is needed or authorized.
- Workflow acceptance: bounded local review JSON, explicit maintainer-confirmed import, deterministic baseline and negative gate tests pass through the existing CLI. Report genuine accepted count and deficit to 100 explicitly; tooling may complete with zero labels, or collection with a small batch, but neither establishes readiness. Request independent re-challenge of this revised brief before Implement; documentation validation is not approval.

### Do NOT

- Treat router intent, source frequency, agent-authored review metadata or synthetic labels as maintainer ground truth; expose predictions before human labelling; silently label out-of-set tasks.
- Commit/export raw private history to shared surfaces, print prompts in diagnostics, upload queues, automatically import a whole queue, or overwrite conflicting cases.
- Enable inference, download models, add providers/dependencies/infrastructure, modify runtime routing/freeze policy, or weaken independent promotion requirements.
- Claim 100 labels collected, calibration proven, promotion approved, a fresh graph, or an independently challenged architecture without the corresponding evidence.

### Assumptions and risks

- [UNVERIFIED] History inventory and graph drift are supplied Understand observations, not remeasured here; they constrain confidence, not labels. Input growth beyond bounds must fail with a local batching instruction.
- [UNVERIFIED] History contains enough diverse, redaction-safe real tasks. If not, maintainers must provide additional genuine scenarios; do not pad with synthetic cases or relax 100.
- Latest parent evidence: three labels supplied privately with publication consent false. This batch is not authorized for publication or import; zero accepted committed real cases remain. The private contents were not read during Feedback, and no labels or task text belong in this brief. Availability/rights for any future batch remain unverified.
- Nonempty metadata permits completeness checks, not identity verification. Actual user confirmation is mandatory but also not authentication; a local writer can fabricate assertions. Explicit reviewed import and independent human review are the proportionate boundary. Mandatory digest/private-manifest ceremony was rejected because it adds workflow without authenticating the reviewer or proving consent.
- Redaction can change intended classification, so final redacted text must be relabelled/confirmed, not inherit a pre-redaction answer. Source references stay in ignored local candidate JSON until source review is complete; missing/conflicting traceability blocks that history-derived import, without requiring a separate archive/manifest service.
- Exact deduplication cannot prove semantic independence; human family review prevents padding with copied variants. Split/family annotation may be deferred for collection, but valid predeclared held-out separation and calibration evidence cannot be deferred for readiness. Zero observed confident-wrong on 100 cases is not a guarantee of zero future risk.
- The task-specific independent re-challenge approved the design for Implement. Parent-led review subsequently recorded three private labels without publication consent; no agent supplies or changes that consent. Final Feedback accepts the reviewer-closed implementation repairs and local proof; release/security verification remains blocked. Splits/calibration and independent unfreeze gates remain unestablished. See the final conclusions below.

## Implementation Proof (2026-09-28)

Historical implementation-stage record. No-label/no-review statements below describe that pass;
the later parent evidence and Feedback conclusions at the end govern current status.

### Delivered

- Extended `scripts/harness/decision-eval.mjs` with mutually exclusive offline candidate export,
	reviewed import, and deterministic-only reporting paths. Offline paths do not enable advisory
	evaluation or contact an endpoint. Candidate export is bounded, stable, blinded, and writes only
	to the ignored canonical calibration directory. Import rejects incomplete, pending, conflicting,
	duplicate, unsafe, or unconsented accepted entries before an atomic fixture replacement.
- Added `scripts/harness/test/decision-eval-test.mjs`, package wiring, and the focused eval operator
	guide. The existing 12 synthetic fixture cases were not changed. No human/history labels,
	reviewer identity, publication consent, or reviewed submission was created.
- Generated the first private candidate queue only after the focused test passed. It contains 25
	candidates; its task text remains in ignored local storage.
- Breadth-review remediation keeps promotion report-only and false in every evaluator path. It adds
	fail-closed reasons for frozen, incomplete, unavailable, uncertain, missing held-out, and missing
	family-separation evidence; no local condition automatically satisfies independent unfreeze gates.
- Private queue batches can advance through `--offset` and explicit `--queue` selection while legacy
	`candidates.json` remains readable. New candidate IDs are persisted opaque UUIDs, never task hashes.
	No private review record, maintainer label, consent decision, or fixture import was created by this
	remediation.

### Proof Summary

- `npm run test:harness:decision-eval`: PASS.
- `npm run test:harness:decision-freeze`: PASS (7 invariants and negative control).
- `npm run test:harness:decision-sidecar`: PASS, including policy, HTTP, advisory, router, backend,
	freeze, and evaluator coverage.
- `npm run harness:config:self-test`, `npm run harness:docs:check`, and
	`npm run harness:memory:references:check`: PASS.
- Repo-scoped `--deterministic-only --json`: 12 smoke cases, 0 accepted real cases, deficit 100,
	promotion false, readiness not established, sidecar metrics not measured.

### Self-Review and Remaining Risks

- The frozen runtime/config/routing paths and 12 original smoke cases remain unchanged.
- Sonar MCP could not start in this environment and Snyk authentication failed, so mandatory
	generated-code scans could not run. Local static diagnostics still flag path-flow and complexity
	warnings in the new evaluator; no suppression was added. A follow-up security review should
	assess those findings against the local containment/atomic-write helpers.
- This is implementation proof only. It does not claim final independent review, actual maintainer
	confirmation, accepted real labels, calibration evidence, readiness, promotion, or unfreeze.
- The human-labelled corpus remains incomplete unless independently evidenced in the committed fixture;
	nothing in this proof asserts otherwise.

## Historical Feedback Conclusions (2026-09-28; superseded)

This earlier Implement return is preserved as audit history. Final Feedback Conclusions below
govern current acceptance, remaining release blockers and optional follow-up ownership.

Verdict: **REVISE; return to Implement. Release proof BLOCKED.** See the
[point-by-point Feedback record](../reviews/decision-calibration-review-workflow-feedback-2026-09-28.md)
for accepted, rejected and explicitly owned deferred findings. Static reviewer PASS is preserved
as historical evidence, not adopted as final acceptance.

D-m1, D-m2 and D-m3 are required Major corrections under this existing brief: validate distinct
source provenance and opaque history-linked IDs at fixture read/count boundaries; contain export
fixture/history inputs before reading; stop unvalidated top-level flags hiding missing-evidence
reasons. Keep report-only eligibility false. No new live calibration mechanism is authorized.

Complete the existing approved bounds and actual atomic-write-failure tests; do not silently
waive them. Qualify export-reuse wording per breadth n1. D-m4 cleanup is explicitly self-assigned
and tracked as deferred in the Feedback record, not assigned to the user.

Latest parent rerun: 16 tests passed, 0 failed, 0 skipped. This is parent-provided proof, not a
Feedback rerun. The unchanged committed fixture has 12 synthetic cases, 0 accepted real cases
and deficit 100. Three supplied labels remain private in ignored storage with consent false;
none is publishable, imported or counted toward the accepted corpus. Feedback did not read them.

Parent attempted Snyk code scans on BOTH final evaluator source and test; both failed HTTP 401 /
SNYK-0005. Sonar `analyze_file_list` failed at startup with exit 1. No actual scan results exist
from those attempts; mandatory security/quality gates remain unmet, not clean or complete.
The parent execution agent owns final scan/triage proof after repairs; no credentials or service
configuration changes are authorized by this conclusion.

No live provider/model run occurred. Freeze remains unchanged; readiness/calibration and all
independent unfreeze evidence remain not established. Graph evidence is still stale by 3 commits /
13 source changes and was not refreshed. This is source-grounded adjudication only.

Scope, thresholds, human consent boundary and Do NOT rules are unchanged. Required repairs and
proof return through Implement, scoped Breadth/Depth, then Feedback before completion is claimed.

## Corrective Implementation Proof (2026-09-28)

- Implemented F-D1 through F-D3 and F-N1 in the evaluator, focused test suite, and operator guide.
	Fixture validation now requires unique real-case source references, history source linkage, and
	opaque IDs for history-linked records. Export contains cases and history inputs before reads.
	Report-only promotion remains false and always reports held-out and family evidence as not
	established, irrespective of caller-supplied fixture flags.
- Added the approved bounded-proof coverage: 10 MiB and 10,000-record fixture/history inputs,
	1 MiB and 100-entry review inputs, generated fixture-output rejection, and an injected
	post-validation atomic-write fault that preserves fixture, history, and configuration bytes.
	The link branch executed without a skip on this Windows workspace.
- `npm run test:harness:decision-eval` passed: 19 tests, 0 failed, 0 skipped.
	`npm run harness:memory:references:check` passed: 860 Markdown files, no missing local targets.
- This proof does not establish final review, release readiness, calibration, promotion, unfreeze,
	Snyk clearance, or Sonar clearance. The parent-owned scanner attempts remain blocked by the
	recorded authentication and startup failures; no scan result is claimed here.

## Final Feedback Conclusions (2026-09-28)

Verdict: **implementation/local proof accepted; release/security verification blocked.** The
[final point-by-point Feedback record](../reviews/decision-calibration-review-workflow-feedback-2026-09-28.md)
supersedes the earlier REVISE handoff without removing its history. Full stages were routed
separately; this final pass is Feedback only, not a new review or implementation cycle.

- Required D-m1, D-m2, D-m3 and n1 corrections are closed in the corrective reviews. Final
	Breadth closes BR-1 and BR-2 with zero required findings; latest Depth remains PASS for structure.
	The previously required bounds/write-failure proof is accepted within the reviewers' stated
	limits. No additional mandatory implementation correction or optional refactor is requested.
- Reviewer final focused suite: 19 passed, 0 failed, 0 skipped. Exact mutation removing only
	history containment: 18 passed, 1 failed, confirming the regression detects the missing guard.
	Parent final freeze: seven invariants plus negative control passed. These are attributed
	reviewer/parent results, not commands rerun by final Feedback.
- Parent final offline source-root-config baseline: 12 synthetic, 1 correct, 11 abstained,
	0 wrong; real accuracy null. Original committed 12 synthetic cases unchanged, zero publishable
	or accepted real cases, deficit 100. Three supplied labels remain private in ignored storage,
	publication denied. Final Feedback did not read/copy private tasks, labels or identity.
- Promotion remains false, readiness not established and sidecar not measured. No live model
	evidence, calibration completion, runtime authority change or unfreeze is established.
- BOTH final evaluator and test Snyk scans failed HTTP 401 Unauthorized / SNYK-0005; final Sonar
	`analyze_file_list` failed MCP startup exit 1. IDE path-flow and complexity findings remain
	untriaged release risk, not a clean quality gate. Mandatory scans are not waived.
- **F-S1 owner: parent execution agent / release verification owner.** Coordinate recovery with
	the authorized tooling operator, obtain successful final Snyk scans and Sonar analysis of both
	files, record finding dispositions and complete any required repair proof before clearance.
	This does not authorize credential/configuration changes or assign the user remediation work.
- **F-D4 owner: future assigned evaluator coding agent, assignment pending acceptance.** Optional
	names/dead-fields/scaffolding cleanup remains explicitly tracked in the Feedback F-D4 repository
	artifact; the historical self-assignment is superseded. No execution or schedule is claimed,
	no user assignment is made, and scanner-confirmed defects cannot be deferred under this label.

Completion boundary: final Feedback reconciliation and implementation/local-proof acceptance are
complete; release/security verification remains blocked. Future consented collection, held-out
calibration and independent unfreeze gates are separate, unestablished work. Source, test, fixture,
configuration and private data are untouched by this docs-only pass. Scope, thresholds, consent
boundary, freeze and Do NOT rules remain unchanged. Document validation cannot certify release.

## Appendix A: F-D4 Maintenance Amendment (2026-09-29)

**Current conclusion: F-D4 CLOSED; mandatory F-S1 BLOCKED.** See A.11 and the
[follow-up Feedback verdict](../reviews/decision-calibration-review-workflow-feedback-2026-09-29.md).
A.1-A.10 preserve the decisions and proof available at their respective stages; their pending
challenge/implementation language and 20-test count are historical, not current status.

### A.1 Objective

- Address all five remaining F-D4 maintainability findings under the user's explicit follow-up
  authorization. This reopens the previously deferred cleanup, not the closed corrective findings.
- Architect decision: **APPROVED for submission to Architect Challenge only**. Independent
  challenge is pending; this is not approval to Implement, finding closure, or release clearance.
  Prior implementation/local-proof acceptance and every unchanged decision above remain valid.
  This appendix governs the newly authorized F-D4 scope; prior no-refactor statements describe
  the completed cycle, not a restriction on this follow-up.

### A.2 Scope and boundaries

- Scope: evaluator maintainability and its existing CLI test/operator contract. Primary boundary:
  CLI argument normalization into separate import-candidate and report-review inputs.
- Context inventory: current `03-ARCHITECT` owns this stage contract; this final brief owns prior
  decisions; [final Feedback F-D4/F-S1](../reviews/decision-calibration-review-workflow-feedback-2026-09-28.md)
  owns compatibility and release obligations; [Depth D-m4](../reviews/decision-calibration-review-workflow-depth-2026-09-28.md)
  enumerates the five cleanup targets. The supplied Understand handoff and its retained summary
  above provide the impact packet; no standalone task-specific Understand artifact was located.
  Direct reads of evaluator, adjacent test and eval guide corroborate each target. No critical
  ownership decision depends on an unavailable artifact; do not claim a separate packet was read.
- Fresh `npm run --silent harness:graph -- status`: stale by 3 commits / 13 source files,
  refresh readiness ready. Source-grounded design only, not fresh graph assurance. No refresh or
  graph configuration change is part of this amendment.
- Current owner evidence: `parseArgs` retains separate `queue` and `reviewed` fields;
  `deterministicBaseline` combines them with `options.queue ?? options.reviewed`;
  `importReviewed` consumes `paths.queue`. The guide documents both report spellings. The
  accepted loop repeats the source existence/equality guard already enforced for every entry by
  `validateReviewedEntries`; `loadCases` only forwards to `loadValidatedCases`;
  `legacyCandidates` is unused; `evaluatorEnv` sets an unconsumed `HARNESS_REPO_ROOT`.
- Architect edits only this existing brief. Subsequent implementation is limited to the evaluator,
  adjacent test and existing eval guide. F-S1 remains mandatory but blocked, not maintenance debt.

### A.3 Artifacts to create

- None. Reuse the current brief, test helpers and operator guide; no new command, framework,
  migration, dependency, prompt surface or broad documentation artifact.

### A.4 Artifacts to modify

- `scripts/harness/decision-eval.mjs`: remove `pathsFor().legacyCandidates`; remove `loadCases`
  and call `loadValidatedCases` directly at its existing call site. Delete only the repeated
  source existence/`sourceRef` equality guard inside the accepted loop, keeping its source lookup
  for projection/deduplication and the preceding whole-batch `validateReviewedEntries` call.
  Preserve all duplicate, consent, intent, metadata, fixture and write validation.
- Same evaluator: normalize the legacy report flag at the existing CLI dispatch boundary, then
  let `deterministicBaseline` consume only `options.reviewed`. Name the import-only resolved path
  `candidateQueue` instead of `queue` at its definition and consumer. No generic mode framework.
- `scripts/harness/test/decision-eval-test.mjs`: remove only the explicit `HARNESS_REPO_ROOT`
  assignment in `evaluatorEnv`. Preserve `HARNESS_PROJECT_ROOT`, its unset-root control, endpoint
  overrides, `--repo-root` isolation and the existing atomic-write fault hook. Extend this suite
  with the contract checks below; do not create a second suite or broaden fault-injection work.
- `.github/harness/eval/README.md`: make `--reviewed` the normal report example and document the
  deprecated report alias and warning. Retain import `--queue`, default candidate selection,
  format/count semantics and privacy instructions. No root README or other guide expansion.

### A.5 Key decisions

- **Gate 1, domain alignment: PASS.** Cleanup stays with offline evaluator, CLI and its tests/guide;
  production router, decision policy and advisory behavior are unchanged.
- **Gate 2, generality: PASS.** This is one existing CLI compatibility conversion, not a reusable
  argument framework. Add no generalized deprecation registry or cross-tool mode abstraction.
- **Gate 3, ownership: PASS.** CLI dispatch owns legacy spelling conversion; reporting owns review
  status counts; import owns candidate linkage. Shared validators remain the validation owners.
  Fixture acceptance, maintainer labels and publication consent keep their existing owners.
- **Gate 4, boundary integrity: PASS with explicit compatibility exception.** Mode dispatch is
  enough to resolve what a legacy invocation means, but alone does not fix the overloaded name.
  The canonical contract has distinct concepts: `--queue` selects import candidates and
  `--reviewed` selects report review data. Normalize legacy report `--queue` once, warn, and do
  not propagate a dual-purpose queue field into report logic. This accepts the historical spelling
  as compatibility, not as a second preferred contract; literal elimination requires a separately
  authorized breaking change and is not claimed by this amendment.
- **Gate 4b, privacy/safety: PASS.** Keep containment, links, bounds, fixed import target, atomic
  writes, full-batch validation and fail-closed reporting intact. Warnings contain flag names only,
  no paths, tasks, labels or reviewer data. Tests use isolated invented test inputs, not private
  labels. No inference, publication or changed authority is authorized.
- **Gate 5, reuse: PASS.** Reuse `loadValidatedCases`, `validateReviewedEntries`,
  `loadReviewSubmission`, current CLI dispatch and existing temporary-root helpers. Remove wrappers
  and dead fields without exporting new APIs or extracting another layer.
- Topology remains Producer-Reviewer. The existing routed Architect/Challenge/Implement/review
  sequence applies; route identifiers are requirements, not proof a model or challenge ran.

#### Exact command contract

| Invocation | Meaning and required behavior |
| --- | --- |
| `--import-reviewed <submission> --queue <candidates>` | Canonical import: explicit source candidate queue, no deprecation warning. Omitted `--queue` still selects the existing default `candidates.json`. |
| `--deterministic-only --reviewed <batch>` | Canonical report: status counts from this local review batch, no deprecation warning. No fixture import. |
| `--deterministic-only --queue <batch>` | Supported deprecated report alias; normalize to the same reviewed input and preserve exit status, validation and stdout. Emit exactly one warning line on stderr after argument validation, before report input reads. |
| `--deterministic-only` | No selected batch; accepted/deferred/rejected remain `"unmeasured"`, not zero. |
| Both `--queue` and `--reviewed` | Preserve the existing error, in either argument order and even for identical paths; reject before reads/writes, with no deprecation warning. |

- Exact warning: `[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.`
  Follow it with a newline. For an invalid legacy report input, this warning precedes the existing
  error; exit remains nonzero and stdout contains no report. This additive stderr warning is the
  only intentional compatibility-visible change. No removal version or automatic migration.
- Both report spellings use the same bounded versioned `{schemaVersion: 1, candidates: [...]}`
  submission reader, not file-name guessing or content-based mode inference. A valid all-pending
  exported queue is valid report input with three zero status counts, not an invalid submission.
  Missing files, malformed JSON/schema, invalid entries/statuses, exceeded bounds and unsafe paths
  still fail. Never silently fall back to unmeasured counts or a different candidate file on error.
- Counts describe selected-batch statuses, not validated publication or imported corpus size.
  Preserve the existing report schema, key ordering, compact JSON without `--json`, pretty JSON
  with `--json`, and final newline. Warnings never enter stdout or the report object.
- Do not introduce new mode restrictions for previously ignored standalone `--queue`/`--reviewed`
  options outside their consuming modes. Preserve those existing no-op behaviors and the global
  two-flag conflict check; they neither select a new mode nor cause a new file read. Deprecation
  applies only to `--queue` with `--deterministic-only`.
- Rejected alternatives: dropping/rejecting the documented report alias breaks Feedback's public
  behavior constraint; merely switching examples leaves overloaded internal state; renaming the
  candidate flag and retaining another alias adds vocabulary without removing compatibility debt.
  Removing every historical dual spelling is incompatible with the current preservation rule.

### A.6 Constraints

- Keep fixture, config, router, freeze and all labels byte-identical. Retain disabled/shadow/frozen
  policy, 100-case and zero-confident-wrong thresholds, promotion false, readiness not established
  and offline sidecar metrics not measured. Preserve the 12 committed synthetic cases, zero
  accepted real cases and deficit 100. Three private labels remain publication-denied and unread.
- Preserve unrelated working changes. Do not redesign source retention, locking, authentication,
  validation schemas or atomic failure injection under this narrow cleanup.
- F-D4 is authorized and assigned to the routed evaluator Implement stage after independent
  Challenge approval; this does not claim an implementer has started. Challenge must explicitly
  accept the bounded legacy-spelling exception before F-D4 can be closed by later review/Feedback.
- F-S1 remains **BLOCKED**: recorded final Snyk Code attempts on BOTH evaluator and test failed
  HTTP 401 Unauthorized / SNYK-0005; Sonar `analyze_file_list` failed MCP startup with exit 1.
  No scan results or dispositions exist; IDE path-flow/complexity findings remain untriaged.
  Parent execution agent / release verification owner retains recovery and final-scan ownership.
  No waiver, credential/configuration change, suppression or reassignment to the user is authorized.

### A.7 Validation plan

- Falsifiable hypothesis: one CLI-boundary normalization can retain documented report behavior
  while removing queue overloading from reporting; shared validation makes the four mechanical
  deletions behavior-neutral. Disconfirm with a changed report, warning on the canonical path,
  accepted invalid source linkage, changed root selection or changed import outcome.
- Cheapest new discriminating test: in the existing suite, add a `reviewed report compatibility`
  test using one temporary mixed-status batch (one accepted, two deferred, three rejected, one
  pending). Compare canonical and alias runs: counts exactly 1/2/3, identical stdout bytes, exit
  zero, canonical stderr empty and alias stderr exactly the warning above. Run it first with
  `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs`.
- Cover both compact and pretty JSON including the trailing newline; assert parseable stdout,
  unchanged fixture-derived human count/deficit, no task/reviewer/source fields in the report,
  no writes and identical repeated output. Also cover no-batch unmeasured counts and all-pending
  queue zero counts. Use synthetic test metadata only; report accepted status is not import consent.
- For BOTH report spellings, test missing file, malformed JSON, wrong schema/list shape, invalid
  entry/status, byte/count overflow, traversal and link rejection with positive controls. Assert
  nonzero exit, specific relevant error, empty stdout and unchanged fixture/config/history bytes;
  legacy paths additionally warn once. Retain both-flag rejection in both orders, without warning.
- Retain explicit/default import-queue success, wrong/missing source rejection and unchanged bytes
  on failure. Add accepted `sourceRef` mismatch coverage that specifically fails in
  `validateReviewedEntries` after the repeated guard is removed; retain duplicate-source checks.
  Re-run the unset-`HARNESS_PROJECT_ROOT` test after removing the inert override. Existing offline
  network-denial and atomic/bounds checks remain required, with no skips counted as proof.
- Risk-first implementation: lock down report compatibility/count/format checks, implement the
  small dispatch normalization and guide adjustment, then make the four mechanical deletions.
  Run the narrow test after the first substantive change and the focused suite after each slice.
  Run `npm run test:harness:decision-eval`, `npm run test:harness:decision-freeze`,
  `npm run test:harness:decision-sidecar`, `npm run harness:config:self-test`,
  `npm run harness:docs:check` and `npm run harness:memory:references:check` before local closure.
- Architect exit proof: immediately after this appendix edit, run memory-reference and docs checks;
  report results and changed-document diagnostics, distinguishing existing warnings. These prove
  document consistency only, not the unimplemented CLI contract. Independent Architect Challenge
  is next; no implementation or self-issued challenge approval in this turn.
- After Implement, obtain scoped Breadth/Depth and Feedback disposition of F-D4. Release still
  requires successful final Snyk scans of both code files, Sonar analysis of both and finding
  triage/repair proof under F-S1. Passing tests/docs or scanner startup failures cannot replace it.

### A.8 Do NOT

- Silently remove the documented `--queue` report command, change its counts/schema, swallow
  invalid inputs, add a warning to JSON stdout, or present retained alias debt as total removal.
- Weaken validators to simplify import, replace consent with status counts, touch private review
  files, change labels/fixture/freeze, run live inference or expand into scanner-driven refactoring.
- Declare all findings fixed or release verified while implementation, independent challenge,
  review or mandatory scans are outstanding.

### A.9 Assumptions and risks

- [UNVERIFIED] Some external scripts may treat any stderr as fatal. The warning is an explicitly
  chosen additive compatibility change; canonical `--reviewed` is warning-free. No behavior or
  output-format change beyond that warning is accepted. Challenge must evaluate this tradeoff.
- Literal dual spelling remains only for backward compatibility; an absolute ban would require
  REVISE and separate authorization to retire the documented alias, not a silent implementation
  choice. No such breaking change is proposed or required for this maintainability amendment.
- Graph staleness limits dependency assurance. Direct source and focused regressions, not absence
  from the graph, justify local deletion. Retained Understand evidence is not a fresh full map.
- Scanner recovery is outside this Architect scope and remains unverified. **APPROVED for
  Architect Challenge; awaiting independent verdict. Implementation and release are not approved
  by this appendix.**

### A.10 F-D4 Implementation Proof (2026-09-29)

- Report-mode `--queue` now normalizes to `--reviewed`, emits the specified stderr-only warning,
  and leaves canonical reports warning-free. Import keeps `--queue` as the candidate-batch input,
  including its default `candidates.json` selection.
- The evaluator names the import-only resolved path `candidateQueue`; report counting reads only
  `options.reviewed`. The focused suite covers compact and JSON alias byte parity, status counts,
  no-batch/all-pending semantics, missing-file and conflict behavior, warning-free imports, and
  accepted source-reference mismatch rejection.
- `npm run test:harness:decision-eval`: PASS (20 tests, 0 failed, 0 skipped).

This implementation proof does not claim independent review, feedback closure, release clearance,
or Snyk/Sonar results. F-S1 remains blocked as recorded above.

### A.11 Final F-D4 Feedback and Proof (2026-09-29)

Verdict: **F-D4 CLOSED; implementation/local proof accepted; release/security verification
BLOCKED under mandatory F-S1.** The
[follow-up Feedback record](../reviews/decision-calibration-review-workflow-feedback-2026-09-29.md)
governs current status, superseding earlier open/deferred F-D4 ownership and pending-stage
statements without erasing their audit history.

- The [F-D4 Architect Challenge](../reviews/architect-challenge-verdict.md) approved the bounded
  legacy report spelling exception. [Breadth Pass 6](../reviews/decision-calibration-review-workflow-breadth-2026-09-29.md)
  has no open findings; [final Depth](../reviews/decision-calibration-review-workflow-depth-2026-09-29.md)
  passes structure with zero Blocker, Major, Minor or Nit. B1-B5, P2-M1, P2-m1/m2/m3,
  P2-n1/n2, P3-m1, P3-n1/n2/n3, P4-n1 and P5-n1 are closed by repair, not waiver.
  Test complexity and helper duplication are resolved within this maintainability scope.
- Final reviewer and parent proof: evaluator **21 tests, 21 passed, 0 failed, 0 cancelled,
  0 skipped** (final Depth also records 0 todo). A.10's 20-test result predates the added
  bounds/linked-input test. Exact `reviewed report compatibility` filter: **1 test, 1 passed,
  0 failed, 0 cancelled, 0 skipped**. Bounds/linked-input TAP filter: **1 test, 1 passed,
  0 failed, 0 skipped**, link branch executed with no `# SKIP`.
- Final full `test:harness:decision-sidecar` aggregate: **exit 0**, policy 5/5, HTTP 9/9,
  advisory 8/8, router PASS, backend-openai 14/14, freeze PASS (7 invariants plus negative
  control), evaluator 21/21. Parent final config, docs, references and diff-check passed.
  These are attributed final review/parent results, not runtime tests rerun by Feedback.
  The parent confirms no source/test changes after these checks, only review artifacts.
- No further F-D4 implementation or optional cleanup is requested. Retained legacy report
  `--queue` is the approved compatibility exception, not an open defect or authorization to
  remove the alias. Prior corrective closures remain settled.
- **F-S1 remains mandatory and BLOCKED. Owner: parent execution agent / release verification
  owner.** Latest Snyk Code attempts on BOTH evaluator and test failed HTTP 401 (the earlier
  record identifies Unauthorized / SNYK-0005). Sonar analysis and automatic-analysis disable
  and re-enable attempts failed MCP startup with exit 1; automatic analysis is still not
  restored. These are failures, not passes; no scan clearance or waiver exists. Production
  path-flow/complexity diagnostics and the raw missing-file path echo remain untriaged.
  Coordinate recovery with the authorized tooling operator, obtain successful final scans
  and analysis of both files, restore automatic analysis, record finding dispositions, and
  complete required repair/review proof before release clearance. No user authentication
  assignment, credentials, configuration changes or suppressions are authorized here.
- This pass edits documentation only. The three user-provided labels remain private,
  publication-denied, unread and unpublished; zero accepted real cases and deficit 100 remain.
  Fixture/config/freeze are unchanged. No sidecar/model inference, import or publication is
  performed. Promotion remains false, readiness not established and sidecar metrics not measured.
  Graph status remains stale by 3 commits / 13 source files, refresh readiness ready; no fresh
  dependency assurance is claimed. Documentation validation cannot certify release.
