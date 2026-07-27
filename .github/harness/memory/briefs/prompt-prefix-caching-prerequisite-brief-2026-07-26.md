# Prompt Prefix Caching Prerequisite Brief - 2026-07-26
resource: .github/harness/memory/radar/prompt-prefix-caching.md, scripts/harness/llm-provider.mjs, scripts/harness/dspy-bridge.mjs, scripts/harness/dspy-optimize.py

## Gap statement

Entry remains parked because JS provider layer supports local Ollama/LM Studio only; cloud provider path uses DSPy/Python bridge, so Anthropic/OpenAI cache-control headers cannot be implemented in current JS adapter alone.

## Scope

- In scope:
  - Define prerequisite work needed before unpark/adopted-integration claim.
- Out of scope:
  - Shipping cloud-provider support in this pass.

## Prerequisite work

1. Decide canonical cloud-call path ownership:
   - Option A: add cloud-provider support to scripts/harness/llm-provider.mjs
   - Option B: expose provider-specific prefix-cache controls in the active DSPy bridge path
2. Add config schema/flags for cache opt-in and provider targeting.
3. Add deterministic proof capture for token-cost deltas across repeated loop turns.

## Unpark gate

- At least one cloud path supports cache-control semantics end-to-end.
- A reproducible benchmark demonstrates reduced input-token cost on repeated-prefix prompts.
- Documentation updated with provider-specific caveats and TTL assumptions.

## Current status

- Keep parked.
- No integration claim is made in this pass.
