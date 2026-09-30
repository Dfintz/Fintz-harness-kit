# Architecture Brief: agent-git repository triage
resource: https://github.com/Einsia/agent-git, C:/Users/Fintz/AppData/Local/Temp/agent-git-review-a030a35, a030a35d5bbfdff3e9987b17a310c5a64d29489e

## Scope

Scope: external Rust CLI and npm distribution review.
Primary boundary: local session capture and secret filtering, authenticated Hub transport, process supervision, and release packaging.

## Understand output

- The local harness graph is fresh at the current harness commit; it does not model the external target.
- The target is a Rust workspace with an npm wrapper, CLI, Hub client, secret scanner, resident controller, and tunnel crates.
- The reviewed target revision is `main` at `a030a35d5bbfdff3e9987b17a310c5a64d29489e`.
- HEAD changes structured image-carrier recognition in the secret scanner and related documentation/configuration.

## Key decisions

1. Review the target at the immutable commit above rather than changing the external checkout.
2. Use a producer-reviewer topology: source/test evidence first, then independent breadth and depth challenges.
3. Treat image exemptions as narrowly scoped structural findings: only a validated image data occurrence may skip generic entropy detection; provider-specific credential rules must still run.
4. Treat authentication, process execution, filesystem permissions, and npm installation as separate trust boundaries.
5. Report only reproducible findings. Keep candidate concerns as hypotheses until source or executable evidence confirms them.
6. Pin review evidence to `HEAD=a030a35d5bbfdff3e9987b17a310c5a64d29489e` and `HEAD^=87e03c6`; do not rely on the moving branch name.

## Artifacts

No target artifacts will be modified. The only local artifact is this review brief and its final verdict record if needed.

## Constraints and Do NOTs

- Do not modify or publish the external repository.
- Do not report a dependency or platform issue as confirmed without a reproducible check.
- Do not treat the local harness graph as evidence about the target repository.
- Do not weaken or bypass target safeguards merely to make tests run.
- Preserve exact target commit identity in every finding.

## Validation contract

- Review the HEAD diff and all changed call paths.
- Run available target checks (`cargo check --locked`, targeted tests, npm/package checks); record unavailable toolchains explicitly.
- Inspect trust-boundary code and relevant tests for correctness, failure handling, and scope.
- Complete breadth and depth ledgers, then adjudicate confirmed findings and unresolved hypotheses.
- Review image policy separately from generic image validation. Test MCP, non-MCP, malformed, escaped, redacted, oversized, and credential-bearing carriers.
- Trace named boundaries: `src/hub/client.rs`, `src/infra/credentials.rs`, `src/rc/harness/proc.rs`, `npm/lib/resolve.js`, `npm/lib/run.js`, and `npm/postinstall.js`.
- Run `npm run check-version` and `node --test npm/*.test.mjs` from the target checkout. Cargo checks remain required evidence but are unavailable on this machine.
- Include inherited environment, executable override, setup side effects, token logging, refresh persistence, filesystem permissions, and cross-platform process cleanup in the safety pass.

## Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED]` The requested triage refers to the current public `main` commit. | Review baseline | A branch or PR could contain different defects. |
| `[UNVERIFIED]` Rust validation tools are installed on the review machine. | Executable proof | Static review confidence is lower if `cargo` is unavailable. |
| `[UNVERIFIED]` The public Hub implementation matches the client protocol in this checkout. | End-to-end auth review | Client-only evidence may miss server contract failures. |

## Stage verdicts

### Architect Challenge

VERDICT: APPROVED after revision. The baseline is pinned to `a030a35d5bbfdff3e9987b17a310c5a64d29489e` with parent `87e03c6`. The plan now separates generic image validation from exemption policy, names the trust-boundary entry points, and records the missing Cargo proof.

### Implement

No target implementation performed. The external checkout remained read-only. Local proof collected: target `npm run check-version` passed, target `node --test npm/*.test.mjs` passed all 8 tests, target `npm pack --dry-run --ignore-scripts` passed, and target `git diff --check HEAD^ HEAD` passed. `cargo check --locked` could not run because Cargo is not installed on this Windows machine.

### Review Breadth Findings Ledger

- Major, proof gap, HIGH confidence: Rust compilation and secret-scanner tests were not executable in this environment. Run `cargo check --locked` and targeted `cargo test --locked` in CI or a Rust-capable environment before merging or publishing.
- Minor, coverage gap, MEDIUM confidence: the checked-in media tests cover MCP-shaped images and malformed/redacted image data, but do not by themselves establish the intended policy for every non-MCP structured image carrier. Keep the policy explicit and add a non-MCP case if those carriers are intended to receive the same exemption.
- No confirmed blocker, credential leak, npm packaging failure, or process-supervision defect was established by the available evidence.

Coverage note: inspected the HEAD diff, media scanner path, credential authority/persistence path, npm binary resolution/postinstall/run wrappers, release package surface, and available npm tests. The public Hub server and Rust execution were not available locally.

### Review Depth Gate Ledger

| Gate | Verdict | Evidence |
| --- | --- | --- |
| 1 Domain/module alignment | PASS | Image validation is owned by `src/domain/secrets/media.rs`; scanner integration remains in `src/domain/secrets/mod.rs`. |
| 2 Generality | PASS | Structural validation is reusable and policy remains at the scanner call site. |
| 3 Ownership | PASS | Media classification, credential persistence, npm resolution, and process supervision remain in their existing owners. |
| 4 Boundary integrity | PASS | Provider rules run independently of generic entropy suppression; npm wrappers remain thin. |
| 4b Isolation/safety | PASS with residual proof gap | Credentials are authority-bound and process paths are supervised; Rust runtime checks were unavailable. |
| 5 Reuse | PASS | Existing scanner, npm, and supervision patterns/tests are reused. |

### Feedback Verdict Record

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | The image exemption may suppress provider credential findings. | Current decision holds | `raw_hits_capped_in` applies media containment only to bare entropy spans; the checked-in AWS-in-image test preserves the provider rule. | HIGH | No change. |
| 2 | The external review baseline could drift because `main` moves. | Challenge upheld and resolved | Target HEAD and parent were pinned and recorded above. | HIGH | Review only the pinned commit. |
| 3 | Missing Cargo execution makes the triage unsafe to accept as fully validated. | Third option | npm checks and static source review pass, but Rust proof is unavailable. | HIGH | Accept only as a triage report; require Rust CI proof before release approval. |
| 4 | The public Hub contract can be fully judged from this checkout. | Insufficient evidence | The server is a separate repository and was not supplied. | HIGH | Keep end-to-end Hub compatibility unverified. |

Accepted changes: none to the external repository; require Rust-capable CI validation before ship.

Rejected challenges: no confirmed defect requiring a source patch was established.

Deferred points: server-side Hub compatibility and non-MCP image policy need their respective evidence.

Brief updates: baseline pinning, named trust boundaries, and explicit Rust proof requirements are now part of this record.

Final triage verdict: **CONDITIONAL ACCEPT / NOT RELEASE-READY FROM THIS ENVIRONMENT**. The reviewed HEAD has no confirmed blocker in the available evidence, but Rust compilation and scanner tests must pass elsewhere before a release decision.

## Explicitly not created

- No patch or fork: the user requested triage, not remediation.
- No new target tests: adding tests would change the reviewed artifact and invalidate the immutable baseline.
- No local graph refresh for the target: the harness graph is repository-local and cannot safely ingest an unrelated checkout during this review.