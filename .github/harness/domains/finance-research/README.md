# Finance & Investment Research pack

Adapts the harness to investment research deliverables. The engine is unchanged; this pack supplies
the stage labels, gates, deliverable checks, loops, and a domain skill.

| Piece          | File                                                  |
| -------------- | ----------------------------------------------------- |
| Manifest       | [`pack.json`](./pack.json)                            |
| Stage machine  | [`STAGES.md`](./STAGES.md)                            |
| Gates          | [`gates.md`](./gates.md)                              |
| Domain skill   | [`skills/SKILL.md`](./skills/SKILL.md)                |
| Loops          | [`loops/`](./loops/) — `finance-validate`, `finance-review` |
| Config preset  | [`config.preset.json`](./config.preset.json)          |
| Samples        | [`samples/good.md`](./samples/good.md), [`samples/broken.md`](./samples/broken.md) |

## Checks this pack runs

- **required-sections** — Summary, Thesis, Valuation, Risks, Disclosures, Sources must all be present.
- **figure-reconciliation** — valuation components must sum to the headline value.
- **citation-integrity** — every figure's `[^id]` citation resolves; every source is cited.

## Quick start

```bash
node scripts/harness/domain-pack.mjs show finance-research
node scripts/harness/domain-pack.mjs check finance-research                      # checks the good sample
node scripts/harness/domain-pack.mjs check finance-research --deliverable my-memo.md
node scripts/harness/domain-pack.mjs activate finance-research                   # wire loops + config in
node scripts/harness/run-loop.mjs finance-validate --check-only                  # then drive it to green
```
