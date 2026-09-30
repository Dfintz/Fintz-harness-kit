# Review Depth — Decision Calibration Review Workflow (2026-09-28)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, package.json, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-review-workflow-2026-09-28.md, .github/harness/memory/reviews/decision-calibration-review-workflow-breadth-2026-09-28.md, scripts/harness/prompt-router.mjs, scripts/harness/decision-advisory.mjs, scripts/harness/config.mjs, harness.config.json

Stage: Review Depth under `.github/instructions/06-REVIEW-DEPTH.md`, entered after the breadth final
verify reported no Blocker or Major. Read-only for source, tests, fixture and config.

Verdict: **PASS for structure (static correctness)** — 0 Blocker, 0 Major, 4 Minor. Release proof is
**BLOCKED**, separately: Snyk code scan (authentication failure) and Sonar analysis (server cannot
start) are unmet mandatory gates. Shipment is not verified by this review.

Previous status (final BR-1/BR-2 verification): **PASS for structure**, unchanged — the BR-2 count fix
is local to `exportCandidates` and adds no owner, path or authority. The overall correctness gate
stays **REVISE** because Breadth BR-1 (test proof) is still open. Release proof remains **BLOCKED**.
See the Breadth record's "Final BR-1/BR-2 verification".

Latest status (BR-1 assertion fix): **PASS for structure**, unchanged from the previous status — the
fix only changes test assertions and adds no owner, path or authority. Breadth now reports **PASS for
static correctness** with BR-1 closed. Release proof remains **BLOCKED** by the unmet Snyk and Sonar
scan gates; this is not shipment approval. See the Breadth record's "BR-1 assertion fix
verification".

Privacy: no raw history prompts, candidate task text or maintainer labels were read or copied. The
private labels are held in ignored storage with publication declined; the committed fixture is
unchanged and nothing here authorises an import. Deferred authentication and the 100-label
collection are out of scope and not treated as code defects.

## Context sufficiency

| Artifact | Role | Owning surface |
| --- | --- | --- |
| `scripts/harness/decision-eval.mjs` | export, import, deterministic baseline, live scoring, promotion reasons | evaluator (owner of offline evidence) |
| `scripts/harness/test/decision-eval-test.mjs` | 16 public CLI/function contract tests | proof |
| `package.json` | `test:harness:decision-eval` chained into `test:harness:decision-sidecar` | operator/test wiring |
| `.github/harness/eval/README.md` | operator workflow and privacy rules | docs |
| `prompt-router.mjs` `planTask` | prediction only; pure (no file writes) | router |
| `decision-advisory.mjs` | live-mode receipts; no disk writes | advisory |
| `config.mjs` | shared module-level root/config resolver | shared config (reuse candidate) |

No critical structural context is missing. The graph was not refreshed; ownership is source-grounded.

## Gate ledger

| Path | G1 | G2 | G3 | G4 | G4b | G5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Export (`--export-candidates`) | Pass | Pass | Pass | Pass | Pass (D-m2) | Pass | Dispatched before `evaluationConfig`; no `planTask` or advisory call; history read-only; output contained to the ignored calibration root; UUID ids; stdout counts only. Input containment is incomplete (D-m2). |
| Import (`--import-reviewed`) | Pass | Pass | Pass (D-m1) | Pass | Pass | Pass | Full validation, then one `atomicWrite` of the fixed fixture; `--cases` rejected; confirmation rebuilt to fixed keys; UUID and source uniqueness enforced at write time, but not by the fixture validator (D-m1). |
| Baseline (`--deterministic-only`) | Pass | Pass | Pass | Pass | Pass | Pass | Separates synthetic and real, reports deficit and coverage, unmeasured review counts, `promotionEligible: false`, readiness not established, sidecar not measured; probe showed byte-identical repeated output. |
| Live scoring + `promotionDecision` | Pass | Pass | Pass (D-m3) | Pass | Pass | Pass | `promotionEligible` is hard `false`; freeze preserved on the cloned policy; committed config never mutated. Reason source partly unowned (D-m3). |
| CLI `main`/`parseArgs` | Pass | — | Pass | Pass | Pass | — | Thin dispatch; offline modes mutually exclusive; repeated `--repo-root` rejects. Option naming overload (D-m4). |
| Root ownership | Pass | — | Pass | Pass | Pass | Pass | `resolveRepoRoot` + rooted `loadConfig(root)`; `planTask`/advisory receive that config. Router's import-time root is unused by evaluator paths. Reusing `config.mjs` would reintroduce import-time root binding, so the local loader is justified. |
| Helper reuse | — | Pass | — | — | — | Pass | Router `assertContainedPath` is private and process-exiting; `stage-state.mjs` atomic write is private. Local `assertContained`/`readBounded`/`atomicWrite` are single-owner and reused by all evaluator writers, matching the Brief's "keep helpers local". |
| Policy/freeze invariants | — | — | Pass | Pass | Pass | — | `test:harness:decision-freeze` PASS (7 invariants + negative control); `harness.config.json` unchanged; no promotion authority added. |

## Structural findings

### Blocker

None.

### Major

None.

### Minor

#### D-m1 — accepted-case invariants live only in the import writer

1. **Artifact:** `validateFixture` / `validateCaseShape` versus `importReviewed` in `decision-eval.mjs`.
2. **Gate:** Gate 3 (ownership).
3. **Evidence:** Import rejects repeated `sourceRef` and non-UUID ids, but fixture validation does not. Synthetic probe: a hand-added real case reusing an existing `sourceRef` with a hash-shaped id passed `--deterministic-only` and raised `humanLabelled` to 2 for one source.
4. **Why wrong:** The Brief makes the evaluator the owner of validation and counting of distinct accepted scenarios; a count that only one writer protects is not self-verifying. Impact is bounded because promotion and readiness are hard false and commits are human-reviewed.
5. **Fix:** In `validateFixture`, for non-model-authored cases require a unique `sourceRef` (present for `history-derived`) and opaque ids for history-derived cases; keep the import checks as early feedback.
6. **Confidence:** High (behavior); medium (severity).

#### D-m2 — export input containment is weaker than the other modes

1. **Artifact:** `exportCandidates` (`loadValidatedCases(paths.cases, …)` and `readBounded(paths.history, …)` without `assertContained`).
2. **Gate:** Gate 4b (privacy / path safety).
3. **Evidence:** Probe: `--export-candidates --cases <outside-root>/cases.json` exited 0, while `--deterministic-only` with the same path exited 1. The history path is fixed under the root but is not checked for symbolic links.
4. **Why wrong:** The Brief requires rejecting traversal and link escape on input as well as output. The output queue stays contained, so no private data leaves the ignored root; this is an inconsistency, not a leak.
5. **Fix:** Reject `--cases` with `--export-candidates` (as import does) or `assertContained(paths.cases, root)`; add `assertContained(paths.history, runsRoot)`.
6. **Confidence:** High.

#### D-m3 — promotion reasons read an unowned, unvalidated fixture flag

1. **Artifact:** `promotionDecision` reading `fixture.calibrationEvidence.{heldOutConfirmed, familySeparationConfirmed}`.
2. **Gate:** Gate 3 (ownership) and Line-level Overfitting.
3. **Evidence:** The field is absent from the committed fixture, the Brief, the README and `validateFixture`; no workflow writes it; only a test sets it. A hand-set `true` silently removes the held-out and family-separation reasons.
4. **Why wrong:** Reasons should derive from validated case data, not a self-asserted top-level boolean. Eligibility is unaffected (always `false`), so the defect is report truthfulness only.
5. **Fix:** Drop `calibrationEvidence`; emit the two reasons unless validated cases include `held-out` entries with `familySeparationConfirmed: true` (already enforced per case), or always emit them while offline evidence is not established.
6. **Confidence:** High.

#### D-m4 — line-level names, dead fields and stale scaffolding

1. **Artifact:** `decision-eval.mjs`, test file.
2. **Gate:** Line-level criteria (Names, Structure, Overfitting).
3. **Evidence:** `--queue` names the candidate batch for import but the reviewed file for reports (README documents both); `pathsFor().legacyCandidates` is unused; `loadCases` is a pass-through alias; the import loop re-checks `sourceRef` already checked by `validateReviewedEntries`; the test sets `HARNESS_REPO_ROOT`, which the evaluator never reads.
4. **Why wrong:** One word should mean one concept; dead or derivable values add concepts without behavior.
5. **Fix:** Use `--reviewed` for reports and `--queue` only for import; delete `legacyCandidates`, the alias, the duplicate check and the inert environment variable.
6. **Confidence:** High.

## Brief divergence

- Batch files `candidates-<offset>.json` with `--offset`/`--queue` extend the Brief's single canonical queue. Justified by breadth M2 and recorded in the Brief's Implementation Proof; accepted.
- `calibrationEvidence` is outside the Brief (D-m3).
- Input containment on export is partial versus the Brief's input/output rule (D-m2).
- Export idempotency holds until a source from that batch is imported; later re-export fails closed (breadth n1). Consistent with refuse-on-conflict.
- Validation-plan items still unproven by tests: history/record and 1 MiB review bounds beyond the 8 KiB task bound, and a write-failure path during atomic replacement. Per agreed criteria, no new test gates are required at this stage; recorded as residual risk.

## Residual risks

- `sourceRef` is a line index (`handoff:record-N`). Any rewrite, rotation or truncation of `handoffs.jsonl` (not append) would shift references and weaken cross-queue duplicate detection. No current retention script touches that file.
- No import lock: concurrent imports can lose an update. A crash between temp write and rename can leave a `.tmp` sibling in the tracked eval directory (content is the intended fixture).
- Review metadata is not authentication (by Brief design); human commit review remains the boundary.
- Private legacy queue ids are hash-derived and stay only in ignored storage. Any future publication of the privately held labels needs re-recording against a UUID `--offset 0` batch by source; none is authorised.
- Static-analysis warnings (path-flow on containment inputs, cognitive complexity in `importReviewed`/`summarise`/`main`) have not been triaged by a working scanner.

## Static correctness versus release proof

- **Static correctness:** PASS. Source read directly; 16/16 focused tests; decision-sidecar aggregate, config self-test and docs check exit 0; synthetic probe confirms breadth fixes and depth invariants.
- **Release proof:** BLOCKED. Required Snyk and Sonar scans did not run. Must-fix before shipment is claimed: authenticate Snyk and run the code scan, run Sonar analysis on the evaluator and test, and triage the path-flow and complexity findings.

## Commands run

- `node --test scripts/harness/test/decision-eval-test.mjs` → 16 pass, 0 fail, 0 skipped.
- `npm run test:harness:decision-sidecar`, `npm run harness:config:self-test`, `npm run harness:docs:check` → exit 0.
- One isolated synthetic temp-dir probe (unreachable endpoint); temp files removed. No live endpoint, source, test, fixture or config edits.

## Handoff

No Blocker or Major: proceed to Feedback. Minors D-m1 to D-m4 and breadth n1 are optional hardening
for one follow-up Implement pass. No data collection, readiness, promotion or unfreeze is
established.

## Corrective verification — 2026-09-28 (Review Depth, scoped; after Breadth corrective verification)

Verdict: **PASS for structure** — 0 Blocker, 0 Major, 1 Minor note for the adjudicated corrections.
This does not override Breadth **REVISE** (BR-1 proof, BR-2 bound), so the overall correctness gate
is **REVISE**. Release proof is **BLOCKED**: no Snyk or Sonar result exists. D-m4/F-D4 stays
deferred and was not reopened. No source, test, fixture or config edits, and no private data read.

| Item | G3 ownership | G4/G4b boundary | Evidence |
| --- | --- | --- | --- |
| D-m1 | Pass | Pass | Source and ID invariants now live in `validateFixture`/`validateSourceReference`, the owner used by baseline, export, import (before and after merge) and live scoring. Import checks stay as early feedback. |
| D-m2 | Pass | Pass (code) | `exportCandidates` reuses local `assertContained` for cases (repo root) and history (runs root) before reads. No new path abstraction. Proof gap is Breadth BR-1. |
| D-m3 | Pass | Pass | `promotionDecision` derives reasons only from summary, fixture counts and policy freeze. Unvalidated top-level flags no longer affect it, and eligibility stays hard `false`. |
| Write-fault seam | Pass | Pass | See note below. |

### Note — test-only write fault in production `atomicWrite` (Minor, accepted)

- The fault only runs when `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE === "1"` (probe: `"true"` has no effect). It sits in the single write owner after all validation. It can only throw before the temporary file exists, so it can block writes but cannot enable, redirect or publish anything.
- Probe: with the fault set, export writes no queue and import leaves the fixture unchanged. It adds no import, promotion, unfreeze or config authority.
- Residual: an environment variable read by production code, and the rename-failure cleanup branch is not exercised. Acceptable under the no-new-dependency constraint. Any later seam cleanup belongs with the deferred F-D4 maintenance, not this gate.

### Commands run

- Relies on the Breadth corrective run: focused suite 19 pass, 0 fail, 0 skipped. Synthetic probes and the junction probe ran with temp roots removed. No live model, provider or scanner run.

### Handoff

Structure needs no change. Close Breadth BR-1 and BR-2, rerun the focused suite and a scoped
Breadth check, then Feedback. Final Snyk and Sonar scans of source and test remain unverified release
blockers owned under F-S1.
