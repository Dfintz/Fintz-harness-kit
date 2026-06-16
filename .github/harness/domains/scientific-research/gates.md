# Scientific & Academic Research — Gates

Run at the Design stage (1) and again at Review depth (4). Answer each gate explicitly; a single
failure is a finding that blocks sign-off until resolved.

### Gate 1 — Reproducibility

Are the methods detailed enough — materials, procedure, parameters, and analysis — for an
independent group to replicate the study?

> **FAIL format:** UNDERSPECIFIED: `[step/parameter]` in `[section]` is not detailed enough to
> replicate. Specify it. Partly enforced by `required-sections.mjs` (a Methods section must exist).

### Gate 2 — Citation Integrity

Does every claim trace to a cited reference, with no invented or uncited references?

> **FAIL format:** UNCITED: `[claim]` in `[section]` has no citation. Cite it or remove it.
> DANGLING/ORPHAN: a `[^id]` is undefined, or a reference is defined but never cited.
> Enforced by `citation-integrity.mjs`.

### Gate 3 — Statistical Validity

Are the statistical tests appropriate for the data, and are effect sizes and uncertainty reported?

> **FAIL format:** BARE ESTIMATE: `[figure]` is reported without uncertainty (CI/error/p).
> WRONG TEST: `[test]` is inappropriate for `[data type]`.

### Gate 4 — Claim Substantiation

Do the conclusions match the results without overreach?

> **FAIL format:** OVERREACH: conclusion `[claim]` is not supported by result `[result]`.
> CAUSAL: causal language used on correlational data. Partly enforced by `claim-substantiation.mjs`
> (a percentage or superlative claim must carry a `[^id]` or `(source: …)`).

### Gate 5 — Novelty & Scope

Is the contribution stated explicitly, and is prior work positioned?

> **FAIL format:** NO CONTRIBUTION: the manuscript never states what is new. UNPOSITIONED: prior
> work `[area]` is not cited or contrasted.
