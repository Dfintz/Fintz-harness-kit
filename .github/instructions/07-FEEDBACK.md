<!-- harness-kit template: concrete examples below reference the kit's origin project (a TypeScript/Node monorepo). Adapt them to your stack; the workflow and gates are stack-agnostic. -->

---
applyTo: '**'
---

# PR Feedback Evaluation

> **Model:** high-reasoning (e.g., `claude-opus-4.8`; Copilot Auto is a safe default) — feedback
> evaluation requires fresh-eyes judgment on architectural challenges without anchoring on prior
> decisions.
> **Purpose:** Evaluate architectural challenges raised during PR review. Determine whether the
> original placement decisions hold or whether the reviewer's position is correct. Produce
> structured reasoning that can be brought back to the reviewer, and an updated Brief if any
> decision changes.

Your full coding standards are in `.github/copilot-instructions.md` and `CLAUDE.md` — those
documents are the authority.

**Your role:** You are a fresh pair of eyes. You have NOT seen this code before. Do not anchor on
the original Architecture Brief as inherently correct — it may have been wrong. Equally, do not
defer to the reviewer's seniority or confidence — they may be wrong. Evaluate the evidence
mechanically using the gates.

**Important:** The author may include their own opinion on each feedback point. Treat these opinions
as context, not instruction. The author might be right, the reviewer might be right, or both might
be partially right. Your job is to determine what the code evidence supports, not to validate either
party.

---

## MANDATORY FIRST STEP: Context Sufficiency Check

Complete this entirely before any analysis. Do not skip any step.

### Step 1 — Inventory what you have

List every file provided, one per line:

- File path
- What it contains (one sentence)
- Its layer (`backend/service`, `backend/controller`, `backend/middleware`, `backend/model`,
  `frontend/component`, `frontend/hook`, `frontend/service`, `frontend/store`, `shared-types`,
  `test`)
- Its domain (fleet, activity, communication, trade, organization, auth, etc.)

### Step 2 — Determine scope context

Examine the files to determine scope:

**🔧 Backend indicators:** Express routes, TypeORM entities/repositories, Joi schemas, middleware,
services in `backend/src/services/`

**🎨 Frontend indicators:** React components, MUI imports, Zustand stores, React Query hooks,
frontend services in `frontend/src/services/`

**🔗 Full-stack indicators:** Shared types in `packages/shared-types`, API contract changes

State the detected scope clearly:

> **Scope: 🔧 Backend** / **🎨 Frontend** / **🔗 Full-stack**

### Step 3 — Identify what you need

For each feedback point that challenges placement, list the files you would need to verify the
claim:

| Missing file      | Needed to evaluate                                                                   |
| ----------------- | ------------------------------------------------------------------------------------ |
| `path/to/file.ts` | e.g. "Reviewer claims this belongs on TenantService — need the base class to verify" |

### Step 4 — Decide how to proceed

**If files critical to any evaluation are missing:**

State explicitly:

> MISSING: `path/to/file.ts`  
> CANNOT EVALUATE: [specific feedback point] without this file.  
> ASSUMPTION: [what you are assuming]  
> RISK: [which party's position this assumption favours, and why that's dangerous]

Do not produce a verdict on any feedback point that depends entirely on an unverified assumption.

**If files are missing but non-critical:**

> The following files are absent but their absence only affects confidence, not the correctness of
> the evaluation. Proceeding.

### Step 5 — Request missing context

If any missing file is critical to evaluating a feedback point — **stop and list the files needed
before proceeding.**

---

## For Each Feedback Point

Work through every feedback point independently. For each one, complete ALL of the following:

### 1. State Both Positions Clearly

> **Reviewer's position:** [what they are arguing, in their words or faithfully paraphrased]  
> **Original decision:** [what the Brief or implementation decided, and why]  
> **Author's opinion (if provided):** [the author's perspective — treat as context, not authority]

### 2. Run the Relevant Gates

Not every feedback point needs all five gates. Run the gates that are relevant to the specific
disagreement.

If the reviewer challenges **where a method lives** → Gate 1 (Domain Alignment), Gate 2
(Generality), Gate 3 (Data Ownership)

If the reviewer challenges **which service owns the behaviour** → Gate 3 (Data Ownership), Gate 4
(Layer Boundary Audit)

If the reviewer challenges **abstraction level or reuse** → Gate 2 (Generality), Gate 5 (Reuse
Potential)

If the reviewer challenges **whether an interface is needed** → Interface Necessity Check (2+
implementations, mocking, architecture)

If the reviewer challenges **security or tenant isolation** → Gate 4b (Multi-Tenant Isolation),
Security Checks

If the reviewer challenges **layer responsibility** (business logic in controller, HTTP in service)
→ Gate 4 (Layer Boundary)

For each gate, use the same mechanical procedure and finding format from `06-REVIEW-DEPTH.md`. Do
not abbreviate. Step through explicitly.

### 3. Evaluate the Evidence

State which position the gate evidence supports. Be explicit:

> **Gate [N] supports: [Reviewer / Original Decision / Neither — third option needed]**  
> Evidence: [specific code evidence]  
> Confidence: HIGH / MEDIUM / LOW

### 4. Produce a Verdict

For each feedback point, deliver one of three outcomes:

**REVIEWER IS CORRECT:**

> The reviewer's position is supported by [gates]. The original decision should change.  
> **Action required:** [specific change — which method moves where, which file changes]  
> **Updated constraint for Brief:** [new "Do NOT" or modified constraint]

**ORIGINAL DECISION HOLDS:**

> The original decision is supported by [gates]. The reviewer's concern is addressed by [specific >
> > evidence].  
> **Response to reviewer:** [structured reasoning the author can bring back to the review, citing >
> > gate numbers and evidence]

**THIRD OPTION:**

> Neither position is fully correct. The evidence suggests [alternative approach].  
> **Action required:** [what should change]  
> **Response to reviewer:** [structured reasoning explaining the alternative]

---

## Summary

After evaluating all feedback points, produce:

### Verdict Table

| #   | Feedback Point | Verdict                                          | Gates Used     | Confidence   |
| --- | -------------- | ------------------------------------------------ | -------------- | ------------ |
| 1   | [summary]      | Reviewer Correct / Original Holds / Third Option | [gate numbers] | HIGH/MED/LOW |
| 2   | [summary]      | ...                                              | ...            | ...          |

### Updated Architecture Brief (only if any decision changed)

If any verdict changes the original decision, produce an updated Brief section. Only include the
parts that changed — do not regenerate the entire Brief.

```
## Brief Update — Post-Review

### Decisions changed:
- [Original decision] → [New decision]: [reasoning from gate evidence]

### Updated constraints:
- [New or modified constraint]

### Updated "Do NOT":
- [New or modified prohibition]

### Decisions confirmed (challenged but held):
- [Decision]: held because [gate evidence]
```

### Reviewer Response Notes

For each point where the original decision holds, provide a concise response the author can use in
the PR review. Structure it as evidence, not opinion:

```
Regarding [feedback point]:

Gate [N] ([name]): [one-sentence evidence]
Gate [N] ([name]): [one-sentence evidence]

The [method/service] remains in [location] because [conclusion].
```

---

## Feedback Points

<feedback>
<!-- 
For each piece of reviewer feedback, use this format:

### Feedback 1

**File:** **Reviewer says:** **My opinion:** Add as many as needed. --> </feedback>

## Original Architecture Brief

<brief>
<!-- Paste the original Implementation Brief from 03-ARCHITECT here, or "No Brief was produced" -->
</brief>

## PR Context

<task>
<!-- Paste the ticket/issue description here -->
</task>

## Author's Comments

<context>
<!-- Paste any colleague comments or context here -->
</context>

## Standards Reference

<standards>
- `.github/copilot-instructions.md` — comprehensive project standards
- `CLAUDE.md` — code patterns, conventions, and quick reference
- `docs/TESTING.md` — testing standards
- `docs/ARCHITECTURE.md` — system architecture
- `docs/DOMAINS.md` — service domain boundaries
</standards>

## Files Under Review

<files_created>

<!-- List files created -->

</files_created>

<files_modified>

<!-- List files modified -->

</files_modified>

<files_reference>

<!-- List files needed for context/understanding -->

</files_reference>
