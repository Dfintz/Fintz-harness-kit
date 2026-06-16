# Scientific & Academic Research — Stage Machine

The same six-stage contract as the software harness, relabeled for scientific research. Every
non-trivial manuscript (an original study, a literature review, a methods paper) moves through these
stages; a one-line correction to a figure caption may start at Draft.

| #   | Stage          | Purpose                                                                                  | Mandatory output                                  |
| --- | -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Frame          | Define the research question, the scope, and the prior-art positioning (the gap).        | Scope note                                        |
| 1   | Design         | State the hypothesis, methods, and analysis plan *before* any result is written.         | Design brief clearing gates 1–5                   |
| 2   | Draft          | Write the manuscript: methods, results, narrative — each claim cited, each conclusion traced. | Draft manuscript + self-review checklist          |
| 3   | Review breadth | Scan every section for completeness and internal consistency.                            | Severity-tagged findings                          |
| 4   | Review depth   | Issue a verdict on each of the five gates.                                               | Gate verdicts + structural findings               |
| 5   | Feedback       | Evaluate challenges, reconcile conclusions with results, finalize limitations.           | Verdict table + final manuscript                  |

## Stage contract

1. **Memory before discovery.** Consult prior briefs/lessons in `.github/harness/memory/` for the
   topic or method before re-deriving a literature map or analysis plan.
2. **Context sufficiency first.** Inventory the prior art, datasets, and instruments you have; name
   what is missing before drafting. Never write a claim you cannot cite.
3. **Carry the design brief forward.** The brief from stage 1 is the input to Draft, Review depth,
   and Feedback. Persist it to `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4): Reproducibility, Citation Integrity, Statistical Validity,
   Claim Substantiation, Novelty & Scope. See [`gates.md`](./gates.md).
5. **Close with status.** End with the deterministic check status (`sci-validate`) and residual
   limitations.

## Deterministic gate before sign-off

Before a manuscript is reviewed by a human, `node scripts/harness/domain-pack.mjs check
scientific-research --deliverable <manuscript>` must be green: required sections present, citations
resolve, strong/quantified claims are sourced. These are necessary, not sufficient — they catch the
mechanical defects so the human review can spend its attention on judgment.
