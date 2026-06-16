# Scientific & Academic Research pack

Adapts the harness to scientific research deliverables — research manuscripts and literature reviews.
The engine is unchanged; this pack supplies the stage labels, gates, deliverable checks, loops, and a
domain skill.

| Piece          | File                                                  |
| -------------- | ----------------------------------------------------- |
| Manifest       | [`pack.json`](./pack.json)                            |
| Stage machine  | [`STAGES.md`](./STAGES.md)                            |
| Gates          | [`gates.md`](./gates.md)                              |
| Domain skill   | [`skills/SKILL.md`](./skills/SKILL.md)                |
| Loops          | [`loops/`](./loops/) — `sci-validate`, `sci-review`   |
| Config preset  | [`config.preset.json`](./config.preset.json)          |
| Samples        | [`samples/good.md`](./samples/good.md), [`samples/broken.md`](./samples/broken.md) |

## Checks this pack runs

- **required-sections** — Abstract, Introduction, Methods, Results, Discussion, References must all be present.
- **citation-integrity** — every claim's `[^id]` citation resolves; every reference is cited.
- **claim-substantiation** — every percentage or superlative claim carries a `[^id]` or `(source: …)`.

## Quick start

```bash
node scripts/harness/domain-pack.mjs show scientific-research
node scripts/harness/domain-pack.mjs check scientific-research                      # checks the good sample
node scripts/harness/domain-pack.mjs check scientific-research --deliverable my-manuscript.md
node scripts/harness/domain-pack.mjs activate scientific-research                   # wire loops + config in
node scripts/harness/run-loop.mjs sci-validate --check-only                         # then drive it to green
```
