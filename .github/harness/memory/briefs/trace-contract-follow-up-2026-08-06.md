---
summary: "Architecture Brief - complete trace-contract coverage for skills and route behavior"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [trace-contract, route, prompt-pack, skill-behavior, testing]
---
## Architecture Brief
resource: scripts/harness/trace-contract.mjs, scripts/harness/prompt-router.mjs, scripts/harness/registry.mjs, scripts/harness/test/trace-contract-route-test.mjs, scripts/harness/test/adoption-slices-test.mjs, package.json, .github/instructions/02-UNDERSTAND-WORKFLOW.md

### Objective
- Close the remaining trace-contract backlog gap by testing the generated registry prompt-pack contract, not only the selected route array.
- Detect drift where stage order, required artifact handoffs, or stable graph/context gate markers disappear from routed prompt-pack files.

### Scope and boundaries
- In scope: extend the provider-agnostic trace helper with prompt-pack contract assertions and add one integration test that invokes `prompt-pack --json`, reads its manifest and stage prompt files, and validates the exact full non-trivial stage chain.
- In scope: wire the new test into `test:harness:adoption` and document the coverage.
- Out of scope: changing routing decisions, stage metadata, model assignments, skill prose, prompt-pack generation, or provider-specific installer behavior.
- Primary boundary: `prompt-router.mjs` and `registry.json` remain the contract owners; the new test is an observer of generated artifacts.

### Artifacts to create
- `scripts/harness/test/trace-contract-prompt-pack-test.mjs` - temporary-fixture integration test for generated manifest and stage prompt behavior.

### Artifacts to modify
- `scripts/harness/trace-contract.mjs` - add pure assertions for ordered stage metadata, required artifact handoffs, and required instruction fragments.
- `package.json` - include the prompt-pack trace test in the existing adoption aggregate without duplicating command bodies.
- `scripts/harness/test/README.md` - document the trace-contract test coverage and deterministic cleanup behavior.
- `.github/harness/memory/briefs/trace-contract-follow-up-2026-08-06.md` - persist this brief and later review decisions.

### Key decisions
- Decision: test the generated prompt-pack manifest and files through the existing CLI, because this is the smallest end-to-end path that observes route output plus registry-to-prompt packaging. This does not claim to execute canonical skills or instruction files.
- Decision: assert contract-critical content, not exact wording. Required checks include exact stage order, each stage's required artifacts matching prior outputs, and stable markers such as `graph freshness gate`; context-sufficiency wording remains out of scope until the generator carries that canonical contract.
- Decision: use a unique slug under the generator's supported prompt-pack root and remove the prompt-pack directory, restore the feature-run index, remove newly created feature-run directories, and restore any override log in a `finally` block.
- Decision: retain the existing route test; the new test complements it by observing generated artifacts rather than replacing route-level checks.
- Decision: use a Pipeline topology: prompt-router output -> prompt-pack manifest/prompts -> pure trace assertions -> test verdict.

### Constraints
- Do not alter route selection, model routing, registry metadata, or prompt text.
- Do not assert provider/model-specific behavior beyond the route's declared stage metadata.
- Use a unique slug under `.github/harness/runs/prompt-packs`; verify the returned output is contained under that root before reading or deleting it.
- Do not read untrusted paths from generated manifest fields without containment checks.
- Keep assertions deterministic and independent of an external model, graph plugin, network, or provider.
- Preserve existing CLI exit semantics and sequential test execution.

### Validation plan
- Run the new prompt-pack trace test directly.
- Run `npm run test:harness:adoption` and `npm run test:harness:core`.
- Run `npm run harness:docs:check`, `npm run harness:commands:check`, and `git diff --check`.
- Confirm the temporary prompt-pack output is removed after both success and assertion failure paths.

### Do NOT
- Do not make tests depend on exact model names or prose wording that is not contract-critical.
- Do not make the trace helper perform filesystem or subprocess operations.
- Do not weaken route or stage guardrails to make the new test pass.
- Do not replace the existing route test with a broader but less discriminating snapshot.

### Assumptions and risks
- `[RETIRED]` The prompt-pack CLI accepts an arbitrary temporary output directory through `--out`; challenge review confirmed it uses a slug under the prompt-pack root, so the test will use a unique slug instead.
- Risk: prompt-pack artifact shape may evolve independently of route JSON. Mitigation: assert only manifest fields already validated by prompt-router and use focused failure messages.
- Risk: generated prompt text changes wording. Mitigation: assert normalized semantic fragments such as `graph freshness gate`, `Context sufficiency check`, and required input filenames.
- Risk: generated prompt text changes wording. Mitigation: assert only stable registry markers and structured artifact fields; canonical context-sufficiency wording is deferred.
- Understand status: graph fresh and ready; direct dependents of the route owner are `mcp-tools.mjs` and `prompt-middleware.mjs`; new trace tests observe the route/prompt-pack boundary without changing those consumers.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: narrowed the claim to registry-to-prompt-pack coverage, required exact stage equality, defined slug/root containment, and specified cleanup of feature-run/index/override side effects.
- Deferred: canonical skill execution and generated context-sufficiency wording until the prompt generator explicitly carries those contracts.
