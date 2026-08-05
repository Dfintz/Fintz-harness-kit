---
artifact_family: review
immutability: mutable
---

## Review Breadth Findings Ledger
resource: .github/harness/memory/briefs/skills-v1-2-0-validation-implementation-2026-08-05.md, .github/harness/HARNESS.md, .github/skills/

### Coverage note
- Reviewed all changed artifacts in this task: HARNESS contract note and all new sidecar metadata files under `.github/skills/*/agents/openai.yaml`.
- Reviewed validation evidence from docs contract check and diff hygiene check.

### Findings

#### Major
- None.

#### Minor
- Artifact: `.github/skills/*/agents/openai.yaml`
- Finding: Sidecars currently omit explicit invocation policy metadata from the external v1.2.0 pattern.
- Evidence: local sidecars contain only `interface.*` keys; v1.2.0 release notes mention `policy.allow_implicit_invocation` for user-invoked skills.
- Impact: low risk now (metadata remains informational), but cross-harness behavior expectations may differ unless policy semantics are documented and tested.
- Confidence: MEDIUM
- Recommended fix: decide policy-key contract in a dedicated brief, then apply with tests if adopted.

#### Nit
- Artifact: `.github/harness/HARNESS.md`
- Finding: The sidecar note is concise but does not link to an example file path.
- Evidence: note mentions optional path pattern but no concrete example.
- Impact: minor readability cost for new contributors.
- Confidence: HIGH
- Recommended fix: optionally add one concrete example path in a follow-up doc polish pass.

### Missing-context note
- No blocking missing context for this metadata-only change.
