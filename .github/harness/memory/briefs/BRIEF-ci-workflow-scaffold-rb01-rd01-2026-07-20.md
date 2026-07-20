<!-- markdownlint-disable-next-line MD022 -->
# Architecture Brief: CI Workflow Scaffold for RB-01 / RD-01
resource: .github/workflows/lint.yml, .github/workflows/type-check.yml, .github/workflows/test.yml, .github/workflows/build.yml, .github/workflows/security.yml, package.json, .github/harness/reviews/fringe-core-remediation-2026-07-20-review-breadth-findings.md, .github/harness/reviews/fringe-core-remediation-2026-07-20-review-depth-findings.md, .github/harness/reviews/fringe-core-remediation-2026-07-20-feedback-verdict.md

Date: 2026-07-20
Status: Architect -> Implement

## Objective

- Implement the first concrete remediation step by scaffolding hosted CI workflows that satisfy RB-01 and support RD-01 enforcement readiness.

## Scope and boundaries

- In scope:
  - Add GitHub Actions workflows under .github/workflows for lint, type-check, test, build, and security scanning.
  - Wire workflows to run on pull_request and on push to main/master.
- Out of scope:
  - Applying repository branch protection settings (requires GitHub admin action outside repository files).
  - Refactoring project scripts or fixing existing lint/test/build failures.

## Gate results

- Gate 1 (Domain alignment): PASS
  - CI gating belongs in .github/workflows and directly addresses breadth/depth findings.
- Gate 2 (Generality): PASS
  - Workflows implement reusable quality controls independent of one feature branch.
- Gate 3 (Ownership): PASS
  - DevOps/engineering governance owns CI checks; artifact location reflects that ownership.
- Gate 4 (Boundary integrity): PASS with note
  - Repo-side workflows can enforce checks; branch protection boundary must still be set remotely.
- Gate 4b (Isolation/safety): PASS
  - Security workflow introduces explicit high-severity dependency scanning at PR boundary.
- Gate 5 (Reuse): PASS
  - Reuses existing root scripts from package.json instead of introducing bespoke command paths.

## Artifacts to create

- .github/workflows/lint.yml
- .github/workflows/type-check.yml
- .github/workflows/test.yml
- .github/workflows/build.yml
- .github/workflows/security.yml

## Key decisions

- Decision: split CI checks into five explicit workflows rather than one monolithic workflow.
  - Reasoning: easier branch-protection mapping and clearer remediation traceability to RB-01 acceptance criteria.
- Decision: use root workspace scripts (npm run lint/type-check/test/build) as source-of-truth commands.
  - Reasoning: keeps CI aligned with developer and turbo orchestration behavior.
- Decision: security gate uses npm audit with high threshold.
  - Reasoning: minimum viable dependency risk gate without requiring external SaaS credentials.

## Constraints

- Keep workflow files minimal and maintainable.
- Do not introduce secrets-dependent tooling in this first scaffold.
- Preserve compatibility with both main and master until branch strategy is finalized.

## Validation plan

- Ensure workflow files are present in .github/workflows.
- Validate no YAML syntax/parse diagnostics are introduced.
- Confirm workflows reference existing package.json scripts.

## Do NOT

- Do NOT claim RD-01 complete from repository code alone; remote branch protection remains a required manual step.
- Do NOT alter unrelated application code in this remediation step.

## Assumptions and risks

- [UNVERIFIED] Root scripts currently execute successfully in CI environment.
- [UNVERIFIED] npm audit high threshold is acceptable for current dependency posture.
- Risk: first CI run may fail due existing debt; this is expected and should drive subsequent remediation items.

## Inline skeptical pass (architect-challenge fallback)

- Challenge: Is one workflow file with multiple jobs sufficient?
  - Resolution: possible, but separate workflows provide cleaner required-check naming and simpler governance mapping.
- Challenge: Should security include SAST (CodeQL) immediately?
  - Resolution: this step prioritizes dependency-risk gate with zero setup; CodeQL can be added as RB follow-on.
- Challenge: Does this fully satisfy RD-01?
  - Resolution: partially; branch protection must be configured in GitHub settings after workflows are merged.

VERDICT: APPROVED
