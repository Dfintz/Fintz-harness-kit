# Adopted Radar Disposition: 39-Entry Continuation Handoff
resource: .github/harness/memory/radar/, .github/harness/memory/briefs/radar-triage-eval-taxonomy-adoption-2026-09-24.md
Status: active

## Inventory

- Radar total: 80 entries; 39 adopted, 32 parked, 9 rejected, zero unresolved candidates.
- Initial adopted disposition: 34 shipped-confirmed, 1 selected in this run, 2 blocked, 2 partial, 0 unassigned architecture tasks.
- Post-run disposition: 35 shipped-confirmed, 0 selected, 2 blocked, 2 partial, 0 unassigned architecture tasks.
- This matrix records current evidence; it does not rewrite historical Decision Logs or silently promote parked items.

| Adopted entry | Disposition | Evidence / continuation |
| --- | --- | --- |
| `anthropic-agentic-memory-file-notes` | shipped-confirmed | `run-experiment.mjs` scratch-note support; `wayfinder-t3-t5-t6-today-implementation-2026-08-18.md` |
| `anthropic-context-compaction` | shipped-confirmed | `context-compaction.mjs`, `context-growth-guard.mjs`, run-experiment/plan-review integration |
| `anthropic-contextual-embeddings-and-fusion-retrieval` | shipped-confirmed | contextual modes in `vector-search.mjs`, `file-search.mjs`, `doc-ingest.mjs`; T2 implementation/feedback briefs |
| `bholmesdev-simplify-prose-and-structure-criteria` | shipped-confirmed | line-level criteria in `06-REVIEW-DEPTH.md` and implementation self-review guidance |
| `bmad-autonomous-loop-state-machine-contract` | shipped-confirmed | bounded terminal states and escalation in `run-loop.mjs` / `LOOPS.md` |
| `bmad-context-aware-next-action-resolver` | shipped-confirmed | `prompt-router.mjs next-actions`, package alias, setup docs, profile-aware follow-up briefs |
| `bmad-deterministic-validator-expansion` | shipped-confirmed | `validate-doc-contracts.mjs --changed-surface-warnings`; `harness:docs:check:changed-surfaces` |
| `bmad-research-evidence-firewall` | blocked-policy | Owner: Radar Governance Owner. Current skill-pattern adoption requires SkillSpector result or authorized waiver; template fields remain unimplemented |
| `bmad-run-provenance-anchors` | shipped-confirmed | baseline/final revision and provenance support in `record-run.mjs` and `harness-report.mjs` |
| `book-to-skill-progressive-disclosure-compiler` | partial | Owner: Knowledge Curation Owner. Progressive-disclosure guidance exists in `teach-agent`; chapter/cheatsheet compiler remains a separate task |
| `coderabbit-pr-review` | blocked-human | Owner: Repository Administrator. Existing gap brief requires GitHub App installation/approval before repository config |
| `coleam00-ablate-ai-layer-instructions-earn-their-keep` | shipped-confirmed | `eval/ablate-artifact.mjs` plus eval-first guidance and deterministic self-test |
| `coleam00-dark-factory-protected-governance-files-gate` | shipped-confirmed | `protected-path-guard.mjs`; warning-first policy retained pending evidence |
| `coleam00-dark-factory-validation-independence-line` | shipped-confirmed | independence-line and empty-is-not-pass rules in `deterministic-validation/SKILL.md` |
| `deusdata-persistent-codebase-memory-graph` | shipped-confirmed | provider-selected persistent graph, refresh loop, cache, vector/MCP retrieval contracts |
| `dspy-mipro-v2-optimizer` | shipped-confirmed | `dspy-optimize.py`, bridge and optimizer validation surfaces |
| `eval-capability-regression-taxonomy` | shipped-confirmed | Bounded metadata/reporting slice shipped under `run-20260924074842-1b935d7e`; dashboard/OTel and trusted metric extraction remain tracked separately |
| `harness-r1-batch-failure-packet` | shipped-confirmed | `grade-trace.mjs` failure records, grouping, provisional minimum-batch behavior |
| `harness-r1-matched-baseline-rerun-scoring` | shipped-confirmed | `harness-evolve.mjs` task manifest diff and missing-evaluation classification |
| `hermes-memory-maintenance-approval` | shipped-confirmed | stage-state approval records, maintenance approval evaluator, control-panel path, deterministic tests |
| `hermes-revision-gate-escalation` | shipped-confirmed | bounded run-loop/plan-review terminal escalation and human guidance |
| `hermes-security-evidence-checklist` | shipped-confirmed | Review Breadth security checklist and Lurkr checklist evidence path |
| `lurkr-ai-capability-scanner` | shipped-confirmed | `lurkr-check.mjs`, diff scanner, package commands and optional CI evidence |
| `manus-recitation-attention-bias` | shipped-confirmed | bounded recap block in `run-experiment.mjs`; 2026-08-18 implementation brief |
| `mattpocock-design-it-twice` | shipped-confirmed | optional DESIGN-IT-TWICE procedure in `03-ARCHITECT.md` |
| `mattpocock-diagnose-feedback-loop` | shipped-confirmed | red-capable feedback-loop-first invariant in diagnose loop and doubt-driven skill |
| `mattpocock-prototype-skill` | shipped-confirmed | `.github/skills/prototype/SKILL.md` |
| `mattpocock-push-right` | shipped-confirmed | Loop Invariant 10 in `LOOPS.md` |
| `mattpocock-review-axes` | shipped-confirmed | Standards/spec separation in Review Breadth Lane 3b |
| `no-ai-slop-doc-quality-linting` | shipped-confirmed | `doc-verifier.mjs`, focused test and warning-first package command |
| `omo-hashline-edit-tool` | shipped-confirmed | re-read-before-edit contract in `04-IMPLEMENT.md`; no custom edit runtime claimed |
| `omo-init-deep-hierarchical-agents` | shipped-confirmed | hierarchical `AGENTS.md` guidance in `setup-harness-bootstrap/SKILL.md` |
| `openai-codex-security-differential-scanning` | shipped-confirmed | `lurkr-diff.mjs`, base/HEAD worktree comparison and security evidence artifacts |
| `prime-agent-daemon-rlm-continuity` | shipped-confirmed | metadata-only goal/continuation/refinement ownership in `stage-state.mjs` |
| `prompt-prefix-caching` | shipped-confirmed | optional TTL cache and config controls in `llm-provider.mjs` |
| `reflexion-loop-memory` | partial | Owner: Loop Runtime Owner. TRIED/OUTCOME/HYPOTHESIS schema and untrusted reflection injection ship in `run-loop.mjs`, `LOOPS.md`, and loop template; `run-experiment.mjs` parity remains a separate evidence-gated task |
| `repo-graph-structured-absence` | shipped-confirmed | structured miss contract, CLI/MCP focused test, agent guidance, Snyk/security clearance |
| `revfactory-multiagent-patterns` | shipped-confirmed | six-pattern topology reference in `03-ARCHITECT.md` |
| `yc-qm-lease-heartbeat-reaper` | shipped-confirmed | lease envelope and bounded loop reliability implementation/briefs |

## Continuation Order

1. Reassess `run-experiment.mjs` reflection parity only after a concrete repeated-strategy failure demonstrates the gap; do not duplicate shipped run-loop behavior.
2. Resolve `bmad-research-evidence-firewall` only after SkillSpector evidence or an authorized waiver.
3. Resume `coderabbit-pr-review` only after the human GitHub App prerequisite.
4. Reassess the partial book-to-skill compiler against a concrete ingestion use case before expanding it.
5. Continue eval dashboard/OTel and trusted metric extraction only through the Harness Evaluation Owner follow-up.
