# Review Breadth — Decision Calibration Review Workflow (2026-09-28)

resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, package.json, .github/harness/eval/README.md, .github/harness/memory/briefs/decision-calibration-review-workflow-2026-09-28.md, scripts/harness/prompt-router.mjs, scripts/harness/decision-advisory.mjs, harness.config.json, .gitignore

Stage: Review Breadth only. Read-only for source; no fixture edits, no live model or sidecar calls.
Verdict: **REVISE** — 2 Blocker, 4 Major, 4 Minor. The 9 passing tests do not establish that the
Brief's requirements pass; several listed findings are untested paths.

Current status (final verify, same day): **PASS for static correctness** — all Blockers and Majors
resolved, including M2-R and M3-R; one new Minor documentation note. Release proof remains
**BLOCKED** by unmet Snyk/Sonar scans. See "Final verify" at the end. Original findings and
Re-review 2 are preserved as the audit record.

Previous status (final BR-1/BR-2 verification): **REVISE** — BR-2 is closed; BR-1 (proof) remains
open because the history-link test asserts only a nonzero exit, which a build without the history
containment check also produces. See "Final BR-1/BR-2 verification" at the end. Release proof
remains **BLOCKED**.

Final status (BR-1 assertion fix): **PASS for static correctness** — no required findings; BR-1
and BR-2 are closed. Release proof remains **BLOCKED** by the unmet Snyk and Sonar scan gates; this
is not shipment approval. See "BR-1 assertion fix verification" at the end.

Privacy note: this committed review contains no raw history prompts, no candidate task text and no
maintainer label choices. Maintainer label decisions exist only in ignored private local storage; no
publication consent was given, so nothing in this review authorises a fixture import.

## Context sufficiency

| Artifact | Change | Surface |
| --- | --- | --- |
| `scripts/harness/decision-eval.mjs` | +~475 lines: export / import / deterministic-only modes, validation, `summarise` rewrite | evaluator CLI |
| `scripts/harness/test/decision-eval-test.mjs` | new, 9 `node:test` cases | proof |
| `package.json` | `test:harness:decision-eval` added and chained into `test:harness:decision-sidecar` | operator/test wiring |
| `.github/harness/eval/README.md` | new operator guide | docs |
| `.github/harness/eval/decision-intent-cases.json` | unchanged (verified via `git status`) | fixture |

Scope: mixed (software + operator documentation). No missing artifact blocks findings. Unrelated
worktree edits (radar entries, `package-lock.json`, `architect-challenge-verdict.md`, untracked
briefs/prompt packs) were not inspected for this review and were not touched.

## Findings (ordered by severity)

### B1 — Blocker — live `promotionEligible` ignores freeze, unavailable and abstentions

- **Artifact:** `scripts/harness/decision-eval.mjs` line 582 (`main`), with `evaluationConfig` line 465.
- **Finding:** The live path still computes `promotionEligible = humanLabelled >= required && confidentWrong <= cap`, identical to HEAD. It ignores `freeze.status: "frozen"`, `summary.unavailable`, sidecar abstentions/uncertain rows, and missing held-out split evidence. `evaluationConfig` forces `policy.enabled = true` without consulting `freeze`.
- **Evidence:** Direct read of line 582; `git show HEAD:scripts/harness/decision-eval.mjs` shows the same expression. `summarise` maps every `unavailable` row to `sidecar.abstained` with no confident-wrong increment (test "summary rejects unavailable..." asserts this). Therefore a fixture with 100 real cases and a dead sidecar yields `confidentWrong = 0` and prints `promotion eligible: yes`.
- **Impact:** Violates the Brief's report contract ("frozen/offline `promotionEligible = false`, with explicit reasons"; "Invalid, missing or unavailable outcomes make readiness false"). Offline mode is correct; the live mode contradicts it under the same frozen config.
- **Confidence:** HIGH (direct code + HEAD comparison; not executed live by design).
- **Fix:** Extract a pure exported `promotionDecision({ summary, fixture, policy })` returning `{ promotionEligible, reasons[] }`. Return `false` when `policy.freeze?.status === "frozen"`, when `summary.unavailable > 0`, when `summary.sidecar.abstained > 0` or any row is not a fully observed `matched` row, when `summary.total !== fixture.cases.length`, when real-case count < required, when `confidentWrong > 0`, or when no held-out/calibration split evidence exists. Use it in `main` and include `reasons` in JSON and text output.
- **Tests:** Unit-test the pure function: frozen policy + 100 real + 0 confident-wrong → false with `frozen` reason; unfrozen + any unavailable → false; unfrozen + uncertain row → false; 99 real → false.

### B2 — Blocker — `summarise` silently weakens confident-wrong versus HEAD

- **Artifact:** `scripts/harness/decision-eval.mjs` lines 506–512 (`summarise`).
- **Finding:** The `uncertain` branch `continue`s before the confident-wrong check. HEAD counted any wrong selection with `probability >= minProbability` regardless of status. A wrong selection with high probability but insufficient margin (status `uncertain` per `decision-policy.mjs` lines 79–84) is no longer counted.
- **Evidence:** Reproduced: `summarise([{expected:'coder', deterministic:'coder', selected:'assistant', probability:0.95, margin:0.05, status:'uncertain'}], 0.7)` returns `confidentWrong: 0`. HEAD's loop counted it.
- **Impact:** The zero-confident-wrong requirement is part of the unfreeze gate (`harness.config.json` `unfreezeRequires`). Weakening its metric without an explicit Brief decision breaches "no silent weakening of guardrails" and feeds B1.
- **Confidence:** HIGH.
- **Fix:** Keep `uncertain` as a sidecar abstention for tally purposes, but evaluate `selected !== expected && probability >= minProbability` for both `matched` and `uncertain` rows before `continue`. Optionally add a separate `uncertainWrongHighProbability` counter for visibility; do not remove it from `confidentWrong`.
- **Tests:** Add the reproduction above as a regression (`confidentWrong === 1`); add an `uncertain` wrong row below threshold (`confidentWrong === 0`) as a control.

### M1 — Major — config root and fixture root are resolved by two independent resolvers

- **Artifact:** `decision-eval.mjs` lines 323, 393, 465 (`loadConfig()` imported from `prompt-router.mjs`); `prompt-router.mjs` lines 45–62 (module-load-time root).
- **Finding:** The evaluator resolves its root in `parseArgs` (last `--repo-root` wins), but `loadConfig()` reads `harness.config.json` from a root captured when `prompt-router.mjs` is imported (first `--repo-root` in `process.argv`, else `HARNESS_PROJECT_ROOT`, else the kit's own root). They agree only by coincidence of parsing the same argv.
- **Evidence:** Isolated temp-dir probe: `--repo-root <kit> --repo-root <tempRootWithoutConfig> --deterministic-only` succeeded, validating the temp fixture against the kit's config although the temp root has no `harness.config.json`. Programmatic imports (the test imports `summarise`) bind config to the importer's environment, not to any evaluator root.
- **Impact:** Intent labels, freeze state and thresholds can be validated against another project's config in adopting repos; import could accept labels invalid for the target project.
- **Confidence:** HIGH for the reproduction; MEDIUM for real-world likelihood.
- **Fix:** Load config from the evaluator's resolved root: `readBounded(join(root, "harness.config.json"), …)` after `assertContained`, pass it to `deterministicBaseline`, `importReviewed` and `evaluationConfig(options, config)`. Reject a repeated `--repo-root` in `parseArgs`.
- **Tests:** Temp root whose config removes one intent profile; a fixture/review using that intent must reject when run with `cwd` = kit and `HARNESS_PROJECT_ROOT` unset. Repeated `--repo-root` must exit non-zero.

### M2 — Major — export cannot progress beyond the first N distinct tasks

- **Artifact:** `decision-eval.mjs` lines 241–279 (`exportCandidates`), 136–152 (`writeJsonIdempotent`).
- **Finding:** Selection is always the first `limit` distinct tasks (max 100). Any different selection conflicts with the existing `candidates.json` and fails. There is no offset/exclusion of ids already in the fixture or already reviewed, and import validates only against the single fixed queue path.
- **Evidence:** Temp-dir probe: `--export-candidates --limit 1` then `--limit 2` → `candidate queue already exists with conflicting data`, exit 1.
- **Impact:** After rejections/deferrals, reaching 100 accepted real cases is impossible via the tool; deleting the queue re-exports the same first N (including already-reviewed items) and breaks queue linkage for pending reviews. The documented "25 default, up to 100" flow has no next-batch path.
- **Confidence:** HIGH.
- **Fix (bounded):** Add `--offset <n>` (or exclude candidate ids present in the fixture and in existing batch files) and write batch files `candidates-<offset>.json`; add `--queue <file>` (contained to the calibration root) for `--import-reviewed`. Keep refuse-on-conflict per batch file.
- **Tests:** Two sequential batches with disjoint ids; second export after a completed import excludes imported ids; import against the second batch queue succeeds; conflicting rewrite of the same batch still fails.

### M3 — Major — committed fixture id is an unsalted hash of the raw private prompt

- **Artifact:** `decision-eval.mjs` line 267 (`id: candidate-<sha256(task)[:16]>`), carried into the fixture at `importReviewed` (`id: item.id`).
- **Finding:** Brief: "committed provenance uses opaque source IDs, not raw prompts, machine paths or raw-source hashes." The id is a raw-source hash of the pre-redaction task and would be committed on import.
- **Impact:** Enables guess-confirmation of short private prompts; contradicts the privacy boundary. Latent now (no publication consent), but the import path would publish it.
- **Confidence:** HIGH.
- **Fix:** Generate an opaque id not derived from task text (e.g. `randomUUID()` at export, persisted in the private queue so repeated export stays idempotent by comparing tasks, or an HMAC keyed by a local ignored secret). Keep the task↔id mapping only in the ignored queue.
- **Tests:** Assert exported ids do not equal any truncated `sha256` of the task and that imported fixture entries contain no hash of the source task.

### M4 — Major — operator guide omits mandatory accepted-entry fields and batch limits

- **Artifact:** `.github/harness/eval/README.md` "Review the queue locally" paragraph.
- **Finding:** Import requires `status: "accepted"`, `labelledBy` ∈ {`human-labelled`, `history-derived`}, unchanged `id` and `sourceRef`, and `confirmation.{finalTaskConfirmed, expectedConfirmed, publicationConfirmed}: true` (`requireRealCaseMetadata`, `importReviewed`). The guide lists none of these, does not state that the reviewed file must live inside the calibration directory, and does not mention the M2 re-export limitation.
- **Impact:** An operator following the guide produces a submission that always rejects, or is tempted to hand-edit ids/sourceRefs.
- **Confidence:** HIGH.
- **Fix:** Add a minimal accepted-entry JSON example with placeholder values only (no real task text), the three confirmation booleans, `labelledBy`, unchanged `id`/`sourceRef`, the containment rule, and next-batch instructions after M2 lands.
- **Tests:** `npm run harness:docs:check`; optionally a test that imports a submission built exactly from the README example shape.

### m1 — Minor — offline network-denial test is vacuous

- **Artifact:** test lines 19–24 and 170.
- **Finding:** The test sets `HARNESS_DECISION_ENDPOINT`, but the evaluator reads `HARNESS_DECISION_ENDPOINT_EVAL` (line 33) or `--endpoint`; nothing routes the stub URL into any code path, and there is no positive control.
- **Fix:** Set `HARNESS_DECISION_ENDPOINT_EVAL` and pass `--endpoint <stub>` in offline runs; add a positive control running the live mode against the same loopback stub (asserting `requests > 0`) so `requests === 0` in offline modes is meaningful. The stub is local only; no model call.

### m2 — Minor — import honours `--cases`, so the target is not fixed

- **Artifact:** `pathsFor` line 79; `importReviewed` writes `paths.cases`.
- **Finding:** Brief: import writes "to the fixed fixture target". Any in-root file that validates as a fixture can be overwritten via `--cases`.
- **Fix:** Reject `--cases` together with `--import-reviewed` (or require it to equal the canonical path). Test: combined flags exit non-zero and leave both files unchanged.

### m3 — Minor — imported fixture copies arbitrary review metadata

- **Artifact:** `importReviewed` line 430 (`confirmation: item.confirmation`); `taskFamily`/`provenance` unbounded strings.
- **Finding:** Extra keys in `confirmation` and arbitrarily long `provenance`/`taskFamily` strings are committed verbatim, contrary to "never arbitrary metadata".
- **Fix:** Rebuild `confirmation` as exactly the three `true` booleans; cap `provenance`/`taskFamily`/`reviewedBy` length (e.g. 200 bytes). Test: extra confirmation keys are dropped; oversize provenance rejects.

### m4 — Minor — avoidable complexity and duplicated atomic write

- **Artifact:** `importReviewed` (Sonar cognitive complexity 31), `summarise` (28), `main` (22); atomic temp-rename duplicated between `writeJsonIdempotent` and `importReviewed`; accepted-entry queue match re-checked after `validateReviewedEntries`.
- **Finding:** Material only because it obscures the B1/B2 gate logic and the import proof. Remedy: one `atomicWrite(path, serialized, root, label)` helper; split import into `validateAcceptedEntry` + `toFixtureCase`; classify summary rows with a small `classifyRow` helper while fixing B2.

### FYI — Brief status line is stale

- The Brief's Objective still reads "awaiting independent re-challenge; not approved for Implement" while an Implementation Proof section follows and the parent treats it as approved. Update the status line (with the re-challenge verdict reference) during Feedback; no code impact.

## Proof gaps (claims not yet evidenced by tests)

- Live-mode promotion semantics (B1) and uncertain confident-wrong (B2): no tests.
- Input bounds: only the 8 KiB task bound is tested. Not tested: 10 MiB / 10,000-record history, 1 MiB review/queue, >100 review entries, >10,000 fixture cases.
- Brief-required: two identical deterministic runs produce identical output; config and history byte-identical after export/import; atomic write-failure path leaves the fixture unchanged (current "atomic" test fails validation before any write).
- Rejected/deferred counts via `--reviewed`; held-out split without `familySeparationConfirmed` rejection; small confirmed batch without splits importing and increasing only the collection count.
- Symlink/junction test passed here but self-skips on EPERM environments; no alternate containment assertion runs when skipped.

## Ignore policy and path validation (checked)

- `git check-ignore -v` confirms `.github/harness/runs/decision-calibration/candidates.json` and `reviewed.json` are ignored by `.gitignore:11` (`.github/harness/runs/*`). The existing private queue is present only there.
- Reviewed/queue paths are contained to the calibration root; fixture path contained to the repo root; symlink/junction ancestors rejected. Relative `--import-reviewed` resolves against `cwd`, not `--repo-root` (fails closed when they differ). Remaining issues: m2 and M1.

## Tooling blockers (not code bugs)

- Sonar MCP connected-mode security-hotspot listing is unavailable: workspace not bound; the call reported it initiated a binding prompt (no binding was completed by this review). IDE diagnostics reported path-flow "file inclusion" warnings on `pathsFor`/`readBounded` inputs — mitigated by `assertContained` except for m2 — and the complexity warnings in m4.
- Snyk: not re-run in this stage; the implementer recorded an authentication failure. Treat as an unmet mandatory scan, not as a pass.

## Commands run (isolated)

- `node --test scripts/harness/test/decision-eval-test.mjs` → 9 pass, 0 fail, 0 skipped.
- `summarise` uncertain-row probe (B2) and temp-dir probes for M1/M2 (temp directories removed).
- No live endpoint, sidecar, or model call; no source or fixture edits.

## Coverage note

Inspected: the full evaluator, the new test file, the README, the `package.json` diff, the
`prompt-router` root/config loading and `planTask` (pure; no handoff writes), the advisory receipt
path, the `decision-policy` uncertain semantics, the freeze config block and the ignore rules. Not
inspected: unrelated worktree changes; structural ownership questions are deferred to Review Depth.

## Handoff

Implementer should fix B1, B2, M1–M4 with the listed tests in one pass, then re-run
`npm run test:harness:decision-eval`, `npm run test:harness:decision-freeze`,
`npm run test:harness:decision-sidecar`, `npm run harness:config:self-test`,
`npm run harness:docs:check` and `npm run harness:memory:references:check`. No data collection,
readiness, promotion or unfreeze is established by this review.

## Re-review 2 — 2026-09-28 (Review Breadth, read-only for source)

Verdict: **REVISE** for implementation correctness — 0 Blocker, 2 Major (residuals of M2/M3), 4 Minor.
Not a security-scan verdict: Snyk and Sonar remain unmet gates (below).

Scope re-inspected: `scripts/harness/decision-eval.mjs`, `scripts/harness/test/decision-eval-test.mjs`,
`package.json` (`test:harness:decision-eval` chained into `test:harness:decision-sidecar`),
`.github/harness/eval/README.md`, the Brief. Fixture `decision-intent-cases.json` unchanged per
`git status`. Unrelated radar, `architect-challenge-verdict.md`, `package-lock.json`, prompt packs and
other untracked briefs were not inspected or touched.

Privacy: the parent reports three maintainer labels stored privately in ignored run storage with
publication declined. This review did not read them and nothing here imports, copies or counts
them. The only private-data read was an id-format count over the ignored candidate queue (no task text).

### Resolution of prior findings

| ID | Status | Evidence |
| --- | --- | --- |
| B1 | Resolved | `promotionDecision` always returns `promotionEligible: false` with reasons (`frozen`, `incomplete-sidecar-observations`, `insufficient-real-cases`, `confident-wrong`, held-out/family evidence, fallback `independent-unfreeze-gates-not-satisfied`); `main` uses it for JSON (`promotionReasons`) and text. Unit test covers frozen, unavailable, 99-case and all-matched cases. |
| B2 | Resolved | `summarise` counts `selected !== expected && p >= min` before the abstention tally for both `matched` and `uncertain`; regression plus below-threshold control tested. |
| M1 | Resolved | Local `loadConfig(root)` reads `<root>/harness.config.json` after containment; `planTask`/advisory receive that config; repeated `--repo-root` rejects. Isolated probe with `HARNESS_PROJECT_ROOT` unset and `cwd` = kit: reduced-intent temp config rejects, missing temp config rejects. |
| M2 | Partially resolved — see M2-R | `--offset` writes `candidates-<offset>.json`, batches are disjoint by position, repeated export of a new-format batch reuses saved UUIDs, `--queue` selects the import batch. |
| M3 | Partially resolved — see M3-R | New exports use `candidate-<randomUUID>`; test asserts UUID shape. |
| M4 | Resolved | README has a placeholder-only accepted-entry example, all three confirmation booleans, `labelledBy`, unchanged `id`/`sourceRef`, containment rule, next-batch `--offset` and `--import-reviewed … --queue …` command matching the parser. |
| m1 | Resolved | Offline runs set `HARNESS_DECISION_ENDPOINT_EVAL` to a loopback stub and assert `requests === 0`; the live positive control against the same stub asserts `requests > 0`. |
| m2 | Resolved | `--cases` with `--import-reviewed` rejects; fixture unchanged (tested). |
| m3 | Mostly resolved — see m3-R | Imported case is rebuilt from fixed keys; `confirmation` rebuilt to three `true` booleans; provenance/reviewer/family capped at 200 bytes (tested). |
| m4 | Partially addressed | `atomicWrite` extracted and `classifySidecarRow` added; not re-assessed further (Review Depth). |
| FYI | Open | Brief status line 10 updated, but the Decisions bullet still ends "Status remains awaiting challenge, not approved." Tidy during Feedback. |

### M2-R — Major — batch identity is positional, not source-anchored

- **Artifact:** `exportCandidates` (committed tasks excluded before the offset is applied; ids not tied to `sourceRef`); `importReviewed` (no `sourceRef` uniqueness check against the fixture).
- **Finding (a):** Accepting candidates with unchanged task text adds them to `committedTasks`, which shifts every later distinct-task position. The README's next-batch command (`--offset 25` after the first 25) then silently skips as many unreviewed candidates as were imported verbatim.
- **Finding (b):** The default `candidates.json` and `--offset 0` (`candidates-0.json`) are separate queues over the same records with different UUIDs; importing one reviewed entry from each, with different redacted text, commits the same source twice.
- **Evidence:** Isolated synthetic probe: 4 history records, 2 imported verbatim from `candidates-0.json`, then `--offset 2 --limit 2` produced an empty batch (expected records 3–4). Second probe: two imports of `handoff:record-1` via the two offset-0 queues both exited 0; the fixture then held 2 cases with that `sourceRef`. The existing "after import" test uses corrected text, so it cannot detect (a).
- **Impact:** Silent candidate loss on the documented path; duplicated sources inflate the 100-case count and can straddle splits.
- **Fix:** Apply offset/limit over distinct history before excluding committed material, and exclude by `sourceRef` already present in the fixture; reject an import whose `sourceRef` already exists under a different id. Optionally treat explicit `--offset 0` as the default queue.
- **Tests:** Verbatim import then next offset yields the next records; the same `sourceRef` via two queues rejects the second import with the fixture unchanged.

### M3-R — Major — legacy hash-id queues still import source hashes

- **Artifact:** `importReviewed` copies `item.id` into the fixture without an id-format check; `pathsFor` defaults `--queue` to legacy `candidates.json`.
- **Finding:** Queues written by the earlier implementation use `candidate-<sha256(task)[:16]>`. Import still accepts them and commits that raw-source hash, contrary to the Brief's opaque-provenance rule. Re-export of a legacy queue fails closed (no `offset` field → "conflicting data"), so the README's "reuses its saved opaque candidate IDs" claim does not hold for the supported legacy file.
- **Evidence:** Synthetic probe: legacy-format queue plus accepted review imported with exit 0; fixture id equalled the source-task hash prefix. Id-format count on the real ignored queue: `candidates.json` 25/25 legacy hash ids, 0 UUIDs. Latent only because publication was declined; any future import against that queue would commit the hashes.
- **Fix:** Reject non-UUID candidate ids at import, or remap legacy ids to fresh UUIDs in a private, ignored migration step before review. Correct the README legacy sentence.
- **Tests:** Legacy-hash queue import rejects (or remaps) with the fixture unchanged; no fixture id equals a truncated sha256 of its source task.

### Minor (optional)

- **m3-R:** `familySeparationConfirmed` is copied verbatim whenever present; probe committed an arbitrary nested object on a `train` entry. Accept only boolean `true` or omit.
- **m5:** `--queue` means the candidate batch for import but the reviewed file for `--deterministic-only`, and silently wins when both `--queue` and `--reviewed` are given (probe: both flags reported the pending queue's zero counts). The README command works as written; prefer documenting `--reviewed` for reports and rejecting both together.
- **m6:** The rooted-config test sets `HARNESS_PROJECT_ROOT` to the temp root, so it would also have passed before the M1 fix; add a run with that variable unset (the probe above confirms correct behavior).
- **m7:** Symlink/junction test still self-skips on EPERM; it ran (not skipped) here.

### Gates not satisfied (tooling, not code findings)

- Snyk: not re-run in this stage; last recorded state is an authentication failure. Unmet.
- Sonar: workspace not bound to connected mode; hotspot listing unavailable. Unmet.

### Commands run

- `node --test scripts/harness/test/decision-eval-test.mjs` → 13 pass, 0 fail, 0 skipped.
- One isolated temp-dir probe script (synthetic tasks, unreachable endpoint, `HARNESS_PROJECT_ROOT` unset) for M1, M2-R, M3-R, m3-R, m5; temp roots and script removed.
- Id-format-only count over the ignored `decision-calibration/candidates*.json` files.
- No live model, sidecar or provider call; no source, test, fixture, doc or config edits.

### Handoff

Fix M2-R and M3-R with the listed tests; minors optional. Then re-run
`npm run test:harness:decision-eval`, `npm run test:harness:decision-sidecar` and
`npm run harness:docs:check`. No readiness, promotion, unfreeze, or label import is established.

## Final verify — 2026-09-28 (Review Breadth, scoped to M2-R/M3-R and narrow fixes)

Verdict: **PASS for static correctness** — 0 Blocker, 0 Major, 1 new Minor. Release proof is
**BLOCKED**: Snyk (authentication failure) and Sonar (server cannot start) remain unmet mandatory
scans; this verdict does not certify shipment.

Scope: only the residual items above, verified against current source rather than implementer
claims. Fixture `decision-intent-cases.json` and `harness.config.json` unchanged per `git status`.
Private labels, candidate task text and prompts were not read; the probe used synthetic tasks only.

| ID | Status | Evidence |
| --- | --- | --- |
| M2-R (a) offset before excludes | Resolved | `exportCandidates` windows on `seen.size` (first-occurrence distinct order) and only then skips `committedSourceRefs`; committed-task exclusion was removed. Test "source-anchored batches…" plus isolated probe with duplicate and malformed lines interleaved: after a verbatim import of record 1, `--offset 2` yielded records 5 and 6 (the next distinct sources). |
| M2-R (b) duplicate `sourceRef` | Resolved | `importReviewed` rejects a batch-internal repeated `sourceRef` and any fixture `sourceRef` reached under a different id; only an identical case under the same id is a no-op. Probe: identical re-import → `noOp: true`; same source with identical final text via a second queue and new UUID → exit 1; differing redaction via default vs `--offset 0` queues → exit 1 (test). |
| M3-R legacy hash ids | Resolved | `validateReviewedEntries` applies `isOpaqueCandidateId` to every reviewed entry. Probe: legacy-format queue import → exit 1, fixture byte-identical; legacy default re-export fails closed. README directs a fresh `--offset 0` UUID batch in `candidates-0.json` with the legacy file retained locally, which is practical because offset 0 re-selects the same sources. |
| m3-R | Resolved | Only `familySeparationConfirmed === true` is copied (test). |
| m5 | Resolved (naming carried to depth) | `--queue` with `--reviewed` rejects (test). |
| m6 | Resolved | Rooted-config test runs with `HARNESS_PROJECT_ROOT` removed. |
| m7 | Ran | Link test executed, not skipped. |
| FYI Brief status | Resolved | Brief status lines now say under review, not approved. |

### n1 — Minor (new) — README over-states export idempotency

- **Artifact:** `.github/harness/eval/README.md`, "Repeated export of the same new-format batch reuses its saved opaque candidate IDs."
- **Evidence:** Probe: after importing one source from `candidates-0.json`, re-exporting `--offset 0` exits 1 (conflict), because the committed source is now excluded. Behavior is fail-closed and acceptable.
- **Fix:** Qualify the sentence: re-export is idempotent until a source from that batch is imported; afterwards it is refused and the existing queue should be reused.

### Commands run

- `node --test scripts/harness/test/decision-eval-test.mjs` → 16 tests, 16 pass, 0 fail, 0 skipped.
- `npm run test:harness:decision-sidecar` → exit 0 (includes decision-freeze PASS 7 invariants + negative control, and the evaluator suite).
- `npm run harness:config:self-test` → exit 0; `npm run harness:docs:check` → exit 0.
- One isolated synthetic temp-dir probe (unreachable endpoint, `HARNESS_PROJECT_ROOT` unset); temp roots and script removed. No live model, sidecar or provider call; no source, test, fixture or config edits.

### Handoff

No Blocker or Major remains; proceed to Review Depth. Before release: authenticate Snyk and run the
code scan, run Sonar analysis on the evaluator and its test, and triage the recorded path-flow and
complexity warnings. No readiness, promotion, unfreeze, or label import is established.

## Corrective verification — 2026-09-28 (Review Breadth, scoped to Feedback F-D1/F-D2/F-D3/F-N1/F-P1)

Verdict: **REVISE** — 0 Blocker, 2 required findings (BR-1 proof gap, BR-2 bound defect), 3 Minor
proof notes. Source corrections for D-m1, D-m2, D-m3 and n1 are correct. Release proof is
**BLOCKED**: no successful Snyk or Sonar result exists; this is not shipment approval.

Scope: only the adjudicated corrections and the F-P1 boundary/atomic tests. D-m4/F-D4 was not
reopened. Source, test, fixture and config were not edited; `decision-intent-cases.json` and
`harness.config.json` are unchanged per `git status`. No private queue, review or history content
was read; probes used synthetic temp roots and an unreachable endpoint. No model or provider call.

| Item | Status | Evidence |
| --- | --- | --- |
| D-m1 / F-D1 | Resolved | `validateFixture` enforces unique non-model `sourceRef`; `validateSourceReference` requires linkage for `history-derived` and opaque UUIDs for any `handoff:`-linked case, including `human-labelled`. Non-history human cases stay valid. Probe: duplicate-source fixture fails in baseline, export and import with `real case source references must be unique`, and no queue is created. Test covers missing linkage, legacy hash id, human handoff id and a distinct-source control (`humanLabelled` 2). |
| D-m2 / F-D2 code | Resolved | `exportCandidates` contains `paths.cases` to the root and `paths.history` to the runs root before any read. Probe: an outside `--cases` path fails with the containment message and no queue; a junction at `runs/handoffs.jsonl` fails with `handoff history must not use symbolic links or junctions` and no queue. |
| D-m2 / F-D2 proof | **Open — BR-1** | See below. |
| D-m3 / F-D3 | Resolved | `promotionDecision` no longer reads `calibrationEvidence` (no source reference remains); both missing-evidence reasons are unconditional; eligibility stays `false`. The fully matched 100-case test with the `true` flag keeps both reasons. |
| n1 / F-N1 | Resolved | README scopes reuse to "before any import", then says export refuses replacement and the saved queue stays the reusable record. This matches the `sameSelection` refusal. |
| F-P1 bounds | **Partly open — BR-2** | Fixture 10 MiB (probe: size message), fixture 10,001 cases, history 10 MiB, review 1 MiB (probe: size message), review 101 entries and generated output above 10 MiB reject. The history record bound is wrong (BR-2). |
| F-P1 atomic write | Resolved | The fault fires in `atomicWrite` after full review and resulting-fixture validation. Probe: the same inputs import with exit 0 without the fault; with it they fail with `injected atomic write failure`, the fixture is unchanged and no temporary sibling is left. |
| Docs | Accurate, with one exception | README and the Brief's corrective proof match the source. The Brief's "link branch executed" is true, but that run did not establish the history branch (BR-1). |

### BR-1 — Required (proof) — no committed test reaches the export history-containment branch

- **Artifact:** link test in `decision-eval-test.mjs`, case "export must reject linked history ancestors before queue writes".
- **Evidence:** The test replaces the whole `runs` directory with a junction. The pre-existing candidate-queue containment check fails first with `candidate queue must not use symbolic links or junctions`, before the new history check runs (probe). The assertion would pass with the F-D2 history call removed. A junction at `runs/handoffs.jsonl` does reach the history branch on this Windows workspace without privilege. A file symlink fails here with EPERM. None of the F-D2 rejection cases asserts that no queue was created.
- **Required fix:** Put the link at the history path only, with the `runs` directory left real. Use a junction on Windows or a file symlink elsewhere. Assert the history-specific error, no `decision-calibration` queue and byte-identical history, fixture and config. Add no-queue assertions to the outside-cases and linked-cases rejections. Test-only change.

### BR-2 — Required (correctness) — history record bound admits 10,001 records

- **Artifact:** `exportCandidates`, `lines.length > MAX_RECORDS + 1`.
- **Evidence:** The check counts split lines, which only works when the file ends with a newline. Probe: 10,001 records without a trailing newline export with exit 0. The committed test writes a trailing newline, so it cannot catch this. Blank lines also count toward the limit, so the check is stricter than the Brief's per-record wording. That is fail-closed and not a defect by itself.
- **Why required:** The Brief caps history at 10,000 records and says to reject over-limit input. F-P1 required proof of this limit.
- **Required fix:** Count records independently of the trailing newline, for example by excluding one final empty segment, and reject more than 10,000. Add a test with 10,001 records and no trailing newline, plus a 10,000-record accepted control.

### Minor proof notes (non-blocking)

- The F-D1 import assertion targets a review file that does not exist, so a missing-file error would also pass. The probe confirms the fixture validator fails first. Asserting the stderr text would make it discriminating.
- F-D3 asked for absent, `true` and malformed flag variants. Only `true` is tested. The source has no read path left, and `true` was the only value that ever suppressed reasons, so the omission hides no current behaviour.
- The fixture 10 MiB and review 1 MiB inputs are not valid JSON, so the tests would pass even without the size check. The probe shows the size messages fire, and the history 10 MiB test does exercise the shared `readBounded` helper. The atomic test has no in-test positive control, and the fault fires before the temporary file is created, so the rename-failure cleanup branch is not exercised.

### Commands run

- `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` → tests 19, pass 19, fail 0, skipped 0, cancelled 0.
- `git status --short` on fixture and config → no changes.
- One synthetic temp-dir probe script (unreachable endpoint, `HARNESS_PROJECT_ROOT` unset) and one junction probe; temp roots and the script were removed. A search for `calibrationEvidence` found it only in the test and review records.
- Not rerun here: the decision-sidecar/freeze aggregate and config self-test, since the corrective diff does not touch them. Snyk and Sonar were not run and are not claimed.

### Handoff

Return BR-1 and BR-2 to Implement: one test-only correction and one bound fix with its test. Then
rerun the focused suite and a scoped Breadth check of those two items. D-m1, D-m2 (code), D-m3 and n1
need no further change. No readiness, promotion, unfreeze, publication or label import is established.

## Final BR-1/BR-2 verification — 2026-09-28 (Review Breadth, scoped to BR-1 and BR-2 only)

Verdict: **REVISE** — 0 Blocker, 1 required finding (BR-1 proof), 1 Minor proof note. BR-2 is
closed. Release proof is **BLOCKED**: no Snyk or Sonar result exists; shipment is not clean. No
source, test, fixture or config edits; no private label, queue or history content was read.

| Item | Status | Evidence |
| --- | --- | --- |
| BR-2 bound | **Closed** | `exportCandidates` counts nonblank lines split on `\r?\n` and rejects above 10,000. Probe: 10,000 records with a final newline, without one, CRLF without one and blank-padded all export with exit 0; the same four 10,001 variants exit 1 with `handoff history exceeds the 10000-record limit` and no queue. The committed test rejects 10,001 with and without a final newline and asserts no queue; the no-newline case would have exported under the old `lines.length` check. |
| BR-1 proof | **Open** | The junction now sits at `runs/handoffs.jsonl` with `runs` real, and the real evaluator fails with `handoff history must not use symbolic links or junctions` and no queue. The test asserts only a nonzero exit and no `candidates-1.json`. Mutation probe: with the history `assertContained` line removed, the same run exits 1 with `handoff history must be a regular file` and no queue, so the test still passes without the F-D2 history check. The directory-target link (junction or `dir` symlink) is caught by the regular-file check on every platform. |

Minimal repro (BR-1): synthetic root with `runs/handoffs.jsonl` as a junction to an outside
directory; run `--export-candidates --offset 1 --limit 1 --json` against an evaluator copy without
`assertContained(paths.history, …)`; exit 1, no queue, so every assertion in the link test holds.

Required fix (test-only): assert the history-link stderr text on that run. Also point the
outside-cases and linked-cases no-queue assertions at `candidates.json`; those runs pass no
`--offset`, so the current `candidates-1.json` check cannot observe them (source verified correct).

Minor proof note: the 10,000-record accepted control is not in the committed test (probe confirms
acceptance). Over-strictness would fail closed, so this is not required.

Commands: `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` → tests 19,
pass 19, fail 0, skipped 0. One synthetic temp-root probe with an unreachable endpoint, including a
mutant evaluator copy in a temp directory; all temp files removed. No model, provider or scanner run.

## BR-1 assertion fix verification — 2026-09-28 (Review Breadth, scoped to BR-1 only)

Verdict: **PASS for static correctness** — 0 Blocker, 0 required findings. BR-1 is closed. No new
audit or criteria. Release proof is **BLOCKED**: Snyk and Sonar scan gates are still unmet; this is
not shipment approval. No source, test, fixture or config edits; no private label, queue or history
content was read.

| Item | Status | Evidence |
| --- | --- | --- |
| History-link stderr | **Closed** | The linked-history export (`--offset 1`) now asserts stderr matches `/handoff history must not use symbolic links or junctions/`, plus nonzero exit and no `candidates-1.json`. |
| No-offset queue checks | **Closed** | The outside-cases and linked-cases rejections (no `--offset`) now assert `candidates.json` is absent. The offset-1 checks still use `queuePath(root, 1)` (`candidates-1.json`). |
| 10,000 accepted control | **Closed** (was Minor) | Exactly 10,000 logical records export 1 candidate with `--offset 0 --limit 1` and create `candidates-0.json`. |

Mutation probe: a temp copy of `scripts/harness` with only the `assertContained(paths.history, …)`
line removed fails the link test (1 of 19) with stderr `handoff history must be a regular file`, so
the committed test now detects the missing F-D2 history check. Temp copy removed.

Commands: `node --test --test-reporter=tap scripts/harness/test/decision-eval-test.mjs` → tests 19,
pass 19, fail 0, skipped 0. The same suite against the mutant → tests 19, pass 18, fail 1. No model,
provider or scanner run.

Handoff: Feedback, run separately.
