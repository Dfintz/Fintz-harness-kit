# Architecture Brief: Harness Full Review — Issues, Gaps, Improvements

resource: `.github/harness/HARNESS.md`, `.github/harness/registry.json`, `harness.config.json`, `.github/skills/*/SKILL.md`, `.github/instructions/02-07-*.md`, `scripts/harness/prompt-router.mjs`, `scripts/harness/validate-doc-contracts.mjs`, `.github/harness/loops/*.json`

**Date:** 2026-07-20
**Architect:** Claude Sonnet 4.6 (inline fallback — architect-challenge not in route)
**Status:** Architect → Implement
**Inline Skeptical Pass:** ✅ recorded below

---

## Scope

> **Scope:** workflow / documentation / infrastructure
> **Primary boundary:** harness layer — `scripts/harness/`, `.github/harness/`, `.github/skills/`, `.github/instructions/`

A wide-angle audit of the harness kit to identify issues, gaps, and improvements across all its surfaces: docs contract, skill registry, loop definitions, routing, stage instructions, and tooling scripts.

---

## Gate Summary

| Gate | Result | Notes |
|---|---|---|
| 1 Domain alignment | ✅ PASS | All fixes stay within harness layer |
| 2 Generality | ✅ PASS | No domain-specific concerns |
| 3 Ownership | ✅ PASS | Gaps are sync failures, not conflicts |
| 4 Boundary integrity | ⚠️ PARTIAL FAIL | architect-challenge routing gap; cross-agent skill availability |
| 4b Isolation/safety | ✅ PASS | No multi-tenancy or credential issues |
| 5 Reuse | ⚠️ PARTIAL FAIL | retrieval-quality-ops unregistered; scout/challenger sidecars undocumented |

---

## Findings Inventory (prioritized)

### F-1 [BLOCKER] `architect-challenge` is in `registry.json` workflow.order but never routed

**Evidence:** `harness.config.json` `routing.nonTrivialStages` contains `["understand","architect","implement","review-breadth","review-depth","feedback"]` — no `architect-challenge`. The registry lists it in `workflow.order`. `prompt-router.mjs` derives stages exclusively from `harness.config.json`. The registry's workflow.order is never consumed by the router.

**Impact:** The architect-challenge stage is documented as a first-class workflow step but is structurally unreachable from the router. Every harness-feature run silently skips it. The harness-feature.prompt.md wrapper compensates by saying "if the printed route omits architect-challenge, do an inline pass" — but this is a safety net for an invariant failure.

**Fix options (mutually exclusive, one must be chosen):**
1. Add `architect-challenge` to `harness.config.json` `routing.nonTrivialStages` so the router emits it (then it can be run via `plan-review.mjs`)
2. Remove `architect-challenge` from `registry.json` `workflow.order` and document it as an optional manual step only, not a workflow stage
3. Keep the current state and explicitly document in HARNESS.md that architect-challenge is a manual opt-in, never auto-emitted

**Recommended:** Option 3 is the most honest without requiring behavioral change — document the current actual behavior. Option 1 is correct if we want the challenge to be required.

---

### F-2 [MAJOR] `run-loop` and `remember` skills listed in HARNESS.md but absent from `.github/skills/`

**Evidence:** HARNESS.md skill routing table, lines 214-215, lists `run-loop` and `remember`. Directory listing of `.github/skills/` shows neither directory exists there. Both exist under `.claude/skills/` only.

**Impact:** Non-Claude agents (Copilot, Cursor, Codex) following the HARNESS.md routing table will attempt to load these skills and fail. The table is the universal routing surface — it should only reference skills available to all agents.

**Fix:** Either:
1. Copy/symlink the skill content to `.github/skills/run-loop/` and `.github/skills/remember/` per the agent adapter table in HARNESS.md
2. Annotate the routing table rows with "(Claude Code only)" and point non-Claude agents to the equivalent instruction file

---

### F-3 [MAJOR] `retrieval-quality-ops` skill exists but is unregistered and undiscoverable

**Evidence:** `.github/skills/retrieval-quality-ops/SKILL.md` exists with a complete skill definition. It is not in `registry.json`'s skills section and not in HARNESS.md's skill routing table.

**Impact:** No agent following standard harness routing will ever load it. The skill is operational but effectively dead to any agent that doesn't already know to look for it.

**Fix:** Add `retrieval-quality-ops` to `registry.json` skills array and add a row in HARNESS.md's skill routing table with an appropriate load trigger.

---

### F-4 [MAJOR] All `.github/skills/*.md` files missing YAML frontmatter

**Evidence:** `validate-doc-contracts.mjs` reports `WARNING missing-frontmatter` for all 11 skill files in `.github/skills/`.

**Impact:** Machine validation of skill metadata is skipped for all skills. Any tooling that reads skill metadata from frontmatter (including `harness-catalog.mjs` and `registry.mjs` skill resolution) gets no structured data.

**Fix:** Add minimal YAML frontmatter (`name`, `description`, `triggers`, `modelTier`) to each skill file. Use the pattern from `.claude/skills/*/SKILL.md` files as reference.

---

### F-5 [MAJOR] `validate-doc-contracts.mjs` scans `runs/prompt-packs/` historical artifacts

**Evidence:** Validator output includes 15+ `missing-package-script` warnings from `.github/harness/runs/prompt-packs/*/implementation-notes.md` referencing `type-check:backend:direct` and `lint`. These are historical run artifacts from a project that used different scripts, not harness-kit source files.

**Impact:** The validation output is flooded with irrelevant noise, making it harder to see real problems. The validator's signal-to-noise ratio is poor.

**Fix:** Exclude `.github/harness/runs/` from `validate-doc-contracts.mjs` scanning scope. This directory is gitignored in project-adopting repos and contains runtime artifacts, not harness sources.

---

### F-6 [MINOR] `scout` and `challenger` sidecars in `prompt-router.mjs` are undocumented in HARNESS.md

**Evidence:** `SIDECAR_PROMPT_METADATA` in `prompt-router.mjs` defines `scout` (parallel research) and `challenger` (independent challenge) sidecars that generate optional prompt files when running `harness:prompt-pack`. No mention of these in HARNESS.md, WORKFLOW.md, or registry.json.

**Impact:** Operators don't know these capabilities exist. The `harness:prompt-pack` command generates sidecar files that operators don't know to use.

**Fix:** Add a brief "Sidecar Prompts" section to HARNESS.md documenting scout and challenger, and add entries to registry.json.

---

### F-7 [MINOR] `harness-evolve.json` has conflicting `maxIterations` vs `successCriteria.maximumIterations`

**Evidence:** `maxIterations: 5` at loop root level vs `successCriteria.maximumIterations: 8` inside `successCriteria`. These express different limits on the same concept.

**Impact:** Ambiguity about which bound governs — the loop runner uses `maxIterations` (5); the `successCriteria` says 8. An agent reading only successCriteria would expect 8 iterations, but the runner would stop at 5.

**Fix:** Align both fields to the same value, or add a comment explaining the distinction (e.g., `maxIterations` is the runner's hard cap, `successCriteria.maximumIterations` is a guidance hint for manual/agent runs).

---

### F-8 [MINOR] `harness:graph` command family documented heavily but graph is disabled

**Evidence:** `harness.config.json` has `"graph.enabled": false`. HARNESS.md and WORKFLOW.md reference graph commands as mandatory freshness gates without surfacing the disabled state.

**Impact:** Operators running `npm run harness:graph -- status` get an error ("Graph file not found") but HARNESS.md doesn't explain that this is expected when graph is disabled. Session-0 agents will report reduced confidence on every run without knowing why.

**Fix:** Add a note to the Graph Freshness Gate section of `02-UNDERSTAND-WORKFLOW.md` and WORKFLOW.md explaining that when `graph.enabled = false`, the gate degrades gracefully to direct file-reads with explicit reduced-confidence annotation.

---

### F-9 [MINOR] `build-fix` loop 0% convergence across 6 runs

**Evidence:** Harness report: `build-fix: convergence runs=6, converged=0%`. The harness-kit `package.json` defines `harness:*` scripts but no top-level `lint`, `type-check`, or `build` commands. The `build-fix` loop uses `{{commands.lint}}`, `{{commands.typeCheck}}`, `{{commands.build}}` which resolve to `npm run lint`, `npm run type-check`, `npm run build` — none of which exist in the harness-kit's own `package.json`.

**Impact:** The `build-fix` loop is structurally broken for the harness-kit repository itself. Any adopter who runs it without defining their own commands will see 0% convergence. This is a self-hosting gap.

**Fix:** Either add stub commands to `package.json` (could be no-ops that exit 0 for the kit itself), or add a note in `harness.config.json` `commands` section clarifying that these must be overridden by the adopting project.

---

### F-10 [NIT] `registry.json` `workflow.order` includes `architect-challenge` but no entrypoint key for it

**Evidence:** `registry.json` `entrypoints` section has `universal`, `claudeCode`, `copilot`, `harness`, `workflowPlaybook`, `loops` — no entry for the architect-challenge agent or its instruction file.

**Fix:** Either add an entrypoint for `architect-challenge` agent or remove it from workflow.order to be consistent (follows from F-1 resolution).

---

## Files Changed

| File | Change | Rationale |
|---|---|---|
| `.github/harness/HARNESS.md` | Annotate `run-loop`/`remember` as Claude-only; add sidecar section; graph-disabled note | F-2, F-6, F-8 |
| `.github/harness/registry.json` | Add `retrieval-quality-ops`; resolve architect-challenge gap per F-1 decision | F-1 option 3, F-3, F-10 |
| `.github/skills/*/SKILL.md` (x11) | Add YAML frontmatter to each | F-4 |
| `scripts/harness/validate-doc-contracts.mjs` | Exclude `runs/` directory from scanning | F-5 |
| `.github/harness/loops/harness-evolve.json` | Align `maxIterations` and `successCriteria.maximumIterations` | F-7 |
| `harness.config.json` | Add comment/note about `commands.*` requiring adopter override | F-9 |

---

## Constraints & Do-NOTs

- ❌ Do NOT modify loop guardrails or weaken any safety property
- ❌ Do NOT change routing behavior without documenting the change in registry.json and HARNESS.md
- ❌ Do NOT add skills to routing table if they don't have files at the referenced path
- ❌ Do NOT change `architect-challenge` from optional to required without explicit operator decision (F-1 is documented, not auto-decided)
- ❌ Do NOT touch `.github/harness/runs/` files — they are runtime artifacts

---

## Validation Plan

```bash
node scripts/harness/validate-doc-contracts.mjs
node scripts/harness/harness-report.mjs
```

For adopting projects, also run the validation matrix (commands resolve from `harness.config.json`):
```bash
{{commands.lint}}
{{commands.typeCheck}}
{{commands.build}}
```

Post-fix: `validate-doc-contracts.mjs` should emit zero `missing-frontmatter` warnings for `.github/skills/` and zero `missing-package-script` warnings from `runs/` paths.

---

## Assumptions

- [UNVERIFIED] `harness-catalog.mjs` consumes skill frontmatter — needs verification before frontmatter format is decided
- [UNVERIFIED] `registry.mjs` skill resolution path — assuming it reads from `registry.json`, not from skill frontmatter directly
- Graph disabled state is intentional for this project; no graph refresh needed

---

## Inline Skeptical Pass (architect-challenge fallback)

**Challenge questions:**
1. Is F-1 actually a blocker, or is the current inline-fallback pattern documented in harness-feature.prompt.md sufficient?
   → The prompt wrapper is a compensating control, but the registry and config being inconsistent is a docs contract failure. F-1 should stay MAJOR (downgrade from BLOCKER since the compensating control exists).

2. Does F-4 (frontmatter) actually block any current tooling, or is it just a future-proofing concern?
   → `validate-doc-contracts.mjs` explicitly skips validation when frontmatter is missing. This is a known gap the tool already reports. Severity is correct at MAJOR since it makes the entire validation pipeline for skills non-functional.

3. Is F-5 (validator noise) really a fix target vs. a known limitation?
   → The validator scanning run artifacts is unintentional — `runs/` is gitignored by adopting projects. Fixing the scanner scope is correct and low-risk.

4. F-9 (build-fix 0%) — is this actually a kit problem or an adopter configuration problem?
   → The kit's own `package.json` is the problem. The kit should either self-host its checks or clearly document what adopters must configure. Keeping as MINOR since no adopter's project breaks; only the kit's own harness self-test is broken.

**Verdict after inline pass:** APPROVED with F-1 downgraded from BLOCKER to MAJOR (compensating control in harness-feature.prompt.md). All other severities hold.
