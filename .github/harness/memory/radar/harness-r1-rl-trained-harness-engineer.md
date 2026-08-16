---
summary: Train a 9B model with cold-start SFT plus online GRPO to author harness patches — rejected here because this kit is an operating contract for hosted agents, not a model training project
status: rejected
source: https://github.com/DeepExperience/Harness-R1
author_project: DeepExperience (Shao et al., arXiv 2608.02276)
captured: 2026-08-09
tags: [rl, grpo, sft, training, out-of-scope]
---

# RL-Trained Harness Engineer

## Technique Summary

The headline contribution of Harness-R1 is a *trained* harness engineer: cold-start supervised
fine-tuning on editing examples, then online GRPO where the reward is the measured delta from
rerunning a frozen target. The trained 9B engineer outperforms much larger frontier models used as
fixed editors on the same evidence. Training runs on a single node with eight H800 GPUs and requires
a frozen target agent, benchmark environments, and a strictly stable prompt protocol shared across
SFT, RL, and evaluation.

## Repository Relevance

None that we can act on. This kit is a set of instructions, skills, loops, and Node scripts that steer
*hosted* models we do not control and cannot fine-tune. We have no frozen target agent, no benchmark
environment harness, and no training hardware. Attempting this would also break the kit's
project-agnostic property: a trained engineer is only meaningful against the specific target it was
trained for, which the authors state explicitly.

Recorded as an explicit rejection so a future radar pass does not re-open it. The *protocol* ideas
extracted from the same paper are captured separately and are the parts worth having.

## Adoption Notes

- **Target files/domains:** none
- **Risks/constraints:** Cost and hardware aside, the deeper mismatch is architectural — a trained
  engineer couples the harness to one target model, which is the opposite of this kit's goal.
- **Next step:** None. See `harness-r1-matched-baseline-rerun-scoring`,
  `harness-r1-batch-failure-packet`, and `harness-r1-lifecycle-hook-positions` for the transferable
  parts.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from Harness-R1 deep dive | radar-pass |
| 2026-08-09 | rejected | No fine-tunable target, no training hardware, and target-coupling conflicts with the kit's agent-agnostic design. Transferable protocol ideas split into three separate entries. | radar-pass |
