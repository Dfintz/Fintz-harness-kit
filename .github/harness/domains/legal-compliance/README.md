# Legal & Compliance pack

Adapts the harness to legal and compliance deliverables. The engine is unchanged; this pack supplies
the stage labels, gates, deliverable checks, loops, and a domain skill.

| Piece          | File                                                  |
| -------------- | ----------------------------------------------------- |
| Manifest       | [`pack.json`](./pack.json)                            |
| Stage machine  | [`STAGES.md`](./STAGES.md)                            |
| Gates          | [`gates.md`](./gates.md)                              |
| Domain skill   | [`skills/SKILL.md`](./skills/SKILL.md)                |
| Loops          | [`loops/`](./loops/) — `legal-validate`, `legal-review` |
| Config preset  | [`config.preset.json`](./config.preset.json)          |
| Samples        | [`samples/good.md`](./samples/good.md), [`samples/broken.md`](./samples/broken.md) |

## Checks this pack runs

- **required-sections** — Parties, Definitions, Obligations, Liability, Governing Law must all be present.
- **defined-terms** — every term defined in Definitions must be used in the operative text.
- **citation-integrity** — every authority's `[^id]` citation resolves; every authority is cited.

## Quick start

```bash
node scripts/harness/domain-pack.mjs show legal-compliance
node scripts/harness/domain-pack.mjs check legal-compliance                      # checks the good sample
node scripts/harness/domain-pack.mjs check legal-compliance --deliverable my-instrument.md
node scripts/harness/domain-pack.mjs activate legal-compliance                   # wire loops + config in
node scripts/harness/run-loop.mjs legal-validate --check-only                    # then drive it to green
```
