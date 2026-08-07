---
artifact_family: challenge
immutability: mutable
---

# Architect Challenge Verdict: Agent Model Specialization Guidance

## Verdict

APPROVED

## Evidence

Reviewed brief: `.github/harness/memory/briefs/agent-model-specialization-2026-08-07.md`.

- The revised brief explicitly chooses advisory-only `modelPolicy.domainSpecialists`, states it is not consumed by `scripts/harness/prompt-router.mjs`, and excludes prompt-router changes and `sidecarPolicy.modelInvokedEligibleSkills` expansion.
- Ownership is clear: `harness.config.json` owns advisory model policy metadata, `skillModelMapping.mappings` remains the executable per-skill routing source, and `scripts/harness/harness-catalog.mjs` owns generated catalog output.
- The brief preserves specialization boundaries by adding no frontend/UI/UX/database/infrastructure/backend skill directories and by requiring database/infrastructure guidance to pair with high-reasoning review, safety, validation, and human approval for destructive operations.

## Required Revisions

None.