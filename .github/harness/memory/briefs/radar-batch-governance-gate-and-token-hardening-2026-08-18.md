## Architecture Brief
resource: .github/harness/memory/radar/anthropic-context-compaction.md, .github/harness/memory/radar/manus-kv-cache-stable-prefix.md, .github/harness/memory/radar/prompt-prefix-caching.md, .github/harness/memory/radar/book-to-skill-progressive-disclosure-compiler.md, .github/harness/memory/radar/coleam00-dark-factory-protected-governance-files-gate.md, .github/harness/memory/radar/coleam00-dark-factory-dispatcher-priority-order.md, scripts/harness/run-experiment.mjs, scripts/harness/plan-review.mjs, scripts/harness/llm-provider.mjs, scripts/harness/git-guard.mjs, scripts/harness/prompt-router.mjs

### Objective
- Run a full stage pass over five radar-queued items from the same batch: measure/verify the two `candidate` entries (context compaction, KV-cache stable-prefix hardening) against real loop code before writing any new runtime logic, confirm the two already-`adopted` entries need no further action, and promote the protected-governance-files-gate candidate into a real, bounded implementation. Leave the dispatcher-priority-order entry parked as instructed.

### Scope and boundaries
- In scope: (1) measuring whether `run-experiment.mjs` and `plan-review.mjs` prompt assembly actually exhibits the context-growth problem the compaction entry targets; (2) auditing `llm-provider.mjs` and the two prompt-composition call sites for the three KV-cache failure modes (non-deterministic serialization, timestamp-in-prefix, dynamic tool lists); (3) a new, small, independently-gated protected-governance-path check; (4) radar decision-log updates reflecting all of the above.
- Out of scope: rewriting `run-experiment.mjs`/`plan-review.mjs` prompt assembly, changing `llm-provider.mjs` request bodies, touching `experiment-loop.mjs` (it is a bash-like dispatcher with no accumulated LLM context of its own — each cycle `spawnSync`s a fresh `run-experiment.mjs` process), building an autonomous dispatcher, or any auto-merge/CI-blocking behavior beyond the new gate's own explicit opt-in.
- Primary boundary: `scripts/harness/protected-path-guard.mjs` (new), `package.json` (new script entries only), `.github/harness/memory/radar/` (decision-log updates only).

### Artifacts to create
- `scripts/harness/protected-path-guard.mjs` — a standalone, deterministic (no LLM) checker that lists changed files against a configurable protected-path list and reports/blocks accordingly. Ships with `--self-test`.
- `.github/harness/runs/protected-path-overrides.jsonl` — audit log written only when a human explicitly bypasses the gate with `--allow "<reason>"` (created lazily on first override, same pattern as `preflight-overrides.jsonl`).

### Artifacts to modify
- `package.json` — add `harness:protected-paths:check` and `harness:protected-paths:self-test` script entries, following the existing `harness:<tool>` / `harness:<tool>:self-test` naming convention.
- `harness.config.json` — add an optional `governance.protectedPaths` array (defaults documented in the script; empty/absent config falls back to the built-in default list) so a project can extend or trim the protected list without touching code.
- `.github/harness/memory/radar/anthropic-context-compaction.md` — record the measurement finding in the Decision Log (see Key decisions).
- `.github/harness/memory/radar/manus-kv-cache-stable-prefix.md` — record the audit finding in the Decision Log.
- `.github/harness/memory/radar/coleam00-dark-factory-protected-governance-files-gate.md` — update status to `adopted` with the shipped next step.

### Key decisions
- Decision: do not add compaction/summarization code to `run-experiment.mjs` or `plan-review.mjs` in this pass. Evidence: `composeImprovementPrompt` already keeps prior-attempt history as one compact line per iteration (`- Iteration N: metric=X (KEPT/reverted)`), not raw transcripts, and every loop's `maxIterations` is a bounded, validated integer (`run-experiment.mjs` fails a loop with no bound). `plan-review.mjs`'s prior-round history is similarly bounded by `maxRounds` (3–5 across current loop JSON). The compaction entry's own "Next step" said to measure growth first; the measurement shows no current loop exhibits the unbounded-context symptom compaction solves, so implementing it now would be speculative and unrequested (Implementation Discipline: don't build for a problem that doesn't exist yet).
- Decision: do not change `llm-provider.mjs`, `composeImprovementPrompt`, or `composeReviewerPrompt` for KV-cache hardening. Evidence: all three prompt/body builders construct plain arrays or object literals in fixed, hand-written order (`buildLmstudioBody`, `buildOllamaBody`, both compose functions) — deterministic `JSON.stringify` key order follows JS object insertion order for string keys, so there is no dynamic key reordering. No call site interpolates a timestamp into a `system` or `prompt` value; the only `Date.toISOString()` usage found (`run-experiment.mjs`'s `stamp`) is journal/commit metadata, never part of a model-facing prompt. No call site adds/removes tool definitions mid-loop (no tool-calling schema exists in this local-provider adapter today). The three specific failure modes named in the Manus entry are verified absent.
- Decision: ship the protected-governance-files gate as **warn-by-default, block-only-when-opted-in**, with an explicit audited bypass. Evidence: this resolves the exact open design question the candidate entry flagged ("how does a legitimate, human-approved governance change land if the gate blocks unconditionally") using a pattern this repo already trusts: `prompt-router.mjs`'s `--allow-degraded-preflight` (explicit flag, JSONL audit record, stderr warning) and the `HARNESS_ENABLE_OPTIONAL_MEMORY_BRIEF_POLICY` opt-in-strictness convention noted in repo memory. Default warn avoids surprising an unrelated CI job the day this ships; a project or CI workflow opts into blocking via `HARNESS_ENABLE_PROTECTED_PATH_GATE=true` or `--strict` once it wants the hard gate.
- Decision: keep the new script fully independent of `validate-doc-contracts.mjs` (the `harness:docs:check` runner). Evidence: minimizes blast radius (Gate 4b) — a bug in the new gate cannot break the existing doc-quality pipeline; it can be composed into `docs:check` or CI later as a separate, explicit follow-up once it has run in warn mode for a while.
- Gate 1 domain/module alignment: the new gate is git-diff/path classification, the same problem family as `git-guard.mjs` (command classification) and `manifest-allowlist.mjs` (trusted-path reads) — it lives beside them in `scripts/harness/` rather than inside an unrelated module.
- Gate 2 generality: the protected-path list is config-driven (`harness.config.json` `governance.protectedPaths`), not hardcoded to this repo's specific file names, so an adopting project can redefine its own governance surface.
- Gate 3 ownership: the new script owns protected-path classification and reporting only; it does not own git operations (delegates to `git diff`/`git status` read-only) and does not own CI wiring (that is a separate, later decision for whoever adopts strict mode).
- Gate 4 boundary integrity: default behavior is warn-only, so no existing workflow's exit code changes by installing this script; strict mode is opt-in per the repo's existing bypass-with-audit convention.
- Gate 4b isolation/safety: read-only git inspection, no writes except the lazily-created override audit log; no secrets, no network calls, no code execution of diff content.
- Gate 5 reuse: reuses `resolveValue` from `config.mjs` for config lookup and the JSONL-audit-record shape already established by `prompt-router.mjs`'s preflight-override logging, instead of inventing a new config or audit pattern.

### Constraints
- The gate must never silently pass with zero checks performed (empty-is-not-pass, per `coleam00-dark-factory-validation-independence-line`, already adopted into `deterministic-validation`): if it cannot compute a diff (e.g., no `git` available, not a git repo), it must exit non-zero with a clear reason rather than reporting "no protected paths changed."
- `--self-test` must run without any real git repository state (pure classification-logic assertions over synthetic file-path lists), consistent with `git-guard.mjs --self-test`.
- The override audit log entry must include timestamp, reason, changed protected paths, and an actor identifier (env `USERNAME`/`USER`, falling back to `null`), mirroring `recordPreflightOverride`'s payload shape.
- Do not add this script to `test:harness:core` or any default CI gate in this pass; that is a separate, later opt-in decision once the tool has real-world warn-mode evidence.

### Validation plan
- `node scripts/harness/protected-path-guard.mjs --self-test` must pass (deterministic classification fixtures: protected path changed / not changed / gate bypassed with `--allow`).
- `npm run harness:protected-paths:check` should run clean (warn mode, exit 0) against the current working tree's actual diff, since this pass's own file changes touch `package.json` and `harness.config.json` — verifying the gate correctly flags its own protected-path edits in warn mode without blocking.
- `npm run harness:docs:check` must still pass unmodified, proving the new script is not wired into the existing doc-contract pipeline.
- Manual diff review of the three updated radar entries confirms the Decision Log rows are present with today's date and cite this brief.

### Do NOT
- Do not implement compaction/summarization logic for `run-experiment.mjs` or `plan-review.mjs` in this pass — evidence shows no current loop needs it.
- Do not modify `llm-provider.mjs` request-body construction — the audit found no violation to fix.
- Do not make the protected-path gate block by default, and do not wire it into `test:harness:core` or `harness:docs:check` in this pass.
- Do not touch `coleam00-dark-factory-dispatcher-priority-order.md` — it stays parked per explicit instruction; no dispatcher exists to attach it to.
- Do not change anything in `prompt-prefix-caching.md`'s T1 implementation or `book-to-skill-progressive-disclosure-compiler.md` — both are confirmed correctly adopted with no residual next step in this pass.

### Assumptions and risks
- `[UNVERIFIED]` No other harness script beyond `run-experiment.mjs` and `plan-review.mjs` assembles a growing, un-summarized prompt history; `harness-evolve.mjs` was not line-by-line audited for prompt assembly in this pass. If a future pass finds one, re-open the compaction candidate against that specific script rather than assuming this brief's finding generalizes.
- Risk: a project adopting this harness may have git remotes/workflows where `git diff` against a base ref behaves unexpectedly (shallow clones, detached HEAD). Mitigation: the script fails loudly (non-zero, clear message) rather than silently reporting no protected changes, per the empty-is-not-pass constraint.
- Risk: the default protected-path list may not match every project's actual governance surface. Mitigation: config-driven list, and warn-only default means an imperfect list only produces noisy warnings, not blocked work.
