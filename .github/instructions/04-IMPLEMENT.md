<!-- harness-kit template: this stage defines how to execute a brief. Project-specific coding rules, frameworks, and stack checks stay in repository standards and domain skills. -->

---
applyTo: '**'
---

# Implement Stage

> **Model:** balanced-coding (e.g., `gpt-5.3-codex` or `claude-sonnet-4.x`; Copilot Auto is a safe
> default) — the Architecture Brief already constrains the problem; what matters here is speed and
> code-generation accuracy.
> **Purpose:** Turn the task packet and Architecture Brief into working deliverables without
> silently changing the architecture contract.

This stage applies to code changes, docs, workflows, automations, and mixed delivery work. Repository
standards remain authoritative for stack-specific implementation details.

## Required inputs

Use these as the **implementation packet**:

- task packet from Architect / Understand
- current Architecture Brief, if one exists
- all artifacts being changed
- relevant domain skills and standards
- the narrowest validation route for the work

If the Brief is missing for a non-trivial task, say so before proceeding.

## Prefer shipped proof surfaces

Use the repository's real proof sources before relying on narrative reassurance.

- Pair this stage with `deterministic-validation`; add `budget-aware-execution` when the task is
  long-running or loop-heavy.
- For harness docs, skills, loops, registry, or MCP guidance changes, verify against the concrete
  source files those docs claim to describe (`registry.json`, `.github/harness/loops/`,
  `package.json`, skill directories, `.github/harness/MCP-INTEGRATION.md`).
- For harness-output changes, use the existing repo proof paths when relevant:
  `npm run harness:report`, `npm run harness:grade`, and `npm run harness:otel`.
- For doc-only edits, `git diff --check` plus reference validation against the cited files is the
  default proof unless the repository exposes a stronger deterministic check.
- If the change would widen `allowed-tools`, remove an approval step, weaken a guardrail, or alter a
  destructive workflow default, stop and get explicit human approval before proceeding.

---

## Mandatory first step: Context sufficiency check

Complete this before changing anything.

### 1. Inventory what you have

List the artifacts provided, with:

- path or identifier
- what each one does
- its surface or layer

### 2. State the scope

> **Scope:** [software / documentation / workflow / infrastructure / mixed]
> **Primary deliverable:** [the artifact or behavior being changed]

### 3. Identify missing context

List anything you still need in order to implement correctly.

| Missing artifact | Needed to implement |
| --- | --- |
| `path/or/name` | What cannot be changed safely without it |

### 4. Confirm or challenge the Brief

If a Brief exists:

- confirm that you will follow it
- list any `[UNVERIFIED]` assumptions it contains that affect this change
- if current evidence contradicts the Brief, stop and route the contradiction back to Architect or
  Feedback before implementing the affected part

If no Brief exists for a non-trivial task, note that you are proceeding with reduced contract safety.

---

## Pre-implementation discovery

Before writing the change, verify the current patterns you intend to reuse.

### 1. Reuse and pattern discovery

- find the closest existing example in this repository
- confirm it is the current pattern, not legacy drift
- reuse before creating a new helper, structure, or workflow step

### 2. Contract discovery

- identify the interfaces, templates, schemas, expectations, or downstream consumers you must
  preserve
- if mirroring an existing shape, compare it directly instead of approximating it

### 3. Validation discovery

- identify the smallest proof that shows the change works
- prefer existing tests, checks, previews, dry-runs, or sample runs
- do not invent new validation infrastructure unless the task requires it

### 4. Risk discovery

- identify destructive paths, approval boundaries, rollout sequencing, or recovery steps
- surface anything that makes the implementation higher-risk than the Brief implied

---

## Execution rules

### 1. Implement in small verifiable slices

- make the smallest coherent change that moves the task forward
- verify that slice before expanding scope
- if a slice fails validation, repair before layering on more change

### 2. Stay inside the contract

- follow the Brief's ownership, boundary, and reuse decisions
- do not make new architectural choices casually during implementation
- if new evidence forces a structural change, stop and record the contradiction explicitly

### 3. Keep related surfaces aligned

When the task changes a contract, update the directly dependent surfaces that must stay in sync:

- code plus tests
- workflow plus operator docs
- template plus usage guidance
- automation plus rollback / approval notes

### 4. Prefer explicit proof over self-report

For code, use the narrowest existing lint / type-check / build / test command that proves the change.
For docs or workflows, use the narrowest existing preview, dry-run, rendering check, or scripted
verification that proves the artifact is usable.

Prefer compact evidence artifacts over transcript sprawl: save or cite the smallest proof that the
next stage needs rather than replaying the whole implementation history.

### 5. Do not weaken safeguards to finish faster

- do not skip, delete, or water down checks just to get green
- do not hide uncertainty behind silent fallbacks
- do not add speculative abstractions, flags, or future-proofing without a current need

---

## Mandatory self-review

Before handing off, work through these checks.

### Brief compliance

- [ ] The implementation still matches the Brief's ownership and boundary decisions
- [ ] Any contradicted assumption was surfaced explicitly
- [ ] No forbidden pattern from the Brief's "Do NOT" section was introduced

### Reuse and clarity

- [ ] Existing patterns were reused where appropriate
- [ ] New artifacts have an immediate consumer
- [ ] Names, responsibilities, and placement are consistent with nearby code or workflow structure

### Safety and validation

- [ ] The narrowest meaningful proof was run for the changed behavior
- [ ] Error paths, rollback paths, or operator-facing failure modes were considered where relevant
- [ ] No safeguards were weakened to force completion

### Handoff readiness

- [ ] Directly dependent docs, tests, or workflow notes were updated where required
- [ ] The next reviewer can tell what changed, why, and how it was proved

---

## Output contract

Produce these implementation artifacts:

1. the change itself
2. a **proof summary** listing the validations run and what they covered
3. a **self-review summary** noting any assumptions, deviations, or follow-up risks

Use this shape:

```md
## Implementation Summary

### Delivered
- What changed

### Contract adherence
- Brief followed / contradiction surfaced

### Proof summary
- Validation run and what it covered

### Assumptions or deviations
- `[UNVERIFIED]` items, if any
```

## Handoff rules

- Review Breadth evaluates correctness, completeness, standards, and proof quality.
- Review Depth evaluates whether the implementation still honors the architectural gates and Brief.
- If implementation uncovered a structural contradiction, Feedback or Architect must resolve it before
  the work is considered settled.
