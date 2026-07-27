# Radar Reevaluation Matrix - 2026-07-26

Resource: .github/harness/memory/briefs/radar-reevaluation-and-adoption-audit-2026-07-26.md

## Decision rubric used

- integrated: at least one target behavior exists in shipped files, at least one target domain/file from entry is evidenced, and evidence paths are recorded.
- partially integrated: some behavior exists, but required target behavior/domain remains incomplete.
- not integrated: no qualifying shipped evidence, or blocked by unmet prerequisite.

## Matrix

| Entry | Current status | Reevaluation decision | Integration verdict | Evidence paths | Next step |
|---|---|---|---|---|---|
| addyosmani-stage-augmentation.md | candidate | hold | n/a | .github/harness/LOOPS.md; .github/instructions/ | Keep as candidate until concrete harness delta is scoped. |
| bmad-autonomous-loop-state-machine-contract.md | adopted | hold adopted | integrated | scripts/harness/record-run.mjs; .github/harness/runs/run-contract.md; scripts/harness/harness-report.mjs | No status change. Append confirmation in decision log. |
| bmad-context-aware-next-action-resolver.md | parked | promote to adopted | n/a | scripts/harness/prompt-router.mjs; .github/harness/registry.json; .github/harness/WORKFLOW.md | Implement a read-only top-3 next-action resolver prototype. |
| bmad-deterministic-validator-expansion.md | parked | promote to adopted | n/a | scripts/harness/validate-doc-contracts.mjs; .github/harness/registry.json; .github/instructions/; .github/skills/ | Implement warning-only changed-surface vs cited-surface mismatch checks. |
| bmad-research-evidence-firewall.md | parked | hold | n/a | .github/instructions/03-ARCHITECT.md; .github/instructions/04-IMPLEMENT.md | Keep parked pending a bounded parser approach. |
| bmad-run-provenance-anchors.md | adopted | hold adopted | integrated | scripts/harness/record-run.mjs; .github/harness/runs/run-contract.md; scripts/harness/harness-report.mjs | No status change. Append confirmation in decision log. |
| coderabbit-pr-review.md | adopted | hold adopted (blocked prerequisite) | not integrated | .github/harness/memory/radar/coderabbit-pr-review.md; repo root (no .coderabbit.yaml) | Keep adopted, blocked on GitHub App installation and config file creation. |
| dspy-mipro-v2-optimizer.md | candidate | hold | n/a | scripts/harness/dspy-optimize.py; scripts/harness/dspy-optimize-ollama.py | Revisit when eval baselines require optimizer changes. |
| harness-evolver-meta-harness.md | candidate | hold | n/a | scripts/harness/harness-evolve.mjs | Keep candidate; no immediate gap forcing adoption. |
| llm-as-judge-rubrics.md | candidate | hold | n/a | scripts/harness/pilot/llm-judge-evaluator.mjs; scripts/harness/eval/ | Keep candidate; tie to next eval-cycle quality target. |
| lurkr-ai-capability-scanner.md | adopted | hold adopted | integrated (optional-by-design) | scripts/harness/lurkr-check.mjs; package.json; .github/instructions/05-REVIEW-BREADTH.md; SETUP.md | Optional executable wiring is complete; keep non-mandatory baseline stance. |
| mattpocock-design-it-twice.md | adopted | hold adopted | integrated | .github/instructions/03-ARCHITECT.md | No status change. |
| mattpocock-diagnose-feedback-loop.md | adopted | hold adopted | integrated | .github/harness/loops/diagnose.json; .github/skills/doubt-driven-development/SKILL.md | No status change. |
| mattpocock-prototype-skill.md | adopted | hold adopted | integrated | .github/skills/prototype/SKILL.md | No status change. |
| mattpocock-push-right.md | adopted | hold adopted | integrated | .github/harness/LOOPS.md | No status change. |
| mattpocock-review-axes.md | adopted | hold adopted | integrated | .github/instructions/05-REVIEW-BREADTH.md | No status change. |
| omo-hashline-edit-tool.md | adopted | hold adopted | integrated | .github/instructions/04-IMPLEMENT.md | No status change. |
| omo-hyperplan-multi-critic.md | candidate | hold | n/a | .github/instructions/03-ARCHITECT.md; scripts/harness/council-review.mjs | Keep candidate until multi-critic overhead budget is justified. |
| omo-init-deep-hierarchical-agents.md | adopted | hold adopted | integrated | .github/skills/setup-harness-bootstrap/SKILL.md | No status change. |
| pi-setup-thinking-budget-tokens.md | candidate | hold | n/a | harness.config.json | Keep candidate; revisit with token-budget telemetry changes. |
| prompt-prefix-caching.md | adopted | hold adopted | not integrated | .github/harness/memory/radar/prompt-prefix-caching.md; scripts/harness/llm-provider.mjs | Keep adopted with explicit gap; no concrete prefix-caching implementation evidence found. |
| reflexion-loop-memory.md | adopted | hold adopted | integrated | scripts/harness/run-loop.mjs; .github/harness/LOOPS.md | No status change. |
| revfactory-multiagent-patterns.md | adopted | hold adopted | integrated | .github/instructions/03-ARCHITECT.md | No status change. |
| superpowers-human-partner-language.md | candidate | hold | n/a | .github/instructions/07-FEEDBACK.md; AGENTS.md | Keep candidate; no blocked gap requiring status change. |
| superpowers-session-start-hook.md | candidate | hold | n/a | AGENTS.md; .github/harness/HARNESS.md | Keep candidate; workflow already has explicit start docs. |
| twelve-factor-agents.md | candidate | hold | n/a | README.md; skills/harness/SKILL.md | Keep candidate; align later with broader docs refresh. |

## Status-change summary

- Promote to adopted:
  - bmad-context-aware-next-action-resolver.md
  - bmad-deterministic-validator-expansion.md
- Keep adopted but mark integration gap:
  - coderabbit-pr-review.md (not integrated, prerequisite blocked)
  - prompt-prefix-caching.md (not integrated)

## Implementation addendum (same day)

- lurkr-ai-capability-scanner.md moved from partially integrated to integrated (optional-by-design)
  after wiring a single executable path and setup/review guidance.
