# Tourism & Hospitality pack

Adapts the harness to tour package and itinerary proposal deliverables. The engine is unchanged; this
pack supplies the stage labels, gates, deliverable checks, loops, and a domain skill.

| Piece          | File                                                  |
| -------------- | ----------------------------------------------------- |
| Manifest       | [`pack.json`](./pack.json)                            |
| Stage machine  | [`STAGES.md`](./STAGES.md)                            |
| Gates          | [`gates.md`](./gates.md)                              |
| Domain skill   | [`skills/SKILL.md`](./skills/SKILL.md)                |
| Loops          | [`loops/`](./loops/) — `tour-validate`, `tour-review` |
| Config preset  | [`config.preset.json`](./config.preset.json)          |
| Samples        | [`samples/good.md`](./samples/good.md), [`samples/broken.md`](./samples/broken.md) |

## Checks this pack runs

- **required-sections** — Overview, Itinerary, Inclusions, Pricing, Safety & Cancellation must all be present.
- **figure-reconciliation** — pricing line items must sum to the quoted total.
- **claim-substantiation** — every superlative/percentage marketing claim carries a source.

## Quick start

```bash
node scripts/harness/domain-pack.mjs show tourism
node scripts/harness/domain-pack.mjs check tourism                      # checks the good sample
node scripts/harness/domain-pack.mjs check tourism --deliverable my-proposal.md
node scripts/harness/domain-pack.mjs activate tourism                   # wire loops + config in
node scripts/harness/run-loop.mjs tour-validate --check-only            # then drive it to green
```
