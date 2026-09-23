# Release Notes v3.6.1

Date: 2026-09-23

## Summary

v3.6.1 refreshes hosted GitHub Copilot model routing recommendations, adds an advisory local
open-model workflow policy for Jev-style/open agentic model signals, and strengthens deterministic
validation so model defaults and local fallback lanes stay evidence-gated.

## Highlights

### Hosted Copilot model refresh

- Updates Phase 5 model policy with September 2026 Copilot-supported models and external benchmark
  evidence.
- Refreshes skill routing examples toward `gpt-6-astra`, `claude-opus-5-5`, `gpt-6-sol`,
  `gpt-5.6-terra`, `gpt-6-luna`, `gemini-3.8-flash`, and `mai-code-1.1-flash` where appropriate.
- Adds caveat metadata for models that are retiring, high-cost, open-weight, client-dependent, or
  not safe as universal defaults.

### Local open model workflow policy

- Adds `modelPolicy.localOpenModels` in `harness.config.json` for Jev-style open/agentic model
  signals, local candidates, hardware fit, and deterministic local workflow lanes.
- Treats `Jev 1.13` as `signal-only`: useful as an adoption cue, but not a local executable default
  without artifact, profile-fit, and local measurement evidence.
- Records per-profile fit decisions for MacBook Air M1 8 GB, Proxmox LXC Xeon 50 GB, and CPU-only
  Xeon 50 GB hardware profiles.
- Documents where local models may be used: assistant triage, implementation drafts, bounded repair
  loops, and offline fallback. Architecture, feedback, review-depth, security, destructive actions,
  secrets, permission changes, and production deployment remain escalated paths.

### Deterministic validation and catalog output

- Adds `test:harness:local-open-model-policy` and includes it in `test:harness:core`.
- Extends model-routing refresh tests to assert supported-model coverage and caveat metadata.
- Exposes the local open model policy in generated `llms.txt` and
  `.github/harness/catalog/harness-profile.json`.

## Validation

- `npm run test:harness:local-open-model-policy`
- `npm run test:harness:model-selection-wizard`
- `npm run test:harness:model-routing-validator-refresh`
- `npm run harness:docs:check`
- `npm run harness:catalog:sync`
- `npm run harness:graph -- status`
- Feature route smoke via `node scripts/harness/prompt-router.mjs route --profile feature --repo-root . --task "..." --json`