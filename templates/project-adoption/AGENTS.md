# AGENTS.md — [YOUR PROJECT NAME]

Entry point for any AI coding agent working in this repository.

## Harness

This project uses the [Fintz Harness Kit](https://github.com/Dfintz/Fintz-harness-kit) for
agent orchestration. The harness runs from a separate install; this repo holds only the
project-specific overlay: config, memory, and domain knowledge.

**Harness skill (load this first):**

```
npx skills add Dfintz/harness-kit
```

Or if the harness is installed locally, invoke the stage machine directly:

```bash
npm run harness:route -- --task "<your task>"
```

Quick map:

- **Harness operating contract:** [Fintz Harness Kit — HARNESS.md](https://github.com/Dfintz/Fintz-harness-kit/blob/main/.github/harness/HARNESS.md)
- **Project config:** [`harness.config.json`](harness.config.json) — commands, model policy, graph settings
- **Project memory:** [`.github/harness/memory/`](.github/harness/memory/) — lessons, briefs, quarantine
- **Domain knowledge:** [`docs/agents/`](docs/agents/) — project-specific domain, issue tracking, labels
- **Project skills:** [`.github/skills/`](.github/skills/) _(optional — add project-specific skills here)_

## Project-Specific Notes

<!-- Add project constraints that every agent must know before starting work. -->
<!-- Examples: monorepo structure, required test commands, deployment targets, forbidden patterns. -->

### Tech Stack

<!-- e.g. TypeScript, Node 22, Postgres 16, deployed on Railway -->

### Key Commands

<!-- These should match harness.config.json commands. -->

| Purpose | Command |
|---------|---------|
| Lint | `npm run lint` |
| Type check | `npm run type-check` |
| Build | `npm run build` |
| Test | `npm test` |

### Conventions

<!-- List project-specific coding conventions not captured elsewhere. -->

### Off-Limits

<!-- List files/patterns agents must not touch without explicit permission. -->

---

See [`docs/agents/domain.md`](docs/agents/domain.md) for deeper domain knowledge.
