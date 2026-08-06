---
summary: "Architecture Brief - first adoption slices for impeccable patterns"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [adoption, trace-tests, hooks, drift, detectors, routing, journal, portability]
---
## Architecture Brief
resource: scripts/harness/prompt-router.mjs, scripts/harness/doc-verifier.mjs, scripts/harness/validate-doc-contracts.mjs, scripts/harness/sidecar-allowlist-report.mjs, scripts/harness/record-run.mjs, scripts/harness/test/, package.json

### Objective
- Adopt the highest-value transferable patterns from the impeccable review as small, provider-agnostic harness primitives with deterministic self-tests and CLI reports.
- Deliver the first usable slice for all eight backlog items without changing stage authority, widening execution permissions, or silently rewriting provider state.

### Scope and boundaries
- In scope: pure trace-contract assertions, hook manifest merge/strip helpers, cross-platform hook command rendering, canonical-vs-installed sidecar drift reporting, metadata-driven document policy rules, route rationale output, optional shortcut generation, and bounded append-only run journal retention.
- In scope: direct Node self-tests under `scripts/harness/test/`, package scripts, and concise operator documentation where commands are introduced.
- Out of scope: provider installers, automatic hook injection, global user-state mutation, frontend-specific detectors, destructive cleanup, changing model/stage routing decisions, and replacing existing journal/report formats.
- Primary boundary: `scripts/harness/` owns deterministic policy and evidence helpers; existing CLI files remain thin adapters; `harness.config.json` remains the source of truth for routing and command defaults.

### Artifacts to create
- `scripts/harness/trace-contract.mjs` - provider-agnostic ordered trace assertions over stage/skill events.
- `scripts/harness/hook-manifest.mjs` - pure merge, dedupe, and strip operations for manifest-shaped hook data.
- `scripts/harness/hook-command-guard.mjs` - safe POSIX, cmd, and PowerShell command rendering with path quoting and no shell evaluation.
- `scripts/harness/provider-drift-report.mjs` - report-only comparison of canonical provider skill/agent trees using hashes and required-shape checks.
- `scripts/harness/policy-detector-registry.mjs` - metadata-driven advisory/error detector registry for harness docs/scripts.
- `scripts/harness/shortcut-generator.mjs` - explicit opt-in generator for provenance-marked local command aliases.
- `scripts/harness/journal-retention.mjs` - pure deterministic age/count retention planning for append-only run artifacts.
- `scripts/harness/test/adoption-slices-test.mjs` - self-tests for the pure helpers and representative route/document contracts.
- `scripts/harness/test/trace-contract-route-test.mjs` - route trace scenario asserting required context and stage ordering.

### Artifacts to modify
- `scripts/harness/prompt-router.mjs` - add machine-readable rationale factors to route JSON while preserving existing human output and route decisions.
- `scripts/harness/doc-verifier.mjs` - expose document-scoped detector registry results through the existing verifier output without executing document content.
- `scripts/harness/validate-doc-contracts.mjs` - own repository-scoped detector execution and preserve its existing contract exit behavior.
- `scripts/harness/sidecar-allowlist-report.mjs` - intentionally unchanged; its policy-semantic checks remain separate from generic file drift until a shared sidecar manifest contract exists.
- `scripts/harness/record-run.mjs` - use retention planning only for an explicit maintenance command or report; do not prune during ordinary recording.
- `package.json` - add focused self-test and report commands; keep one canonical command body per alias policy.
- `docs/harness/COMMAND_INDEX.md` - document only shipped commands and report-only/opt-in semantics.

### Key decisions
- Decision: use pure functions plus thin CLIs. Evidence: existing harness self-tests are direct Node scripts and existing command owners already separate policy from output.
- Decision: keep drift and retention report-only by default. Evidence: the local harness forbids silent global-state rewrites and destructive defaults.
- Decision: make detector rules explicit metadata `{ id, severity, scope, advisory }` and return structured findings. Evidence: doc-verifier is already deterministic and config-driven.
- Decision: route rationale is explanatory telemetry, not a second router. Evidence: `prompt-router.mjs` owns decisions and has downstream consumers.
- Decision: manifest merge preserves unknown keys, strips only explicitly selected entries, and dedupes by stable hook identity. Evidence: future providers may carry provider-specific metadata.
- Decision: command guards render argv-safe commands and reject unsupported shell interpolation; they never invoke commands. Evidence: hook data crosses an execution boundary and must remain non-executing.
- Decision: use a Pipeline topology: route/registry inputs -> pure helper -> CLI/report/test artifact. The existing plan-review route remains the producer-review boundary for architecture, not a new runtime agent topology.
- Decision: define hook identity as `provider + event + command`; merge accepts an object with `hooks` arrays, preserves unknown top-level keys, ignores non-object entries with a structured finding, and dedupes exact identities while retaining first-seen order. Evidence: no local writer or schema exists, so the pure helper must have an explicit fixture contract before any future writer adopts it.
- Decision: provider drift takes explicit `--canonical-root` and one or more `--installed-root` values, with default canonical root `.github/skills` and default installed roots `.claude/skills` plus `.github/skills`; it compares `SKILL.md` and `agents/openai.yaml` only when present and reports missing, extra, shape, and SHA-256 differences. Evidence: `.github/skills` is Copilot-native and `.claude/skills` is Claude-native; there is no safe universal provider installer to infer from.
- Decision: journal retention plans only files matching existing run-journal shapes under `.github/harness/runs/` and never `*.manifest.json`, `handoffs.jsonl`, override logs, or feature-run manifests. Evidence: `harness-report.mjs` already excludes manifest artifacts and `record-run.mjs` owns per-run writes; retention is a separate explicit maintenance surface.
- Decision: sidecar allowlist validation remains separate from generic provider file drift. Evidence: `sidecar-allowlist-report.mjs` validates policy semantics and central allowlists, while the new drift report compares portable file contents; composing them without a shared manifest would duplicate or blur contracts.

### Constraints
- Preserve existing public CLI output and exit codes unless a new flag is explicitly used.
- No `eval`, shell interpolation, dynamic imports of untrusted values, or execution of generated aliases/hooks.
- All filesystem comparisons stay repository-contained through existing manifest allowlist/path-safety patterns.
- Hash comparisons must be deterministic and normalize only documented text boundaries.
- Retention plans may identify deletions but must not delete files without an explicit opt-in command and deterministic manifest.
- Tests must prove empty input, duplicates, malformed entries, path quoting, drift categories, ordering, and bounded retention.
- Provider-specific artifact layouts belong in data/config adapters, not stage contracts.
- Detector ownership is split by scope for future expansion: `doc-verifier.mjs` runs current `scope: document` rules; repository-scoped rules and `validate-doc-contracts.mjs` integration are explicitly deferred until high-signal repository rules are defined.
- Implementation is staged as five bounded slices: (1) trace contracts plus route rationale, (2) hook manifest plus command guards, (3) provider drift report, (4) detector registry integration, and (5) shortcut generation plus journal-retention planning.
- Do not modify unrelated existing worktree changes.

### Validation plan
- Run `npm run harness:docs:check` after the Brief and command metadata changes.
- Run the focused adoption self-test and route trace test directly with Node.
- Run `npm run test:harness:core` after integration, then `npm run harness:commands:check` and `npm run harness:docs:check:changed-surfaces`.
- Run `git diff --check` and inspect structured JSON output for route rationale and drift reports.
- Run a deterministic retention dry-run against a temporary fixture; no repository run artifacts are deleted.
- Before each slice, run its focused self-test; after slice 3 run the sidecar validator and after slice 4 run both document and repository contract tests.

### Do NOT
- Do not auto-install, auto-update, inject, or rewrite hooks or provider trees.
- Do not make detector findings a hard gate unless a rule is explicitly configured as `severity: error`.
- Do not make rationale factors influence the selected route.
- Do not duplicate existing sidecar policy logic or replace the existing journal schema.
- Do not add a new skill, agent, or model branch for these shared primitives.

### Assumptions and risks
- `[UNVERIFIED]` Existing provider sidecar trees are the comparison target; explicit roots and shape checks are required because the repository has no canonical installer/update manifest.
- `[UNVERIFIED]` Hook manifests have no single current writer in this repository; the helper ships with fixture-based tests and no live writer integration until a manifest owner is introduced.
- `[UNVERIFIED]` Existing run files that look like journals are safe to classify using the reporter's `loop` plus `iterations` shape; the retention planner must skip unknown shapes rather than delete them.
- Risk: eight slices can become too broad for one review. Mitigation: keep each helper pure, share one self-test file, and avoid invasive changes to existing owners.
- Risk: detector false positives reduce trust. Mitigation: advisory defaults, explicit scopes, and fixture tests for both positive and negative cases.
- Understand status: graph fresh and ready; tools used: graph status/provider/dependents, targeted source reads, repository memory; residual risk medium because external provider runtime telemetry is unavailable.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: explicit hook identity/fixture contract, provider root arguments and comparison scope, journal exclusions and owner boundary, detector scope ownership, and five implementation slices.
- Remaining limitation: no live provider installer or hook writer exists locally, so those integrations remain report-only and fixture-backed.
- Remaining limitation: repository-scoped policy rules and sidecar/hash composition are deferred; current sidecar semantic validation remains on its existing owner.
