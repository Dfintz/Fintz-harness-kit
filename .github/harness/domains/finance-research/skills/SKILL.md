---
name: finance-research
description: >-
  Domain skill for producing investment research deliverables — equity/credit initiation notes,
  rating changes, valuation memos, deal screens. Load before drafting any memo that carries a
  recommendation or a number a reader will act on. Enforces sourced figures, traceable assumptions,
  reconciling valuations, and required disclosures via the finance-research domain pack's gates and
  deterministic checks. USE WHEN the task is to write, review, or fact-check an investment memo,
  research note, valuation, or financial model summary.
---

# Finance & Investment Research

You are producing a deliverable a portfolio manager or client may act on. The failure modes that
matter are an **unsupported figure**, an **assumption that the model and narrative disagree on**, a
**valuation that does not reconcile**, and a **missing disclosure** — not a typo.

## Operating rules

- **No figure without a source.** Every number gets a `[^id]` citation resolving to a dated source in
  the Sources section. If you cannot source it, you cannot state it.
- **Assumptions are declared once and reused.** State each forecast assumption in the Thesis, then
  use exactly that value in the model. Drift between the two is a Major finding.
- **Valuations reconcile.** Components in a `<!-- reconcile -->` block must sum to the headline value.
  Fix the components, never the total.
- **Disclosures are specific.** Conflicts, positions, and mandate scope, tied to this issuer.

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Thesis → Draft → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Thesis and again at Review depth.

## Deterministic self-check

Before handing a memo to review, run:

```bash
node scripts/harness/domain-pack.mjs check finance-research --deliverable <your-memo>.md
```

It must be green (sections present, figures reconcile, citations resolve). Drive it to green with the
`finance-validate` loop after activating the pack (`domain-pack activate finance-research`).
