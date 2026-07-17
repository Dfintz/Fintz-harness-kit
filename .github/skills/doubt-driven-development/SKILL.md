# Skill: Doubt-Driven Development

> Use when: Stakes are high (production, security, irreversible action), working in unfamiliar code,
> a confident-sounding output is cheaper to verify now than to debug later, or the harness Review
> Depth stage surfaces architectural challenges.

Adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) —
`doubt-driven-development` skill. Condensed to this repo's conventions and wired to the harness
cross-model review protocol.

---

## Objective

Apply adversarial fresh-context review to every non-trivial decision in-flight before committing it
to code or an Architecture Brief — catching confident-but-wrong outputs before they cost effort to
unwind.

---

## Process: CLAIM → EXTRACT → DOUBT → RECONCILE → STOP

### CLAIM

State the decision or output being evaluated:

> "I am about to [X] because [reason]."

Be specific. Vague claims produce vague doubts.

### EXTRACT

List every assumption the claim depends on:

- What must be true about the codebase for this to work?
- What must be true about the runtime environment?
- What must be true about external dependencies?

### DOUBT

For each assumption: "What if this is wrong?"

Apply the five gate tests from the harness architecture protocol (domain alignment, generality, data
ownership, layer boundary, reuse), plus Gate 4b: Multi-Tenant Isolation — does every database access
scope by `organizationId`? Flag any assumption that would fail a gate if wrong.

Explicitly check:

- Is there a prior Architecture Brief decision this contradicts?
- Does the change cross a domain boundary without justification?
- Is there an existing pattern in the codebase this ignores?

### RECONCILE

Resolve each doubt with evidence (a file read, a test result, a documented decision) — or escalate:

- **Evidence clears it** → proceed
- **Doubt is unresolvable locally** → pause, ask the user or request a cross-model review pass
- **Doubt reveals a real gap** → stop and return to Architect stage

### STOP

Declare the outcome:

- "All doubts cleared by evidence — proceeding."
- "Doubt [X] unresolved — escalating to cross-model review / returning to Architect."

Never proceed with an unresolved doubt that maps to a high-impact assumption.

---

## When to Invoke Cross-Model Review

This repo's harness already assigns Opus to Review Breadth/Depth. Invoke a cross-model pass when:

1. A doubt touches security (auth, encryption, data isolation, GDPR).
2. A doubt challenges an existing Architecture Brief decision.
3. Two consecutive implement iterations produce the same finding.

Cross-model escalation is a `review-fix` loop invocation, not an ad-hoc question.

---

## Verification

A doubt-driven pass is complete when:

- [ ] Every assumption for the current claim is listed explicitly
- [ ] Each assumption has a clearing evidence reference or an escalation decision
- [ ] No unresolved doubt maps to a high-impact assumption (security, auth, tenant isolation,
      irreversible action)
- [ ] Outcome declared explicitly: "All doubts cleared — proceeding" or "Doubt [X] unresolved —
      escalating"

---

## Anti-Rationalization Table

## Usage Scenarios

### Scenario 1: I need to change encryption keys. How do I ensure zero data loss?

**What this demonstrates:** Shows high-stakes patterns: assumption checks, reversibility analysis

### Scenario 2: I want a security expert to review my auth change before deploy.

**What this demonstrates:** Demonstrates cross-model review for production security changes
