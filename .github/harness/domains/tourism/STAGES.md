# Tourism & Hospitality — Stage Machine

The same six-stage contract as the software harness, relabeled for tour packages and itinerary
proposals. Every non-trivial proposal (a multi-day group tour, a bespoke private trip, a seasonal
package) moves through these stages; a one-line price correction may start at Draft.

| #   | Stage          | Purpose                                                                                       | Mandatory output                                  |
| --- | -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Frame          | Define client/segment, travel dates, budget, and constraints (group size, accessibility).     | Scope note                                        |
| 1   | Plan           | Design the itinerary and logistics, select suppliers, fix every timing and price *first*.      | Itinerary plan clearing gates 1–5                 |
| 2   | Draft          | Write the proposal: itinerary, inclusions, pricing, narrative — each price sourced, each claim backed. | Draft proposal + self-review checklist     |
| 3   | Review breadth | Scan every section for completeness and internal consistency.                                 | Severity-tagged findings                          |
| 4   | Review depth   | Issue a verdict on each of the five gates.                                                     | Gate verdicts + structural findings               |
| 5   | Feedback       | Evaluate challenges, reconcile the quote, finalize safety and cancellation terms.              | Verdict table + final proposal                    |

## Stage contract

1. **Memory before discovery.** Consult prior plans/lessons in `.github/harness/memory/` for the
   destination or supplier before re-deriving timings or rates.
2. **Context sufficiency first.** Inventory the supplier quotes, opening hours, and transfer times you
   have; name what is missing before drafting. Never quote a price you cannot source.
3. **Carry the itinerary plan forward.** The plan from stage 1 is the input to Draft, Review depth,
   and Feedback. Persist it to `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4): Logistics Feasibility, Pricing Reconciliation, Claim
   Substantiation, Safety & Compliance, Client Fit. See [`gates.md`](./gates.md).
5. **Close with status.** End with the deterministic check status (`tour-validate`) and residual risk.

## Deterministic gate before sign-off

Before a proposal is reviewed by a human, `node scripts/harness/domain-pack.mjs check tourism
--deliverable <proposal>` must be green: required sections present, line items reconcile to the total,
marketing claims substantiated. These are necessary, not sufficient — they catch the mechanical
defects so the human review can spend its attention on judgment.
