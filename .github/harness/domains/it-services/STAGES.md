# IT Services & Delivery — Stage Machine

The same six-stage contract as the software harness, relabeled for IT-services delivery. Every
non-trivial deliverable (a new managed-service onboarding, a platform build, a major runbook) moves
through these stages; a one-line procedure correction may start at Draft.

| #   | Stage          | Purpose                                                                                      | Mandatory output                                  |
| --- | -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Frame          | Define the client need, in-scope and out-of-scope boundaries, and the constraints.           | Scope note                                        |
| 1   | Design         | State the target architecture, SLA targets, and operating model *before* a runbook is written. | Design brief clearing gates 1–5                   |
| 2   | Draft          | Write the SOW / service design / runbook: architecture, SLA, procedures, rollback.           | Draft SOW/runbook + self-review checklist         |
| 3   | Review breadth | Scan every section for completeness and internal consistency.                                | Severity-tagged findings                          |
| 4   | Review depth   | Issue a verdict on each of the five gates.                                                   | Gate verdicts + structural findings               |
| 5   | Feedback       | Evaluate challenges, reconcile scope against cost, finalize the go-live readiness sign-off.  | Verdict table + final sign-off                    |

## Stage contract

1. **Memory before discovery.** Consult prior briefs/lessons in `.github/harness/memory/` for the
   client or service line before re-deriving an operating model or SLA target.
2. **Context sufficiency first.** Inventory the client requirements, environments, and compliance
   constraints you have; name what is missing before drafting. Never commit to an SLA you cannot
   measure.
3. **Carry the design brief forward.** The brief from stage 1 is the input to Draft, Review depth,
   and Feedback. Persist it to `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4): Scope Clarity, SLA Measurability, Operational Readiness,
   Security & Compliance, Cost/Effort Traceability. See [`gates.md`](./gates.md).
5. **Close with status.** End with the deterministic check status (`it-validate`) and residual risk.

## Deterministic gate before sign-off

Before a SOW or runbook is reviewed by a human, `node scripts/harness/domain-pack.mjs check
it-services --deliverable <file>` must be green: required sections present, every readiness gate
carries a verdict, every quantified/superlative claim is sourced. These are necessary, not
sufficient — they catch the mechanical defects so the human review can spend its attention on
judgment.
