---
summary: "Architecture Brief - T1 Prompt Prefix Cache Activation Path"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t1, prompt-prefix-cache, llm-provider, mcp-cache]
---
# Architecture Brief - T1 Prompt Prefix Cache Activation Path

resource: scripts/harness/llm-provider.mjs, scripts/harness/mcp-cache.mjs, harness.config.json, templates/project-adoption/harness.config.json, .github/harness/memory/radar/prompt-prefix-caching.md

## Architecture Brief

### Objective

- Activate a safe, optional prompt-prefix caching path for harness LLM calls.
- Keep behavior backward-compatible with local providers and current workflows.

### Scope and boundaries

- In scope:
  - Add opt-in prompt-prefix cache settings and runtime resolution.
  - Reuse shared TTL cache utility with per-entry TTL support.
  - Keep default state disabled to avoid behavioral surprises.
- Out of scope:
  - Adding Anthropic/OpenAI providers to `llm-provider.mjs`.
  - Changing request semantics for existing Ollama/LM Studio calls.

### Artifacts to create

- `.github/harness/memory/briefs/t1-prompt-prefix-cache-architect-challenge-2026-08-05.md` - challenge verdict.
- `.github/harness/memory/briefs/t1-prompt-prefix-cache-implementation-2026-08-05.md` - implementation proof summary.
- `.github/harness/memory/briefs/t1-prompt-prefix-cache-review-breadth-2026-08-05.md` - breadth findings.
- `.github/harness/memory/briefs/t1-prompt-prefix-cache-review-depth-2026-08-05.md` - depth gate ledger.
- `.github/harness/memory/briefs/t1-prompt-prefix-cache-feedback-2026-08-05.md` - final verdict.

### Artifacts to modify

- `scripts/harness/llm-provider.mjs` - add prompt-prefix cache settings resolver and cache registry path.
- `scripts/harness/mcp-cache.mjs` - add per-entry TTL override and hit/miss stats.
- `harness.config.json` - add `llm.promptPrefixCache` defaults.
- `templates/project-adoption/harness.config.json` - align template defaults.
- `.github/harness/memory/radar/prompt-prefix-caching.md` - update decision log.

### Key decisions

- Decision: Implement a feature-flagged cache path with no protocol-level dependency on cloud-only APIs.
- Decision: Keep all defaults disabled and require explicit activation via config or env.
- Decision: Extend existing `ResourceCache` instead of creating a parallel cache utility.

### Constraints

- Do not alter existing provider compatibility (`ollama`, `lmstudio`).
- Do not introduce network-level cache-control fields that may break local runtimes.
- Do not enable caching by default.

### Validation plan

- `npm run harness:graph -- status`
- `node scripts/harness/config-self-test.mjs`
- `node scripts/harness/test/mcp-resources-cache-benchmark.mjs`
- `npm run harness:docs:check`

### Do NOT

- Do NOT claim cloud prompt-cache billing optimization is complete in this slice.
- Do NOT add provider-specific behavior without explicit provider support in the adapter.

### Assumptions and risks

- [UNVERIFIED] Graph is stale by one commit; direct file evidence and deterministic checks are used.
- Risk: Users may interpret this as cloud-prefix billing integration; mitigated by explicit docs/decision log wording.

## Gate Summary

- Gate 1 Domain alignment: PASS.
- Gate 2 Generality: PASS.
- Gate 3 Ownership: PASS.
- Gate 4 Boundary integrity: PASS.
- Gate 4b Isolation/safety: PASS.
- Gate 5 Reuse: PASS.
