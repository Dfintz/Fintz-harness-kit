---
summary: "Feedback Verdict: local open agent model workflow 2026-09-23"
type: review
status: complete
artifact_family: review
immutability: mutable
source: copilot
created: 2026-09-23
updated: 2026-09-23
tags: [feedback, local-models, deterministic-workflow]
---
# Feedback Verdict: Local Open Agent Model Workflow 2026-09-23

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Jev-style models should be considered, but not over-promoted. | Current decision holds. | Jev is recorded as `signal-only`; OpenRouter usage is treated as adoption evidence, not quality or local artifact proof. | HIGH | No further change. |
| 2 | Best local models must be hardware-fit, not generic leaderboard winners. | Challenge upheld and resolved. | `modelPolicy.localOpenModels.hardwareFit` separates Mac 8 GB, Proxmox LXC 50 GB with NUMA, and CPU-only 50 GB profiles with explicit fit statuses. | HIGH | No further change. |
| 3 | Existing guardrails must be woven deterministically into local workflows. | Challenge upheld and resolved. | `workflowLanes` require proof classes, forbidden stages, escalation targets, and guardrails; `test:harness:local-open-model-policy` validates the contract. | HIGH | No further change. |
| 4 | Prompt-router should not be changed for advisory local model policy. | Current decision holds. | No prompt-router code change; local policy is advisory metadata surfaced through config/catalog/docs. | HIGH | No further change. |

## Accepted changes

- Added advisory local open model policy metadata, evidence artifact, deterministic validation test, catalog output, and HARNESS.md workflow guidance.

## Rejected challenges

- None.

## Deferred points

- New open-weight models such as Qwen3.8, DeepSeek V4, GLM 5.3, MiMo V2.6, Kimi K3, or a future local Jev artifact require artifact verification and local measurement before executable defaults.

## Brief updates

- Decisions changed: Architect Challenge revisions were implemented; final review found no blocking issues.
- Constraints updated: no prompt-router behavior change; local executable defaults require local measurement.
- Do NOT rules updated: none beyond the brief's existing forbidden stage and guardrail rules.
- Assumptions retired or added: Jev remains adoption signal only for this run.

## Response notes

- Local open models are now woven into the workflow deterministically as advisory lanes, not as unchecked routing behavior.
- The repo can use local models for assistant/dev/loop/offline work while preserving hosted high-reasoning review for architecture, feedback, security, and final adjudication.