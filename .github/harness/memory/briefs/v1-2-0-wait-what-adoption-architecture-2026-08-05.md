## Architecture Brief
resource: https://github.com/mattpocock/skills/releases/tag/v1.2.0, .github/harness/HARNESS.md, .github/instructions/05-REVIEW-BREADTH.md, .github/instructions/07-FEEDBACK.md, .github/skills/

### Objective
- Evaluate whether the v1.2.0 behavior skill wait-what should be adopted into harness-kit now, and if so under what constraints.

### Scope and boundaries
- In scope:
  - Architectural decision only (adopt now, defer, or pilot).
  - Mapping to existing harness guidance surfaces.
- Out of scope:
  - Implementing the full wait-what skill in this run.
  - Modifying runtime routing behavior to invoke wait-what automatically.

### Artifacts to create
- Decision brief (this file).

### Artifacts to modify
- None in this focused evaluation pass.

### Gate outcomes
- Gate 1 Domain/module alignment: PASS
  - The skill belongs to communication quality/handoff clarity, which is relevant to harness operator experience.
- Gate 2 Generality: PASS
  - Generic behavior for reducing verbosity/confusion; not tied to one tech stack.
- Gate 3 Ownership: PASS with caveat
  - Best owner is a cross-agent instruction surface or a dedicated behavior skill bucket, not stage contracts.
- Gate 4 Boundary integrity: PASS
  - Can remain optional and user-invoked without crossing execution boundaries.
- Gate 4b Isolation/safety: PASS
  - No security, secrets, or destructive action boundary impact.
- Gate 5 Reuse: PASS
  - Single concise pattern reusable across all stage responses.

### Key decisions
- Decision: Pilot adoption as optional, user-invoked behavior guidance in a narrow surface first.
- Decision: Do not make it model-invoked globally yet.
- Decision: Tie wording to existing harness communication constraints to avoid duplicated policy.

### Constraints
- Keep it short and non-invasive.
- Must not override mandatory stage artifacts or evidence requirements.
- Must preserve technical precision and safety language.

### Validation plan
- Additive docs-only pilot in a follow-up brief with before/after reviewer sample outputs.
- Ensure no degradation in findings-first review behavior.

### Do NOT
- Do NOT replace substantive explanations with oversimplified output.
- Do NOT bypass stage-specific output contracts.
- Do NOT auto-trigger this behavior in safety-critical reviews.

### Assumptions and risks
- [UNVERIFIED] Current contributors want an explicit shorthand cue for message re-pitching.
  - Risk if wrong: added noise in instruction surfaces.
- [UNVERIFIED] Existing formatting rules already constrain verbosity enough for most workflows.
  - Risk if wrong: pilot may show marginal value.

### Verdict
- ADOPT AS PILOT (deferred implementation): create a small optional guidance surface in a separate scoped change.
