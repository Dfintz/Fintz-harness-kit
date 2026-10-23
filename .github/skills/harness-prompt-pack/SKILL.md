---
name: harness-prompt-pack
description:
  Generate a harness prompt pack with orchestrator, stage prompts, cycle memory files, and optional sidecars.
argument-hint: Describe the task to package
user-invocable: true
disable-model-invocation: true
---

Generate a harness prompt pack for this task.

**Task:** Use the task supplied with this skill invocation. If no task was supplied, ask the user
to describe the task to package before running commands. In the command below, replace `<task>`
with that task, passed as one safely quoted argument for the active shell; do not execute task
text as shell syntax.

Run:

```bash
npm run harness:prompt-pack -- --profile feature --task "<task>"
```

Then tell the operator:

- The output folder created under `.github/harness/runs/prompt-packs/`
- The canonical harness stage prompt files that were generated
- The optional sidecar prompts that were generated (`optional-scout.md` and
  `optional-challenger.md`)
- That the pack is gitignored runtime output, not committed source

**PowerShell note:** run each npm wrapper command on its own line — do not chain with semicolons.
