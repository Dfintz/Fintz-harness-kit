# Decision Calibration Scanner Triage (2026-09-29)
resource: scripts/harness/decision-eval.mjs, scripts/harness/test/decision-eval-test.mjs, .github/harness/eval/README.md, .github/harness/memory/reviews/decision-calibration-review-workflow-feedback-2026-09-29.md, .github/instructions/03-ARCHITECT.md, harness.config.json, package.json

## Architecture Brief

### Objective

- **Architect verdict: APPROVED for independent Architecture Challenge, not Implement or release approval.** Continue fixing the user's unresolved scanner/review work through a new, focused F-S1 slice. F-D4 is CLOSED by [final Feedback](../reviews/decision-calibration-review-workflow-feedback-2026-09-29.md); do not reopen it or alter its accepted compatibility contract.
- Deliver evidence-grounded triage, minimal repairs of demonstrated defects and current actionable IDE findings, and final-file security proof. Warning disappearance is not the definition of safety. **F-S1 remains OPEN and release/security verification BLOCKED** until all mandatory evidence, including Sonar analysis and automatic-analysis restoration, exists.

### Scope and boundaries

- Scope: mixed evaluator security/correctness maintenance, adjacent tests, and narrowly necessary operator documentation. Primary boundary: operator-selected local project -> bounded input validation -> private export or consent-gated fixture replacement -> report-only output.
- Context sufficiency: direct source and tests, current IDE diagnostics, supplied native Snyk results, and final Feedback suffice for this bounded design. Missing Sonar service and authenticated MCP evidence block security clearance, not drafting or challenged local repairs.

| Artifact / evidence | Classification, owner, and decision supported |
| --- | --- |
| [Evaluator](../../../../scripts/harness/decision-eval.mjs) | Runtime module; owns path handling, file lifecycle, validation, scoring, and CLI errors. Read current source through the final catch. |
| [Adjacent tests](../../../../scripts/harness/test/decision-eval-test.mjs) | Node public CLI tests; existing temp-root, link, atomic-failure, bounds, alias, privacy and offline controls are the extension point. |
| [Operator guide](../../eval/README.md) | Offline workflow contract; target repository selection is intentional; imports cannot select alternate fixtures. |
| [Prior brief](decision-calibration-review-workflow-2026-09-28.md) and final Feedback | Settled architecture and closure record; preserve privacy/freeze, F-D4 closure, and mandatory F-S1 ownership. |
| [Stage contract](../../../instructions/03-ARCHITECT.md), [config](../../../../harness.config.json), [package scripts](../../../../package.json) | Architecture output, routed models, and executable validation owners. No edits to these surfaces. |
| Current `get_errors` output | IDE diagnostic snapshot, not a fresh Sonar scan; actionable inventory below. Duplicate reports at one location do not prove distinct vulnerabilities. |
| User-supplied native Snyk CLI results | Evaluator: five open, zero ignored; test: one LOW HTTP finding. Scans completed with findings; not clean scans or reruns by this Architect. |
| Supplied Understand/tooling packet | Graph stale by 3 commits / 13 files; provider lacks pluginRoot. No Sonar key/connectedMode or scanner executable found. Source-grounded design only. |
| Repository routing/security memory | Previous sink-wrapper attempts did not reliably clear static warnings; do not move or hide diagnostics merely to achieve zero counts. |

- Latest supplied graph readiness supersedes the older brief's ready observation for this task; neither is remeasured here. No graph refresh/config change, emergency bypass, or fresh dependency assurance is claimed.
- No private history, queues, tasks, or labels were opened. Frozen config and committed fixture remain read-only references. Security scans are scoped to source/test files, never private runs data.

### Artifacts to create

- This brief: `.github/harness/memory/briefs/decision-calibration-scanner-triage-2026-09-29.md`. New F-S1 decisions must not rewrite the closed D4 record.
- No new runtime module, test suite, certificate fixture, dependency, scan configuration, or infrastructure. Use existing review/proof surfaces for task-free scan dispositions after implementation; no second planning framework.

### Artifacts to modify

- `scripts/harness/decision-eval.mjs`: local root-aware read/write helpers, temporary-file ownership, safe filesystem error projection, internal deterministic tally map, and the exact IDE findings below. The evaluator remains the owner; retain public exports and CLI behavior.
- `scripts/harness/test/decision-eval-test.mjs`: extend existing public CLI tests with synthetic adversarial inputs and preservation assertions; reuse temp-root and rejection helpers. Keep the endpoint positive control unless independent Challenge rejects the disposition below.
- `.github/harness/eval/README.md`, only if needed: clarify operator-selected root trust, safe failure diagnostics, and stable local-directory assumption. Do not repeat scanner ledgers or alter accepted alias/import instructions.
- No code edits in this Architect stage. During implementation, fixture/config changes are permitted only to disposable synthetic test copies, never the committed originals.

### Key decisions

#### Architectural gates

| Gate | Verdict | Decision |
| --- | --- | --- |
| 1. Domain / module alignment | PASS | Evaluator I/O and scoring hardening stays in the evaluator; diagnostics on its tests stay in the adjacent test file. |
| 2. Generality | PASS | Root-scoped I/O is generally useful, but this task demonstrates only one owner needing this exact bounds/privacy contract. Local helpers, not a new shared filesystem framework. |
| 3. Ownership | PASS | Operator selects a repository; evaluator enforces each narrower resource boundary and owns its temporary files. Maintainer alone owns labels and consent; scanner/service owner owns analysis recovery. |
| 4. Boundary integrity | PASS | Sink helpers enforce filesystem invariants; thin CLI dispatch selects modes and safe output. Scoring has no filesystem/network responsibility; router/advisory remain unchanged dependencies. |
| 4b. Isolation / safety | PASS, conditional on proof | Reject traversal and links, clean up only owned temporaries, prevent raw filesystem path disclosure, preserve private/frozen state. No hostile-concurrent-writer or privilege-isolation guarantee is invented. |
| 5. Reuse | PASS | Extend current helpers, test cases, guide and validation commands. Keep behavior-preserving complexity extraction local and cohesive. |

#### Exact findings and dispositions

Locations refer to the current pre-implementation source; future proof must record final locations.

| ID | Evidence / current status | Required action and discriminating proof |
| --- | --- | --- |
| S1-PATH | Native Snyk LOW: evaluator L141 `readFileSync` via `readBounded`; L182 `writeFileSync`, L183 `renameSync`, L185 `unlinkSync` via `atomicWrite`. Caller checks already constrain inputs. Exploitable traversal is NOT established. | Make reads root-aware at the sink; validate write destination and generated temporary paths at relevant operations. Exercise the complete source/root/sink matrix below. Rescan; retain evidence-backed dispositions for residual analyzer warnings, not suppressions. |
| S1-TEMP | Source-derived defect hypothesis: `wx` can fail because `<target>.<pid>.tmp` exists, then catch unconditionally unlinks that unowned path. Existing injected failure occurs before creation and does not test ownership. | First reproduce preservation failure with a pre-existing temporary-file sentinel in an isolated CLI child. Acquire ownership only after exclusive open succeeds, before writing; close handles on all exits, and clean up only this operation's file. Also test partial-write/rename failure cleanup and unchanged destination. |
| S1-ERROR | Final catch emits raw `error.message`; filesystem exceptions can disclose absolute local paths (`ENOENT` explicitly retained under F-S1). | Translate filesystem failures into fixed resource/operation messages at local I/O boundaries, without native message/path/stack interpolation. Test missing config/cases/history/review and failed write with a unique synthetic path marker absent from stderr; preserve nonzero exit, empty failure stdout, warning order, and useful error categories. |
| S1-LABEL | Native Snyk MEDIUM and duplicate IDE warning at L375 `report.confusion[item.expected]`. `expected` is validated against config own keys and `Object.fromEntries` defines own data properties, including `__proto__`; pollution is NOT proven. | Use a local `Map` of label -> tally for accumulation and fail closed on a missing key; serialize with `Object.fromEntries` only at the JSON boundary. Preserve report shape/order. Test JSON-parsed config keys `__proto__`, `constructor`, `prototype`, and `toString`, exact totals/own entries, plus labels absent from config rejecting. Never ban valid configured labels merely to silence the analyzer. |
| S1-HTTP | Native Snyk LOW at test L177 `http.createServer`; listener binds only `127.0.0.1`, ephemeral port, synthetic temp-root state; handler counts requests and returns 500. | Proposed reviewed non-vulnerability in this test context, pending independent Challenge/Breadth acceptance. Retain the real offline-negative/live-positive control, no real sidecar or secrets. Verify binding, synthetic data, request count 0 offline and >0 live, and teardown. Keep the warning visible in the final scan ledger; no automatic waiver. |
| S1-IDE-PATH | Current IDE path-flow diagnostics: evaluator L27, L99-106, L111, L123-124, L132, L141, L156, L303, L408, L479; test L97, L101, L105 (some duplicates). | Trace each to its actual sink/root or literal synthetic test caller. Recheck after sink repair. Do not claim test helpers are production attack surfaces without an input path; retain explicit per-location or grouped-source dispositions. No moving code to an unscanned file. |
| S1-COMPLEXITY | IDE: `parseArgs` 28, `exportCandidates` 23, `importReviewed` 26, `summarise` 17, `main` 22; threshold 15. | After security proofs, extract cohesive local argument validation, candidate selection, accepted-entry projection, tally updates, and live reporting/dispatch responsibilities as needed. Preserve ordering and APIs. Check each affected function <=15 with working analyzer evidence; tests alone cannot certify this metric. This is F-S1 production diagnostic work, not reopened D4 cleanup. |
| S1-STYLE | IDE L267/L439 optional chaining; L721 replace-all preference. | Apply the narrow semantics-preserving optional-chain guards and `replaceAll` conversion; retain malformed/null fixture/submission and CLI-entry coverage. No opportunistic reformatting. |
| S1-TOOLS | Snyk MCP status/Code 401 despite local browser auth success; native CLI now usable. Sonar analysis/toggles fail startup exit 1; no project key or scanner executable. | Use native file-scoped Snyk scans; do not retry browser auth or claim MCP repaired. Sonar subgate remains genuinely BLOCKED pending authorized service operator. Bounded diagnostic recovery below; no invented key, installation, remote server or secret request. |

#### Root and sink contract

1. `--repo-root` -> `HARNESS_PROJECT_ROOT` -> evaluator source root is existing precedence. The selected root is an explicit operator capability, not a sandbox against that operator. Keep this contract, including repeated-root rejection; do not silently pin to CWD, this checkout, or source root. A future privileged/untrusted caller would require separately approved root authorization upstream.
2. Keep relative option paths resolved against process CWD as today. Pass the independently selected allowed root into each read; never derive it from the untrusted target's own dirname. Canonicalization must not turn rejected links into accepted resolved paths.
3. Extend `readBounded`/`parseBoundedJson`/`loadValidatedCases` to require the allowed root and resource label. Resolve and validate containment/link ancestry inside the sink helper before stat/read, using that checked target. Retain regular-file, byte and record limits and post-read byte checks. `loadConfig`, history reads, case reads, review reads and idempotence reads must all supply their correct roots; no unchecked overload.
4. Keep `atomicWrite` local and root-aware. Validate destination before/after directory creation, generated temporary path before exclusive creation, and rename source/destination before replacement. Use exclusive open to establish ownership before writing (a flag set only after `writeFileSync` returns misses partial failures). Close the owned descriptor before rename on Windows; cleanup only after ownership, containment and link checks, without masking the primary error. An existing path or dangling link is never owned. Do not remove stale/colliding files opportunistically.
5. Link checks must use `lstat` so dangling links are not hidden by `existsSync`; treat only genuine not-found as a missing path, not permission/I/O errors. Preserve rejection of root ancestors, intermediate links, terminal symlinks and Windows junctions. Rechecking is defense in depth, not a race-proof filesystem transaction.

| Source / operation | Allowed root and sink |
| --- | --- |
| Operator root + fixed `harness.config.json` | Selected repository root -> bounded JSON read. |
| `--cases` or default cases in export/report/live mode | Selected repository root -> validated bounded JSON read; not arbitrary machine files. |
| Fixed handoff history | Selected root's `.github/harness/runs` -> bounded text read. |
| `--reviewed`, report legacy `--queue`, `--import-reviewed`, import candidate `--queue` | Selected root's `.github/harness/runs/decision-calibration` -> bounded review read. Neither submission metadata nor sourceRef changes this root. |
| Candidate export and idempotence read | Same calibration root -> fixed/default or validated numeric-offset filename -> owned temp/atomic replacement. |
| Reviewed import destination | Selected repository root -> fixed canonical fixture -> owned temp/atomic replacement; `--cases` remains forbidden for import. |

#### Minimal approach and alternatives

- Choose Map accumulation over an ordinary-object bracket access or a label blacklist. Existing own-key construction may already be safe; this is explicit defensive structure, not a claim to have repaired proven pollution. Boundary conversion retains the JSON contract.
- Choose root parameters and owned-temp lifecycle over branded path objects, generic capability classes, a new package, or scanner-specific wrappers. Path wrapping alone is not evidence of safety.
- Keep the loopback HTTP control with an explicit proposed disposition. TLS adds test private-key/certificate lifecycle and child trust plumbing without protecting actual sensitive traffic here. An in-process mock weakens the current subprocess positive control unless it proves the same observation. If independent Challenge requires HTTPS, return for a bounded amendment permitting a test-only certificate and child-scoped CA trust; never disable TLS verification globally or use `rejectUnauthorized: false`.
- Bounded Sonar diagnostic work: one targeted startup/log inspection and one analysis/restoration retry after the authorized operator reports recovery. No repeated identical failures, service changes, credential collection or guessed project identity. Existing IDE diagnostics can guide local fixes but cannot replace fresh Sonar analysis. In this Architect environment no tool-discovery entrypoint is exposed for deferred MCP calls; no new disable/enable or analysis success is claimed.
- Topology: Producer-Reviewer. Required routed identifiers from current config: Architect `gpt-6-astra` (GPT-6 Astra), independent Challenge `gpt-6-sol`, Implement `gpt-5.6-terra`, Breadth/Depth `claude-opus-5-5`, Feedback `gpt-6-astra`. These are routing requirements, not verified model-execution claims. Record effective model identity at handoff; implementation must differ from every active review-stage model. No local-only security adjudication or silent fallback. Independent Architecture Challenge follows this APPROVED brief and must approve before code edits.

### Constraints

- Preserve exact deprecated report warning, exactly once on stderr after argument validation and before reads; canonical `--reviewed`, both-flag conflict rejection, and nondeprecated import `--queue` remain unchanged. Preserve compact/pretty output, key ordering, idempotence, bounds and no-write report behavior. Safe filesystem failure text is the intentionally changed behavior.
- Preserve all public exports and downstream `planTask`/advisory contracts. Do not alter route authority, endpoints, model configuration or production network policy.
- Config stays disabled, shadow, frozen. All 12 synthetic committed cases and thresholds stay unchanged; zero accepted committed real cases/deficit 100 are prior evidence, not a new private-data measurement. Promotion false, readiness not established, sidecar metrics not measured.
- No private labels, consent decisions, imports, exports or live inference against the actual repository. Synthetic temp-root imports and stub requests are test-only. Never upload private runs during scans or include private content in proof artifacts.
- Preserve unrelated worktree edits. No commit, branch creation, scan suppression, NOSONAR, exclusion, severity downgrade or automatic finding acceptance.

### Validation plan

- Architect exit: immediately after creating this brief, run `npm run harness:memory:references:check`, then `npm run harness:docs:check` and document diagnostics. Check this new untracked file directly for whitespace and required section/resource structure; `git diff --check` alone does not cover it. These checks validate documentation, not remediation or security clearance.
- Acceptance is expressed in the existing adjacent test suite; no separate acceptance scaffold is needed. Run one focused named regression immediately after each substantive change, then the full evaluator suite. Do not edit multiple security behaviors before the first discriminating check.

| Risk-first slice | Hypothesis / red-capable check | Required proof |
| --- | --- | --- |
| 1. File boundary and lifecycle | Under a stable, operator-owned root, traversal and existing links cannot escape; current cleanup may delete an unowned temp, and native filesystem errors may disclose paths. | Before repair, make sentinel-preservation and safe-error assertions fail on current code in a disposable CLI child. A test-only child bootstrap can know its PID and pre-create the colliding temp before loading the real CLI; no production export or new test hook is needed. After repair, sentinel/destination/config/history/outside files stay byte-identical. |
| 1. Path adversaries | Caller checks cover the current paths but sinks must enforce the same root. | Exercise relative `..`, absolute outside target, sibling-prefix root, root-equals-target, directory input, root/ancestor/terminal/dangling links, linked calibration output and fixture destination. Include Windows junctions and drive/UNC cases where supported. Assert no outside read content, write, rename or deletion; normal selected-project read/export/import remains a positive control. A skipped link branch is incomplete proof, not a pass. |
| 1. Atomic failure cases | Ownership is established on open, not after successful write. | Cover exclusive-open collision, pre-open injected failure, partial write, rename failure, and successful replacement; owned temps cleaned up, unowned temps untouched, existing fixture preserved on failure. Do not claim hostile same-user races are eliminated. |
| 2. Config label keys | JSON own keys should not mutate prototypes or lose tally entries. | Add synthetic config/cases for reserved-looking keys with known expected totals and explicit own-property checks; verify relevant prototypes unchanged in the scoring process, not only the parent process. Unsupported keys reject. These may already pass before Map hardening; report that honestly, never manufacture a red pollution exploit. Existing reports must remain byte-compatible. |
| 3. Exact IDE findings | Cohesive local extraction removes complexity findings without semantic change. | Red-capable existing alias/error/bounds/import/summary tests before and after extraction; malformed/null guards and entrypoint smoke. Require fresh analyzer metric proof when available; otherwise mark metric verification pending. |
| 4. HTTP disposition and final evidence | The stub has no sensitive traffic and observes actual endpoint contact. | Inspect bind/data/teardown and run the named offline/live test. Independent reviewer must accept or reject the documented test-context disposition; no silent suppression or clean-scan claim. |

- Focused implementation checks: `node --test --test-name-pattern="<exact new regression name>" scripts/harness/test/decision-eval-test.mjs`, verifying selection and counts, then `npm run test:harness:decision-eval`.
- Compatibility regressions: `node --test --test-name-pattern="reviewed report compatibility" scripts/harness/test/decision-eval-test.mjs` and `node --test --test-name-pattern="report bounds and linked review inputs" --test-reporter=tap scripts/harness/test/decision-eval-test.mjs`. Neither proof may pass vacuously; link coverage must execute on a supported environment.
- Final local gates: `npm run test:harness:decision-sidecar` (includes evaluator and freeze), `npm run harness:config:self-test`, `npm run harness:docs:check`, and `npm run harness:memory:references:check`. Record exact counts/exits and unchanged committed fixture/config bytes. Existing 21/21 proof is historical, not proof for future edits.
- After ALL source/test remediation, run BOTH native CLI scans: `snyk code test scripts/harness/decision-eval.mjs` and `snyk code test scripts/harness/test/decision-eval-test.mjs`. Record file hashes, command, completion/error status, severity/location and disposition. Exit 1 with a completed findings report differs from authentication/startup failure. Aim for zero true path vulnerabilities; residual warnings need reviewed source-to-sink evidence and tests, not a forced zero-warning rewrite. Repeat both if code changes after scanning.
- Sonar mandatory subgate: successful `analyze_file_list` for both final files, complete finding triage/repair evidence, and successful automatic-analysis re-enable. Restore automatic analysis after any successful disable, even on failure. Failed/unavailable toggles, IDE diagnostics, missing project key, or absent `sonar-scanner` never satisfy this gate. Owner remains parent execution agent / release verification owner, coordinating the authorized service operator without asking for secrets.
- Completion sequence: independent Architecture Challenge -> routed Implement with red/green proof -> cross-model Breadth and Depth -> Feedback. Explicitly distinguish local repair acceptance, individual reviewed warning dispositions, and F-S1 clearance. If Sonar remains unavailable, report **local work complete as evidenced; F-S1 BLOCKED**, never "all findings fixed" or release approval.

### Do NOT

- Reopen prior September D4, remove its legacy spelling, relax root/batch/consent/freeze rules, invent labels or calibration evidence, or change committed fixture/config.
- Re-anchor to the evaluator checkout to make taint disappear; silently trust the target dirname as the allowed root; treat canonicalized symlinks as safe; delete an unowned temporary; claim repeated path checks defeat arbitrary concurrent directory replacement.
- Blacklist JavaScript-looking labels without a compatibility decision, hide warnings in new files, disable rules/TLS checks, add NOSONAR/ignores, or treat a synthetic fixture as private real-use evidence.
- Install scanners, start remote services, guess Sonar project keys, request/store credentials, reset authentication, or change tooling configuration under this brief.
- Call historical tests, failed tools, provisional dispositions, or self-review a final scan pass or independent Challenge approval.

### Assumptions and risks

| Assumption / missing evidence | Consequence and resolution |
| --- | --- |
| Operator controls root selection; CLI is not a privileged service exposed to untrusted callers. Supported by guide, `resolveRepoRoot`, and rooted-config test. | If a real untrusted/privileged caller is discovered, stop and return to Architect for upstream authorization; current containment alone cannot protect against intentional root reselection. |
| [UNVERIFIED] Directories are not concurrently swapped by a hostile same-user writer. | Ancestor checks have TOCTOU limits; no portable race-proof guarantee from path-based Node APIs. Shared/hostile directories require a separate design, not undocumented trust. |
| [UNVERIFIED] S1-TEMP is reproducible through a synthetic public CLI invocation. Source supports it; runtime exploit proof is not yet run. | Run the red preservation check first; correct the disposition if it does not reproduce rather than overstating exploitability. |
| [UNVERIFIED] Reserved-looking labels survive upstream routing as ordinary own keys. | Exercise the real `planTask` call path. If a defect is owned by the router, stop for focused scope approval; do not silently edit router/config or reject labels globally. |
| [UNVERIFIED] Native Snyk authentication remains usable and recognizes the hardening. | Run final file scans; failures remain tooling blockers and residual warnings require independent dispositions. MCP 401 does not negate CLI results or prove MCP recovery. |
| [UNVERIFIED] Authorized Sonar operator can recover analysis and restore automatic analysis. | No critical design decision depends on a guessed key or service fix. Closure depends on actual successful final-file analysis/restoration; F-S1 stays blocked until then. |
| [UNVERIFIED] Independent Challenge accepts the HTTP test-context disposition. | Do not mark the warning cleared prematurely. Rejected disposition requires a focused amended transport plan, not global TLS bypass or weakening the positive control. |
| Supplied graph and scan snapshots can age; current IDE output is not a fresh Sonar run. | Ground implementation in final direct files, preserve snapshot provenance, and rescan final code before security acceptance. No graph certainty or hidden model-switch claim. |

- No blocking ownership question remains for independent Challenge. The root-trust assumption, temporary-file ownership proof, HTTP disposition and mandatory Sonar block are the highest-value challenge targets.

## Appendix A: Scanner Triage Challenge Revision (2026-09-29)

### Status and precedence

- Responds to the appended **Decision Calibration Scanner Triage Challenge** in [Architect Challenge verdict](../reviews/architect-challenge-verdict.md). That task's verdict is **REVISE**, not the earlier tasks' APPROVED verdicts. This appendix supersedes the earlier S1-TEMP hypothesis/unverified wording, generic bootstrap proposal, and provisional HTTP disposition where they conflict; all other scope and freeze constraints remain binding.
- Scope of this revision: this brief only. No evaluator, test, guide, config, fixture, scanner configuration, or verdict edits. **Implement remains unauthorized until repeat independent Challenge approves the revised brief.** F-D4 remains closed; F-S1 and release/security clearance remain BLOCKED pending final-file scanner, triage, and automatic-analysis restoration evidence.
- Evidence: current `atomicWrite` attempts `writeFileSync(temporary, ..., { flag: "wx" })`, then unconditionally unlinks an existing temporary in its catch. A same-PID pre-existing regular sentinel deterministically reaches `EEXIST` and is deleted; a symlink to an existing sentinel payload is itself unlinked, while its target remains intact. This is an unowned-file deletion defect, not demonstrated target overwrite or traversal. A dangling link is missed by `existsSync`; the repaired guard must still reject and preserve it. The user's supplied deterministic exploit observation supplements the Challenge's source finding; this documentation revision does not claim a new runtime reproduction.
- Context: brief, appended verdict, memory protocol/routing notes, and direct evaluator/test reads suffice for this amendment. Fresh graph status is stale by 3 commits / 13 files, with refresh readiness now ready; no refresh or fresh graph impact proof is claimed. No tool-discovery entrypoint is exposed here for deferred Sonar calls; no successful toggle, analysis, restoration, or scanner recovery is claimed.

### Exact child command and test ownership

1. Extend only the existing adjacent evaluator test suite after approval. Generate a disposable `preload.mjs` within its synthetic temporary test area; no committed preload module, new production export, source rewrite, loader transform, or public filesystem adapter. Each scenario gets a separate child and disposable root. The test owns and removes these artifacts only after preservation assertions.
2. Launch the real evaluator as the Node entrypoint: `node --import <preload.mjs> <absolute-evaluator.mjs> --repo-root <synthetic-root> --export-candidates --json`. Precisely, use `spawnSync(process.execPath, ["--import", pathToFileURL(preloadPath).href, evaluator, "--repo-root", root, "--export-candidates", "--json"], options)` with the existing cwd/environment helpers and a bounded timeout. File URLs avoid Windows preload path ambiguity. The evaluator remains `process.argv[1]`, so its existing entrypoint guard runs `main`; the preload must not statically import the evaluator or manually call an exported `main`.
3. For that export command, `destination` is `<synthetic-root>/.github/harness/runs/decision-calibration/candidates.json`. The preload embeds only test-generated absolute paths and a scenario identifier, creates the parent directory, and synchronously writes the known sentinel bytes to `${destination}.${process.pid}.tmp` before the evaluator is imported/executed. Leave the export destination absent so idempotence cannot bypass `atomicWrite`. Do not infer the child PID before launch or create the sentinel from the parent after `spawnSync`; the parent may use the returned PID for assertions after exit.
4. Use the same `--import` command shape with the existing valid, synthetic reviewed-import arguments for replacement scenarios. There `destination` is the synthetic root's canonical fixture. Prepare a consent-complete synthetic batch that actually changes that fixture, snapshot its bytes before launch, and require an uninstrumented successful-import control so validation/idempotence cannot masquerade as an injected write failure. Never import into the real repository.
5. In ordinary collision/fault children, explicitly remove inherited `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE` and `NODE_OPTIONS` from the child environment only. Restore neither in the parent because it is never mutated. A dedicated legacy-switch case alone sets the former to `"1"`. The preload and its scenario selection are test-owned command arguments/content, not newly recognized evaluator environment switches.

### Deterministic red-before-fix proof

- First add and run a focused CLI regression, named `atomic write preserves unowned temporary sentinel`, **before any production repair**. Its invariant is preservation even when the CLI fails: normal child exit with nonzero status, no signal/timeout/spawn error, empty stdout, and the original sentinel still a regular file with identical bytes. Record preload setup completion and the exact attempted exclusive-create failure (`EEXIST`) through a child-only observation of the real filesystem call. Setup/argv/fixture failures cannot count as the expected red.
- On current code, the CLI already fails but the sentinel-preservation assertion must fail because cleanup deletes it. Do not invert the assertion to expect deletion, mark the test expected-failure, or accept a generic nonzero process result as the red proof. Record the actual failed assertion before repairing `atomicWrite`; rerun the identical preservation test after repair and require it to pass while the collision still causes CLI failure. A repaired path guard may reject before open; do not require post-repair `EEXIST` specifically.
- Repeat with a temporary-path symlink to an existing synthetic payload outside the selected root but inside the disposable test area. Assert `lstat` still reports the symlink, `readlink` is unchanged, and target bytes are unchanged. Before repair the link-preservation assertion fails, not the target-byte assertion. After repair both pass. For a dangling link, require rejection and preservation of the link and continued target absence; report honestly that preservation may already pass before repair.
- For every failure scenario, require destination bytes unchanged (or continued absence for a new export), plus unchanged synthetic config, history, fixture and outside payload. Snapshot with test-owned reads, not by expanding production read authority. Unsupported symlink/junction privileges must produce explicit incomplete platform coverage and a required supported-platform run, never a passing ownership claim.

### Private sink fault-injection mechanism

- Exercise the real private `atomicWrite` through the public CLI. In the child preload, import the default mutable `node:fs` object and `syncBuiltinESMExports` from `node:module`, retain original filesystem functions, install scenario-specific wrappers, then call `syncBuiltinESMExports()` before the evaluator loads. This synchronizes its named filesystem imports. Do not replace `atomicWrite`, export it for tests, alter evaluator source, or rely on patching the parent test process.
- Match only the exact generated temporary path, destination pair, or descriptor returned by a successful real exclusive open of that temporary. All unrelated operations delegate unchanged. Record setup, operation, fault count and descriptor lifecycle through retained original functions into a separate test-owned receipt outside CLI stdout/stderr; do not include private content. Assert the selected operation was reached and the fault fired exactly once. Missing receipt or zero matching calls is test failure, not preservation proof.
- **Pre-open failure:** wrap `openSync` after repair to throw a fixed synthetic I/O error before calling the original for the matched temporary. Require no acquired descriptor, no created temporary, no attempted cleanup unlink, CLI failure and unchanged destination. The legacy switch below separately retains coverage of its existing pre-create failure.
- **Partial write:** wrap `writeFileSync` for the matched path on the pre-repair implementation and the captured descriptor on the repaired implementation. Call the original with a nonempty proper prefix of the intended serialized bytes and the same applicable encoding/create options, then throw a fixed synthetic write error. Observe that bytes reached the real temporary before throwing. For descriptor writes the wrapper must not close the descriptor or delete the temporary; real `atomicWrite` must close and clean it. This distinguishes ownership acquired at open from an incorrect flag set only after write returns. If implementation later uses another write primitive, explicitly update the child-only wrapper and prove reachability; a silent unmatched wrapper is forbidden.
- **Rename failure:** wrap `renameSync` only for `(temporary, destination)`, verify the real temporary exists with the expected serialized bytes, and throw a fixed synthetic rename error before invoking the original. Require the owned descriptor already closed at this point, followed by cleanup of only the owned temporary and unchanged destination. The wrapper must not perform cleanup or replacement itself.
- Observe real `openSync`, `closeSync`, `unlinkSync` and successful `renameSync` as necessary using pass-through wrappers and `syncBuiltinESMExports()`. Require close before rename, exactly one successful close per acquired descriptor, no unowned unlink, and no leaked descriptor at operation completion (a retained-original `fstatSync` check on the captured descriptor must give `EBADF`). Child process teardown alone is not close proof. Setup and receipt writes use retained originals so they cannot satisfy operation counters.
- Run partial-write and rename cases both before and after repair, but do not manufacture a red result if existing code already cleans those failures. The mandatory red is unowned sentinel/link preservation. After repair require collision preservation, partial-write cleanup, rename-failure cleanup, and a no-fault successful replacement with no remaining temporary and exact intended destination bytes.

### Production ownership and root contract

- Keep the local root-aware helper and its private ownership. After the temporary path passes the correct allowed-root and link checks, acquire with `openSync(temporary, "wx", 0o600)` and **establish ownership immediately when that call returns**, before any write or other fallible action. A failed open, including `EEXIST`, never confers ownership. Write through that descriptor, not a second path-based open; a flag set after successful `writeFileSync` is insufficient for partial-write failure.
- Close the acquired descriptor on success and failure; close before rename for Windows. Revalidate both source and destination at rename and containment/link state before cleanup. Unlink only a temporary acquired by this operation and still eligible under those checks; relinquish temporary ownership after successful rename. Never remove an existing regular sentinel, symlink, dangling link, or destination during failure cleanup. Cleanup errors must not mask the primary operation failure.
- Existing `assertContained` calls are caller validation, not proof that every actual sink enforces its root. Require the earlier source/root/sink matrix inside read, write, rename and cleanup boundaries, with `lstat` distinguishing genuine not-found from permission/I/O failures. Pair public CLI traversal/link cases with source-level review of every sink's independently supplied allowed root and child observations of actual operations; explicitly cover normal selected-root reads/export/import and no outside read content, replacement or deletion. Do not add a private-helper export simply to bypass callers for a test.
- Trust remains a stable, operator-owned directory tree and operator-selected repository root. Rechecks are defense in depth, not protection against hostile same-user concurrent path/ancestor replacement. Discovering a privileged/untrusted root selector or needing race-proof transactions requires a separate approved design.
- **Existing switch disposition: retain for compatibility in this slice.** `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE === "1"` remains a production-visible pre-create failure switch with its current trigger and error behavior. An actor controlling the inherited evaluator environment can deny a write; that environment is an explicit operator trust assumption, not an authenticated test boundary. Do not broaden the switch into partial-write/rename/timing injection or silently remove it. Test its failure with an absent temporary and with an unowned sentinel; repaired cleanup must preserve the sentinel. Removing the switch requires separate compatibility approval.

### Acceptance and handoff

- Gate 1-3/5 ownership and reuse remain unchanged. Gate 4b approval is pending repeat independent Challenge of this precise preload, ownership and proof contract. The requested review route remains GPT-6 Sol distinct from Architect GPT-6 Astra; no effective model identity or independent review execution is attested here.
- S1-HTTP now has Challenge acceptance of the **test-context** non-vulnerability disposition, conditional on proof of loopback/ephemeral bind, synthetic data, zero offline requests, positive live requests and teardown. This supersedes only the earlier pending-Challenge wording, not the need for final scans, a visible finding ledger or downstream review. No general production HTTP approval or suppression follows.
- After approval, run `node --test --test-name-pattern="atomic write preserves unowned temporary sentinel" scripts/harness/test/decision-eval-test.mjs` first against unrepaired code and preserve its assertion-level red evidence. Immediately after the ownership repair rerun that exact test, then the named link/fault controls and full evaluator suite. Record selected/executed/skipped counts, exits, fault receipts and byte comparisons. Continue all original compatibility, freeze, final-file Snyk/Sonar, restoration and cross-model review gates; none is waived by this appendix.
- Documentation exit for this revision: `npm run harness:memory:references:check`, `npm run harness:docs:check`, targeted Markdown diagnostics and direct whitespace/required-section checks of this brief. These prove document consistency only; runtime red/green tests and scanner clearance are deliberately not claimed or executed by this docs-only task. Hand back for repeat independent Challenge, not Implement.

## Appendix A Final Implementation Proof (2026-09-29)

- Implemented only `scripts/harness/decision-eval.mjs` and its existing adjacent test. `readBounded` and `parseBoundedJson` now require the selected root, validate containment and links at each read sink, and project filesystem failures to resource/operation categories without native absolute paths. The selected `--repo-root` / `HARNESS_PROJECT_ROOT` remains operator authority; checks are defense in depth, not a claim of hostile-swap race protection.
- `atomicWrite` now uses exclusive `openSync(..., "wx", 0o600)`, establishes ownership immediately after open, writes and closes the descriptor before rename, revalidates source and destination, and removes only an owned, still-regular temporary. The switch was removed during an intermediate implementation and restored under the approved compatibility contract; see the later Proof Corrections below. Child `--import` preload tests prove the pre-fix regular sentinel RED (unowned temporary deleted) and post-fix GREEN preservation, plus partial-write and rename-failure cleanup, descriptor close-before-rename, and unchanged destination. Generated temporary symlink/dangling-link coverage was attempted but skipped because this Windows environment denied link creation; it is incomplete platform coverage.
- Deterministic scoring now uses a local `Map` and serializes configured label order at the JSON boundary. Synthetic JSON-own labels `__proto__`, `constructor`, `prototype`, and `toString` pass through the real `planTask` evaluation path with exact own confusion entries; unknown labels still reject. This is defensive hardening, not a claim that the original code reproduced prototype pollution.
- Runtime proof: the initial exact collision regression failed with the sentinel removed (`ENOENT`); the identical named regression passed after repair. `npm run test:harness:decision-eval` passed 25 tests with 1 unsupported-link skip. `npm run test:harness:decision-sidecar`, `npm run harness:config:self-test`, `npm run harness:docs:check`, `npm run harness:memory:references:check`, and `git diff --check` passed.
- Final native scans: `snyk code test scripts/harness/decision-eval.mjs` reported 5 open LOW path-flow warnings and 0 ignored findings at the rooted `readFileSync`, `openSync`, descriptor `writeFileSync`, `renameSync`, and owned-temp `unlinkSync` sinks. The source has explicit selected-root containment, lstat link rejection, child CLI traversal/link tests, and no outside-read/write/delete regression; Snyk does not recognize this local capability boundary, so the warnings remain visible and are not suppressed. `snyk code test scripts/harness/test/decision-eval-test.mjs` reported 1 open LOW HTTP finding and 0 ignored findings. It is the existing loopback-only (`127.0.0.1`), ephemeral-port, synthetic stub with offline zero-request/live positive-request and teardown controls; retained as the approved test-context disposition, not production HTTP approval.
- Sonar automatic-analysis disable, file analysis for both changed files, and restoration were all attempted and each failed because the MCP server exited with code 1. No Sonar project/server configuration was changed and no clean analysis is claimed. F-S1 and release/security clearance remain **BLOCKED** pending supported-platform link evidence and a successful authorized Sonar analysis/restoration, plus downstream review of residual Snyk findings.

### Complexity Follow-up (2026-09-29)

- Local cohesive extraction reduced the reported cognitive-complexity diagnostics for `parseArgs`, `atomicWrite`, `exportCandidates`, `importReviewed`, `summarise`, and `main` to zero. New helpers remain local to the evaluator and preserve CLI dispatch, report shape/order, error handling, path checks, private `Map` tally behavior, and atomic-write ownership semantics.
- Final local diagnostic snapshot: evaluator has 21 existing path-flow reports (including duplicate locations) and 2 optional-chain style reports, with no complexity reports; the adjacent test has 6 test-only synthetic-path reports and no complexity reports. No finding was suppressed or ignored.
- `npm run test:harness:decision-eval` passed 25 tests with 1 Windows link-capability skip. Final native scans completed: `snyk code test scripts/harness/decision-eval.mjs` reported 0 issues; `snyk code test scripts/harness/test/decision-eval-test.mjs` reported exactly 1 open LOW HTTP issue at the existing loopback-only synthetic endpoint, with 0 ignored findings. The approved test-context HTTP disposition remains unchanged. Sonar remains unavailable; no status is amended here.

## Current Status and Proof Correction: Feedback on Breadth Pass 2 (2026-09-29)

This append-only reconciliation supersedes contradictory current-state claims in Final
Implementation Proof and Complexity Follow-up above, not the approved architecture or historical
sequence. See [Breadth Pass 2](../reviews/decision-calibration-scanner-triage-breadth-2026-09-29.md)
and the appended [Feedback verdict](../reviews/decision-calibration-scanner-triage-feedback-2026-09-29.md).

- **Design authorization:** Appendix A rechallenge and independent second Challenge in
[the Challenge record](../reviews/architect-challenge-verdict.md) are APPROVED for scoped
Implement. Earlier pending-approval language is historical. No architecture decision, public
API, scope, privacy/freeze constraint, scanner requirement or F-D4 closure changes here.
- **Delivery status:** Feedback is REVISE. F-S1 remains OPEN and release/security clearance
BLOCKED by accepted local proof/category gaps as well as missing external evidence. This is
not "local work complete" or "only Sonar blocked". The retained switch is now present at
evaluator 247-249 with the required `=== "1"` pre-create trigger; the prior removal statement
is not current. No new production injection modes are approved. Exact historical message
compatibility remains unverified, not silently certified.
- **Current file identity, freshly read by Feedback:** evaluator SHA-256
`B6F8BF8894E748799CB2C8C7562F3FC18AF67E26805DDFD25C6419FE729D60FA`;
adjacent test `41088FE21A3222EDB44401347D63E07C95E5E2D7EAA09A10BBDC1E1F4D012A91`;
guide `DC40252EE560669C920E9C8FE69DB57DBB0855FF8B0F10C44C34F23287CA76AD`.
These match Breadth's prefixes but are not scan-time receipts.
- **Runtime evidence, supplied by latest parent/Breadth, not rerun by Feedback:** evaluator TAP
30 tests, 30 pass, 0 fail, 0 skipped; sidecar suite exit 0 with evaluator tail 30/30. Windows
test 24 now executes existing/dangling junction cases under the current helper. It does not
execute Windows file symlinks or emit a link-kind diagnostic. Supported-platform file-symlink
and dangling-file-link evidence remains mandatory. Earlier 25-pass/1-skip counts are historical.
- **Fresh IDE snapshot:** evaluator 21 path-flow reports; test 11 path-flow reports, including
duplicate locations. No optional-chain or complexity reports returned. This supersedes the
earlier 2 style/6 test-report snapshot; it does not certify fresh Sonar complexity measurements.
- **Correct scanner provenance, user-supplied:** Snyk MCP Code evaluator completed with 0 issues;
MCP test completed with 1 LOW loopback HTTP. Native
`snyk code test scripts/harness/decision-eval.mjs` completed with 0 issues. Native
`snyk code test scripts/harness/test/decision-eval-test.mjs` failed on network with
`SNYK-CLI-0022`, producing no result. The earlier blanket "final native scans completed" claim
is invalid; the LOW test result belongs to MCP. No clean test scan or scan/hash binding is
evidenced. The approved conditional HTTP test-context disposition and visible warning remain.
- **Sonar external block:** startup exit 1; no completed final-file analysis; automatic analysis
remains unrestored. No authorized recovery signal or new retry by Feedback. Release owner
coordinates the authorized operator for bounded analysis/triage and successful re-enable;
no tool recovery, installation, credential request or configuration mutation is authorized.
- **Outstanding local acceptance:** B2-M1 requires exact replacement bytes and no-fault lifecycle
proof using evaluator-PID receipt, not the parent's temporary pathname; B2-M2 requires finite
child timeouts and normal status/error/signal assertions. B2-m1 requires explicit local
category identity, not message regex; B2-m2 requires in-child full descriptor identity/flags,
totals/order and specific unsupported-label rejection; B2-m3 completes same-PID import
collision and preservation assertions; B2-m4 reports link kind/capability. Exact minimal
actions/owners and optional nits are in Feedback; none of these code/test fixes occurs here.
- **Proof ownership:** B2-M3's factual correction is recorded, but final proof is still owed.
After repairs the proof owner records fresh counts, executed link kinds, final hashes and
BOTH native scan receipts, then independent Breadth/Depth/Feedback and mandatory Sonar proof.
Earlier config/self-test passes remain historical, not fresh runs for this Feedback.
- **Scope evidence:** scoped status shows committed config and fixture unmodified; their hashes
are `41274EA69F105900C7EDD018E278A9CD237748DEFB93FCE7720E82E4FC520FDB` and
`3928B7B9471D1C7ED2A230E293BB8524C9FC8970046728C780958577959315C2`, respectively.
No private labels/runs/queues/consent were opened. This pass edits only this brief's factual
record and the Feedback artifact, preserving existing source/test/guide changes.

## Implementation Correction: Breadth Pass 2 Actions (2026-09-29)

This append-only implementation record supersedes the outstanding-local-acceptance statement
above for the actions listed below. It does not alter the approved Appendix A architecture,
reopen F-D4, clear F-S1, or grant release/security approval.

- `atomicWrite` now marks locally-created filesystem failures rather than recognizing safe
	categories by message text. `openSync` errors become the owned `write` category, while marked
	read/write/replace errors and containment/link validation categories survive cleanup unchanged.
	The retained `HARNESS_DECISION_EVAL_TEST_FAIL_WRITE === "1"` pre-create compatibility switch
	remains unchanged and is covered for absent and unowned-sentinel temporary paths.
- The child runners now have a 30-second timeout. Preload/fault proof paths use
	`assertChildOutcome` to require no spawn error, null signal, an integer expected status before
	stdout or receipts are accepted. Ordinary validation-rejection CLI tests assert rejection only;
	they are not fault-child completion or timing proof.
- The changing reviewed-import matrix now covers a same-evaluator-PID unowned sentinel collision,
	pre-open, partial-write, and rename faults. Failure cases assert empty stdout, exact safe error,
	unchanged fixture/config/history, and the expected temporary ownership outcome. The collision
	receipt observes real `EEXIST` and proves that cleanup did not unlink the unowned sentinel.
- The no-fault reviewed-import control records the evaluator child PID, temporary and destination,
	descriptor write bytes (base64), and `open`, `write`, `close`, `rename-after-close` events. It
	proves the descriptor is closed before the real rename, observes no unlink, and compares the
	destination to independently constructed two-space JSON with a trailing newline.
- Reserved configured labels are checked in the scoring child with complete `Object.prototype`
	own-descriptor identity and flag comparisons. The test proves exact configured confusion-key
	order, total count, own tallies for `__proto__`, `constructor`, `prototype`, and `toString`,
	plus the explicit unsupported-label rejection. This remains defensive hardening; no historical
	prototype-pollution exploit is claimed.
- On this Windows run, temporary file-symlink creation was attempted first and denied; the test
	explicitly reported and exercised the `junction` fallback for existing and dangling targets.
	That is not file-symlink proof. Supported-platform existing and dangling file-symlink evidence
	remains required.

### Final Local Evidence

- `npm run test:harness:decision-eval`: 30 tests passed, 0 failed, 0 skipped; the output records
	`temporary link coverage: junction`.
- `npm run test:harness:decision-sidecar`: passed, including policy, HTTP, advisory, router,
	backend, freeze, and evaluator suites.
- `npm run harness:config:self-test`, `npm run harness:docs:check`, and
	`npm run harness:memory:references:check` passed. `git diff --check` found no whitespace error;
	Git emitted an unrelated existing LF-to-CRLF warning for the architect challenge record.
- Final SHA-256: evaluator
	`F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84`; adjacent test
	`A846C14265B738C078E50BBD1D85A820B0746B5997BC5CEEA8FF90F68AD0BCAE`; guide
	`DC40252EE560669C920E9C8FE69DB57DBB0855FF8B0F10C44C34F23287CA76AD`; frozen config
	`41274EA69F105900C7EDD018E278A9CD237748DEFB93FCE7720E82E4FC520FDB`; committed fixture
	`3928B7B9471D1C7ED2A230E293BB8524C9FC8970046728C780958577959315C2`.

### Native Snyk Receipts

- Native CLI authentication completed for the active CLI session before scanning.
	`snyk code test scripts/harness/decision-eval.mjs` completed against the evaluator hash above
	with 0 issues.
- `snyk code test scripts/harness/test/decision-eval-test.mjs` completed against the test hash
	above and exited 1 because it reported 1 open LOW issue, `Cleartext Transmission - HTTP Instead
	of HTTPS`, at `node:http.default.createServer` on test line 232; ignored issues: 0. This is the
	existing loopback-only, ephemeral-port, synthetic test stub covered by offline-zero/live-positive
	and teardown controls. The finding remains visible under the approved test-context disposition;
	it is not a production HTTP approval or a scanner suppression.
- Earlier MCP Code results remain distinct historical evidence: evaluator 0 issues and test 1 LOW.
	No MCP status/Code retry is claimed by this implementation record.

### Remaining Gates

- Current IDE output contains 21 evaluator path-flow diagnostics and no test-file errors. These
	are not Sonar results and remain for independent source-to-sink review.
- No successful Sonar automatic-analysis toggle, final-file analysis, or restoration was obtained;
	no Sonar response is inferred. F-S1 and release/security clearance remain **BLOCKED** pending
	authorized Sonar analysis/restoration, supported-platform file-symlink evidence, and renewed
	independent Breadth, Depth, and Feedback review.

### Final Receipt Correction

- After the prior record was written, the adjacent test added the required rename-primary plus
	unlink-failure regression. It proves that an owned temporary can remain after failed cleanup
	without replacing the primary `candidate queue replace failed` category; the existing
	partial-write variant proves the corresponding `write failed` category. The final focused suite
	and sidecar aggregate both passed after this addition (evaluator: 30 pass, 0 fail, 0 skipped).
- Final post-change SHA-256 identities are evaluator
	`F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` and adjacent test
	`9225AB78663DCDF3A37D26BF68D0B51579B8BDBFA0295A2E72CEBFDF21039404`; guide, frozen config,
	and committed fixture retain the hashes recorded above.
- Both native scans were rerun against these final identities: evaluator completed with 0 issues;
	test completed with the same 1 open LOW loopback `node:http.createServer` finding at line 232
	and 0 ignored issues. The test command is nonzero because Snyk reports that visible finding.
	No MCP or Sonar retry is claimed.
- Final IDE diagnostics are 21 evaluator path-flow reports and 10 synthetic-path reports in the
	adjacent test, with no other test diagnostics. They are not a successful Sonar analysis and do
	not change the remaining-gates status above.

### Final Scanner And Proof Correction: Breadth Pass 3 B3-M1/B3-M2 (2026-09-29)

This append supersedes only the earlier scanner-status statements that it expressly corrects. It
does not clear F-S1, grant release/security approval, reopen F-D4, change a scanner disposition,
or claim an unavailable Sonar result.

- Final evaluator SHA-256 is
	`F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84`.
	`snyk code test scripts/harness/decision-eval.mjs` completed with 0 issues.
- Final adjacent-test SHA-256 is
	`845CF7905BE4D1CE8F630844529627A22F31BA65F6F059B76FBD762B8C75FBF0`.
	`snyk code test scripts/harness/test/decision-eval-test.mjs` completed and exited 1 because it
	reported 1 open LOW issue, `Cleartext Transmission - HTTP Instead of HTTPS`, at
	`node:http.default.createServer` on line 232; ignored issues: 0. This is the existing
	loopback-only, port-0, synthetic test server. The finding remains visible; no suppression or
	waiver was added.
- These native CLI scan completions replace the earlier, now historical `SNYK-CLI-0022` test-file
	no-result status for this final test hash. A successful local CLI login is not represented as
	scan proof.
- No current-hash MCP Snyk Code receipt is recorded in this append. The earlier MCP results
	(evaluator: 0; test: 1 LOW HTTP) remain historical and are not used as final native-scan proof.
	A fresh MCP Snyk attempt stopped at `Authentication Error` for `https://api.snyk.io`; no Code
	scan was run.
- Sonar remains blocked. No final-file Sonar analysis or automatic-analysis restoration was
	obtained, and automatic analysis remains unrestored. The final disable attempt also failed
	because the Sonar MCP server exited with code 1, so no state change, analysis, or restoration is
	inferred.

The B3-M2 and B3-m1/m2 proof is now test-bound: every affected evaluator child path asserts no
spawn error, a null signal, an integer expected status, and the expected 0 or 1 exit before
accepting stdout or a receipt. Collision and fault paths assert exact stderr without the synthetic
root. Failure receipts identify the child PID, count owned-temporary unlink attempts exactly once,
and record partial-write byte counts and contents, proving $0 < actual < intended$. The successful
replacement control asserts status 0 before JSON parsing, exact write bytes, unchanged config and
history, and no unlink.

Fresh validation completed after these changes:

- `npm run test:harness:decision-eval`: 30 passed, 0 failed, 0 skipped; temporary-link coverage
	executed through the Windows `junction` fallback.
- `npm run test:harness:decision-sidecar`: passed: policy 5/5, HTTP 9/9, advisory 8/8, backend
	14/14, freeze, router integration, and evaluator 30/30.
- `npm run harness:config:self-test`, `npm run harness:memory:references:check`, and
	`npm run harness:docs:check`: passed. The final artifact identities retain the frozen config
	`41274EA69F105900C7EDD018E278A9CD237748DEFB93FCE7720E82E4FC520FDB` and committed fixture
	`3928B7B9471D1C7ED2A230E293BB8524C9FC8970046728C780958577959315C2`.
- Current IDE diagnostics are 21 existing evaluator path-flow reports and no adjacent-test-file
	reports. They are not Sonar results and supersede earlier test diagnostic counts in this record.

### Final Scanner Receipt Correction (2026-09-29)

This receipt records a hash-bound scan result for the test file at `73F6878B…`. Only scanner
claims explicitly marked as historical by a later hash-bound receipt are superseded; an earlier
error recorded for a different test hash remains historically accurate. The native Snyk test scan
that previously failed with `SNYK-CLI-0022` applied to a prior hash, not the final test file at
that time.

| File | Final SHA-256 | Native Snyk Code CLI | Snyk MCP Code |
| --- | --- | --- | --- |
| `scripts/harness/decision-eval.mjs` | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` | Completed, exit 0, 0 issues | Completed, 0 issues |
| `scripts/harness/test/decision-eval-test.mjs` | `73F6878B898B015204EF188F2527173702E5D834A603027DF9C825236371E8C0` | Completed, exit 1, one open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at `http.createServer`, line 236; 0 ignored | Completed, one same LOW HTTP finding at line 236 |

The LOW test finding is the approved test-context disposition: the server binds only to
`127.0.0.1` on an ephemeral port and exercises an offline-zero/live-positive request control with
synthetic temporary-root data and teardown. It remains visible; no suppression, ignore or waiver
was added. Native and MCP results agree on issue counts but are recorded as separate receipts.
The earlier MCP Snyk authentication-status error is not represented as a scan failure when the Code
scans themselves returned results. The native CLI test scan now has a completed result for this
final hash; this explicitly corrects the earlier no-result entry.

Current local test proof after the final test edit: `npm run test:harness:decision-eval` passed
30/30 with zero skips; `npm run test:harness:decision-sidecar` passed, including freeze and the
evaluator suite. Config, docs, memory-reference and whitespace checks passed. Config and fixture
hashes are unchanged as listed above. Windows executed the temporary-link preservation cases using
junctions, not file symlinks. WSL2 was present but had no Node/NodeJS runtime; no installation was
made. Supported-platform file-symlink evidence remains outstanding.

Sonar remains **BLOCKED**: automatic-analysis disable, `analyze_file_list`, and re-enable each
failed because the MCP server exited with code 1. No Sonar project key/connected-mode config or
local scanner executable was found. No Sonar result, restoration, finding triage, release/security
clearance or waiver is claimed. F-S1 remains open pending supported-platform file-symlink proof,
authorized final-file Sonar analysis/restoration, and renewed Breadth/Depth/Feedback review.

### Final S1 Receipt And Proof Correction (2026-09-29)

This receipt is the latest hash-bound scanner evidence and supersedes only earlier scanner results
that explicitly refer to a different test hash. Earlier records remain chronological evidence for
the hashes and tool outcomes they name; they are not claims about the current test unless hashes
match.

Correction note (2026-09-29): earlier child-exit and scanner-supersession wording in this brief was
corrected in place to match the verified fault-test scope and hash-bound receipt rules. Historical
review ledgers retain prior wording as evidence of what was reviewed at each stage.

| File | Final SHA-256 | Native Snyk Code CLI | Snyk MCP Code |
| --- | --- | --- | --- |
| `scripts/harness/decision-eval.mjs` | `F4081EAC61D4CC9691B48538B3F161A24CF2E14A13510E2A3B9303AA0A507F84` | Exit 0, 0 issues | Success, 0 issues |
| `scripts/harness/test/decision-eval-test.mjs` | `C3438CC376BE6BC48341498F34971977300C8A9EF5D19E796E960FA387801DBF` | Exit 1 after completed scan: one open LOW `Cleartext Transmission - HTTP Instead of HTTPS` at `http.createServer`, line 236; 0 ignored | Success, one same LOW HTTP finding at line 236 |

The test finding remains visible under the previously approved test-context disposition: an
ephemeral `127.0.0.1` server handles only synthetic temporary-root requests for offline-negative
and live-positive assertions, then closes in `finally`. No suppression, ignore or waiver was added.
The MCP authentication-status endpoint still reports an authentication error even though both MCP
Code calls return results; native CLI and MCP receipts are listed separately, not conflated.

Current proof on these source/test hashes: `npm run test:harness:decision-eval` and
`npm run test:harness:decision-sidecar` pass with 30 evaluator tests, 0 failed/skipped; config,
docs, memory-reference and `git diff --check` gates pass. The source/test edits do not change the
committed config or fixture. The compatibility switch is retained; the old proof sentence saying it
was removed describes an intermediate state and is superseded by the later correction and current
test coverage.

Child-exit evidence is scoped accurately: preload/fault children use bounded `spawnSync` and
`assertChildOutcome`; ordinary validation-rejection CLI tests assert rejection only and are not
fault-child timeout proof. Collision, partial-write and rename receipts require exact event counts,
expected child status before receipt parsing, preserve existing imports, and compare the real
serialized byte prefix. The exact test assertions are in the current hash listed above.

Supported-platform file-symlink proof remains outstanding. Windows ran the suite using junction
fallback; WSL2 has no Node/NodeJS runtime and no install was authorized. Sonar disable, final-file
analysis, and re-enable attempts all failed with MCP startup exit 1, so automatic-analysis state
and restoration are unverified. No successful Sonar result, final triage, release/security
clearance, or waiver is claimed. F-S1 remains **BLOCKED**.
