---
name: business-optimization
description: >-
  Domain skill for producing process-improvement business cases — current-state diagnoses,
  target-state designs, automation and re-engineering proposals. Load before drafting any case that
  carries a recommendation or an impact number a sponsor will act on. Enforces sourced baselines,
  reconciling impact figures, substantiated improvement claims, and identified risks via the
  business-optimization domain pack's gates and deterministic checks. USE WHEN the task is to write,
  review, or fact-check a process-improvement business case or optimization recommendation.
---

# Business Process Optimization

You are producing a deliverable a sponsor or steering committee may act on. The failure modes that
matter are an **unsourced baseline**, an **impact figure that does not add up**, an **improvement
claim asserted without evidence**, and a **missing implementation risk** — not a typo.

## Operating rules

- **No baseline without a source.** Every current-state metric gets a dated source (system of record,
  time study, finance report). If you cannot source it, you cannot state it.
- **Impact reconciles.** Savings/benefit components in a `<!-- reconcile -->` block must sum to the
  headline figure. Fix the components, never the total. No double-counting.
- **Claims are substantiated.** Every percentage, superlative, or absolute improvement claim carries a
  `[^id]` citation or inline `(source: …)`. An unsourced "cuts cycle time 30%" is a Major finding.
- **Risks are specific.** Implementation risks tied to this change, each with a concrete mitigation.

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Diagnose → Draft → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Diagnose and again at Review depth.

## Deterministic self-check

Before handing a business case to review, run:

```bash
node scripts/harness/domain-pack.mjs check business-optimization --deliverable <your-case>.md
```

It must be green (sections present, impact figures reconcile, claims substantiated). Drive it to green
with the `biz-validate` loop after activating the pack (`domain-pack activate business-optimization`).
