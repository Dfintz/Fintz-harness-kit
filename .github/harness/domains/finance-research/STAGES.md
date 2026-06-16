# Finance & Investment Research — Stage Machine

The same six-stage contract as the software harness, relabeled for investment research. Every
non-trivial memo (an initiation, a rating change, a deal screen) moves through these stages; a
one-line data correction may start at Draft.

| #   | Stage          | Purpose                                                                                  | Mandatory output                                  |
| --- | -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Frame          | Define subject (security/issuer), mandate, the decision needed, horizon, constraints.    | Scope note                                        |
| 1   | Thesis         | State the thesis, valuation approach, and every assumption *before* a number is written. | Thesis brief clearing gates 1–5                   |
| 2   | Draft          | Write the memo: model, figures, narrative — each figure sourced, each assumption traced. | Draft memo + self-review checklist                |
| 3   | Review breadth | Scan every section for completeness and internal consistency.                            | Severity-tagged findings                          |
| 4   | Review depth   | Issue a verdict on each of the five gates.                                               | Gate verdicts + structural findings               |
| 5   | Feedback       | Evaluate challenges, reconcile the recommendation, finalize disclosures.                 | Verdict table + final recommendation              |

## Stage contract

1. **Memory before discovery.** Consult prior briefs/lessons in `.github/harness/memory/` for the
   issuer or sector before re-deriving comparables or assumptions.
2. **Context sufficiency first.** Inventory the filings, vendor data, and management commentary you
   have; name what is missing before drafting. Never write a figure you cannot source.
3. **Carry the thesis brief forward.** The brief from stage 1 is the input to Draft, Review depth,
   and Feedback. Persist it to `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4): Data Provenance, Assumption Traceability, Valuation
   Coherence, Risk & Disclosure, Mandate Fit. See [`gates.md`](./gates.md).
5. **Close with status.** End with the deterministic check status (`finance-validate`) and residual
   risk.

## Deterministic gate before sign-off

Before a memo is reviewed by a human, `node scripts/harness/domain-pack.mjs check finance-research
--deliverable <memo>` must be green: required sections present, figures reconcile, citations resolve.
These are necessary, not sufficient — they catch the mechanical defects so the human review can spend
its attention on judgment.
