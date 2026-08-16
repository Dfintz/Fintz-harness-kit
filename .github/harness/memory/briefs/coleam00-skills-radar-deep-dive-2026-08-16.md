# Architecture Brief: Radar Deep Dive — coleam00/skills (build-dark-factory + repo-wide scan)

resource: .github/skills/ai-techniques-radar/SKILL.md, .github/harness/memory/radar/README.md, .github/harness/memory/radar/_template.md, .github/harness/memory/radar/harness-evolver-meta-harness.md, .github/harness/memory/radar/bmad-autonomous-loop-state-machine-contract.md, .github/skills/deterministic-validation/SKILL.md, .github/skills/eval-first-tuning/SKILL.md, scripts/harness/git-guard.mjs, scripts/harness/acceptance-gate.mjs

- **Status:** approved
- **Date:** 2026-08-16
- **Run ID:** run-20260816065444-c3a167c3
- **Route:** feature (understand → architect → architect-challenge → implement → review-breadth → review-depth → feedback)

## Problem

The user asked to start with `coleam00/skills`' `build-dark-factory` skill and evaluate whether it
can improve this harness, then investigate the rest of that repository (33 skills total) for
cherry-pick candidates.

`build-dark-factory` (MIT) is a single long `SKILL.md` that walks a "build an unattended,
autonomous-merge repository" workflow in seven ordered phases (guidance layer → validation harness →
workflow-driven repo → deployment → trigger), backed by a `templates/runner/` execution layer and a
`templates/harness/` validation scaffold. The repo's other 32 skills cover priming, planning, the
PIV (plan/implement/validate) loop, issue triage, worktrees, and meta-skills for building an AI
Layer (rules, hooks, skill authoring, ablation testing, opportunity scanning).

## Decision

Per the `ai-techniques-radar` skill's own rule ("The loop must not implement code directly. Triage
and route only."), this is a **radar triage task**, not a build task. This harness already
implements most of what a "dark factory" needs structurally — a bounded stage machine, deterministic
validation gates, loop convergence checks, and a memory-backed radar for exactly this kind of
external-idea intake — so the useful output is committed decision memory: one radar entry per idea
with a distinct adoption path, each with an explicit status.

Six ideas were separated out (one idea per file, per the skill's own writing rule):

| # | Slug | Source | Status | Why |
|---|---|---|---|---|
| 1 | `coleam00-dark-factory-overview` | build-dark-factory | rejected | We are not building an autonomous, human-out-of-the-loop merge pipeline; this harness's stage machine keeps a human review gate (Feedback stage) by design. Recorded so the whole-skill idea isn't re-litigated. |
| 2 | `coleam00-dark-factory-validation-independence-line` | build-dark-factory | adopted | Concrete, cheap, doc-only addition to `deterministic-validation`: draw an "independence line" above which checks are outside the agent's optimization loop, require an explicit ran-count assertion ("empty is not pass"), and mutation-test the harness's own gate scripts. |
| 3 | `coleam00-dark-factory-protected-governance-files-gate` | build-dark-factory | candidate | We protect briefs/registry/config by convention and review, not by a code-enforced pre-merge gate that rejects a diff touching governance files before anything else is evaluated. Real gap, but needs its own Architect pass to define the protected-path list and enforcement point. |
| 4 | `coleam00-dark-factory-dispatcher-priority-order` | build-dark-factory | parked | Fixed dispatcher priority (finish in-flight work before starting new work) is a good principle for any future autonomous dispatch loop, but we have no such dispatcher today; it complements the already-parked `harness-evolver-meta-harness` entry. |
| 5 | `coleam00-ablate-ai-layer-instructions-earn-their-keep` | ablate-ai-layer (repo-wide scan) | adopted | Genuinely novel technique not covered by existing skills: strip a rule/skill, rerun the same task, diff the two runs, keep only what changes the outcome. Maps cleanly onto `eval-first-tuning`. |
| 6 | `coleam00-piv-loop-and-meta-skills-overlap-scan` | repo-wide scan (prime-*, plan-*, piv-*, worktree-*, rules-check-drift, opportunity-scan, second-brain-audit, tools) | rejected | Batch entry: each of these skills maps to a stage, memory surface, or check we already run (Understand↔prime-*, Architect↔plan-architecture/piv-slice-epic, Implement/Review/Feedback↔the PIV loop, context-engineering↔second-brain-audit, ai-techniques-radar↔opportunity-scan). No net-new capability identified beyond items 2 and 5 above. |

## Files

New files only, all under `.github/harness/memory/radar/`:

- `coleam00-dark-factory-overview.md`
- `coleam00-dark-factory-validation-independence-line.md`
- `coleam00-dark-factory-protected-governance-files-gate.md`
- `coleam00-dark-factory-dispatcher-priority-order.md`
- `coleam00-ablate-ai-layer-instructions-earn-their-keep.md`
- `coleam00-piv-loop-and-meta-skills-overlap-scan.md`

Plus a small doc addition to `.github/skills/deterministic-validation/SKILL.md` for the one item
promoted straight to `adopted` with a fully bounded, doc-only next step (item 2).

## Constraints

- Radar entries follow `_template.md` frontmatter exactly: `summary`, `status`, `source`,
  `author_project`, `captured`, `tags`.
- Every entry has a `Decision Log` row for the status it lands on.
- `adopted` requires: current harness problem, named target files/domains, bounded next step,
  routable through Understand → Architect. Item 2's next step is small enough to land in this same
  pass (a documentation subsection); item 5 still requires its own future Understand/Architect pass
  before any tooling is built, so its `Decision Log` next step stays "define the eval harness slice."
- Summaries in our own words; no pasted external SKILL.md text; no vendored templates/scripts from
  `coleam00/skills`.

## Do-NOT

- Do **not** build an autonomous/unattended merge pipeline (dark-factory's core premise) — this
  conflicts with the harness's explicit human review gate at the Feedback stage.
- Do **not** vendor `templates/runner/` or `templates/harness/` from `coleam00/skills` into this
  repo. Only the underlying principles (independence line, dispatcher priority) are cherry-picked.
- Do **not** mark the protected-governance-files idea `adopted` in this pass — it needs its own
  Architect decision on enforcement point (pre-commit hook vs. CI check vs. harness script) before a
  bounded next step can be written honestly.
- Do **not** copy raw text from any external repository into radar entries or this brief.

## Assumptions

- `skillspector` is not installed in this environment; because no external skill file or script is
  vendored or executed, the SkillSpector gate is **not applicable** to any of the six entries. This
  becomes mandatory again if a future pass imports a file verbatim.
- Validation for this task = `npm run harness:docs:check` (registry/loop/template conformance) plus
  a manual template-conformance read of each new radar file.
