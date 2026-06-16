# <Domain> — Stage Machine

The same six-stage contract as the software harness, relabeled for this domain. Replace the purposes
and outputs below with your domain's reality.

| #   | Stage          | Purpose                                                            | Mandatory output                    |
| --- | -------------- | ----------------------------------------------------------------- | ----------------------------------- |
| 0   | Frame          | Define the subject, the decision/output needed, the constraints.  | Scope note                          |
| 1   | Plan           | Decide structure and approach *before* producing.                 | Plan brief clearing the gates       |
| 2   | Produce        | Write the deliverable; every claim traceable to the plan/sources. | Draft + self-review                 |
| 3   | Review breadth | Scan every section for completeness and consistency.              | Severity-tagged findings            |
| 4   | Review depth   | Issue a verdict on each gate.                                      | Gate verdicts + structural findings |
| 5   | Feedback       | Evaluate challenges, reconcile, finalize.                         | Verdict table + final output        |

## Stage contract

1. **Memory before discovery.** Consult `.github/harness/memory/` for prior briefs/lessons before
   re-deriving anything.
2. **Context sufficiency first.** Inventory what you have; name what is missing before producing.
3. **Carry the plan brief forward** into Produce, Review depth, and Feedback; persist it to
   `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4) — see [`gates.md`](./gates.md).
5. **Close with status:** the deterministic check status and residual risk.

## Deterministic gate before sign-off

Before human review, `node scripts/harness/domain-pack.mjs check <your-pack> --deliverable <file>`
must be green. These checks are necessary, not sufficient — they catch mechanical defects so human
review can focus on judgment.
