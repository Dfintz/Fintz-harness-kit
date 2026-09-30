---
summary: "Architecture Brief - ZCode capability adoption assessment"
type: brief
status: active
source: research
created: 2026-09-29
updated: 2026-09-29
tags: [zcode, agent-workflow, goals, plugins, mcp, adoption]
---
# Architecture Brief: ZCode Capability Adoption Assessment
resource: https://zcode.z.ai/en/docs/goal, https://zcode.z.ai/en/docs/plugin, https://zcode.z.ai/en/docs/automations, https://zcode.z.ai/en/docs/mcp-services, https://zcode.z.ai/en/docs/bot-channel, https://zcode.z.ai/en/docs/safety-confirm, scripts/harness/stage-state.mjs, scripts/harness/run-loop.mjs, scripts/harness/agent-plugins-export.mjs, scripts/harness/teams-agent.mjs

## Architecture Brief

### Objective

Evaluate ZCode's documented capabilities against the harness and record the smallest worthwhile
follow-ups without importing an ADE runtime, weakening approvals, or installing external code.

### Context Sufficiency

| Artifact | What it contains | Owner |
| --- | --- | --- |
| ZCode Goal Mode docs | One active goal, evidence-backed round verification, pause/resume, and budget stop behavior | ZCode product workflow |
| ZCode Plugin docs | Workspace-scoped bundles of skills, commands, agents, MCP servers, and hooks | ZCode extension runtime |
| ZCode Automations and Bot docs | Scheduled execution and remote task control | ZCode hosted/desktop runtime |
| `scripts/harness/stage-state.mjs` | Live state for goal, continuation, refinement, and approvals | Harness live-state owner |
| `scripts/harness/run-loop.mjs` | Bounded convergence-loop execution and journal persistence | Harness loop runtime |
| `scripts/harness/agent-plugins-export.mjs` | Deterministic, skills-only portable plugin export | Harness packaging owner |
| `scripts/harness/teams-agent.mjs` | Approval-only remote control channel | Harness approval adapter |

Scope: documentation/research. Primary boundary: committed decision memory under
`.github/harness/memory/briefs/` and future radar entries. No runtime behavior changes are in this
task.

Missing context: ZCode's source code and production metrics are unavailable. Product documentation
is sufficient to assess capability fit, but not to claim reliability or performance improvements.

### Evidence Matrix

| Source | Observed behavior | Assessment use |
| --- | --- | --- |
| ZCode Goal Mode docs | Each round verifies changed files, command output, and test results; a goal can pause, resume, complete, or stop at budget. | Source for the evidence-backed progress opportunity. |
| ZCode Plugin docs | Discovery looks for `.zcode-plugin/plugin.json` before `.claude-plugin/plugin.json`; plugins can include executable hooks and MCP servers. | Source for the skills-only constraint and manifest-layout mismatch. |
| ZCode Automations docs | Scheduled tasks support a per-task permission mode, and bundled examples are read-only reporting workflows. | Source for parking read-only scheduling while rejecting unattended mutation. |
| ZCode MCP docs | Workspace configurations connect at session start and can execute commands, access files, and reach networks. | Source for parking configuration import rather than adding a client surface. |
| ZCode Bot Channel docs | Remote tasks can be steered from chat channels with a workspace access scope and separate approval questions. | Source for evaluating, then rejecting, remote task-steering expansion. |
| ZCode Safety Confirmation docs | File changes, commands, network calls, and scripts are permission-gated; plan approvals do not auto-continue. | Source for retaining explicit local approval boundaries. |

### Understand Impact Map

- Graph status: fresh at `646372654df58f550f9af10242e1b8490dad0dc4` after
  `npm run harness:graph:refresh:once`.
- Changed component: this Architecture Brief only.
- Affected local owners: `stage-state.mjs` already defines goal and continuation status models;
  `harness-report.mjs`, `run-loop.mjs`, and `agent-plugins-export.mjs` are targets of proposed
  work, not changed by this task.
- Affected layers: Core. The graph reports Core, Utility Layer, and Test Layer; this task does not
  alter any graph node or dependency.
- Risk: low for the assessment; medium for any later unattended or remote-execution proposal.

### Adoption Decisions

| ZCode capability | Decision | Harness opportunity | Concrete follow-up |
| --- | --- | --- | --- |
| Goal Mode: evidence-backed iteration, visible checklist, pause/resume, budget stop | Adopt a bounded design investigation | The harness already stores goal and continuation states but does not define a user-facing goal-progress contract tying each iteration to its proof. | Route `Add evidence-backed goal progress to stage state and report output` through the full stage machine. First specify one authoritative run/goal identifier and evidence-reference model spanning `stage-state.mjs`, journals, and reports; do not duplicate lifecycle state. |
| Plugin bundles with inspectable components and workspace scoping | Adopt a compatibility assessment | The harness has a deliberately skills-only Agent Plugins export, but ZCode discovers `.zcode-plugin/plugin.json` or `.claude-plugin/plugin.json`, not the generated root `plugin.json`. | First record the manifest-layout mismatch. Only then design and locally validate a ZCode-specific, skills-only adapter; do not claim that the existing export is directly compatible. |
| Explicit MCP source/scope display and import | Park | The local MCP server is a server, not a configuration client. Importing external configurations would create trust, precedence, and credential ownership questions. | Reconsider only after a user-owned MCP client/configuration surface exists. |
| Dynamic subagent workflows with adjustable concurrency | Park | The harness has bounded workflow and review stages, but no demonstrated need for a new runtime scheduler or changing concurrency. | Require a concrete workflow that cannot be represented by existing stage/loop contracts and a benchmark showing a benefit. |
| Scheduled and idle-time tasks | Park read-only reporting; reject unattended mutation | Read-only periodic reporting could preserve approvals, but no current local use case proves it is worth a scheduler. Unattended mutations conflict with explicit approval gates and bounded-loop execution. | Reconsider only for a concrete read-only report. Do not add a daemon, scheduler, or background mutation path. |
| Remote bot task control | Reject for now | `teams-agent.mjs` is limited to approval/status operations, but its action and webhook paths do not authenticate the configured secret or validate a Teams sender. Remote code execution would add risk to an adapter that is not yet an approval-integrity baseline. | Do not widen remote controls. First separately design authenticated, replay-safe approval integrity, then require per-workspace authorization and audit retention before reconsidering remote task steering. |

### Architectural Gates

| Gate | Verdict | Rationale |
| --- | --- | --- |
| 1. Domain / module alignment | PASS | Decisions stay in decision memory; future goal state, reporting, and packaging work stays with their current owners. |
| 2. Generality | PASS | An evidence-backed goal-progress contract can serve any bounded loop; ZCode-specific UI and model behavior are not generalized. |
| 3. Ownership | PASS | `stage-state.mjs` owns live goal state, journal/report modules own history and rendering, and the exporter owns portable package contents. |
| 4. Boundary integrity | PASS | This assessment creates no scheduler, ADE client, plugin loader, remote executor, or MCP configuration manager. |
| 4b. Isolation / safety | PASS | No credential, remote control, approval, or destructive-action path changes. Later remote or unattended work requires separate human approval. |
| 5. Reuse | PASS | Reuse existing goal, continuation, plugin-export, MCP, and Teams surfaces rather than inventing parallel systems. |

### Current Export and Proof Model

The existing exporter writes `plugins/agent-plugins/harness-kit/plugin.json` at the package root
with the Agent Plugins v1 schema and only `skills/wait-what/SKILL.md`. It has no
`.zcode-plugin/` or `.claude-plugin/` directory, so it is not ZCode-discoverable as generated.

| Concern | ZCode behavior | Current harness behavior | Follow-up rule |
| --- | --- | --- | --- |
| Goal completion evidence | Uses changed files, command output, and test results instead of a persuasive summary. | `run-loop.mjs` journals iterations and checks; `stage-state.mjs` holds normalized live goal and continuation state independently. | Define evidence references and one run/goal identifier before adding a progress view. |
| Plugin packaging | Discovers ZCode/Claude-compatible manifest locations and may activate hooks or MCP servers. | `agent-plugins-export.mjs` produces a root, skills-only Agent Plugins manifest with one allowlisted skill. | A future adapter must remain skills-only and preserve drift validation and containment. |
| Remote approvals | Separates task steering from approval prompts. | `teams-agent.mjs` records approvals but currently lacks webhook authentication enforcement. | Do not treat it as an approval-integrity baseline or expand remote controls. |

### Constraints

- Treat ZCode documentation as product claims, not independently verified quality evidence.
- Preserve bounded iterations, deterministic validation, and explicit approval states.
- Do not add unattended mutation, remote execution, third-party plugin loading, or external MCP
  configuration import in a follow-up without its own approved brief.
- Keep ZCode compatibility work skills-only. A future adapter must use a ZCode-discoverable manifest
  layout and prove client loading before any compatibility claim.
- Do not copy ZCode source, workflows, or permission semantics into this repository.

### Validation Plan

- Validate this decision-memory artifact with `npm run harness:docs:check` and a direct
  whitespace check because the new file is untracked.
- Run an independent Architect Challenge against this Brief before treating any adoption decision
  as ready for implementation.
- For the plugin compatibility follow-up, first prove the exact manifest-layout mapping, then prove
  actual client loading before claiming compatibility.
- For goal progress, require focused state/report tests, a before/after evidence trace, and proof
  that a single run/goal identifier links live state, journals, and reports.

### Do NOT

- Do not implement a scheduler, idle-time executor, remote command bot, marketplace, plugin loader,
  or MCP import UI in this task.
- Do not alter `stage-state.mjs`, `run-loop.mjs`, approval semantics, or existing plugin allowlists.
- Do not claim ZCode interoperability, reliability, speed, or safety without executable local proof.

### Assumptions and Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED]` A ZCode-specific skills-only manifest adapter can preserve the export's drift and containment guarantees. | Plugin compatibility assessment | The compatibility work may be rejected if it requires unsafe hooks, commands, or MCP launch configuration. |
| `[UNVERIFIED]` Current users need more goal-progress visibility than `stage-state` and run journals provide. | Goal-progress follow-up | The proposed slice may be unnecessary or need a different owner. |
| ZCode's remote and automation behavior can be evaluated from published docs without copying it. | Rejection decisions | Product details may change, but the local safety boundary remains controlling. |