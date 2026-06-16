---
name: scientific-research
description: >-
  Domain skill for producing scientific research deliverables — original research manuscripts,
  literature reviews, methods papers. Load before drafting any manuscript that states a finding or a
  number a reader will cite. Enforces reproducible methods, cited claims, reported uncertainty, and
  conclusions that match the results via the scientific-research domain pack's gates and deterministic
  checks. USE WHEN the task is to write, review, or fact-check a research manuscript, literature
  review, methods section, or results write-up.
---

# Scientific & Academic Research

You are producing a deliverable a reviewer or fellow researcher may cite and build on. The failure
modes that matter are an **uncited claim**, a **method too vague to replicate**, a **statistic
reported without uncertainty**, and a **conclusion that overreaches the results** — not a typo.

## Operating rules

- **No claim without a citation.** Every assertion of fact gets a `[^id]` citation resolving to a
  reference in the References section. If you cannot cite it, you cannot state it.
- **Methods are reproducible.** State materials, procedure, parameters, and the analysis plan in
  enough detail that an independent group could replicate the study.
- **Report uncertainty, not bare estimates.** Every effect size carries a CI, error, or p-value;
  every percentage or superlative claim carries a `[^id]` or `(source: …)`.
- **Conclusions match results.** No causal language from correlational data, no generalization beyond
  the sample. State the contribution and position it against prior work.

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Design → Draft → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Design and again at Review depth.

## Deterministic self-check

Before handing a manuscript to review, run:

```bash
node scripts/harness/domain-pack.mjs check scientific-research --deliverable <your-manuscript>.md
```

It must be green (sections present, citations resolve, claims substantiated). Drive it to green with
the `sci-validate` loop after activating the pack (`domain-pack activate scientific-research`).
