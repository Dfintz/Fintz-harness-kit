# Tourism & Hospitality — Gates

Run at the Plan stage (1) and again at Review depth (4). Answer each gate explicitly; a single
failure is a finding that blocks sign-off until resolved.

### Gate 1 — Logistics Feasibility

Are the timings, transfers, and opening hours realistic — does each day physically work?

> **FAIL format:** INFEASIBLE: `[activity]` on `[day]` overlaps/exceeds `[transfer or opening hours]`.
> Adjust the schedule or the supplier.

### Gate 2 — Pricing Reconciliation

Do the priced line items sum to the quoted total?

> **FAIL format:** RECONCILE: line items sum to `[a]` but the Total says `[b]`.
> Enforced by `figure-reconciliation.mjs`.

### Gate 3 — Claim Substantiation

Is every marketing claim sourced or factual rather than puffery?

> **FAIL format:** UNSOURCED CLAIM: `[claim]` carries no `[^id]` or `(source: …)`. Source it or
> rephrase without the superlative/percentage. Enforced by `claim-substantiation.mjs`.

### Gate 4 — Safety & Compliance

Are insurance, cancellation policy, and relevant travel advisories present and specific?

> **FAIL format:** MISSING TERM: `[insurance / cancellation policy / advisory]`. BOILERPLATE: `[term]`
> is generic, not tied to this trip. Partly enforced by `required-sections.mjs` (a Safety &
> Cancellation section must exist).

### Gate 5 — Client Fit

Does the package match the client's segment, budget, and accessibility needs, and are reusable
itinerary components factored out rather than re-derived per proposal?

> **FAIL format:** FIT MISMATCH: package `[detail]` is inconsistent with `[segment/budget/accessibility]`.
