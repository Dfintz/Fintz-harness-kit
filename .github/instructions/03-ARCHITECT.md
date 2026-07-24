<!-- harness-kit template: keep this stage contract project-agnostic. Project-specific architecture rules belong in repository standards and domain skills, not here. -->

---
applyTo: '**'
---

# Architect Stage

> **Model:** high-reasoning (e.g., `claude-opus-4.8`; Copilot Auto is a safe default) — this stage
> requires deep architectural judgment across ownership, abstraction layers, and domain alignment.
> **Purpose:** Decide where the change should live and what shape it should take before work begins.
> Produce an Architecture Brief that downstream stages can follow, review, and challenge.

Your repository standards remain the authority for stack-specific rules, naming, APIs, and coding
patterns. This stage is the reusable planning contract.

## What this stage is for

Use Architect for any non-trivial change: code, docs, workflows, automations, infra, or mixed work
that crosses files, owners, boundaries, or validation surfaces.

Do not produce a vague plan. The output of this stage is not "ideas"; it is a decision record that
constrains implementation.

## Required inputs

Treat the following as the **task packet**:

- task / ticket / prompt
- relevant repository standards and skill docs
- Understand-stage output (impact map, graph status, prior memory)
- any existing brief for the area
- all files, artifacts, or workflow definitions already in scope

If the task packet is incomplete, stop and say so before planning.

## Prefer shipped evidence sources over pure recollection

When the repository already exposes a way to gather evidence, use it before inventing certainty.

- Start with the memory and graph discipline from `context-engineering` and `understand-process`.
- For harness or orchestration tasks, inspect the real capability surfaces: `registry.json`, loop
  definitions, `package.json`, skill directories, and `.github/harness/MCP-INTEGRATION.md`.
- If the task touches routing, registry, loops, skills, or MCP adapters, prefer
  `npm run harness:mcp:find` and `npm run harness:mcp:impact` for targeted evidence instead of
  broad file dumping.
- If the design itself is disputed, use the architect-challenge surface (`npm run harness:plan-review`
  or `scripts/harness/plan-review.mjs --lens plan`) before implementation.

---

## Mandatory first step: Context sufficiency check

Complete this before any design decision.

### 1. Inventory what you have

List every artifact provided and classify it:

- path or identifier
- what it contains
- owning surface or layer
- domain / workflow area

Valid surface examples include:

- code module or service
- UI / API surface
- data model / schema
- document or template
- automation / workflow / CI job
- infrastructure / environment config

### 2. State the scope

Describe the change in one line:

> **Scope:** [software / documentation / workflow / infrastructure / mixed]
> **Primary boundary:** [the main domain, team boundary, system boundary, or workflow boundary]

### 3. Identify missing context

List the missing artifacts that would materially affect ownership or boundary decisions.

| Missing artifact | Needed to answer |
| --- | --- |
| `path/or/name` | What decision cannot be made safely without it |

### 4. Decide whether to proceed

If critical context is missing, stop and state:

> MISSING: `artifact`
> BLOCKED DECISION: [what cannot be designed safely]
> ASSUMPTION: [what you would otherwise guess]
> RISK: [what that guess could invalidate]

Mark any later assumption that depends on missing context as `[UNVERIFIED]`.

---

## Core procedure

### Step 1 - Map the current shape

Before proposing anything new, identify:

1. the current owner of the behavior, information, decision, or workflow
2. adjacent artifacts that already touch this area
3. existing reusable patterns, templates, utilities, or procedures
4. upstream and downstream consumers
5. validations, approvals, tests, dry-runs, previews, or release steps already in place

### Step 2 - Run the architectural gates

Every non-trivial plan must step through the gates explicitly.

#### Gate 1 - Domain / module alignment

- Does the change belong to the domain or workflow area where it is being placed?
- Is a cross-domain placement justified, or is it leakage?

#### Gate 2 - Generality

- Remove the domain-specific nouns from the proposed behavior.
- Would the same logic or structure apply elsewhere right now?
- If yes, it probably belongs in a shared layer, template, helper, or workflow primitive.

#### Gate 3 - Ownership

- Which artifact truly owns the state, rule, decision, or lifecycle being changed?
- If this change mostly manipulates another owner's data or responsibilities, it is misplaced.

#### Gate 4 - Boundary integrity

- Are responsibilities staying in the right execution surface?
- Keep delivery surfaces thin: request handlers, pages, templates, wrappers, and orchestration steps
  should not absorb rules that belong deeper in the system.
- For non-code workflows, keep approval logic, policy, and reusable procedure out of one-off task
  notes when they belong in the workflow definition.

#### Gate 4b - Isolation / safety boundary

Run this when the task touches security, tenancy, privacy, permissions, secrets, environment
separation, destructive actions, or approval boundaries.

- Could this change cross a boundary it should preserve?
- What scoping, approval, or rollback protection must remain explicit?

#### Gate 5 - Reuse

- Is this the first occurrence of the pattern?
- Is reuse already present, or clearly imminent from nearby structure?
- If the pattern is duplicated or predictably repeated, extract now instead of after drift sets in.

**Optional: DESIGN-IT-TWICE** — adapted from
[mattpocock/skills `codebase-design`](https://github.com/mattpocock/skills/tree/main/skills/engineering/codebase-design):
When the right interface shape is genuinely uncertain (two plausible approaches, unclear which is
deeper or better-placed), spin up two parallel sub-agents to design the same interface radically
differently, then compare on: (a) depth — how much behaviour behind how small an interface?
(b) locality — does change concentrate or spread? (c) seam placement — where does the caller/test
cross? Pick the winner explicitly; record the rejected alternative and why in the Brief.
Do this only when the choice would materially affect Gate 1–4 decisions — not as a default.

**Multi-agent topology reference** — adapted from
[revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0):
When the task involves multiple agents, name the topology before designing interactions.
Six canonical patterns:

| Pattern | Shape | Use when |
|---|---|---|
| **Pipeline** | A → B → C | Each stage transforms output for the next |
| **Fan-out / Fan-in** | 1 → N → 1 | Parallel collection then aggregated consensus |
| **Expert Pool** | Router → specialist | Task type determines which specialist handles it |
| **Producer-Reviewer** | Generator → Validator | One agent produces, a separate agent validates |
| **Supervisor** | Orchestrator → workers | Orchestrator dispatches, monitors, and retries workers |
| **Hierarchical Delegation** | L1 → L2 → L3 | Nested orchestrators with layered delegation |

Pick one pattern explicitly; record the choice in the Brief's Key Decisions. When the harness's
own `plan-review.mjs` is involved, that is a Producer-Reviewer pattern.

### Step 3 - Design the change set

State the intended shape of the solution.

#### Artifacts to create

For each new artifact:

- full path or identifier
- single responsibility
- why it needs to exist now

#### Artifacts to modify

For each existing artifact:

- full path or identifier
- what changes
- why that artifact is the right owner

#### Artifacts explicitly not being created

List plausible alternatives you considered and rejected.

- pattern or artifact not chosen
- why it was rejected (wrong owner, too general, duplicate, YAGNI, wrong boundary)

When considering a new skill, agent, or workflow branch, split only when the new path needs
materially different instructions, tools, approval policy, or output contract. Do not create a
"specialist" whose behavior could stay inside an existing stage or skill.

### Step 4 - Define execution constraints

Capture the implementation contract:

- invariants that must remain true
- required patterns, interfaces, or workflow rules
- validation or proof required before completion
- sequencing / rollout constraints
- anything implementation must explicitly avoid

### Step 5 - Record risks and assumptions

Use an explicit register.

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED] ...` | decision or artifact | what must change if false |

Also note:

- open questions that can wait until implementation
- questions that must be answered before implementation begins

### Step 6 - Sequence by risk and simplicity

Before finalizing the Brief, apply two ordering checks.

**Risk-first slicing** — adapted from [addyosmani/agent-skills `incremental-implementation`](https://github.com/addyosmani/agent-skills):
When the plan has multiple delivery slices, order them so the riskiest or most
uncertain piece comes first:

> *If Slice 1 proves the hard assumption wrong, you discover it before investing in Slices 2–N.*

Rank slices by risk (probability × cost-of-being-wrong), not by perceived importance or
implementation convenience. A working Slice 1 that proves the architecture sound is more
valuable than a beautiful Slice 5.

**Simplicity gate** — adapted from [addyosmani/agent-skills `incremental-implementation`](https://github.com/addyosmani/agent-skills) and [mattpocock/skills `codebase-design`](https://github.com/mattpocock/skills):
Before finalizing any design decision, ask:

> *"What is the simplest thing that could work?"*

Check the proposed design against these:
- Can this be done in fewer artifacts?
- Are the abstractions earning their complexity, or are they speculative?
- Would a reader say "why didn't you just..."?
- Am I building for a hypothetical future requirement, or the current task?

If the simpler path works, take it. Three similar concrete implementations are better than a premature abstraction. Optimize only after the naive, obviously-correct version is proven.

---

## Output contract

Produce an **Architecture Brief** with exactly these sections:

```md
## Architecture Brief

### Objective
- What outcome is being delivered

### Scope and boundaries
- In scope
- Out of scope

### Artifacts to create
- `path/or/name` - responsibility

### Artifacts to modify
- `path/or/name` - change and reason

### Key decisions
- Decision: evidence / reasoning

### Constraints
- Rules implementation must follow

### Validation plan
- Checks, tests, previews, dry-runs, or approvals required

### Do NOT
- Explicit anti-patterns or forbidden shortcuts

### Assumptions and risks
- `[UNVERIFIED]` assumptions and what they affect
```

The Brief must be specific enough that Implement can execute without re-deciding architecture.

## Persist the Brief

Save the Brief to `.github/harness/memory/briefs/<topic>.md` using the memory protocol. Review Depth
compares implementation against it, and Feedback updates it if challenged decisions change.

## Handoff rules

- Implement follows the Brief unless new evidence contradicts it.
- Review Breadth checks execution quality without re-litigating architecture prematurely.
- Review Depth challenges the structure against the gates and the Brief.
- Feedback is the only stage that formally overturns a settled Brief decision.
