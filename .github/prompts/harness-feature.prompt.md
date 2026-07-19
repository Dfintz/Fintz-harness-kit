---
mode: agent
description:
  Run the full harness stage machine for a feature task (Understand → Architect → Architect
  Challenge → Implement → Review Breadth → Review Depth → Feedback).
---

Run the full harness feature handoff for this task.

**Task:** ${input:task:Describe the feature task}

First print the routing decision + exact stage/model handoff plan by running:

```bash
node scripts/harness/prompt-router.mjs route --task "${input:task}" --json
```

Then print the executable handoff plan:

```bash
node scripts/harness/prompt-router.mjs handoff --task "${input:task}"
```

Then follow the printed stage sequence exactly:

1. **Understand** — load `understand-process` skill; run graph freshness gate; map impacted
   components, layers, and dependencies.
2. **Architect** — load `architect` skill; run all five architectural gates; produce an Architecture
   Brief (files, decisions, constraints, Do-NOTs, assumptions); save to
   `.github/harness/memory/briefs/`. New briefs must include a provenance line directly under the
   heading: `resource: <comma-separated-paths>`.
3. **Architect Challenge** — when the printed route includes it, a different model (GPT-5.3 Codex,
   distinct from the Opus architect) pressure-tests the Brief, optionally via
   `node scripts/harness/plan-review.mjs --lens plan`; end with VERDICT: APPROVED or REVISE and
   resolve blocking concerns before Implement. If the printed route omits `architect-challenge`
   because of a runtime/tool-limit adjustment, do an inline skeptical pass inside Architect before
   Implement and record that fallback in the brief.
4. **Implement** — load the relevant domain skill(s); complete the pre-implementation checklist;
   write code; run the self-review checklist. Optionally load the `pr` skill
   (`.github/skills/pr/SKILL.md`) to spawn a fresh verifier sub-agent that drives the running app
   and captures evidence before the Review Breadth handoff.
5. **Review Breadth** — load `review-breadth` skill; produce a severity-tagged findings list.
6. **Review Depth** — load `review-depth` skill; run gate verdicts and structural findings against
   the Architecture Brief.
7. **Feedback** — load `feedback` skill; produce the verdict table; update the Brief if decisions
   changed.

Important execution rule:

- The handoff print and any kickoff wrappers are bootstrap only. Do not stop after kickoff.
- Continue into stages 1-7 in the same run unless the user explicitly asks to stop.
- Treat a "minimal kickoff" instruction as completed only when explicitly requested for this run.

**Model roles:** The route output is authoritative. The router uses a deterministic task-class
matrix from `harness.config.json` to select either `exploratory` or `deterministic` model sets and
records the decision in handoff telemetry (`.github/harness/runs/handoffs.jsonl`).

**PowerShell note:** run each npm wrapper command on its own line — do not chain with semicolons.
