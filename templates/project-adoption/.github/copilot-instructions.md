---
applyTo: '**'
---

# GitHub Copilot Instructions — [YOUR PROJECT NAME]

This repository uses the [Fintz Harness Kit](https://github.com/Dfintz/Fintz-harness-kit) for
agent orchestration. This file is the GitHub Copilot App entrypoint.

## Start Here

1. Read [`AGENTS.md`](../../AGENTS.md) for the project entry point and tech stack.
2. Read [`docs/agents/domain.md`](../agents/domain.md) for domain knowledge before touching business logic.
3. Consult [`.github/harness/memory/`](harness/memory/) for lessons and settled Architecture Briefs.
4. For non-trivial work, follow the harness stage machine:
   **Understand → Architect → Implement → Review Breadth → Review Depth → Feedback**

## Harness Commands

```bash
npm run harness:route -- --task "<prompt>"      # classify and plan a task
npm run harness:loops                           # list available loops
npm run harness:report                          # build the dashboard
```

## Authority Chain

When guidance conflicts, higher entries win:

1. This file (`.github/copilot-instructions.md`)
2. [`docs/agents/domain.md`](../agents/domain.md) — project domain and invariants
3. Harness operating contract — [HARNESS.md](https://github.com/Dfintz/Fintz-harness-kit/blob/main/.github/harness/HARNESS.md)
4. Stage instruction contracts in the harness kit

## Project Standards

<!-- Add project-level standards Copilot must respect on every task. -->
<!-- e.g. "All API handlers must validate input at the boundary." -->
<!-- e.g. "Never commit secrets; use environment variables via dotenv." -->
