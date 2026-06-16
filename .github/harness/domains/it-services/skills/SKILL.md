---
name: it-services
description: >-
  Domain skill for producing IT-services delivery artifacts — statements of work, service designs,
  SLA schedules, and operational runbooks. Load before drafting any deliverable a client will sign or
  an on-call engineer will follow. Enforces explicit scope boundaries, measurable SLA targets,
  complete runbooks with rollback, signed-off readiness gates, and substantiated claims via the
  it-services domain pack's gates and deterministic checks. USE WHEN the task is to write or review a
  statement of work (SOW), service design, SLA, or runbook.
---

# IT Services & Delivery

You are producing a deliverable a client will sign or an on-call engineer will execute under
pressure. The failure modes that matter are an **ambiguous scope boundary**, an **unmeasurable SLA
target**, a **runbook with no rollback**, a **readiness gate left unanswered**, and an
**unsubstantiated cost or capability claim** — not a typo.

## Operating rules

- **Scope is explicit on both sides.** State what is in scope and what is out of scope. Anything
  named by neither is a Scope Clarity finding.
- **SLA targets are measurable.** Every target carries a number, a window, or a metric (e.g.
  "99.9% monthly uptime", "P1 response within 15 minutes"). A vague aspiration is a finding.
- **Runbooks ship with rollback.** Every change procedure has a tested rollback path; the Rollback
  section is mandatory.
- **Readiness gates are signed off.** Each go-live readiness gate carries an explicit `Verdict:`
  line — PASS with a reason, or a blocking finding.
- **Strong claims are sourced.** Any percentage or superlative/absolute statement (e.g. an SLA
  figure, "best-in-class") carries a `[^id]` citation or an inline `(source: …)`.

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Design → Draft → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Design and again at Review depth.

## Deterministic self-check

Before handing a SOW or runbook to review, run:

```bash
node scripts/harness/domain-pack.mjs check it-services --deliverable <your-deliverable>.md
```

It must be green (sections present, readiness gates carry verdicts, claims are sourced). Drive it to
green with the `it-validate` loop after activating the pack (`domain-pack activate it-services`).
