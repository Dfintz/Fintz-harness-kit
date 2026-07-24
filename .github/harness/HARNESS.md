# AI Agent Harness — your project

Harness-kit template note: project-specific values (name, validation commands, model) come from
`harness.config.json`. The skill-routing tables and any multi-tenant (gate 4b) examples below are
illustrative from the kit's origin project. Replace them with your project's own skills and drop
gates that do not apply. See `SETUP.md` and `CREDITS.md`.

> **Audience:** Every AI coding agent working in this repository (Claude Code, GitHub Copilot,
> Codex, Cursor, Gemini, or any other). This document is agent-agnostic: it unifies all project
> skills and workflow instructions into one operating contract.

The harness answers three questions for any agent, on any task:

1. **What do I load?** → [Skill Routing](#skill-routing)
2. **What sequence do I follow?** → [Workflow Stage Machine](#workflow-stage-machine)
3. **How do I iterate until done?** → [Loops](#loops) (full protocol in [`LOOPS.md`](./LOOPS.md))

For MCP (Model Context Protocol) tool integration, see [`MCP-INTEGRATION.md`](../MCP-INTEGRATION.md).

A machine-readable index of everything below lives in [`registry.json`](./registry.json).

---

## Default Prompt Routing

The kit ships a harness-first prompt routing policy through `scripts/harness/prompt-router.mjs` and
`harness.config.json`.

- `npm run harness:route -- --task "<prompt>"` classifies a prompt against the trivial/non-trivial policy.
- `npm run harness:profile -- --task "<prompt>"` maps a task to an intent profile (`turnkey-coding`, `multi-agent-orchestration`, `drop-in-memory`).
- `npm run harness:route -- --intent <intent> --task "<prompt>"` routes directly through that intent profile.
- `npm run harness:feature -- --task "<feature task>"` or `npm run harness:handoff:feature -- --task "<feature task>"` prints the full operator handoff plan.
- `npm run harness:handoff:review -- --task "<review task>"` prints the review-only handoff plan.
- `npm run harness:review` runs the plan-review workflow (backward-compatible behavior).
- `npm run harness:docs:check` validates registry stage contracts, loop references, skill metadata, and cited script or npm command paths across the harness docs surfaces.
- `npm run harness:catalog:sync` publishes machine-readable capability artifacts (`llms.txt` + `.github/harness/catalog/harness-profile.json`).

### Model Roles In The Shipped Environment Policy

The harness applies a **three-tier capability model**. Copilot Auto is the recommended default for
all tiers when using GitHub Copilot — it selects an appropriate model dynamically. The tier labels
govern _what kind_ of capability a stage requires. Pinned examples show which models map well to
each tier today, but treat them as examples, not requirements: any model in the same capability
class works.

| Tier | Stages | Copilot default | Pinned examples | Rationale |
|---|---|---|---|---|
| **high-reasoning** | Understand, Architect, Review Breadth, Review Depth, Feedback | Auto | `claude-opus-4.8`, `gemini-2.5-pro` | Sustained multi-hop reasoning over large contexts; architectural judgment; cross-cutting concern detection. Both models score strongly on GPQA Diamond, MMLU-Pro, and long-context SWE-bench. |
| **balanced-coding** | Implement, `build-fix`, `test-fix` | Auto | `gpt-5.3-codex`, `claude-sonnet-4.5` | The Architecture Brief already constrains the problem; what matters is code-generation speed and accuracy |
| **fast-cheap-local** | Experiment loops, lint-debt, background enrichment, triage | — (local only) | `qwen2.5-coder:14b`, `llama3.2:3b` | Cheap, offline, high-volume; not suitable for architecture gates, security review, or multi-tenant isolation |

**Cross-model review:** implementer and reviewer must differ. The router enforces
`models.implementer ≠ models.reviewer`. If both are on Copilot Auto, explicitly select distinct
models for the `review-fix` pass to break single-model echo chambers. The cross-model pass runs
the balanced-coding model first (implement), then the high-reasoning model as the independent
challenger.

---

## Authority Chain

When guidance conflicts, higher entries win:

1. `CLAUDE.md` and `.github/copilot-instructions.md` — coding standards, conventions, warnings
2. `.github/instructions/0*.md` — workflow stage instructions (this harness orchestrates them)
3. Skill files (`.github/skills/`, `.claude/skills/`) — domain patterns and checklists
4. This harness — orchestration, routing, and loop protocol

The harness never overrides standards; it tells you **when** to apply which document.

---

## Agent Adapters

The same skill content is published in two trees. Use the one your runtime loads natively and treat
the other as reference — do not load both copies of the same skill.

| Runtime                    | Native skills               | Native instructions                                        |
| -------------------------- | --------------------------- | ---------------------------------------------------------- |
| Claude Code                | `.claude/skills/*/SKILL.md` | `CLAUDE.md`, `.github/instructions/`                       |
| Copilot / Codex            | `.github/skills/*/SKILL.md` | `.github/copilot-instructions.md`, `.github/instructions/` |
| Other agents (Cursor, etc) | `.github/skills/*/SKILL.md` | `AGENTS.md` (repo root), `.github/instructions/`           |

Workflow-stage skills (`architect`, `implement`, `review-breadth`, `review-depth`, `feedback`) exist
only under `.claude/skills/` as invocable commands; non-Claude agents get identical content from the
corresponding `.github/instructions/0*.md` file. Those instruction files define reusable stage
contracts; repository standards and domain skills provide the stack-specific rules.

---

## Customization and specialization policy

Choose the lightest surface that can carry the contract:

| Need | Preferred surface |
| --- | --- |
| Always-on repository norms | `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md` |
| Reusable task or workflow procedure | skill directories under `.github/skills/`, `.claude/skills/`, or `skills/` |
| A stage-specific contract in the harness flow | `.github/instructions/0*.md` |
| A branch that needs materially different tools, policy, or output ownership | handoff / custom agent / subagent |
| External evidence or real-time system state | MCP wrappers / MCP server |

Use a new specialist only when the next branch truly needs different instructions, tools, approval
policy, or output contract. Otherwise, extend the existing stage or skill.

## Stage design principles

The harness stage files follow a few public, cross-vendor agent-design rules:

1. **Compact state transfer.** Pass the smallest artifact that preserves the contract: Brief, proof
   summary, findings ledger, gate ledger, verdict record.
2. **Evidence before summary.** Prefer graph, MCP, loop, report, grade, and otel surfaces over
   narrative certainty when the repo already exposes them.
3. **Progressive disclosure.** Keep the main stage contract concise and push detailed reference
   material into the actual files, loops, scripts, and skills it names.
4. **Human approval on sensitive capability changes.** Widening tool permissions, weakening
   guardrails, or changing destructive defaults is never auto-approved.
5. **Specialize only when the contract changes.** Extra agents or skills are justified by different
   tools, policy, or outputs, not by preference alone.

---

## Workflow Stage Machine

Every non-trivial task moves through these stages. A task is **non-trivial** when it modifies more
than one file, changes APIs/shared types/routes/database behavior, or touches auth, security,
tenancy, caching, or infrastructure. Trivial one-file typo/doc fixes may skip straight to Implement.

```text
┌──────────────┐
│ 0 UNDERSTAND │  graph freshness + architecture discovery
└──────┬───────┘
       ▼
┌──────────────┐
│ 1 ARCHITECT  │  gates 1–5 → Architecture Brief
└──────┬───────┘
       ▼
┌──────────────┐     ┌────────────────────────────────────┐
│ 2 IMPLEMENT  │◄────┤ review-fix loop (Blocker/Major     │
└──────┬───────┘     │ findings route back to Implement)  │
       ▼             └────────────────▲───────────────────┘
┌──────────────┐                      │
│ 3 BREADTH    │  breadth pass ───────┤
│   REVIEW     │                      │
└──────┬───────┘                      │
       ▼                              │
┌──────────────┐                      │
│ 4 DEPTH      │  depth pass ─────────┘
│   REVIEW     │
└──────┬───────┘
       ▼
┌──────────────┐
│ 5 FEEDBACK   │  evaluate final verdicts → Brief update
└──────────────┘
```

> **Multi-session work?** When the task is too large for a single run — the destination isn't yet
> visible and the full journey spans multiple sessions — use the
> [**wayfinder skill**](https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder)
> before entering this stage machine. Wayfinder charts a shared decision-ticket map on the repo's
> issue tracker, then resolves tickets one at a time. Each resolved ticket typically feeds one
> harness run. See `harness.config.json` `routing.intentProfiles.wayfinder` for the profile and
> keywords the router uses to detect wayfinder-scale tasks.

### Stage Reference

| #   | Stage          | Instruction file                                 | Claude Code skill                        | Mandatory output                                                         |
| --- | -------------- | ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| 0   | Understand     | `.github/instructions/02-UNDERSTAND-WORKFLOW.md` | `understand-process` (`.github/skills/`) | Component/layer impact map, graph status                                 |
| 1   | Architect      | `.github/instructions/03-ARCHITECT.md`           | `/architect`                             | Architecture Brief (scope, artifacts, decisions, constraints, validation, assumptions) |
| 1′  | Architect Challenge *(manual opt-in)* | `.github/agents/architect-challenge.agent.md` | — | VERDICT: APPROVED \| REVISE \| BLOCKED on the Brief |
| 2   | Implement      | `.github/instructions/04-IMPLEMENT.md`           | `/implement`                             | Delivered change + proof summary + self-review summary                   |
| 2′  | Implement (surgical) | `.github/instructions/04.5-SURGICAL-IMPLEMENT.md` | `/implement`                       | Minimal-diff change + proof summary + surgical boundary note             |
| 3   | Review Breadth | `.github/instructions/05-REVIEW-BREADTH.md`      | `/review-breadth`                        | Findings ledger (severity, evidence, impact, confidence, fix)            |
| 4   | Review Depth   | `.github/instructions/06-REVIEW-DEPTH.md`        | `/review-depth`                          | Gate ledger + structural findings + Brief divergences                    |
| 5   | Feedback       | `.github/instructions/07-FEEDBACK.md`            | `/feedback`                              | Verdict record + Brief updates + response notes                          |

> **Architect Challenge:** Stage 1′ is a manual opt-in that runs a cross-model adversarial review
> on the Architecture Brief before implementation. It is **not** auto-emitted by the prompt router.
> Invoke it explicitly with `npm run harness:plan-review -- --lens plan` when the change is high-risk
> or when a second opinion on the Brief is desired. The workflow-stage prompt templates include
> inline guidance for cases when the route omits this stage.

### Stage Contract (applies to every stage)

1. **Memory before discovery.** Consult the two memory surfaces before re-deriving anything: the
   committed knowledge graph snapshot (provider-selected; default
   `.understand-anything/knowledge-graph.json`) for structure, and the
   harness memory store ([`memory/`](./memory/README.md)) for lessons and prior Architecture Briefs.
   Rediscovering what a previous session already recorded is wasted budget.
2. **Context Sufficiency Check first.** Every stage instruction begins with one. Inventory what you
   have, identify what you need, and request missing context before producing output. Never guess at
   an Architecture Brief, reviewer intent, or file contents you were not given. When asking the
   user for missing context, **ask one question at a time** — a wall of questions is harder to answer
   and produces lower-quality responses than a focused single question.
   (Adopted from [davis7dotsh/my-pi-setup `AGENTS.md`](https://github.com/davis7dotsh/my-pi-setup))
3. **Carry artifacts forward — and persist them.** Stage 1 produces the Architecture Brief; stage 2
   adds a proof summary; stage 3 produces a findings ledger; stage 4 produces a gate ledger and
   structural findings; stage 5 resolves them into a verdict record. Pass these compact artifacts
   forward instead of full transcript dumps. Save the Brief to `memory/briefs/` per that directory's
   protocol so a later session inherits the gate decisions.
4. **Honor the gates.** Stages 1 and 4 run the five architectural gates (Domain Alignment,
   Generality, Data Ownership, Layer Boundaries, Reuse — plus 4b Multi-Tenant Isolation).
   Implementations that bypass a gate decision must be flagged, not silently merged.
5. **Use direct evidence tools when available.** For harness work, prefer the graph CLI, MCP wrappers,
   loop JSON, registry metadata, and report / grade / otel outputs over memory or prose-only claims.
6. **Close with status.** Non-trivial tasks end with the Understand status line (graph status, tools
   used, residual risk) per `02-UNDERSTAND-WORKFLOW.md`, plus the stage artifacts needed by the next
   pass.

---

## Skill Routing

Load a skill **before** writing code in its area. Triggers below are matched against the task
description and the files being touched.

### Shipped Skills

| Skill                               | Load when the task involves…                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `understand-process`                | Any non-trivial change; stage-0 impact analysis and graph freshness           |
| `context-engineering`               | Task switching, stale context, compact handoffs, and session memory hygiene   |
| `deterministic-validation`          | Exit criteria, proof selection, and objective completion checks               |
| `doubt-driven-development`          | Security, correctness skepticism, and evidence-led bug diagnosis              |
| `observability-and-instrumentation` | Telemetry, instrumentation, RED signals, and operational proof                |
| `eval-first-tuning`                 | Retrieval, prompt, or agent quality tuning with explicit evals                |
| `ai-techniques-radar`               | External technique intake, triage, and adoption decisions                     |
| `budget-aware-execution`            | Cost-aware tool/model selection and bounded execution                         |
| `teach-agent`                       | Machine-first guidance curation, promotion gates, and agent teachability      |
| `setup-harness-bootstrap`           | Adopting the harness in a new repository or workflow surface                  |
| `retrieval-quality-ops`             | A/B evaluation of retrieval stacks (vector-only vs contextual+BM25+rerank)    |
| `remember` *(Claude Code only)*     | Persisting reusable lessons and Architecture Briefs to harness memory. Non-Claude agents: follow the write protocol in `memory/README.md` directly. |
| `run-loop` *(Claude Code only)*     | Native execution of workflow loops using checked-in loop JSON and guardrails. Non-Claude agents: follow the loop JSON as protocol per `LOOPS.md § Native Execution`. |
| `pr`                                | PR creation, verification, and review-before-ship workflow                    |

Repositories may add domain specialists under `.github/skills/` or `.claude/skills/`, but they
should only be listed in `registry.json` once the skill files are actually checked in.

### Sidecar Prompts (optional, generated by `harness:prompt-pack`)

When running `npm run harness:prompt-pack`, two optional sidecar prompt files are generated
alongside the main stage prompts:

| Sidecar | Purpose | When to use |
|---|---|---|
| `optional-scout.md` | Parallel research — find reuse opportunities, missing context, and adjacent risks | Highest value before or during Understand and Architect |
| `optional-challenger.md` | Independent challenge — pressure-test assumptions, risks, and review blind spots | After architecture or implementation artifacts exist; can run in parallel with breadth review |

Both sidecars are optional and do not replace canonical harness stages. Run them with a
high-reasoning model; write output to `scout-notes.md` or `challenger-findings.md` respectively.

### Workflow Skills (stage executors)

`architect`, `implement`, `review-breadth`, `review-depth`, `feedback` — invoked explicitly per
stage (see Stage Reference table). They are not auto-loaded by topic; they are the stage.

---

## Validation Matrix

Run the narrowest command that covers the change; loops use these as their convergence checks.

> **Harness-kit note:** The rows below show the pattern — adapt `commands.*` tokens to your project's
> actual commands, which are resolved from `harness.config.json`. Replace scope names and commands
> with whatever applies to your stack.

| Scope touched       | Required before completion                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Any code change     | `{{commands.lint}}` · `{{commands.typeCheck}}` · `{{commands.build}}`                        |
| Tests               | `{{commands.test}}`                                                                           |
| Backend-only        | `{{commands.testBackend}}`                                                                    |
| Frontend-only       | `{{commands.testFrontend}}`                                                                   |
| Full feature        | All of the above for touched scopes; E2E if user-facing flow changed                         |

Hard rules (loop guardrails — restated here because loops are tempted to violate them):

- Never skip, delete, or weaken a failing test to make a loop converge — fix the cause.
- Never lower coverage thresholds to converge.
- Never add type suppressions (`any`, `@ts-ignore`, lint-disable) to silence a checker — fix the root cause.
- Never mutate the eval suite or its targets to make a convergence check pass.

---

## Loops

A **loop** is a bounded, goal-seeking iteration: run a check, and while it fails, apply a fix
informed by the relevant skills, then re-check. Every loop must declare an **exit condition** (a
command for convergence loops, a gradeable rubric for workflow loops), a **max iteration count**,
and an **escalation** path — unbounded retry is forbidden. Every run ends in a named terminal state
(`converged`, `exhausted`, `stuck`, or `blocked`), records its git baseline before touching
anything, and reports only progress it can ground in check output or rubric verdicts.

Built-in loops (definitions in [`loops/`](./loops/), protocol and authoring guide in
[`LOOPS.md`](./LOOPS.md)). **10 operational loops** (see directory for all including `_template.json`):

| Loop                   | Converges on                                 | Kind         |
| ---------------------- | -------------------------------------------- | ------------ |
| `build-fix`            | Lint + type-check + build green              | convergence  |
| `test-fix`             | Workspace test suites green                  | convergence  |
| `ci-green`             | PR checks green on the remote                | workflow     |
| `review-fix`           | No Blocker/Major findings from breadth+depth | workflow     |
| `feature-cycle`        | Full stage machine (0→5) complete and clean  | workflow     |
| `harness-evolve`       | Harness guidance improvements (gated)        | experiment   |
| `tdd-cycle`            | TDD iteration: red → green → refactor        | workflow     |
| `diagnose`             | Async diagnostic and observability           | workflow     |
| `plan-review`          | Multi-agent plan challenge & verdict         | workflow     |
| `lint-debt-experiment` | Lint-rule optimization via metric reduction  | experiment   |

Run a convergence loop from any shell or agent CLI:

```bash
node scripts/harness/run-loop.mjs test-fix            # native agent fixes between checks
node scripts/harness/run-loop.mjs build-fix --check-only   # report convergence state, no agent
```

Claude Code runs loops natively via the `run-loop` skill; other agents follow the loop JSON as a
protocol (see `LOOPS.md` § Native Execution). New loops are created by copying
`loops/_template.json` — see `LOOPS.md` § Creating a Loop.

Every run leaves a JSON journal in `.github/harness/runs/` (gitignored): convergence loops via
`run-loop.mjs`, workflow loops/stages via `scripts/harness/record-run.mjs`. Aggregate them into a
dashboard with `npm run harness:report` — per-loop convergence rates, slowest checks, and the rubric
pass-rates that make Understand/Architect/Review activity measurable.

---

## Harness Self-Improvement: Phase Integration Snapshot

The harness includes a closed-loop optimization path for its own guidance, with guarded evolution,
observability, and deterministic scoring.

### Phase 3 — Meta-Optimization Loop (`harness-evolve`)

- Target: `.github/harness/evolve/candidate-instructions.md` (editable guidance surface)
- Guardrails: forbidden target validation + suite integrity tripwire in
  `scripts/harness/evolve-guard.mjs`
- Iteration control: bounded loop with no-improvement early stop

Run with:

- `npm run harness:evolve`
- `npm run harness:evolve:dry-run`
- `npm run harness:evolve:check`

### Phase 4 — Observability

- Journals: `.github/harness/runs/*.jsonl`
- Dashboard: `npm run harness:report`
- OTLP/JSON export: `npm run harness:otel`

### Phase 5 — Outcome Scoring & Feedback

- Trajectory scorer: `npm run harness:grade`
- Self-test checks: `npm run harness:grade:self-test`, `npm run harness:evolve:self-test`
- Feedback path: run -> journal -> grade -> evolve adjustment -> next measured cycle

See `LOOPS.md` for scoring semantics and loop protocol details.

---

## Memory

Persistent, committed memory keeps sessions from rediscovering what earlier sessions learned. Full
protocol: [`memory/README.md`](./memory/README.md).

- **Structure** — provider-agnostic graph surface (default Understand-Anything path
  `.understand-anything/knowledge-graph.json`, optional Graphify path via `graph.provider` and
  `graph.graphify.path` in `harness.config.json`). Committed structural snapshots are queried through
  `scripts/harness/graph.mjs`; **query it, don't read it**. Use
  `npm run harness:graph -- <status|provider-status|banner|neighbors|dependents|path|layers|layer|hubs>`
  to fetch only the slice you need. `status` remains the stage-0 freshness gate.

  > **Graph disabled?** If `graph.enabled` is `false` in `harness.config.json` (the harness-kit
  > default for new adopters), `npm run harness:graph -- status` will exit non-zero with "Graph file
  > not found." This is expected — set `graph.enabled = true` and run the graph provider pipeline to
  > populate the snapshot. Until then, the stage-0 gate degrades gracefully: continue with explicit
  > reduced-confidence annotation and ground discoveries in direct file reads.
- **Lessons** — `memory/lessons/`: one non-obvious, hard-won fact per file; first line is the
  scannable summary. Write via the `remember` skill (Claude Code) or the protocol directly.
  Agent-local lesson stores (e.g. Copilot's memory tool) are promoted into this committed store with
  `npm run harness:migrate-memory`.
- **Briefs** — `memory/briefs/`: Architecture Briefs persisted from stage 1, updated by stage 5.
  Settled unless challenged through the Feedback stage.

Memory coverage is observable: `npm run harness:report` surfaces committed lesson count, Brief
count/status, and knowledge-graph freshness alongside the loop metrics.

Memory is consulted at stage 0 of every non-trivial task (see Stage Contract) and written back
whenever a session learns something the next one shouldn't have to re-derive — including the
diagnosis from any loop that ends `stuck` or `exhausted`.

### Optional: context compression

For long loop runs, [Headroom](https://github.com/chopratejas/headroom) can wrap the agent CLI to
compress tool outputs and logs before they reach the model (`pip install "headroom-ai[all]"`, then
`HARNESS_AGENT_CMD="headroom wrap claude -p"` or `--agent "headroom wrap claude -p"` on the loop
runner). It is an efficiency adapter, not a dependency — nothing in the harness requires it.

---

## Optional Local AI Tooling

Implemented scaffolding (optional, all adapters):

1. **MCP wrappers plus first-class stdio transport.** `scripts/harness/mcp-tools.mjs` exposes stable
   JSON command wrappers for provider-agnostic graph queries (`graph.mjs`) plus `memory/lessons/` and `memory/briefs/`, and
   `scripts/harness/mcp-server.mjs` exposes the same tools through MCP tool schema + stdio
   transport: `npm run harness:mcp -- list-tools` and `npm run harness:mcp:server`.
2. **Dockerized deterministic graph refresh.** `scripts/harness/refresh-graph.mjs` runs
   scan/import/build/validate/save with plugin scripts and core APIs. Optional sidecar profile
   (`graph-refresh`) runs `scripts/harness/graph-refresh-loop.mjs` continuously:
   `UNDERSTAND_PLUGIN_ROOT=<path> docker compose -f docker-compose.harness.yml --profile graph-refresh up -d --build graph-refresh`.
3. **Local Ollama adapter for loop runner fan-out.** `scripts/harness/ollama-agent.mjs` consumes the
   loop runner prompt from stdin and calls `/api/generate` on Ollama. Use with:
   `npm run harness:loop -- build-fix --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b"`.
4. **Optional local embeddings + vector retrieval tier.** `scripts/harness/vector-search.mjs` can
   index semantic vectors over committed memory plus graph nodes, then run cosine retrieval:
   `npm run harness:vector -- index --scope all` and
   `npm run harness:vector -- search --query "tenant isolation" --scope all --top 8`.

Guardrail: keep local models on low-stakes/high-volume work (lint/format, triage, enrichment). Do
not route architecture gates, multi-tenant isolation, or security review decisions to local models.

---

## Maintenance Principle

Every harness component exists to compensate for something the current models can't yet do reliably
on their own. As models improve, some scaffolding becomes unnecessary — prune it rather than letting
it ossify. The `Model:` lines at the top of each `.github/instructions/0*.md` and the stage skills
are **advisory provenance, not a runtime requirement**: any capable agent runs these stages. Treat a
component that no longer earns its context cost as debt to remove.
