# Domain & Industry Packs

The harness engine is domain-agnostic: the loop kinds (convergence / workflow / experiment), memory,
cross-model review, observability, and the *shape* of a gated stage machine do not care whether the
work product is code. What is software-specific is only the **content** — the stage labels
(Architect / Implement), the five architectural gates, and the convergence checks (lint / type /
build / test).

A **domain pack** swaps that content layer for another knowledge domain while reusing the engine
unchanged. It re-labels the stages, supplies a domain gate set, and points the convergence checks at
deterministic **deliverable checks** (`scripts/harness/domain-checks/*`) that read a written artifact
— a research memo, a contract, a runbook, an itinerary — instead of compiling code.

```
ENGINE (unchanged)                         DOMAIN PACK (swappable)
─────────────────────────────────         ─────────────────────────────────
run-loop / run-experiment                  stages[]   relabeled stage machine
memory (lessons + briefs)                  gates[]    domain gate set
cross-model / council review               checks[]   deliverable checks (lint/test analogue)
grade-trace + otel observability           loops[]    convergence + workflow loops
domain-pack.mjs --self-test  ◄── fitness   samples[]  good (passes all) + broken (fails ≥1)
```

## Anatomy of a pack

Each pack is a directory under `.github/harness/domains/<name>/`:

| Path                  | What it is                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- |
| `pack.json`           | Manifest (schema: [`pack.schema.json`](./pack.schema.json)) — stages, gates, checks |
| `STAGES.md`           | The re-skinned stage machine: what each stage means and outputs in this domain      |
| `gates.md`            | The domain gate set, with a finding format per gate                                 |
| `loops/*.json`        | Domain loops (convergence loops reference the deliverable checks)                    |
| `config.preset.json`  | A `harness.config.json` preset wiring `commands.*` to the deliverable checks         |
| `skills/SKILL.md`     | The domain skill an agent loads before producing the deliverable                    |
| `samples/good.md`     | A model deliverable that **passes every check**                                     |
| `samples/broken.md`   | A flawed deliverable that **fails at least one check** (proves the checks bite)      |
| `README.md`           | One-screen adoption guide for the pack                                               |

## Using a pack

```bash
node scripts/harness/domain-pack.mjs --list                 # discover packs
node scripts/harness/domain-pack.mjs show finance-research   # stages, gates, checks
node scripts/harness/domain-pack.mjs check finance-research  # run the checks on the good sample
node scripts/harness/domain-pack.mjs check finance-research --deliverable path/to/your.md
node scripts/harness/domain-pack.mjs activate finance-research   # copy loops + config preset into place
node scripts/harness/domain-pack.mjs --self-test             # validate ALL packs (fitness gate)
```

`activate` copies the pack's loop files into `.github/harness/loops/` and writes its
`config.preset.json` over `harness.config.json` (backing up the old one to `harness.config.json.bak`),
so the existing `run-loop` / dashboard / MCP engine then drives the domain unchanged.

## The deliverable checks (shared, domain-neutral)

These live in `scripts/harness/domain-checks/` and are reused across packs. Each is dependency-free,
exits 0/1, and ships a `--self-test`:

| Check                       | Fails when…                                                                   |
| --------------------------- | ----------------------------------------------------------------------------- |
| `required-sections.mjs`     | a `--sections "A|B|C"` heading is missing                                     |
| `citation-integrity.mjs`    | a `[^id]` citation is undefined, or a `[^id]:` source is never cited           |
| `defined-terms.mjs`         | a term in `## Definitions` (`- **Term** — …`) is never used in the body        |
| `figure-reconciliation.mjs` | items in a `<!-- reconcile -->` block don't sum to their `Total` line          |
| `claim-substantiation.mjs`  | a percentage/superlative claim carries no `[^id]` or `(source: …)`             |
| `checklist-coverage.mjs`    | a `Gate …` heading has no non-empty `Verdict:` line before the next heading    |

## Authoring a new pack

1. `cp -r .github/harness/domains/_template .github/harness/domains/<your-pack>`.
2. Edit `pack.json`: set `name` (= directory name), `title`, relabel `stages`, write the `gates`, and
   pick the `checks` your deliverable needs (compose the shared checks above; add a new one under
   `scripts/harness/domain-checks/` only if no existing check covers the rule).
3. Write `samples/good.md` (must pass every check) and `samples/broken.md` (must fail ≥1). These are
   the pack's test fixtures — keep them small and realistic.
4. Fill in `STAGES.md`, `gates.md`, the `skills/SKILL.md`, the loop(s), and `config.preset.json`.
5. Prove it: `node scripts/harness/domain-pack.mjs --self-test` must stay green.

The rule of thumb mirrors the software harness's eval suite: **a check earns its place only if the
broken sample trips it and the good sample doesn't.** A check no sample can fail is decoration.
