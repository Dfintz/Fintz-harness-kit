---
summary: Measured adoption of fast-check state models and an opt-in Stryker gate pilot, with replayed controls, strengthened gate tests, and explicit review/security limits.
artifact_family: review
immutability: mutable
---

# Testing Techniques Adoption: 2026-10-23

## Decision

Retain both techniques within the [Brief](../briefs/state-model-and-gate-mutation-adoption.md):
fast-check 4.10.2 state models and evaluator safety tests run in core CI; Stryker 9.6.1 is an
opt-in comparison/logical/boolean mutation pilot for the pure security-review gate. Neither
runtime owner was edited. No external skill, runtime policy, new approval authority, or
repository-wide mutation threshold was adopted.

## Context and Implementation Notes

Reviewed inputs: the Brief and inline challenge, the two radar entries, the three changed
JavaScript test/evaluation files, package manifest/lock, command index, and actual command/tool
results. The gate and state owner source, existing fixture pattern, and graph symbol context
provided ownership evidence. Graph status was fresh and ready at
`b7b3387fcc3e0227d5cd4cac00d013ca816d293e`, with zero commits/files behind and no bypass.
This is author-run Breadth/Depth/Feedback; configured routing targets are not runtime model
attestation or an independent reviewer execution.

- [State model](../../../../scripts/harness/test/stage-state-model-test.mjs): a literal ownership/evidence model using only public APIs, temporary state directories, generated commands, shrinking, and seed/path/replayPath output.
- [Evaluator](../../../../scripts/harness/eval/testing-adoption.mjs): fixed first-party targets, disposable source copies, seeded controls, total deadlines, OS/path-only child environment, unchanged-input hashes, raw mutation outcomes, and cleanup. A source copy is not a security sandbox.
- [Gate tests](../../../../scripts/harness/test/security-review-gate-test.mjs): additive checks isolating verdict, terminal state, legacy scans, checklist schema/policy, valid warnings, and diagnostic values. Production gate behavior was not changed to improve the score.
- [Package manifest](../../../../package.json) and [lock](../../../../package-lock.json): exact development pins plus patched shared `qs` and `fast-uri` resolutions. npm re-resolved/deduplicated the generated tree; no unbounded tool download or lifecycle scripts were used.
- [Command index](../../../../docs/harness/COMMAND_INDEX.md): actual install, test, pilot, replay, budget, and isolation contracts.

## Measured Proof

Windows, Node v24.15.0; both tool pins declare Node 20 compatibility, but a separate Node 20
runtime execution was not performed. Final combined command: `npm run harness:testing:adoption`.
Local ignored raw report: `.github/harness/runs/testing-adoption-kTsLaC.json`.
Total runtime: **7,541 ms**; source hashes stayed unchanged and disposable copies were removed.

| Check | Actual result |
| --- | --- |
| Clean state model | 100 runs, at most 20 commands each; 1,634 ms; no failure/interruption |
| Baseline operations | 150 progress writes, 12 rejected ownership conflicts, 49 evidence writes, 138 stage writes, 129 resumed reads |
| Ownership fault | Detected; 4 shrinks to two progress commands; exact replay failed as expected |
| Evidence-drop fault | Detected; 6 shrinks to progress plus evidence; exact replay failed as expected |
| Existing fixture comparison | Existing fixtures already caught both faults; no unique fault-discovery or speedup claim |
| Mutation baseline | Original tests: 22 killed, 15 survived among 37 selected; no timeout/compile/runtime errors |
| Initial known-guard controls | Accept-all guard caught; verdict-only weakening escaped the old combined negative case |
| Final mutation run | **37 killed, 0 survived**, 0 no-coverage/compile/runtime/timeout/pending; 111 separately ignored; 4,180 ms |
| Final gate controls | Original exits 0; accept-all and verdict-ignored controls each exit 1 with assertions |
| Evaluator self-test | Ignored-mutant regression, zero/over-budget refusal, error-status separation, real child deadline termination, environment filtering: pass |
| Core/contract gates | `test:harness:core`, `harness:docs:check`, `harness:commands:check`: pass |

The original mutation baseline report is locally retained as `testing-adoption-hNuG3v.json`;
the strengthened-test comparison is `testing-adoption-ztjEtY.json`. Three earlier preflights
incorrectly counted ignored entries as executable; no mutants ran in those rejected attempts.
That accounting defect was corrected and covered by a self-test. The final pilot intentionally
retains only BooleanLiteral/EqualityOperator/LogicalOperator mutations; the 111 exclusions
are not kills or evidence about other operator families, CLI loading, or unrelated modules.

State control seed: `20261023`. Ownership path `1:2:2:2:2`, replayPath `CFH:F`;
evidence path `1:2:2:1:1:1:1`, replayPath `EDM:F`. The evaluator recreates the known faults and
replays them; replaying those paths against the clean source is not expected to fail.
The model is sequential observational metadata coverage, not race safety or completion proof.

## Security and Quality

Final Snyk Code scans succeeded with zero issues for all three changed JavaScript files.
An intermediate network timeout was retried successfully. Two earlier hardcoded-secret
warnings referred to literal synthetic environment values; generated disposable values
replaced them and the evaluator rescan returned zero issues. No ignore or suppression was added.

The original Snyk SCA reported four findings on optional SDK paths. Follow-up dependency
inspection also found the same `zod` under Stryker's `mutation-server-protocol`; the earlier
claim that none affected an adopted tool path was incorrect. Fresh SCA after the repairs,
including development dependencies, strict lockfile synchronization, and ignored policies,
returns **one high finding**, not a clean dependency scan:

| Package | Before | Current | Finding and disposition |
| --- | --- | --- | --- |
| body-parser | 2.3.0 | 2.3.0 | High, SNYK-JS-BODYPARSER-21431495: unresolved; patched release blocked by minimum-age protection. |
| zod | 4.4.3 | 4.6.6 | SNYK-JS-ZOD-20510278 cleared on SDK and Stryker paths. |
| hono | 4.13.8 | 4.13.11 | SNYK-JS-HONO-20883336 cleared. |
| ip-address | 10.7.3 | 10.7.4 | SNYK-JS-IPADDRESS-21185770 cleared. |

[The body-parser advisory](https://security.snyk.io/vuln/SNYK-JS-BODYPARSER-21431495)
identifies 2.4.0 as the fixed 2.x version. Public registry metadata dates its publication to
2026-10-22T11:39:38.614Z. The protected npm resolver excludes it at this check. The operator
explicitly selected **Keep minimum-age protection**, declining a one-invocation exception.
Revisit the patch when `npm view body-parser@2.4.0 version` succeeds under the normal policy;
then reinstall with lifecycle scripts disabled and repeat SCA/MCP validation. No security
ignore, permanent policy exception, SDK removal, or release waiver was introduced.

The first unavailable exact pin silently removed the optional SDK despite npm reporting zero
audit findings, and left a versionless optional lock entry. Removing only that failed-install
placeholder and unavailable pin allowed protected npm installation to restore the complete
SDK. `npm ls` confirms SDK 1.32.1 and the patched versions above, including shared `zod`.
An empty/incomplete audit tree is not remediation proof. The earlier `qs`/`fast-uri` fixes stay.

Sonar batch verification is now operational. MCP logs showed HTTP 500 from the IDE bridge's
`/sonarlint/api/analysis/files`; the IDE logged "No files belong to any configured scope".
Uppercase `C:` failed with both slash styles. Matching the registered lowercase drive using
`c:/Users/...` succeeded, without changing ports, credentials, project settings, or extensions.
The full batch initially returned eight minor findings. Three were fixed using fast-check's
serializer, `RegExp.exec()`, and an equivalent raw Windows path literal. The changed-file
rescan returns **five MINOR findings**, all in the evaluator:

| Rule | Count | Author review and remaining constraint |
| --- | --- | --- |
| javascript:S9382 | 4 | Serial fixture/model/replay and gate controls deliberately share total deadlines and preserve ordered measurements. Retain the awaits; no parallelism change or suppression. |
| javascript:S4036 | 1 | Fixed `git rev-parse HEAD` arguments run under the operator-owned PATH. PATH entries must remain trusted; no guarantee of unwriteable directories or sandboxing is claimed. |

These remain visible analyzer findings, not a zero-warning result or independent security
approval. Automatic analysis was successfully restored (`success: true`, `enabled: true`).
No full security or release-clearance claim is made.

Memory references pass across 923 Markdown files; final review-artifact/editor diagnostics,
documentation contracts, and tracked whitespace checks have no errors.

### Follow-up Proof

- Fresh `test:mcp:dispatch`: pass across dispatch, rate limits, auth, templates, HTTP routing, MRTR, tasks, subscriptions, OAuth hardening, and SDK result delivery.
- Fresh `test:mcp:stdio:mrtr`: SDK initializes, lists tools, resumes MRTR, and rejects an invalid token.
- Final `harness:testing:adoption`: both arms pass, minimized faults replay, 37 selected mutants killed, 111 separately ignored, no errors/timeouts; local report `testing-adoption-JQ5oS7.json`.
- Final `test:harness:testing-adoption`: pass, including real process-tree termination and environment isolation; local report `testing-adoption-Dyp7i7.json`.
- Fresh Snyk Code on the two modified JavaScript files: zero issues. No runtime owner or guard semantics changed.
- Boundary expansion from dependency metadata to two testing files was limited to the three actual Sonar fixes. No new files, framework, permissions, suppression, or concurrent execution were introduced.

## Review Breadth

Context is sufficient for this development-only scope; missing independent model attestation
and Node 20 execution limit assurance but do not become invented passes.

| Severity | Finding and evidence | Disposition |
| --- | --- | --- |
| Major, HIGH | Ignored mutants were counted against executable budget; three preflights falsely refused the same population. | Fixed: count non-Ignored only, retain both populations, test 111 ignored plus 37 selected and explicit zero/101 refusals. |
| Major, HIGH | A combined exhausted/REVISE fixture let verdict-only weakening survive; 15 selected mutants survived. | Fixed: independent public contract assertions; identical selected set now 37 killed and both seeded controls fail. |
| Major, HIGH | Per-child deadlines did not enforce the total technique budget; setup/cleanup could lose an error report. | Fixed: shared monotonic deadlines, setup within reporting scope, cleanup failure makes the report incomplete, real termination self-test. |
| Minor, HIGH | Literal synthetic values triggered hardcoded-secret diagnostics. | Fixed and rescanned without suppression. |
| FYI, HIGH | Dependency findings, retained Sonar warnings, and no independent runtime reviewer identity. | Follow-up repairs three of four dependency findings; one high and five minor Sonar findings remain explicit, not waived. |

Requirements, standards, safety, proof quality, and semantic clarity were reviewed. No unresolved
task-local functional finding remains; Sonar batch completion is verified with five retained minor warnings. Configured lint,
type-check, build and generic test strings are project-adoption defaults, not root package scripts;
the real core suite, focused executable proofs, diagnostics, and contract commands were used.

## Review Depth

| Gate | Evidence and result |
| --- | --- |
| 1 Domain alignment | Tests live beside Node fixtures; the bounded evaluator lives beside eval scripts. Pass. |
| 2 Generality | Two fixed pilot targets, no new testing framework or generalized plugin system. Pass. |
| 3 Ownership | State owner and gate source unchanged; journals remain completion authority. Pass. |
| 4 Boundary integrity | Package commands invoke tests/evaluation; AST extraction excludes runtime configuration and CLI file loading. Pass. |
| 4b Isolation | Only trusted disposable copies mutate; credential names are excluded, no dashboard reporter, budgets enforced, original hashes checked. Pass within the operator-owned filesystem assumption. |
| 5 Reuse | Existing fixture tests, Node facilities, Babel parser, and Stryker's own public instrumenter generate the exact preflight population. Pass. |

No new skill/agent or permission boundary was introduced. The generated lockfile is the expected
cost of adding development tooling, not a new runtime feature. The final retained operator
families and fixed ignored-mutant accounting are explicit Brief updates, not silent score filtering.

## Feedback Verdict Record

| # | Feedback point | Verdict | Evidence | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Retain generated state tests? | Current decision holds | Clean 100-run control and two shrunk, exact replays | HIGH | Keep supplemental core test; do not claim novel fault coverage. |
| 2 | Treat initial budget refusals as true oversized executions? | Challenge upheld | Instrumenter returns excluded entries as Ignored | HIGH | Fix and self-test accounting; retain all outcomes. |
| 3 | Relax gate or mutation threshold to pass? | Rejected | Public API stayed unchanged; test additions kill the same 37 mutants | HIGH | Keep additive contract tests and opt-in pilot; no global score gate. |
| 4 | Continue after three unsuccessful preflight repairs? | Explicitly authorized | Operator selected "Continue the bounded Stryker repair" | HIGH | Continued only the same slice, without raising limits. |
| 5 | Claim independent review or repository security clearance? | Insufficient evidence | No model attestation; one high dependency finding and five minor Sonar findings remain | HIGH | Record limits, no clearance claim or security waiver. |
| 6 | Bypass minimum-age protection for body-parser 2.4.0? | Operator declined | Explicit selection: Keep minimum-age protection | HIGH | Keep the other three patches and complete SDK; revisit when the fixed release is normally eligible. |
| 7 | Keep treating Sonar batch completion as externally blocked? | Challenge upheld | IDE scope log plus successful lowercase-drive requests and actual returned findings | HIGH | Use canonical `c:/` paths; preserve the five reviewed warnings and enabled automatic analysis. |

Accepted changes: corrected accounting, total deadlines, additive tests, exact replay proof,
patched tool/SDK dependency paths, three targeted Sonar fixes, and explicit operator scope.
Deferred: broader mutation families, concurrency, Node-version matrix execution, independent
reviewer attestation, and the age-blocked body-parser patch. Sonar batch completion is verified;
its five retained minor findings and the remaining high dependency finding prevent any clean
security/release-clearance claim. The Brief records these measured outcomes and constraints.
