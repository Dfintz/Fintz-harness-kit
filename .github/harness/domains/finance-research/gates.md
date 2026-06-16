# Finance & Investment Research — Gates

Run at the Thesis stage (1) and again at Review depth (4). Answer each gate explicitly; a single
failure is a finding that blocks sign-off until resolved.

### Gate 1 — Data Provenance

Does every figure trace to a cited, dated source (filing, data vendor, management commentary)?

> **FAIL format:** UNSOURCED: `[figure]` in `[section]` has no citation. Source it or remove it.
> Partly enforced by `citation-integrity.mjs`.

### Gate 2 — Assumption Traceability

Is each forecast assumption stated explicitly, justified, and identical between the narrative and the
model?

> **FAIL format:** DRIFT: assumption `[name]` is `[x]` in the narrative but `[y]` in the model.

### Gate 3 — Valuation Coherence

Does the valuation method fit the asset, and do the component figures reconcile to the headline value?

> **FAIL format:** RECONCILE: components sum to `[a]` but the headline says `[b]`.
> Enforced by `figure-reconciliation.mjs`.

### Gate 4 — Risk & Disclosure

Are the material risks, conflicts of interest, and required disclosures present and specific?

> **FAIL format:** MISSING DISCLOSURE: `[which]`. BOILERPLATE RISK: `[risk]` is generic, not tied to
> this issuer. Partly enforced by `required-sections.mjs` (a Disclosures section must exist).

### Gate 5 — Mandate Fit

Does the recommendation match the stated mandate and risk profile, and are reusable model components
factored out rather than re-derived per memo?

> **FAIL format:** MANDATE MISMATCH: recommendation `[rating]` is inconsistent with `[mandate]`.
