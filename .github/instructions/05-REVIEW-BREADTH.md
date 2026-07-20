<!-- harness-kit template: breadth review should stay universal. Repository standards provide the stack-specific checklist; this stage defines how to find and report concrete issues without drifting into deep architecture adjudication. -->

---
applyTo: '**'
---

# Review Breadth Stage

> **Model:** high-reasoning (e.g., `claude-opus-4.8`; Copilot Auto is a safe default) — breadth
> review requires sustained coverage across many categories without losing track of prior findings.
> **Purpose:** Find concrete, actionable issues across the changed scope: correctness, completeness,
> standards compliance, safety, and proof quality.

Breadth review is the wide pass. Its job is to catch what is wrong, missing, risky, or weakly proved
without collapsing into a deep ownership debate too early.

## Required inputs

Use the following review packet:

- task statement
- changed artifacts
- relevant standards and skill docs
- Architecture Brief, if one exists
- Implement-stage proof summary

If the change packet is incomplete, stop and name what is missing.

---

## Mandatory first step: Context sufficiency check

### 1. Inventory what you have

List the changed and supporting artifacts with:

- path or identifier
- what changed
- surface or layer

### 2. State the scope

> **Scope:** [software / documentation / workflow / infrastructure / mixed]

### 3. Identify missing context

List any missing artifacts that would affect finding quality.

| Missing artifact | Affects which review lane |
| --- | --- |
| `path/or/name` | standards / correctness / proof / safety / completeness |

### 4. Decide whether to proceed

If a missing artifact blocks a reliable finding, say so explicitly and avoid pretending certainty.

Use:

> MISSING: `artifact`
> LIMITATION: [what cannot be judged well]
> RISK: [what issue might be hidden]

---

## Review lanes

Run all lanes that apply to the change. Report failures only.

### Lane 1 - Requirement and contract coverage

- Does the delivered change appear to satisfy the stated task?
- Are dependent artifacts updated where the contract changed?
- If a Brief exists, does the implementation stay within its declared scope?

### Lane 2 - Standards and policy compliance

- Does the change follow the repository's current conventions?
- Are naming, structure, validation, and documentation expectations met for this surface?
- If the task is workflow or automation related, are approvals, owners, and operator steps explicit?
- If the task changes harness docs or skills, do the prose claims match the shipped capability
  surfaces (`registry.json`, loop JSON, skill frontmatter, `package.json`, MCP wrappers)?

### Lane 3 - Functional correctness and safety

- Does the logic do what it claims?
- Are edge cases, failure paths, and bounds handled?
- Are there security, privacy, tenancy, permission, or destructive-action risks?
- For docs and workflows: are instructions unambiguous, executable, and safe to follow?

### Lane 4 - Resource, lifecycle, and operational soundness

- Are cleanup, retries, sequencing, and state transitions handled correctly?
- Could the change leave the system, workflow, or operator in a half-complete state?

### Lane 5 - Proof quality

- Did the implementation run the narrowest meaningful proof?
- Do tests, previews, dry-runs, or validation artifacts actually cover the changed behavior?
- Is any claim of completion unsupported by evidence?
- For harness-surface work, were report / grade / otel / graph / MCP references checked against the
  actual repo capabilities they describe?

### Lane 6 - Semantic clarity

- Do names, headings, commands, or steps describe what the artifact actually does?
- Are any instructions misleading, ambiguous, or internally inconsistent?

---

## Findings rules

- Distinguish direct evidence from inference.
- Cite the specific artifact and location that supports each finding.
- Prefer checking the concrete tool or contract surface over inferring behavior from prose alone.
- Do not list strengths.
- Do not re-report items intentionally deferred with an explicit TODO marker.
- If confidence is not high, say why.
- Save structural ownership arguments for Review Depth unless they are necessary to explain the bug.
- **Lead with what matters.** Order findings by leverage: correctness and security first, then structural regressions and missed simplifications, then everything else. A few high-conviction findings beat a long list of nits.
- **When flagging a structural problem, propose the remedy** — not just the problem. Reach for a named restructuring:
  - Replace a chain of conditionals with a typed model or explicit dispatcher
  - Collapse duplicate branches into a single clearer flow
  - Separate orchestration from business logic so each reads on its own
  - Move feature-specific logic out of a shared module into the package that owns the concept
  - Reuse the canonical helper instead of a bespoke near-duplicate
  - Make a type boundary explicit so downstream branching disappears
  - Delete a pass-through wrapper that adds indirection without clarifying the API

---

## Anti-rationalization

Adapted from [addyosmani/agent-skills `code-review-and-quality`](https://github.com/addyosmani/agent-skills).

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or structurally wrong creates debt that compounds. |
| "AI-generated code is probably fine" | Model-produced code needs more scrutiny, not less. It is confident and plausible even when wrong. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch structural problems, security issues, or readability concerns. |
| "I'll clean it up later" | Later never comes. The review is the quality gate — use it. Require cleanup before closing. |
| "The refactor makes it cleaner" | Relocating complexity is not reducing it. If the reader still holds the same number of concepts, the structure didn't improve. |
| "It's just a small addition to this file" | Small diffs can still push a file past a healthy size and bolt branches onto unrelated flows. Judge the resulting structure, not the diff size. |
| "LGTM" without review evidence | Rubber-stamping helps no one. Don't soften real issues — quantify problems when possible. |

---

## Output contract

Produce a **findings ledger** grouped by severity:

- **Blocker** - unsafe, broken, or cannot be accepted as-is
- **Major** - important issue or missing proof that should be fixed before closing
- **Minor** - improvement or follow-up that does not block the task
- **Nit** - optional micro-polish; author may ignore
- **FYI** - informational context only; no action required — use when something is worth noting for future reference but demands nothing now

For each finding include:

1. **Artifact**
2. **Finding**
3. **Evidence**
4. **Impact**
5. **Confidence** (`HIGH`, `MEDIUM`, `LOW`)
6. **Recommended fix**

Also include:

- a short **coverage note** describing what this pass did and did not inspect
- a **missing-context note** for anything that reduced confidence

## Handoff rules

- Review Depth receives this ledger and should not duplicate it unless a breadth finding exposes a
  deeper structural problem.
- Feedback uses accepted / rejected breadth findings as part of the final verdict record.
