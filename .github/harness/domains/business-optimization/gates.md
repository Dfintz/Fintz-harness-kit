# Business Process Optimization — Gates

Run at the Diagnose stage (1) and again at Review depth (4). Answer each gate explicitly; a single
failure is a finding that blocks sign-off until resolved.

### Gate 1 — Baseline Integrity

Are the current-state metrics sourced and dated (system of record, time study, finance report)?

> **FAIL format:** UNSOURCED: baseline `[metric]` in `[section]` has no dated source. Source it or
> remove it. Partly enforced by `claim-substantiation.mjs`.

### Gate 2 — Impact Reconciliation

Do the savings/benefit components sum to the headline impact figure, with no double-counting or
unexplained gap?

> **FAIL format:** RECONCILE: components sum to `[a]` but the headline says `[b]`.
> Enforced by `figure-reconciliation.mjs`.

### Gate 3 — Claim Substantiation

Is each improvement claim (percentage, superlative, absolute) sourced to evidence rather than asserted?

> **FAIL format:** UNSUBSTANTIATED: claim `[text]` carries no citation or `(source: …)`.
> Enforced by `claim-substantiation.mjs`.

### Gate 4 — Change Feasibility & Risk

Are the implementation risks identified and specific, each paired with a concrete mitigation?

> **FAIL format:** MISSING RISK: `[which]`. BOILERPLATE RISK: `[risk]` is generic, not tied to this
> change. Partly enforced by `required-sections.mjs` (a Risks section must exist).

### Gate 5 — ROI / Mandate Fit

Does the recommendation's payback and ROI match the stated mandate, and are reusable analysis
components factored out rather than re-derived per case?

> **FAIL format:** MANDATE MISMATCH: recommendation `[action]` has payback `[x]` inconsistent with the
> mandate `[y]`.
