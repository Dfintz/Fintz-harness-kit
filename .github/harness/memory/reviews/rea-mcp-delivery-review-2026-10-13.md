# REA MCP Delivery Review

Date: 2026-10-13. Packet: [Architecture Brief](../briefs/rea-mcp-delivery-2026-10-13.md).
Scope: stdio result provenance, optional output capture/retention/resources, fresh-policy reads,
schema, directly related tests and operator documentation. Existing decision-backend work excluded.

## Breadth Findings And Adjudication

Independent Explore agent reviewed the changed files without edits. Its findings were evaluated
against source, the approved Brief and real SDK proof; severity labels are not accepted without facts.

| Challenge                                                               | Verdict                    | Evidence or action                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh authorization config is stale between dispatch and resource read. | Current decision holds.    | Each resources/read invocation loads `loadConfig({fresh:true})` before its synchronous authorization callback. The SDK test revokes permissions on disk and observes denial. Loading twice in one synchronous read would add no evidence. |
| Missing caller silently disables capture.                               | Current decision holds.    | Reply explicitly reports `retainedOutput.state: missing-caller`; no stderr warning or credential logging needed. Added SDK assertion of that state and incomplete coverage.                                                               |
| Bearer regex should omit padding or allow colons.                       | Current decision holds.    | Current known-pattern matcher handles RFC-style token characters and optional padding; removing padding is not a security improvement. Arbitrary/encoded secrets are explicitly unsupported.                                              |
| Same-prefix token collision test missing.                               | Current decision holds.    | Existing first/second tokens share their first 16 characters; both helper and SDK tests reject the different full token.                                                                                                                  |
| Lazy expiry violates TTL.                                               | Current decision holds.    | Decisions 9-10 and operator docs explicitly require lazy expiry; access after TTL fails, while capped storage bounds idle retention. No cleanup timer promised.                                                                           |
| Strengthen split-secret and response-overflow proof.                    | Challenge upheld in part.  | Partial capture now uses an actual secret prefix and must drop it. Existing oversized-metadata test exercises zero-preview fallback and serialized-byte bound; finite wrapper-failure transport remains a limitation.                     |
| Dispatch guard is called twice.                                         | Out of scope.              | Both calls predate this implementation; quota semantics were intentionally not changed. No claim that duplication is harmless is accepted.                                                                                                |
| Schema must use integer.                                                | Current decision holds.    | Repository validator rejects integer-typed JSON numbers. Standard number/multipleOf schema plus runtime safe-integer enforcement preserves the contract; config self-test passes.                                                         |
| Output read auditing could be added.                                    | Parked design alternative. | User approved memory-only retention without additional read audit persistence; no traceability guarantee is claimed.                                                                                                                      |

No substantiated new Blocker/Major finding remains after this adjudication. This does not erase
pre-existing IDE path-access diagnostics or establish hostile multi-user authentication.

## Proof

- Provenance RED: `npm run test:mcp:stdio:mrtr` failed at missing continuation metadata.
- Provenance GREEN: same SDK test passes success, continuation, validation error and unknown-tool paths.
- Delivery: `node scripts/harness/test/mcp-result-delivery-test.mjs` passes helper lifecycle and SDK
  paging, identity, authorization revocation, foreign session, tail recovery and default-off cases.
- Existing `npm run test:mcp:dispatch` aggregate passes; new delivery test is added to that aggregate.
- `npm run harness:config:self-test` passes.
- Snyk Code scans returned zero issues for all six changed first-party JavaScript files.
- Editor diagnostics: new helper/tests/config have no issues; existing memory-path warnings remain
  in unrelated sections of MCP server/tools. Full repository build/test and hosted model distinction
  are not asserted by these focused checks.

## Depth

First independent depth verdict: REVISE. Fresh reads were overwriting the shared config cache,
contradicting the cached-caller contract. Challenge upheld; `readConfigSnapshot` now owns independent
validated reads, and `loadConfig` updates cache only for default reads. The explicit request snapshot
is passed to both existing dispatch guards; their permission/quota rules are unchanged.

`harness:config:self-test` gained a regression for successful and invalid fresh reads retaining
the original cached object. It failed at cache identity before repair and passed after repair.
Second independent depth verdict: PASS; reviewer also reran config, delivery and provenance tests.

| Gate               | Verdict | Evidence                                                                            |
| ------------------ | ------- | ----------------------------------------------------------------------------------- |
| Domain             | PASS    | Delivery logic beside MCP; execution capture remains in the wrapper.                |
| Generality         | PASS    | Common provenance; output pilot limited to dispatch.                                |
| Ownership          | PASS    | Independent policy snapshots; server-local store; executor capture coverage.        |
| Boundary integrity | PASS    | Explicit snapshot flow; no arbitrary file reads or new execution authority.         |
| Isolation          | PASS    | Default-off, full fingerprint, UUID references, TTL/caps and fresh read permission. |
| Reuse              | PASS    | Existing authorization, SDK client and resources protocol retained.                 |

## Feedback And Limits

The architecture and depth challenges were upheld where executable evidence reproduced their
concerns. Breadth findings contradicted by source or passing discriminating tests were rejected
individually above. Both adopted radar ideas have locally implemented first slices; parked/rejected
ideas remain unchanged. Human review is still required; nothing was committed or released.

Independent reviewers were used, but distinct hosted model identities were not attested. The byte
budget applies to serialized results, not the outer JSON-RPC frame. Live wrapper-transfer failure
was not injected. Lazy expiry and best-effort secret redaction are explicit contract limitations.
Existing IDE memory-path diagnostics were not changed or claimed resolved.

Final validation passed: registered delivery test, dispatch aggregate including that test, stdio
provenance, config cache-isolation, memory ACL checks, and docs contracts. Snyk scans of all seven
changed first-party JavaScript files returned zero issues, including rescans after final code edits.
Sonar analyzed the final files: the new delivery helper has no findings. Its two sequential-test
await-loop warnings are intentional (next-page dependencies and one fixture lifecycle); existing
MCP import/deprecation, memory-path and older server quality diagnostics are outside this change.
No repository-wide clean claim is made.

Bearer/private-key redaction and successful-command delivery-overflow status now have focused
assertions. Capture-option selection was moved into the delivery helper rather than adding branches
to the legacy command executor. User's existing config, bakeoff work and unrelated changes remain
preserved; only a new test script and its aggregate membership were added in the dirty package file.

## Release Preflight: v3.9.0

The release snapshot excludes the pre-existing bakeoff/config changes and generated artifacts.
Its package is staged independently from HEAD plus release/MCP-test changes; user edits remain in
the worktree. An isolated detached worktree with its own locked dependencies passed `test:full`,
docs contracts, fast health, and version/whitespace checks before commit/tag publication.

Preflight found fixable dependency advisories and refreshed compatible security floors/lockfile.
The installed snapshot resolves SDK 1.32.1, ip-address 10.7.3, and proxy-addr 2.0.8. npm audit is
clean. Snyk SCA retains one high Zod advisory without an upstream fix; Zod 4.4.3 is identical to
v3.8.0. Release notes explicitly disclose it. No ignore, scan suppression or trust exception was
introduced. This residual risk is not covered by first-party Snyk Code scan success.
