# Business Process Optimization — Stage Machine

The same six-stage contract as the software harness, relabeled for process-improvement business cases.
Every non-trivial case (a new initiative, a re-engineering proposal, an automation business case) moves
through these stages; a one-line baseline correction may start at Draft.

| #   | Stage          | Purpose                                                                                       | Mandatory output                                  |
| --- | -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Frame          | Define the problem statement, scope of the process, baseline metrics (dated, sourced), constraints. | Scope note                                  |
| 1   | Diagnose       | Establish root cause, lay out the options, and define the target state *before* an impact number is written. | Diagnosis brief clearing gates 1–5     |
| 2   | Draft          | Write the business case: current state, proposed change, reconciled impact, risks — each figure summing, each claim sourced. | Draft case + self-review checklist |
| 3   | Review breadth | Scan every section for completeness and internal consistency.                                 | Severity-tagged findings                          |
| 4   | Review depth   | Issue a verdict on each of the five gates.                                                    | Gate verdicts + structural findings               |
| 5   | Feedback       | Evaluate challenges, reconcile the recommendation, finalize the implementation risk view.     | Verdict table + final recommendation              |

## Stage contract

1. **Memory before discovery.** Consult prior briefs/lessons in `.github/harness/memory/` for the
   process or function before re-deriving baselines or benefit estimates.
2. **Context sufficiency first.** Inventory the system-of-record data, time studies, and finance
   reports you have; name what is missing before drafting. Never write a baseline you cannot source.
3. **Carry the diagnosis brief forward.** The brief from stage 1 is the input to Draft, Review depth,
   and Feedback. Persist it to `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4): Baseline Integrity, Impact Reconciliation, Claim
   Substantiation, Change Feasibility & Risk, ROI / Mandate Fit. See [`gates.md`](./gates.md).
5. **Close with status.** End with the deterministic check status (`biz-validate`) and residual risk.

## Deterministic gate before sign-off

Before a business case is reviewed by a human, `node scripts/harness/domain-pack.mjs check
business-optimization --deliverable <case>` must be green: required sections present, impact figures
reconcile, improvement claims sourced. These are necessary, not sufficient — they catch the mechanical
defects so the human review can spend its attention on judgment.
