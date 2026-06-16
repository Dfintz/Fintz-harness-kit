# Legal & Compliance — Gates

Run at the Structure stage (1) and again at Review depth (4). Answer each gate explicitly; a single
failure is a finding that blocks sign-off until resolved.

### Gate 1 — Jurisdiction Alignment

Is the governing law and venue stated explicitly, and is every clause consistent with that
jurisdiction?

> **FAIL format:** JURISDICTION: `[clause]` assumes `[law/venue]` but the Governing Law section says
> `[other]`. Reconcile or remove the conflict.
> Partly enforced by `required-sections.mjs` (a Governing Law section must exist).

### Gate 2 — Defined-Term Consistency

Is every defined term actually used in the operative text, with no dead definition left from a
template?

> **FAIL format:** DEAD TERM: `[Term]` is defined but never used in any clause. Use it or delete the
> definition. Enforced by `defined-terms.mjs`.

### Gate 3 — Enforceability

Is each obligation clear, bounded, and lawful — no vague, open-ended, or unenforceable duty?

> **FAIL format:** UNENFORCEABLE: obligation `[which]` is `[vague/unbounded/unlawful]`. State the
> standard, the trigger, and the limit.

### Gate 4 — Obligation Completeness

Are each party's duties, the remedies for breach, and the termination conditions all covered?

> **FAIL format:** GAP: `[party]` has duties but no remedy/termination path, or `[topic]` is silent.
> Partly enforced by `required-sections.mjs` (Obligations and Liability sections must exist).

### Gate 5 — Authority Traceability

Does every citation to a statute, regulation, or precedent resolve to a stated authority?

> **FAIL format:** UNRESOLVED AUTHORITY: `[^id]` is cited but never defined, or an authority is defined
> but never cited. Enforced by `citation-integrity.mjs`.
