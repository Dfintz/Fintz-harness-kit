<!-- harness-kit template: Feedback is the adjudication stage for challenged decisions. Keep it broader than PR comments so it also fits docs, workflows, and operational changes. -->

---
applyTo: '**'
---

# Feedback Stage

> **Model:** high-reasoning (e.g., `claude-opus-4.8`; Copilot Auto is a safe default) — feedback
> evaluation requires fresh-eyes judgment on architectural challenges without anchoring on prior
> decisions.
> **Purpose:** Resolve challenged decisions after implementation and review. Decide which findings or
> objections stand, which do not, and whether the Architecture Brief must change.

This is the adjudication stage. Use it for PR comments, reviewer disagreement, stakeholder pushback,
post-review architectural challenges, or any case where the work now has competing interpretations.

## Required inputs

Use this **feedback packet**:

- task statement
- current implementation or changed artifacts
- Architecture Brief, if one exists
- breadth findings ledger
- depth gate ledger and structural findings
- the specific feedback points or challenged decisions
- any author / stakeholder context

If the challenged point cannot be evaluated from what you have, stop and name the missing evidence.

---

## Mandatory first step: Context sufficiency check

### 1. Inventory the available evidence

List:

- the feedback point or challenged decision
- the artifacts that support or contradict it
- which earlier stage outputs are available

### 2. Identify missing evidence

| Missing artifact | Needed to evaluate |
| --- | --- |
| `path/or/name` | Which decision cannot be resolved safely |

### 3. Decide whether to proceed

If a feedback point depends on missing critical evidence, state:

> MISSING: `artifact`
> CANNOT ADJUDICATE: [feedback point]
> ASSUMPTION: [what would otherwise be guessed]
> RISK: [which conclusion that guess would bias]

Do not force a verdict from incomplete evidence.

---

## For each feedback point

Work every point independently.

### 1. Restate the competing positions

Capture:

- **Challenge:** what the reviewer / stakeholder / author is arguing
- **Current decision:** what the Brief or implementation says now
- **Context:** any author commentary or operational nuance

### 2. Gather the governing evidence

Use the relevant inputs from:

- the Architecture Brief
- breadth findings
- depth gate results
- repository standards
- the changed artifacts themselves
- any concrete capability surface the dispute references (`registry.json`, loop definitions, skill
  frontmatter, MCP contracts, command wrappers, report paths)

### 3. Run the relevant checks

Pick the checks that actually answer the disagreement:

- Gates 1-5 (and 4b where relevant)
- correctness / proof quality from Breadth
- dependency or boundary checks from Depth
- contract / scope adherence from the Brief

Do not run performative analysis. Run the checks that decide the point.

### 4. Produce a verdict

Each point must end in one of these outcomes:

#### Challenge upheld

The objection is correct and the current decision should change.

Include:

- what changes
- which artifact or rule must be updated
- whether the Brief must change

#### Current decision holds

The present implementation or Brief is supported by the evidence.

Include:

- why the challenge does not overturn it
- a concise response note the author can reuse

#### Third option

Neither side is fully right; the evidence supports a different resolution.

Include:

- the alternative
- what must change
- how the Brief should be updated

#### Insufficient evidence

The point cannot be resolved safely yet.

Include:

- what evidence is missing
- what follow-up is required

If resolving the point would widen `allowed-tools`, weaken a guardrail, reduce human approval, or
change a destructive default, treat "human accepted this tradeoff" as required evidence. Without
that evidence, the point is deferred rather than silently approved.

---

## Output contract

Produce a **verdict record** with these sections:

```md
## Feedback Verdict Record

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |

### Accepted changes
- What must change now

### Rejected challenges
- What holds and why

### Deferred points
- What still needs evidence

### Brief updates
- Decisions changed
- Constraints updated
- Do NOT rules updated
- Assumptions retired or added

### Response notes
- Concise, evidence-based replies the author can reuse
```

## Brief maintenance rule

If any settled decision changes, update the persisted Brief instead of leaving the transcript as the
only source of truth.

## Handoff rules

- If Feedback changes the contract materially, Implement and Review Depth must treat the updated Brief
  as the new source of truth.
- If Feedback confirms the current decision, the verdict record becomes the reusable rationale for
  future review cycles.
