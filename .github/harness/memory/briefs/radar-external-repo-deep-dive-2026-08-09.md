# Architecture Brief: Radar Deep Dive — Harness-R1, bholmesdev/skills, book-to-skill

resource: .github/skills/ai-techniques-radar/SKILL.md, .github/harness/memory/radar/README.md, .github/harness/memory/radar/_template.md, .github/harness/loops/technique-triage.json, .github/harness/memory/radar/harness-evolver-meta-harness.md, scripts/harness/harness-evolve.mjs, scripts/harness/grade-trace.mjs, scripts/harness/doc-ingest.mjs, .github/skills/teach-agent/SKILL.md, .github/instructions/04-IMPLEMENT.md, .github/instructions/06-REVIEW-DEPTH.md

- **Status:** approved
- **Date:** 2026-08-09
- **Run ID:** run-20260809130244-170154b8
- **Route:** feature (understand → architect → architect-challenge → implement → review-breadth → review-depth → feedback)

## Problem

Three external repositories were nominated for evaluation. The task is to extract their ideas and
decide what this harness should integrate, cherry-pick, or adopt — not to build anything yet.

- `DeepExperience/Harness-R1` (Apache-2.0, Python, research) — RL-trained "harness engineer" that
  reads batched agent failure trajectories and emits a sandboxed runtime patch, scored by rerunning
  a frozen target on identical task identities.
- `bholmesdev/skills` (MIT, 6 small general-purpose skills) — `simplify`, `taste-review`, `done`,
  `alt-text`, `transcribe`, `free-disk-space`.
- `virgiliojr94/book-to-skill` (MIT, Python) — deterministic extractor plus spec-driven generator
  that compiles a book/doc corpus into a progressive-disclosure skill package.

## Decision

Treat this as a **radar triage task**, not an implementation task. The `ai-techniques-radar` skill is
explicit: "The loop must not implement code directly. Triage and route only." The deliverable is
committed decision memory — one radar entry per idea with an explicit status and a named next step.

Seven ideas were separated out because each has a distinct adoption path (the skill requires one idea
per file when adoption paths differ).

| # | Slug | Source | Status |
|---|---|---|---|
| 1 | `harness-r1-matched-baseline-rerun-scoring` | Harness-R1 | adopted |
| 2 | `harness-r1-batch-failure-packet` | Harness-R1 | adopted |
| 3 | `harness-r1-lifecycle-hook-positions` | Harness-R1 | parked |
| 4 | `harness-r1-rl-trained-harness-engineer` | Harness-R1 | rejected |
| 5 | `bholmesdev-simplify-prose-and-structure-criteria` | bholmesdev/skills | adopted |
| 6 | `bholmesdev-taste-review-cli-shellout` | bholmesdev/skills | rejected |
| 7 | `bholmesdev-done-feature-closeout` | bholmesdev/skills | parked |
| 8 | `book-to-skill-progressive-disclosure-compiler` | book-to-skill | adopted |

(Eight entries; item 4 is recorded explicitly so the rejection of the training pipeline is not
re-litigated on a future radar pass.)

## Files

New files only — all under `.github/harness/memory/radar/`:

- `harness-r1-matched-baseline-rerun-scoring.md`
- `harness-r1-batch-failure-packet.md`
- `harness-r1-lifecycle-hook-positions.md`
- `harness-r1-rl-trained-harness-engineer.md`
- `bholmesdev-simplify-prose-and-structure-criteria.md`
- `bholmesdev-taste-review-cli-shellout.md`
- `bholmesdev-done-feature-closeout.md`
- `book-to-skill-progressive-disclosure-compiler.md`

Plus this brief.

## Constraints

- Radar entries must follow `_template.md` frontmatter exactly: `summary`, `status`, `source`,
  `author_project`, `captured`, `tags`.
- Every entry needs a `Decision Log` row for the status it lands on.
- `adopted` requires: current harness problem, named target files/domains, bounded next step,
  routable through Understand → Architect.
- Summaries in our own words; no pasted external content; no vendored external code or skill files.

## Do-NOT

- Do **not** implement any of the eight ideas in this pass. Each adopted entry becomes its own task.
- Do **not** vendor `bholmesdev/skills/taste-review` — it reads a long-lived OAuth token from macOS
  Keychain and requests a reusable approval for a shell prefix outside the sandbox. That is an
  auth-material-handling pattern we will not import.
- Do **not** vendor the `book-to-skill` Python toolchain into this Node kit. Cherry-pick the output
  schema and the quality rules only.
- Do **not** copy raw text from any external repository into radar entries.
- Do **not** pursue the Harness-R1 RL training stack (GRPO, cold-start SFT, 8×H800). It is a model
  training project; this kit is an agent operating contract.

## Assumptions

- Radar entries are decision memory, so no runtime validation exists for them beyond the harness doc
  checks. Validation for this task = `npm run harness:docs:check` plus template conformance.
- `skillspector` is not installed in this environment. Because no external skill file is vendored or
  executed, the SkillSpector gate is recorded as **not applicable** in the two skill-derived entries
  (items 5 and 8), with the condition that a scan becomes mandatory if we ever import a file
  verbatim.

## Gate results

| Gate | Verdict | Note |
|---|---|---|
| Ownership | Pass | Radar is the correct owner for external-idea decisions; briefs own the routing record. |
| Boundary | Pass | No production script or instruction file is modified in this pass. |
| Reuse | Pass | Uses existing `_template.md` and the `technique-triage` loop contract. |
| Blast radius | Pass | Additive memory files only. |
| Smallest slice | Pass | Triage only; implementation deferred to per-entry follow-up tasks. |
