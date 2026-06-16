---
name: legal-compliance
description: >-
  Domain skill for producing legal and compliance deliverables — contracts, clause sets, amendments,
  compliance memos. Load before drafting any instrument that creates obligations or asserts an
  authority a party will rely on. Enforces stated governing law, consistently-used defined terms,
  clear and bounded obligations, complete duties/remedies/termination, and traceable authority
  citations via the legal-compliance domain pack's gates and deterministic checks. USE WHEN the task
  is to draft, review, or compliance-check a contract, clause, agreement, policy, or compliance memo.
---

# Legal & Compliance

You are producing a deliverable a party or regulator may rely on. The failure modes that matter are an
**unenforceable obligation**, a **defined term that no clause uses**, a **gap in duties, remedies, or
termination**, and an **authority citation that does not resolve** — not a typo.

## Operating rules

- **State the governing law.** The Governing Law section names the controlling jurisdiction and venue,
  and every clause is consistent with it. A conflicting forum or choice-of-law clause is a finding.
- **Defined terms are declared once and used.** Define each term in `## Definitions` as
  `- **Term** — description`, then use that exact term in the operative clauses. A dead definition is a
  finding; so is an operative term that was never defined.
- **Obligations are clear and bounded.** Each duty states its standard, trigger, and limit. Each party
  has duties, remedies for breach, and a termination path.
- **No authority without a citation.** Every reference to a statute, regulation, or precedent gets a
  `[^id]` citation resolving to a stated authority. If you cannot cite it, you cannot rely on it.

## Stages and gates

Follow [`../STAGES.md`](../STAGES.md): Frame → Structure → Draft → Review breadth → Review depth →
Feedback. Clear the five gates in [`../gates.md`](../gates.md) at Structure and again at Review depth.

## Deterministic self-check

Before handing an instrument to review, run:

```bash
node scripts/harness/domain-pack.mjs check legal-compliance --deliverable <your-instrument>.md
```

It must be green (sections present, every defined term used, every authority resolves). Drive it to
green with the `legal-validate` loop after activating the pack
(`domain-pack activate legal-compliance`).
