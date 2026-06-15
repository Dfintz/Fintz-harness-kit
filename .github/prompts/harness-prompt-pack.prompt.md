---
agent: true
description:
  Generate a harness prompt pack with orchestrator, stage prompts, cycle memory files, and optional sidecars.
---

Generate a harness prompt pack for this task.

**Task:** ${input:task:Describe the task to package}

Run:

```bash
npm run harness:prompt-pack -- --profile feature --task "${input:task}"
```

Then tell the operator:

- The output folder created under `.github/harness/runs/prompt-packs/`
- The canonical harness stage prompt files that were generated
- The optional sidecar prompts that were generated (`optional-scout.md` and
  `optional-challenger.md`)
- That the pack is gitignored runtime output, not committed source

**PowerShell note:** run each npm wrapper command on its own line — do not chain with semicolons.
