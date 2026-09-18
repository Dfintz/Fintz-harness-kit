---
summary: "Architecture Brief - Security Evidence and Review Gate Enforcement"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [security, evidence, review-gate, lurkr]
---
## Architecture Brief
resource: scripts/harness/lurkr-diff.mjs, scripts/harness/plan-review.mjs, scripts/harness/security-review-gate.mjs, scripts/harness/test/security-review-gate-test.mjs, .github/workflows/harness-optional-security-gates.example.yml, package.json, SETUP.md

### Objective
- Enforce that a security-sensitive review cannot pass without both a usable differential security evidence report and an approved review verdict.

### Scope and boundaries
- In scope:
  - Add a deterministic gate that validates Lurkr differential evidence and plan-review verdict artifacts.
  - Add a self-test and package command.
  - Wire the gate into the optional security workflow after report generation.
  - Document invocation and failure semantics.
- Out of scope:
  - Changing Lurkr scanner findings or evidence-only checklist generation.
  - Making the entire optional workflow mandatory by default.
  - Replacing the existing stage machine or plan-review loop.

### Artifacts to create
- `scripts/harness/security-review-gate.mjs` - deterministic evidence/verdict gate.
- `scripts/harness/test/security-review-gate-test.mjs` - self-contained gate contract tests.
- `.github/harness/memory/briefs/security-evidence-review-gate-2026-09-18.md` - Architecture Brief.

### Artifacts to modify
- `package.json` - expose the gate and self-test commands.
- `.github/workflows/harness-optional-security-gates.example.yml` - run the gate after security and review artifacts exist.
- `SETUP.md` - document inputs and exit behavior.

### Key decisions
- Decision: Gate on artifact facts, not scanner-specific output: report status, checklist presence, no failed checklist item, review terminalState `converged`, and finalVerdict `APPROVED`.
- Decision: Fail closed for missing, malformed, skipped, or incomplete artifacts.
- Decision: Keep the workflow opt-in; enforcement is active when the security workflow is enabled.
- Decision: Keep report production evidence-only; the new gate owns enforcement.

### Constraints
- Read JSON only from explicit repository-relative paths.
- Do not execute scanner or model commands from the gate.
- Do not treat missing checklist items as success.
- Do not accept `APPROVED` without `terminalState: converged`.

### Validation plan
- `node scripts/harness/test/security-review-gate-test.mjs`
- `npm run harness:security:review-gate -- --security-report <path> --review-report <path>` with pass and fail fixtures.
- `npm run harness:docs:check`
- `node --check scripts/harness/security-review-gate.mjs`

### Do NOT
- Do not weaken existing scanner safety parsing.
- Do not silently convert skipped security scans into passing evidence.
- Do not make optional CI security gates globally required in this slice.

### Assumptions and risks
- `[UNVERIFIED]` Review artifacts use the JSON fields emitted by `plan-review.mjs` (`terminalState`, `finalVerdict`).
- Risk: Existing CI callers need to provide a review JSON artifact; the workflow documentation will show the contract explicitly.

### Architectural gates
- Gate 1 domain alignment: PASS. The new module owns only cross-artifact security review enforcement.
- Gate 2 generality: PASS. It is scanner/model agnostic and validates stable artifact contracts.
- Gate 3 ownership: PASS. Producers keep producing evidence; the gate adjudicates completeness.
- Gate 4 boundary integrity: PASS. The gate performs no scanning or command execution.
- Gate 4b isolation/safety: PASS. Missing or failed evidence denies approval.
- Gate 5 reuse: PASS. Reuses existing Lurkr checklist and plan-review JSON contracts.
