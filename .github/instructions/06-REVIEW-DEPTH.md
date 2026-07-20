<!-- harness-kit template: depth review is the structural pass. Keep it project-agnostic and gate-driven; repository standards provide stack details. -->

---
applyTo: '**'
---

# Review Depth Stage

> **Model:** high-reasoning (e.g., `claude-opus-4.8`; Copilot Auto is a safe default) — depth
> review requires reasoning about multi-hop ownership boundaries and multi-tenant isolation that
> weaker models consistently miss.
> **Purpose:** Challenge the structure of the implemented change: ownership, boundaries, reuse,
> dependency direction, isolation, and conformance to the Architecture Brief.

Depth review asks a different question than Breadth: not merely "does it work?" but "is it shaped
correctly, and will that shape hold under future change?"

## Required inputs

Use the following depth-review packet:

- task statement
- changed artifacts
- Architecture Brief, if one exists
- breadth findings ledger
- relevant standards and skill docs

If the Brief or breadth findings are missing for a non-trivial task, state that reduced context
explicitly.

---

## Mandatory first step: Context sufficiency check

Depth review has a higher context threshold than Breadth. If ownership or boundary evidence is
missing, stop instead of guessing.

### 1. Inventory what you have

List each artifact with:

- path or identifier
- role in the changed flow
- owning surface or layer
- domain / workflow area

### 2. Identify missing structural context

For every new or meaningfully changed artifact, list what you still need to judge ownership,
dependencies, and boundaries.

| Missing artifact | Needed for which gate |
| --- | --- |
| `path/or/name` | Gate 1 / 2 / 3 / 4 / 4b / 5 |

### 3. Decide whether to proceed

If critical structural evidence is missing, stop and state:

> MISSING: `artifact`
> BLOCKED GATE: [gate and question]
> ASSUMPTION: [what would otherwise be guessed]
> RISK: [what that guess could hide]

Do not produce a structural verdict that depends entirely on an unverified assumption.

---

## Mandatory gate pass

Run the gates for every new or materially changed owner, decision point, or execution path.

### Gate 1 - Domain / module alignment

- Does this behavior live in the correct domain, module, document family, or workflow area?
- If it spans areas, is that cross-boundary placement justified and visible?

### Gate 2 - Generality

- Remove the domain-specific nouns.
- Is the remaining behavior a reusable primitive rather than a local feature detail?
- If yes, has it been placed at the correct shared layer?

### Gate 3 - Ownership

- Which artifact truly owns the state, rule, decision, approval, or lifecycle?
- Is the implementation manipulating another owner's responsibilities from the wrong place?

### Gate 4 - Boundary integrity

- Are responsibilities separated cleanly between thin entry surfaces and deeper decision surfaces?
- For workflows, are operator instructions, automation logic, approvals, and reusable policy living
  in the correct artifacts?
- Are dependency directions still sane and one-way where they should be?

### Gate 4b - Isolation / safety boundary

Run this whenever the task touches:

- multi-tenancy
- auth / permissions
- privacy / secrets
- environment separation
- destructive actions
- human approval gates

Ask:

- Can the change cross or blur a boundary it must preserve?
- Are scoping, permissions, approvals, or rollback points still explicit?

### Gate 5 - Reuse

- Is the pattern duplicated?
- Was an extractable concern left local without a good reason?
- Was a new abstraction introduced before it had a real consumer?

---

## Additional depth checks

Run the ones that apply to the task.

### Trace the changed path end-to-end

For each significant path:

1. entry point
2. execution / ownership chain
3. state or artifact mutations
4. error propagation
5. cleanup / completion behavior
6. isolation or approval boundaries crossed

For harness changes, trace the contract path when relevant:

1. stage instruction or skill text
2. registry / routing metadata
3. loop or MCP contract
4. script or command surface
5. report / memory / review artifact affected downstream

### Check specialization and capability boundaries

Ask:

- Was a separate skill, agent, or branch introduced only because the instructions, tools, policy, or
  output contract genuinely differ?
- Are always-on standards still living in repo instructions, while repeatable task workflows live in
  skills?
- Does every tool, command, MCP wrapper, or loop named in the docs correspond to a shipped capability
  surface in the repo?
- Has any approval or guardrail boundary been blurred in the name of convenience?

### Compare against the Brief

If an Architecture Brief exists, verify:

- artifacts created and modified match the contract
- constraints were followed
- "Do NOT" rules were not violated
- assumptions were confirmed, or their contradictions were surfaced

### Look for structural drift

Flag:

- dependency direction reversals
- responsibilities that now require "and" to describe accurately
- hidden sequencing requirements
- shared patterns duplicated locally
- thin wrapper surfaces accumulating business or policy logic
- documentation contracts claiming capabilities that the repo does not actually expose

### Complexity-reduction test

Adapted from [addyosmani/agent-skills `code-review-and-quality`](https://github.com/addyosmani/agent-skills).

When reviewing a refactor, ask: **does this reduce complexity or just relocate it?**

Count the concepts a reader must hold in mind to follow the change. If the count is unchanged after
the refactor, the structure did not improve — it re-centralizes the same logic in a different place.

Prefer the restructuring that makes whole branches, modes, or layers **disappear** over one that
re-packages the same moving parts. A good structural improvement is visible as deletion, not just
reorganization.

Flag as a depth finding (Gate 3/4) when:

- a refactor moves code around without reducing the number of concepts held in mind
- feature-specific logic migrates into a shared or general-purpose module
- a new conditional is bolted onto an unrelated flow (missing model or dispatcher)
- repeated conditionals on the same shape appear across the diff (missing polymorphism)
- a change grows an already-large file instead of decomposing it

---

## Findings rules

- Do not repeat breadth findings unless the same issue has a deeper structural cause.
- Every finding must cite the gate or depth check it failed.
- Prefer concrete relocation or extraction guidance over abstract criticism.
- State confidence on every finding.

---

## Output contract

Produce a **gate ledger** and a **structural findings ledger**.

### Gate ledger

For each reviewed artifact or path, record:

- artifact / path
- gates run
- pass / fail / blocked status for each relevant gate
- one-sentence evidence

### Structural findings ledger

Group findings by severity:

- **Blocker**
- **Major**
- **Minor**

For each finding include:

1. **Artifact or path**
2. **Gate / depth check failed**
3. **Evidence**
4. **Why the current placement or structure is wrong**
5. **Recommended fix**
6. **Confidence**

Also include a **Brief divergence** section when implementation differs from the Brief.

## Handoff rules

- Blocker or Major depth findings route the work back through Implement.
- Feedback decides whether challenged Brief decisions stand, change, or split into a third option.
