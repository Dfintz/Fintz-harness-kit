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
node scripts/harness/prompt-router.mjs route --profile feature --repo-root . --task "${input:task}" --json
```

Then print the executable handoff plan:

```bash
node scripts/harness/prompt-router.mjs handoff --profile feature --repo-root . --task "${input:task}"
```

Then follow the printed stage sequence exactly:

1. **Understand** — load `understand-process` skill; run graph freshness gate; map impacted
   components, layers, and dependencies.
2. **Architect** — Claude runtimes load the `architect` skill; Copilot and other runtimes load
   `.github/instructions/03-ARCHITECT.md`; run all five architectural gates; produce an Architecture
   Brief (files, decisions, constraints, Do-NOTs, assumptions); save to
   `.github/harness/memory/briefs/`. New briefs must include a provenance line directly under the
   heading: `resource: <comma-separated-paths>`.
3. **Architect Challenge** — when the printed route includes it, a different model (GPT-5.3 Codex,
   distinct from the Opus architect) pressure-tests the Brief, optionally via
   `node scripts/harness/plan-review.mjs --lens plan`; end with VERDICT: APPROVED or REVISE and
   resolve blocking concerns before Implement. If the printed route omits `architect-challenge`
   because of a runtime/tool-limit adjustment, do an inline skeptical pass inside Architect before
   Implement and record that fallback in the brief.
4. **Implement** — load the relevant domain skill(s) and
   `.github/instructions/04-IMPLEMENT.md`; complete the pre-implementation checklist; write code;
   run the self-review checklist. Optionally load the `pr` skill
   (`.github/skills/pr/SKILL.md`) to spawn a fresh verifier sub-agent that drives the running app
   and captures evidence before the Review Breadth handoff.
5. **Review Breadth** — Claude runtimes load `review-breadth`; Copilot and other runtimes load
   `.github/instructions/05-REVIEW-BREADTH.md`; produce a severity-tagged findings list.
6. **Review Depth** — Claude runtimes load `review-depth`; Copilot and other runtimes load
   `.github/instructions/06-REVIEW-DEPTH.md`; run gate verdicts and structural findings against the
   Architecture Brief.
7. **Feedback** — Claude runtimes load `feedback`; Copilot and other runtimes load
   `.github/instructions/07-FEEDBACK.md`; produce the verdict table; update the Brief if decisions
   changed.

Important execution rule:

- The handoff print and any kickoff wrappers are bootstrap only. Do not stop after kickoff.
- Continue into stages 1-7 in the same run unless the user explicitly asks to stop.
- Treat a "minimal kickoff" instruction as completed only when explicitly requested for this run.

**Model roles:** The route output is authoritative. The router derives stage assignments from
`harness.config.json`, using the active per-stage skill mapping when available and falling back to
the repository role defaults only when no stage-specific override exists.

**PowerShell note:** run each npm wrapper command on its own line — do not chain with semicolons.
