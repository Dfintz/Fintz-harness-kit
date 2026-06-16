# IT Services & Delivery — Gates

Run at the Design stage (1) and again at Review depth (4). Answer each gate explicitly; a single
failure is a finding that blocks sign-off until resolved.

### Gate 1 — Scope Clarity

Are the in-scope and out-of-scope boundaries explicit, so no work is assumed by either party that was
never agreed?

> **FAIL format:** AMBIGUOUS SCOPE: `[item]` is neither in the In-Scope nor Out-of-Scope list.
> Partly enforced by `required-sections.mjs` (a Scope section must exist).

### Gate 2 — SLA Measurability

Is every SLA target quantified and measurable (a number, a window, a metric) rather than a vague
aspiration?

> **FAIL format:** UNMEASURABLE SLA: `[target]` has no number, window, or metric.

### Gate 3 — Operational Readiness

Are the runbook and rollback complete, and have the go-live readiness gates each been signed off?

> **FAIL format:** NO VERDICT: readiness gate `[name]` has no Verdict line. UNSAFE: the runbook has
> no Rollback section. Enforced by `checklist-coverage.mjs` and `required-sections.mjs`.

### Gate 4 — Security & Compliance

Are access control, data handling, and audit requirements addressed and specific to this engagement?

> **FAIL format:** MISSING CONTROL: `[which]`. GENERIC: `[control]` is boilerplate, not tied to this
> engagement's data classification or environment.

### Gate 5 — Cost/Effort Traceability

Does the stated cost or effort trace to the scoped work, with reusable components factored out rather
than re-priced per engagement?

> **FAIL format:** UNTRACED COST: line item `[x]` maps to no scoped work. UNSUBSTANTIATED: a
> percentage or superlative claim carries no source. Partly enforced by `claim-substantiation.mjs`.
