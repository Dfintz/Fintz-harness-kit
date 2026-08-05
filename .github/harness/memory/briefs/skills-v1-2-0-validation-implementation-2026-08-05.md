## Implementation Summary
resource: .github/harness/memory/briefs/skills-v1-2-0-validation-architecture-2026-08-05.md, .github/harness/HARNESS.md, .github/skills/

### Delivered
- Added Codex sidecar metadata files at `.github/skills/*/agents/openai.yaml` for all shipped `.github` skills.
- Updated `.github/harness/HARNESS.md` with a concise adapter note documenting sidecar purpose and non-authoritative behavior.

### Contract adherence
- Followed Architecture Brief scope: metadata-only integration, no router or stage behavior changes.
- Kept sidecars informational (`interface.display_name`, `interface.short_description`) and deferred policy semantics.

### Proof summary
- `npm run harness:docs:check` -> PASS (`[docs-contracts] OK`)
- `git diff --check` -> PASS (no whitespace errors; line-ending warnings only on unrelated pre-existing files)
- Sidecar coverage check -> PASS (`True` for all `.github/skills/*` directories)

### Change summary
CHANGES MADE:
- `.github/skills/<skill>/agents/openai.yaml`: added Codex metadata sidecar for each shipped local skill.
- `.github/harness/HARNESS.md`: documented sidecar compatibility convention and non-routing impact.

THINGS I DIDN'T TOUCH (intentionally):
- `harness.config.json`: no routing profile changes in this pass.
- `scripts/harness/prompt-router.mjs`: no runtime routing behavior changes.
- External behavior skill imports (`wizard`, `to-questionnaire`, `wait-what`): deferred for separate architecture decision.

POTENTIAL CONCERNS:
- Some consumers may expect additional policy fields in sidecars; intentionally deferred to avoid behavioral ambiguity.

### Assumptions or deviations
- [UNVERIFIED] All target Codex consumers will read these sidecars as intended metadata.
