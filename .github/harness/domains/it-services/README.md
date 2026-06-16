# IT Services & Delivery pack

Adapts the harness to IT-services delivery deliverables — statements of work, service designs, and
runbooks. The engine is unchanged; this pack supplies the stage labels, gates, deliverable checks,
loops, and a domain skill.

| Piece          | File                                                  |
| -------------- | ----------------------------------------------------- |
| Manifest       | [`pack.json`](./pack.json)                            |
| Stage machine  | [`STAGES.md`](./STAGES.md)                            |
| Gates          | [`gates.md`](./gates.md)                              |
| Domain skill   | [`skills/SKILL.md`](./skills/SKILL.md)                |
| Loops          | [`loops/`](./loops/) — `it-validate`, `it-review`     |
| Config preset  | [`config.preset.json`](./config.preset.json)          |
| Samples        | [`samples/good.md`](./samples/good.md), [`samples/broken.md`](./samples/broken.md) |

## Checks this pack runs

- **required-sections** — Scope, Architecture, SLA, Runbook, Rollback, Risks must all be present.
- **checklist-coverage** — every go-live readiness gate heading must carry a non-empty Verdict line.
- **claim-substantiation** — every percentage or superlative/absolute claim must carry a source.

## Quick start

```bash
node scripts/harness/domain-pack.mjs show it-services
node scripts/harness/domain-pack.mjs check it-services                      # checks the good sample
node scripts/harness/domain-pack.mjs check it-services --deliverable my-sow.md
node scripts/harness/domain-pack.mjs activate it-services                   # wire loops + config in
node scripts/harness/run-loop.mjs it-validate --check-only                  # then drive it to green
```
