---
name: doubt-driven-development
description: Security and correctness skepticism for high-stakes changes, and disciplined diagnosis for hard bugs. Use for security changes, irreversible operations, cross-model review of production behavior, and debugging complex failures.
---

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

This repo's harness assigns a **high-reasoning** model to Review Breadth/Depth (see `harness.config.json §
models.reviewer`). Invoke a cross-model pass when:

1. A doubt touches security (auth, encryption, data isolation, GDPR).
2. A doubt challenges an existing Architecture Brief decision.
3. Two consecutive implement iterations produce the same finding.

Cross-model escalation is a `review-fix` loop invocation, not an ad-hoc question.

---

## Bug Diagnosis (Hard Bugs and Regressions)

When a bug can't be quickly identified by inspection, shift to a structured diagnosis loop rather
than guessing. Adapted from [mattpocock/skills `diagnosing-bugs`](https://github.com/mattpocock/skills/tree/main/skills/engineering/diagnosing-bugs).

### Phase 1 — Build a feedback loop first (the whole skill)

Before hypothesizing, build a **tight pass/fail signal** for the bug. Without one, no amount of
reading code will reliably find the cause. Try these in order:

1. Failing test at a seam that reaches the bug
2. curl / HTTP script against a running dev server
3. CLI invocation with a fixture input, diff stdout against known-good
4. Headless browser script (Playwright / Puppeteer)
5. Replay a captured trace (HAR file, log dump, saved payload)
6. Throwaway harness — minimal subset of the system, single function call
7. Property / fuzz loop — 1000 random inputs, look for the failure mode
8. Bisection harness — `git bisect run` against a known-good vs bad state

**Tighten the loop:** make it faster (skip unrelated init), sharper (assert the exact symptom),
more deterministic (pin time, seed RNG, freeze network).

**Non-deterministic bugs:** raise the reproduction rate — loop 100×, parallelise, narrow timing
windows. A 50%-flake bug is debuggable; a 1%-flake is not.

**Completion criterion:** name one command you have already run, whose output you can paste, that
goes red on this specific bug, is deterministic, runs in seconds, and runs unattended.
If you catch yourself reading code to build a theory before this command exists — **stop**.

### Phase 2 — Reproduce and minimise

Run the loop. Confirm it fails with the user's exact symptom (not a nearby failure). Then shrink
the repro to the smallest scenario that still goes red — remove inputs, callers, config, data one
at a time, re-running after each cut.

### Phase 3 — Hypothesise (3–5 ranked, all falsifiable)

Generate 3–5 ranked hypotheses before testing any. Each must be falsifiable:

> "If `<X>` is the cause, then changing `<Y>` will make the bug disappear."

Show the ranked list before testing. Don't block on user response — proceed with your ranking if AFK.

### Phase 4 — Instrument (one variable at a time)

Tool preference: debugger / REPL → targeted logs at hypothesis boundaries → never "log everything
and grep". **Tag every debug log** with a unique prefix e.g. `[DEBUG-a4f2]` — cleanup becomes a
single grep. For perf regressions: measure first (timing harness, query plan), bisect second.

### Phase 5 — Fix + regression test at a correct seam

Write the regression test **before the fix** — but only at a **correct seam**: where the test
exercises the real bug pattern at the actual call site. If no correct seam exists, that is the
finding — the architecture is preventing the bug from being locked down. Note and flag it.

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail → apply the fix → watch it pass.
3. Re-run the original (un-minimised) Phase 1 loop.

### Phase 6 — Cleanup + post-mortem

- [ ] Original repro no longer reproduces
- [ ] Regression test passes (or absence of correct seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted
- [ ] Correct hypothesis stated in the commit message
- [ ] Ask: what would have prevented this? If architectural, hand off to Architect stage with the
      specific seam gap as input.

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
