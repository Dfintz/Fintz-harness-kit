---
summary: Add untrusted MCP result provenance and an opt-in, bounded session-local command-output pilot.
type: brief
status: implemented
source: human
created: 2026-10-13
updated: 2026-10-13
tags: [mcp, provenance, output-budget, rea]
---

# Architecture Brief: REA MCP Delivery

## Task And Context

Implement the two adopted REA radar ideas, not the parked unknown ledger or rejected runtime.
Baseline: `542a0870ad32860e09123a0b4899e99ef29dc2b1`; graph fresh at routing. Existing dirty
decision-backend/config/package changes belong to the user and must be preserved.
Inputs: both adopted radar entries, MCP tool/result/resource handlers, command dispatch wrapper,
stdio SDK test/client, command-dispatch tests, auth and resource access owners.
Scope: software and directly related documentation. Boundary: MCP stdio delivery and dispatch output.

## Understand

`mcp-server.mjs` owns stdio results and per-server state. `mcp-tools.mjs` executes configured
commands and truncates normal output at 10,000 characters. `runWrapper` buffers wrapper JSON.
Consumers include SDK clients, audit records, and existing resource readers. MRTR owns missing-input
continuations, not result paging. Graph context-pack confirmed the runWrapper -> createServer path;
source reads confirmed its inferred edges. No external runtime is required.

## Gates

| Gate | Decision |
| --- | --- |
| Domain | Delivery metadata and response budgeting belong beside MCP delivery, not routing. |
| Generality | One small delivery helper serves every stdio tool result; retention starts with dispatch only. |
| Ownership | Executor owns capture coverage; server owns short-lived retained output and references. |
| Boundaries | No arbitrary path reads, new execution tools, external dependencies, or changes to HTTP contracts. |
| Isolation | Retention is off by default, server-instance scoped, caller-bound, expiring, byte/entry capped, and memory-only. Reads recheck command authorization. |
| Reuse | Reuse stdio SDK client and resource protocol; preserve existing memory ACL and dispatch admission. |

## Decisions And Constraints

1. Label all application-level tool results `_meta.provenance` with `untrusted_content: true` and
   `source: harness-tool-result`, including continuation and error results. Preserve payloads and
   existing metadata. JSON-RPC framing/schema failures are not tool results; no label is claimed there.
   Server instructions explain that repository/process text is data, not instructions or authority.
2. Pilot retained output only when operator configuration explicitly enables it. Keep normal CLI
   behavior unchanged. Do not enable it in the user's current config.
3. Retain only stdout/stderr and coverage facts in a bounded per-server in-memory store, not raw
   command vectors, arguments, environments, caller tokens, or disk files. This is a deliberate
   smaller slice than persistent run artifacts: restart ends retention, no durability is promised.
   Existing audit files are outside this memory-only claim; new retained tails and resource references
   must not be added to those files. Redact the pilot's commandResolved/diagnostic fields as well.
4. Use unguessable, server-local exact resource references with bounded UTF-8-safe pages. Do not list
   retained output publicly or accept filesystem paths. Bind each entry to caller identity and command;
   recheck authorization without consuming execution quota. Missing/expired/denied reads are indistinct.
5. Redact known credential patterns and current secret-like environment values before storage/delivery.
   Redaction is defense in depth, not proof arbitrary command output is secret-free; operator consent
   and process/client isolation remain necessary. Retention failure must preserve command status.
6. Budget the whole serialized dispatch tool reply, including text duplication, escaping, and metadata.
   Keep execution, capture, storage, and delivery limits separate. Overflow/timeout captures are partial,
   never complete; reads never rerun the producer. Other tools keep current delivery behavior.
7. No changes to allowed tools, authentication defaults, destructive defaults, approval gates, or
   parked/rejected radar decisions. Async task output is outside the retained-output pilot.
8. Approved trust boundary: one trusted stdio client per server process, not a shared or remote
   multi-user service. Caller metadata is bookkeeping, not cryptographic identity. Retention uses
   `params._meta["harness/caller"]` containing the existing caller context shape. Require an explicit
   valid caller for capture/read, hash the full normalized identity including full token, and never
   retain that token. Do not change runDispatchGuard or infer new execution authority from this carrier.
9. Read authorization is separate from dispatch quota: require pilot still enabled, matching
   server-local opaque reference, TTL, full caller fingerprint, and freshly loaded command permission.
   No output resources in lists, notifications or ResourceCache. Missing/expired/denied replies use
   one unavailable error. Missing retention context leaves execution unchanged but captures nothing.
10. Finite pilot defaults: 128 KiB per-stream process capture, 2 MiB wrapper JSON transfer, 256 KiB
    per stored output pair, 1 MiB aggregate and 16 entries, five-minute TTL, and 1,024 UTF-16-unit
    resource pages that never split surrogate pairs. Reject new retention at capacity rather than
    silently evicting useful output; expire entries lazily before access/admission.
    `commandDispatch.retainedOutput.enabled === true` opts in. `responseBytes` defaults to 32 KiB,
    accepts safe integers 8-64 KiB, and invalid settings disable the pilot. Whole dispatch and output
    resource replies must fit that budget; minimal overflow diagnostics preserve execution status.
11. Redact known token/private-key patterns and secret-like current environment values before all
    pilot delivery/storage. Discard a trailing incomplete line on partial process capture so a
    split secret is not presented as safe complete output. Capture coverage is explicit on timeout,
    signal, process-buffer overflow and wrapper failure. Arbitrary/encoded secrets remain a limitation.

## Approval And Challenge

- 2026-10-13: User explicitly approved both implementation slices, opt-in caller-bound output
  resources, and independent review agents. Defaults and execution permissions stay unchanged.
- Initial Architect Challenge: REVISE; required supported metadata carrier, single-client trust
  scope, finite bounds, read authorization and clearer audit/redaction contracts. Decisions 8-11
   address these findings. Second independent Architect Challenge: APPROVED; verdict captured in
   `../reviews/rea-mcp-delivery-architect-challenge-2026-10-13.md` before runtime changes.

## Artifacts

- Modify `scripts/harness/mcp-server.mjs`: common provenance boundary, gated dispatch delivery and
  exact resource reads. Modify `mcp-tools.mjs`: internal bounded capture path for the pilot only.
- Add `scripts/harness/mcp-result-delivery.mjs`: result metadata, byte-safe preview, bounded
  session-output lifecycle. Add a helper only if executor capture needs a separate responsibility.
- Extend existing stdio and command tests; add one focused delivery test only if existing files cannot
  exercise the lifecycle without mixing unrelated scenarios.
- Document pilot settings, lifecycle and limits in `.github/MCP-INTEGRATION.md`; link shipped proof
  from both adopted radar entries. Preserve user config; schema changes are additive if needed.
- Not created: REA dependency, external skill, evidence daemon, disk-log archive, unknown registry.

## Acceptance And Validation

- RED/GREEN: existing stdio SDK MRTR test asserts untrusted metadata on success, continuation,
  invalid continuation and unknown-tool results; payloads remain intact.
- Output test: a configured command emits over 10,000 characters, Unicode, quotes and a final marker.
  Inline reply fits the configured byte budget; authorized pages recover the redacted tail and status.
- Test nonzero exit, timeout, capture overflow, disabled behavior, redaction, storage exhaustion,
  retention expiry, foreign server/caller, missing references and no re-execution on reads.
- SDK round-trip must preserve `_meta` caller identity; test missing context, same-prefix/different
   tokens, revoked permissions, output absent from lists, and resource reply byte bounds.
- Run focused dispatch/auth/ACL/stdio tests, docs contracts, editor diagnostics, Snyk and Sonar.
- Independent Architect Challenge before runtime changes; breadth/depth review after focused proof.

## Risks And Assumptions

- An opt-in preview/resource contract is additive; existing clients must retain default behavior.
- Caller identity uses existing trust semantics; this does not establish new authentication guarantees.
- Memory-only retention avoids Windows file ACL assumptions but is not durable or a sandbox.
- Provider/model routing is advisory for this session; do not claim a model switch without evidence.
- Design status: approved; implementation delivered in two focused slices. Provenance SDK RED/GREEN
   and output helper/SDK proof are recorded in `../reviews/rea-mcp-delivery-review-2026-10-13.md`.
- Implementation refinement: `loadConfig({fresh:true})` is required for pilot admission and each
   output read because the default loader intentionally caches for process lifetime. Existing callers
   retain cached behavior; no dispatch guard or permission rules were rewritten.
- Independent depth review initially required cache ownership repair; the new cache-isolation
   regression went RED/GREEN, and the second depth review passed all six gates. Fresh snapshots now
   leave the default cache untouched and are passed explicitly to dispatch admission.
- Independent-agent reviews completed; distinct hosted model identity was not attested. Human review
   remains required before shipment. This brief records local implementation, not a commit or release.
- Serialized result limits exclude the enclosing JSON-RPC frame; lazy expiry is access-based and
   live wrapper-transfer failure was not injected. No wider transport or secret-detection guarantee
   is claimed. Final scan/check outcomes are recorded in the review artifact.
