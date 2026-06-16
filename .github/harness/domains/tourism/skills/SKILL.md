---
name: tourism
description: >-
  Domain skill for producing tour packages and itinerary proposals — multi-day group tours, bespoke
  private trips, seasonal packages. Load before drafting any proposal that carries a price or a claim
  a client will act on. Enforces feasible logistics, reconciling pricing, substantiated marketing
  claims, and required safety/cancellation terms via the tourism domain pack's gates and deterministic
  checks. USE WHEN the task is to build, review, or fact-check a tour package or itinerary proposal.
---

# Tourism & Hospitality

You are producing a deliverable a traveler or client may book and pay for. The failure modes that
matter are an **infeasible schedule**, a **price that does not add up**, an **unsupported marketing
claim**, and a **missing safety or cancellation term** — not a typo.

## Operating rules

- **No price without a source.** Every line item traces to a supplier quote; the line items must sum
  to the quoted total. Fix the line items, never the total.
- **Logistics must be feasible.** Timings, transfers, and opening hours have to physically work within
  each day and across the trip. State each in the Plan, then use exactly that in the itinerary.
- **Claims are substantiated, not puffery.** Any superlative ("best", "#1", "guaranteed") or
  percentage gets a `[^id]` or `(source: ...)`, or it is rephrased without the trigger word.
- **Safety terms are specific.** Insurance, cancellation policy, and relevant travel advisories, tied
  to this trip — not boilerplate.

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Plan → Draft → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Plan and again at Review depth.

## Deterministic self-check

Before handing a proposal to review, run:

```bash
node scripts/harness/domain-pack.mjs check tourism --deliverable <your-proposal>.md
```

It must be green (sections present, line items reconcile, claims substantiated). Drive it to green
with the `tour-validate` loop after activating the pack (`domain-pack activate tourism`).
