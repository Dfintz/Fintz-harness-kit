# Release Notes v3.5.0

Date: 2026-08-07

## Summary

v3.5.0 expands model-routing and output-governance workflows, adds an Agent Plugins v1 export surface, and refreshes catalog/help content so operators can inspect and validate the harness more reliably.

## Highlights

- Adds reusable structured-output and review-output generators with dedicated tests.
- Adds a model-selection wizard and refreshes model-routing validation coverage.
- Adds Agent Plugins v1 skills-only export and validation flows, including plugin metadata and tests.
- Extends prompt-router and harness help/catalog surfaces to better reflect profile and routing behavior.
- Updates documentation and profile metadata to keep public release guidance aligned with the current harness surfaces.

## Validation

- `npm run test:harness:structured-output`
- `npm run test:harness:review-output`
- `npm run test:harness:model-selection-wizard`
- `npm run test:harness:model-routing-validator-refresh`
- `npm run test:harness:agent-plugins`
- `npm run test:harness:prompt-router:run-bundle`
- `npm run harness:docs:check`
