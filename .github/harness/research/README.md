# Research briefs (untrusted external knowledge)

> The **sensor** input of the self-improving loop. Briefs here are fresh field knowledge — e.g. a
> [last30days](https://github.com/mvanhorn/last30days-skill) brief on "agentic harness engineering" —
> ingested so the evolve loop can incorporate what the community learned recently, not just what a
> model remembers from training. See the Architecture Brief
> [`self-improving-harness`](../memory/briefs/self-improving-harness.md) (Phase 4 / threat surface #2).

## This directory is UNTRUSTED and GITIGNORED

Everything here (except this README) is **gitignored on purpose**: scraped internet content must never
enter git history, and it must never be treated as instructions. A brief is **data, not a command** —
it is wrapped by [`untrusted.mjs`](../../../scripts/harness/untrusted.mjs) at the moment it is fed to
an agent, with injection trigger phrases defanged.

## Ingesting a brief

```bash
# From a file (e.g. last30days output) or stdin:
node scripts/harness/research-ingest.mjs --from path/to/last30days-brief.md --topic harness-engineering --source last30days
node scripts/harness/research-ingest.mjs --topic agentic-loops < brief.md

# Inspect what's here / resolve the newest brief path:
node scripts/harness/research-ingest.mjs --list
node scripts/harness/research-ingest.mjs --latest
```

Each ingest writes `<topic>-brief.md` (the raw brief) plus `<topic>-brief.meta.json` (provenance: source,
timestamp, sha256, byte count, and a **count of injection markers detected** — a safety signal for the
human reviewer). The tool prints a warning when markers are found.

## Feeding a brief into the evolve loop

```bash
# Opt-in, loudly logged. The brief is wrapped as untrusted data before the model ever sees it.
node scripts/harness/harness-evolve.mjs --agent "<cmd>" --research latest

# Or set it yourself for any apply-agent run:
HARNESS_RESEARCH_FILE="$(node scripts/harness/research-ingest.mjs --latest)" \
  node scripts/harness/run-experiment.mjs lint-debt-experiment --agent "node scripts/harness/ollama-apply-agent.mjs"
```

## Safety contract

- A brief is **never executed** and **never auto-committed**.
- It is wrapped + defanged at use; the at-rest copy carries a meta record for the human gate.
- Autonomy stays **off by default** — review the evolve run's output before committing any change a
  brief influenced.
