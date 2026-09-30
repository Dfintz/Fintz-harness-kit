---
summary: "Architecture Brief - Pi.dev capability review and external-agent event-ingestion candidate"
type: brief
status: active
source: research
created: 2026-09-29
updated: 2026-09-29
tags: [pi, external-research, events, extensions, sessions]
---
<!-- markdownlint-disable-next-line MD022 -->
# Architecture Brief - Pi.dev Capability Review
resource: <https://pi.dev/docs/latest>, <https://pi.dev/docs/latest/extensions>, <https://pi.dev/docs/latest/packages>, <https://pi.dev/docs/latest/json>, <https://pi.dev/docs/latest/rpc>, <https://pi.dev/docs/latest/sessions>, <https://pi.dev/docs/latest/security>, .github/harness/memory/briefs/external-harness-source-audit-2026-08-03.md, .github/harness/memory/briefs/agent-plugins-v1-compatibility-2026-08-07.md, plugins/agent-plugins/harness-kit/plugin.json, scripts/harness/harness-proxy.mjs
Status: active

## Objective

Evaluate the current Pi documentation for improvements that transfer to this provider-neutral
harness, record the adoption disposition for each capability family, and avoid importing a
persistent agent runtime into an orchestration kit.

## Context Sufficiency

| Artifact | Evidence it supplies | Owner |
| --- | --- | --- |
| Pi documentation | Current extension, package, session, event, RPC, SDK, and security contracts | External Pi runtime |
| `scripts/harness/harness-proxy.mjs` | Existing upstream-chat proxy that injects a routing plan and passes stream bytes through | Harness integration adapter |
| `plugins/agent-plugins/harness-kit/plugin.json` | Existing portable skills-only distribution pilot | Skill packaging |
| Prior Pi and plugin briefs | Existing decision boundaries and portable-package constraints | Harness decision memory |

**Scope:** documentation and decision memory.
**Primary boundary:** provider-neutral orchestration contracts versus Pi's persistent runtime.

No critical artifact is missing for a capability disposition. A future implementation of an
external-agent event adapter would require a concrete local consumer and its protocol examples.

## Understand Impact Map

- Graph status: fresh at `HEAD` `646372654df58f550f9af10242e1b8490dad0dc4` after refresh.
- Direct artifacts: this Brief and one radar entry for an external-agent event-ingestion candidate.
- Affected layers: research memory, future integration adapters, and operator documentation.
- Graph evidence: the prior Pi radar and Brief are leaf documents; `harness-proxy.mjs` has no
  import dependents in the current graph.
- Residual risk: low for this decision-memory change; medium for any future event-adapter task
  until real producer traces and a consumer are specified.

## Capability Disposition

| Pi capability | Local assessment | Disposition |
| --- | --- | --- |
| Strict JSONL event stream with `agent_settled`, tool lifecycle, retry, and compaction events | A useful input pattern, but one Pi protocol does not establish a provider-neutral contract and the harness has no local process supervisor or dashboard consumer for a normalized stream. | Park a single event-ingestion candidate. |
| RPC process control and TypeScript SDK | Useful when embedding or supervising Pi itself, not when routing work among heterogeneous editors and agents. | Reject from harness core. |
| Session tree, fork, clone, automatic compaction, and branch summaries | Correctly owned by a persistent agent runtime; the harness already owns stage handoffs and bounded compaction artifacts, not host conversation state. | Keep prior rejection. |
| Executable extensions, dynamic tools, provider registration, and terminal UI | These run with the Pi process permissions; Pi explicitly states project trust is not a sandbox. | Reject from harness core. |
| npm/git package installation and project-local package loading | The harness already has a generated, skills-only Agent Plugins export. Adding a package loader would introduce an unsafe execution and lifecycle boundary without a consuming client. | Keep the skills-only export boundary. |
| Tool annotations and explicit approval policy | Good design reference, but current harness safety controls belong in MCP contracts, command guards, and existing approval instructions rather than a Pi extension model. | No new artifact. |

## Architecture Gates

| Gate | Verdict | Decision |
| --- | --- | --- |
| 1. Domain alignment | PASS | Capability research belongs in committed decision memory; a future protocol adapter belongs with integration adapters, not the core stage machine. |
| 2. Generality | PASS | Only a future mapping backed by multiple producers may become provider-neutral; Pi-specific APIs and TUI behavior are not. |
| 3. Ownership | PASS | Pi owns its session and extension runtime. The harness owns routing, run evidence, and any future external-event normalization. |
| 4. Boundary integrity | PASS | Do not turn `harness-proxy.mjs` into a Pi runtime or package loader. Keep any future ingestion adapter separate from routing-plan injection. |
| 4b. Isolation and safety | PASS | Do not load third-party Pi packages or extensions. Pi's project trust is not sandboxing, so no new execution permission is justified. |
| 5. Reuse | PASS | Reuse the existing radar template, portable skills-only package, MCP contracts, command guards, and run evidence surfaces. |

## Key Decisions

- Create one parked radar entry for a possible external-agent event-ingestion contract.
- Do not add Pi as a dependency, invoke its installer, or add a Pi package loader, extension host,
  session store, TUI, or SDK adapter to this repository.
- Do not duplicate the existing generated Agent Plugins skills-only export with a second package
  format.
- A future implementation may be proposed only after an operator needs to consume real external
  agent traces from at least two independent producers and can name a local owner, normalized
  schema, terminal-state mapping, redaction policy, and validation fixture.

## Artifacts

### Create

- `.github/harness/memory/radar/pi-jsonl-external-agent-events.md` - parked candidate recording
  the protocol idea, a future dedicated adapter and run-evidence consumer, and promotion
  prerequisites.

### Explicitly Not Creating

- Pi dependency, SDK adapter, RPC supervisor, session persistence, extension host, package loader,
  or terminal UI - all are owned by Pi's persistent runtime and would widen this harness's execution
  boundary.
- A second portable package export - duplicates the existing Agent Plugins skills-only pilot.

## Constraints

- Keep the result provider-neutral and evidence-linked.
- Do not execute, install, or vendor third-party Pi packages, extensions, or source code.
- Treat external event payloads as untrusted input if an event adapter is ever implemented.
- Keep `scripts/harness/harness-proxy.mjs` limited to routing-plan injection and response relay;
  it is not an event-ingestion owner.
- Preserve current explicit approval, command-guard, and human-review boundaries.

## Validation Plan

- Run `npm run harness:docs:check` after each memory artifact edit.
- Confirm required Brief provenance, radar frontmatter, status, source, and decision-log fields with
  a targeted content check.
- Run `npm run harness:plan-review -- --lens plan` with an independent read-only reviewer before
  completing the research handoff.
- Run `git diff --check` against only the new memory artifacts.

## Do NOT

- Do not claim Pi's project trust is a sandbox or approval system.
- Do not treat Pi's session lifecycle as a substitute for harness stage state.
- Do not add a generic plugin loader without a client-owned lifecycle, containment, schema, and
  approval contract.
- Do not modify pre-existing user changes in the worktree.

## Assumptions and Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED]` At least one additional external agent exposes a stable event protocol that can map safely with Pi's documented stream. | Provider-neutral promotion | The adapter must stay producer-specific or remain parked. |
| No current harness operator requires external agent-event ingestion. | Promotion timing | The candidate may deserve an earlier implementation Brief if such a consumer exists. |
| Pi documentation reflects the intended current release behavior. | Capability assessment | Details may change; any implementation must re-check the pinned upstream version. |
