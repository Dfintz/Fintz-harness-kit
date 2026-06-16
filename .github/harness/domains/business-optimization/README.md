# Business Process Optimization pack

Adapts the harness to process-improvement business cases. The engine is unchanged; this pack supplies
the stage labels, gates, deliverable checks, loops, and a domain skill.

| Piece          | File                                                  |
| -------------- | ----------------------------------------------------- |
| Manifest       | [`pack.json`](./pack.json)                            |
| Stage machine  | [`STAGES.md`](./STAGES.md)                            |
| Gates          | [`gates.md`](./gates.md)                              |
| Domain skill   | [`skills/SKILL.md`](./skills/SKILL.md)                |
| Loops          | [`loops/`](./loops/) — `biz-validate`, `biz-review`   |
| Config preset  | [`config.preset.json`](./config.preset.json)          |
| Samples        | [`samples/good.md`](./samples/good.md), [`samples/broken.md`](./samples/broken.md) |

## Checks this pack runs

- **required-sections** — Current State, Proposed Change, Impact, Risks, Recommendation must all be present.
- **figure-reconciliation** — savings/benefit components must sum to the headline impact figure.
- **claim-substantiation** — every percentage/superlative improvement claim carries a source.

## Quick start

```bash
node scripts/harness/domain-pack.mjs show business-optimization
node scripts/harness/domain-pack.mjs check business-optimization                      # checks the good sample
node scripts/harness/domain-pack.mjs check business-optimization --deliverable my-case.md
node scripts/harness/domain-pack.mjs activate business-optimization                   # wire loops + config in
node scripts/harness/run-loop.mjs biz-validate --check-only                           # then drive it to green
```
