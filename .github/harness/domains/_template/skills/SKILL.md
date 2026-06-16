---
name: <your-domain-skill>
description: >-
  Domain skill for producing <deliverable kind> in the <industry> domain. Load before producing or
  reviewing the deliverable. Enforces <the domain's core quality rules> via this pack's gates and
  deterministic checks. USE WHEN the task is to write, review, or fact-check a <deliverable kind>.
---

# <Domain title>

State the failure modes that matter in this domain — the defects a reader would be harmed by, not
cosmetic ones. Then the operating rules that prevent them.

## Operating rules

- <Rule 1 — e.g. "No figure without a source.">
- <Rule 2>
- <Rule 3>

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Plan → Produce → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Plan and again at Review depth.

## Deterministic self-check

Before handing the deliverable to review, run:

```bash
node scripts/harness/domain-pack.mjs check <your-pack> --deliverable <your-deliverable>.md
```

It must be green. Drive it to green with the `<prefix>-validate` loop after activating the pack
(`domain-pack activate <your-pack>`).
