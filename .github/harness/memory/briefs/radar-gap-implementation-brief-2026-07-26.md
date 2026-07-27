# Radar Gap Implementation Brief - 2026-07-26
resource: scripts/harness/prompt-router.mjs, scripts/harness/validate-doc-contracts.mjs, package.json, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md, .github/harness/memory/briefs/radar-reevaluation-matrix-2026-07-26.md, scripts/harness/llm-provider.mjs

## Task

Implement the first promoted item (context-aware next-action resolver prototype), implement the second promoted item (warning-mode deterministic validator expansion), convert hold-adopted gaps into concrete implementation briefs, and close the Lurkr integration gap while keeping prompt-prefix-caching parked until prerequisite work is completed.

## Understand summary

- Graph freshness is stale/degraded because understand-anything refresh needs pluginRoot.
- Confidence is reduced for graph-wide dependency claims; file-backed evidence is used.
- Impacted components:
  - scripts/harness/prompt-router.mjs (new read-only helper command)
  - scripts/harness/validate-doc-contracts.mjs (warning-mode changed-surface validator)
  - package.json (optional new helper scripts)
  - SETUP.md and .github/instructions/05-REVIEW-BREADTH.md (Lurkr wiring and usage guidance)
  - .github/harness/memory/briefs/* (gap briefs)

## Architectural gates

1. Problem clarity gate: PASS
- Two promoted radar entries require concrete implementation.
- Matrix identified adopted entries with integration gaps that require follow-up artifacts.

2. Ownership/boundary gate: PASS
- Router behavior belongs in scripts/harness/prompt-router.mjs.
- Doc-contract validation belongs in scripts/harness/validate-doc-contracts.mjs.
- Operator/CI guidance belongs in SETUP and stage instruction docs.

3. Reuse gate: PASS
- Reuse existing prompt-pack manifest and stage metadata in prompt-router.
- Reuse existing markdown collection logic and findings ledger in docs validator.

4. Safety/operations gate: PASS
- Next-action resolver is read-only and does not mutate artifacts.
- Validator expansion is warning-only prototype, non-blocking by design.
- Lurkr integration is optional and explicit; no hidden hard dependency introduced.

5. Proof gate: PASS
- Run npm run harness:docs:check.
- Run prompt-router help/next-action command against current repo state.
- Validate no existing command regressions in prompt-router route/handoff output.

## Decisions

- Add a new prompt-router command that infers workflow position from known artifacts and returns top 1-3 next actions.
- Keep next-action resolver prototype bounded to prompt-pack artifacts plus safe fallbacks.
- Add warning-mode changed-surface citation checks to docs validator behind an explicit CLI flag.
- Add optional Lurkr wiring through docs plus a single helper script entrypoint; avoid redundant wrappers.
- Produce concrete implementation briefs for hold-adopted gap entries:
  - coderabbit-pr-review
  - lurkr-ai-capability-scanner
  - prompt-prefix-caching

## Planned file changes

- scripts/harness/prompt-router.mjs
  - Add command parsing and output for next-action resolver.
  - Add read-only artifact inspection using prompt-pack manifests.
- scripts/harness/validate-doc-contracts.mjs
  - Add --changed-surface-warnings mode.
  - Add warning checks for changed capability surfaces lacking doc citations.
- package.json
  - Add optional scripts for new validator warning mode and Lurkr checks.
- scripts/harness/lurkr-check.mjs (new)
  - Optional wrapper to run configured Lurkr command in warning or required mode.
- SETUP.md
  - Add optional Lurkr setup/wiring section with command examples.
- .github/instructions/05-REVIEW-BREADTH.md
  - Strengthen concrete Lurkr invocation guidance.
- .github/harness/memory/briefs/*.md
  - Add concrete follow-up implementation briefs for gap entries.

## Constraints

- Keep all new behavior additive and backward compatible.
- Do not weaken existing docs-contract checks; only add warning-mode capability.
- Avoid introducing mandatory third-party dependencies for default local flow.
- Keep prompt-prefix-caching parked; do not claim implementation without provider-layer support.

## Acceptance criteria

1. Next-action resolver proof:
- Running the new prompt-router next-action command on this repo returns 1-3 concrete actions.
- Output changes based on discovered artifacts (for example, when an architecture brief exists versus when only route/handoff is present).
- Existing route/handoff commands remain behaviorally unchanged.

2. Changed-surface warning-mode proof:
- Running docs validator in warning mode emits warning findings (not errors) when changed capability surfaces lack citations in harness markdown.
- Default docs validator mode preserves current pass/fail behavior.

3. Minimal Lurkr integration contract:
- Provide one executable integration path (`npm run harness:security:lurkr`) backed by a single helper script.
- Document install and usage in setup/stage docs as optional.
- Do not make Lurkr a required dependency for baseline harness commands.

## Do-NOTs

- Do not auto-run external security scanners inside default commands without opt-in.
- Do not change stage routing policy semantics while adding next-action helper.
- Do not mark prompt-prefix-caching integrated in this pass.

## Assumptions

- Prompt packs in .github/harness/runs/prompt-packs remain the canonical artifact set for stage progression.
- Lurkr CLI availability varies by environment; wrapper must handle missing binary gracefully unless strict mode is requested.
