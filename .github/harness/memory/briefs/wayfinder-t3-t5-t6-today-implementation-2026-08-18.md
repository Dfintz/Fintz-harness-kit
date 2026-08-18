---
summary: "Architecture Brief - T3/T5/T6 implemented today on explicit human override of the trigger-gate"
type: brief
status: active
source: human
created: 2026-08-18
updated: 2026-08-18
tags: [wayfinder, t3, t5, t6, context-engineering, override]
---
## Architecture Brief
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-18.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-18.md, .github/harness/memory/briefs/wayfinder-day60-t3-t5-t6-t4-checkpoint-2026-08-18.md, .github/harness/memory/radar/anthropic-context-compaction.md, .github/harness/memory/radar/anthropic-agentic-memory-file-notes.md, .github/harness/memory/radar/manus-recitation-attention-bias.md, scripts/harness/run-experiment.mjs, scripts/harness/plan-review.mjs, scripts/harness/git-guard.mjs

### Objective
- Implement T3 (context compaction), T5 (agentic memory scratch-file), and T6 (recitation anti-drift)
  today, on explicit human instruction, overriding the trigger-gate that would otherwise have kept
  all three `parked-until-trigger` per the same-day Day-60 checkpoint that just found zero trigger
  evidence.

### Explicit override record
The wayfinder decision map and milestone plan both state, in their own "Do NOT" sections, that T3/T5/T6
must not start without documented trigger evidence. The Day-60 interim checkpoint (same day) found
exactly that: no evidence yet. The user then explicitly instructed implementation to proceed today
regardless. This is a legitimate human override of a self-imposed process guardrail (not a safety or
security boundary) — the person who owns the roadmap can choose to build ahead of evidence. This
override is recorded here, in the decision map, and in each radar entry's Decision Log so the
guardrail's intent is not silently erased from history.

### Scope and boundaries
- In scope: T3 (compaction), T5 (opt-in scratch-notes), T6 (recitation) as designed in the decision
  map's "Target files/domains" / "Exit criteria" for each ticket, adapted to this harness's actual
  architecture (see Key decisions).
- Out of scope: T4 (KV-cache re-audit) — nothing to implement; its trigger (tool-calling added to
  `llm-provider.mjs`) still has not occurred, confirmed again in this pass. T7 remains untouched.
- Primary boundary: `scripts/harness/context-compaction.mjs` (new), `scripts/harness/run-experiment.mjs`,
  `scripts/harness/plan-review.mjs`, `harness.config.json` (new keys only), plus a real,
  independently-discovered bug fix in `scripts/harness/git-guard.mjs` (see below).

### Artifacts to create
- `scripts/harness/context-compaction.mjs` — deterministic (no LLM call) compaction: keeps the most
  recent N run-experiment iteration lines / plan-review rounds verbatim, folds older ones into one
  summary line/block.

### Artifacts to modify
- `scripts/harness/run-experiment.mjs` — `composeImprovementPrompt` now compacts history (T3), accepts
  an optional scratch-notes excerpt (T5), and appends a bounded "Recap" block at the end of the prompt
  (T6). `invokeAgent` now exposes `HARNESS_EXPERIMENT_NOTES_FILE` when scratch notes are enabled.
  New `--scratch-notes` CLI flag (opt-in, default off).
- `scripts/harness/plan-review.mjs` — `composeReviewerPrompt`'s round history now goes through
  `compactRoundHistory` (T3) instead of rendering every prior round's full critique unconditionally.
- `harness.config.json` — `contextGrowth.compaction.*` (thresholds) and `contextGrowth.scratchNotes.enabled`
  (default false).
- `scripts/harness/git-guard.mjs` — **bug fix, discovered during this pass's own validation, not part
  of the original ticket scope.** `main()` was called unconditionally at module scope with no
  entry-point guard, so importing `classifyGitCommand` (as `run-experiment.mjs` already did, before
  this session, for `commitTargets`) silently hijacked the importer's own `process.argv` and called
  `process.exit()` on its behalf. This meant `run-experiment.mjs` could never actually run as a CLI —
  `node scripts/harness/run-experiment.mjs --list` exited immediately printing
  `[git-guard] allow: --list` instead of listing loops. Fixed with a standard
  `import.meta.url === pathToFileURL(process.argv[1]).href` entry-point guard. This had to be fixed in
  this same pass because it blocked validating T3/T5/T6 at all — `run-experiment.mjs` is the only
  script that imports from `git-guard.mjs`, and the harness's own `test:harness:core` suite apparently
  never exercised `run-experiment.mjs` as a plain CLI invocation, or this would have surfaced sooner.

### Key decisions
- Decision: T3 uses deterministic, non-generative compaction (keep-recent-N + one summary line), not
  an LLM-summarized compaction. Evidence: Anthropic's pattern uses a model call to summarize; but
  `run-experiment.mjs`'s history is already one line per iteration (not raw transcripts), so a second
  model call to "summarize a summary" would add cost and non-determinism for no real benefit. The
  compaction here solves the token-growth problem the ticket names without inventing a new LLM
  dependency.
- Decision: T5 (scratch notes) ships **default-off**, opt-in via `--scratch-notes` or
  `HARNESS_EXPERIMENT_SCRATCH_NOTES=true`. Evidence: unlike T3/T6 (pure prompt-shaping, zero behavior
  change unless the loop actually accumulates enough history to compact), T5 is a genuine new
  capability — the agent gets a persistent file across iterations it did not have before, which
  changes what the agent can do. Shipping it default-off keeps every existing loop's behavior
  byte-identical unless a human opts in, consistent with this repo's autonomy-escalation stance even
  though the *implementation* itself was authorized ahead of trigger-evidence.
- Decision: T6 (recitation) adapts Manus's pattern rather than copying it literally. Evidence: Manus's
  recitation works because the *agent itself* rewrites a persistent todo.md across turns of one long
  conversation. `run-experiment.mjs` spawns a fresh, stateless CLI process every iteration — there is
  no persistent agent-owned context to recite into. The adapted implementation has the *harness*
  append a short, bounded "Recap" block (goal, best-so-far, iterations remaining) at the end of every
  composed prompt, achieving the same "keep the goal near the end of context" effect within this
  harness's actual per-iteration-process architecture.
- Decision: fix the git-guard.mjs import-hijack bug in this same pass rather than filing it separately.
  Evidence: it directly blocked proving T3/T5/T6 work (`run-experiment.mjs` could not run at all);
  deferring it would have meant shipping T3/T5/T6 with zero real validation.
- Gate 1 domain/module alignment: `context-compaction.mjs` sits beside `context-growth-guard.mjs` as a
  small, single-purpose helper; the git-guard fix stays inside `git-guard.mjs`, not a new file.
- Gate 2 generality: compaction thresholds are config-driven; the entry-point guard pattern is a
  standard, reusable Node idiom, not a one-off hack.
- Gate 3 ownership: `run-experiment.mjs` and `plan-review.mjs` each call the shared compaction helper
  independently; scratch-notes and recitation are entirely owned by `run-experiment.mjs` (plan-review
  has no equivalent multi-turn agent state to attach either to).
- Gate 4 boundary integrity: T3/T6 are prompt-shaping only — no change to metric measurement, revision
  gates, or verdict parsing (self-test proves this for plan-review). T5 is behind an explicit default-off
  flag. The git-guard fix only changes behavior for direct-CLI vs. imported-module invocation, which is
  exactly the bug, not a new behavior change for existing direct CLI users (self-test still passes).
- Gate 4b isolation/safety: scratch-notes files are written under `.github/harness/runs/` (already the
  trusted output directory), separate from committed memory; no network calls; no new dependencies.
- Gate 5 reuse: one shared `context-compaction.mjs` module for both composers instead of duplicating
  compaction logic twice.

### Constraints
- None of T3/T6 change loop control flow (measurement, revert-on-no-improvement, verdict parsing) —
  proven by `harness:plan-review:self-test` (33/33 unchanged) and code-level confirmation that
  `composeImprovementPrompt`'s new arguments are purely additive with safe defaults.
- T5 must never be silently enabled — no config default flips it on; only `--scratch-notes` or the
  explicit env var.

### Validation plan
- `node --check` on all three touched/created scripts (`context-compaction.mjs`, `run-experiment.mjs`,
  `plan-review.mjs`) plus the fixed `git-guard.mjs`.
- Direct smoke test of `compactLineHistory`/`compactRoundHistory` against synthetic data (25 lines → 21,
  6 rounds → 4 blocks, small lists pass through unchanged).
- `npm run harness:plan-review:self-test` (33/33) and `npm run harness:git-guard:self-test` (27/27)
  unchanged after the fix.
- `node scripts/harness/run-experiment.mjs --list` now correctly lists loops instead of being hijacked
  — this is the proof the git-guard fix actually resolves the blocking bug.
- `npm run harness:docs:check` green.

### Do NOT
- Do NOT enable scratch-notes by default — it stays opt-in.
- Do NOT claim this pass provides trigger evidence for T3/T5/T6 — it does not; it is an explicit
  human override, recorded as such, not a retroactive justification.
- Do NOT expand the git-guard fix into a broader refactor of the file beyond the entry-point guard.

### Assumptions and risks
- `[UNVERIFIED]` No real agent CLI was invoked end-to-end in this environment to prove
  `composeImprovementPrompt`'s new arguments behave correctly inside a live `spawnSync` call; validation
  relied on unit-level smoke tests of the compaction helper plus code-level review of the composer
  and `--list` proving the script loads and argument-parses correctly post-fix.
- Risk: the git-guard fix, while narrowly scoped, touches a file with an existing 27-case self-test
  suite depended on elsewhere. Mitigation: self-test re-run confirms all 27 cases still pass unchanged.
