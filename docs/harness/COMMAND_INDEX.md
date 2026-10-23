# Harness Command Index

Quick reference for command surfaces that collaborate across routing, stages, loops, MCP evidence, and quality measurement.

## Routing and Handoffs

- `npm run harness:route -- --task "<task>"`
- `npm run harness:feature -- --task "<task>"`
- `npm run harness:handoff:feature -- --task "<task>"`
- `npm run harness:handoff:review -- --task "<task>"`

Route JSON from `harness:route -- --json` includes additive `rationale.conditionsMatched`,
`rationale.exclusions`, and `rationale.stateFactors` arrays. These explain the selected route and
do not alter routing.

## Stage Execution and Review

- `npm run harness:review -- --subject <path> --reviewer "<cmd>"`
- `npm run harness:plan-review -- --lens plan --subject <path> --reviewer "<cmd>"`

## Loop Surfaces

- `npm run harness:loops`
- `npm run harness:loop <loop-name>`
- `npm run harness:run <loop-name>`
- `npm run harness:loop:list`

## MCP Evidence Surfaces

- `npm run harness:mcp:status`
- `npm run harness:mcp:find -- --query "<query>" --scope all`
- `npm run harness:mcp:impact -- --file <path[,path2,...]> [--file <pathN>] [--depth 1-3]`

## Quality Measurement Surfaces

- `npm run harness:docs:check`
- `npm run test:harness:doc:quality`
- `npm run harness:continue-as-new:roi`
- `npm run test:harness:continue-as-new:roi`
- `npm run harness:hybrid-fusion:benchmark-gap`
- `npm run test:harness:hybrid-fusion:benchmark-gap`
- `npm run harness:contextual-embeddings:eval-pilot -- --eval-set <repo-relative-json> --root .`
- `npm run harness:lease-heartbeat:loop -- <loop-name>`
- `npm run harness:security-differential`
- `npm run harness:graph-resilience -- status`
- `npm run harness:doc-quality -- <paths>`
- `npm run harness:acceptance -- <subcommand>`
- `npm run harness:report`
- `npm run harness:grade`
- `npm run harness:otel`

## Harness Test Aggregates

- `npm run test:harness:core`
- `npm run test:harness:adoption`
- `npm run test:mcp:dispatch`

## State and Gate Test Pilots

Install development dependencies with `npm install --ignore-scripts` (Node >=20).
The core suite includes the state model, security gate fixtures, and evaluator safety self-tests;
Stryker execution remains opt-in.

- `npm run test:harness:stage-state:model` runs 100 seeded sequential command sequences, at most 20 commands each, and prints failure/shrinking metadata.
- `npm run test:harness:testing-adoption` checks mutant accounting, refusal bounds, environment filtering, and deadline termination without running Stryker.
- `npm run harness:testing:adoption` evaluates both techniques with original and seeded-fault controls in disposable copies.
- `npm run harness:testing:adoption -- --technique model` runs only the state controls, capped at 60 seconds total.
- `npm run harness:testing:adoption -- --technique mutation` runs only the fresh comparison/logical/boolean gate pilot: at most 100 non-ignored mutants, one worker, and five minutes total.

Reports are written to `.github/harness/runs/testing-adoption-*.json`, including source hashes,
versions, timings, replay metadata, every selected/ignored mutant and its outcome. Only trusted
first-party source copies execute, with an OS/path-only environment allowlist and no dashboard
reporter. These copies are not a security sandbox. Timeout/compile/runtime outcomes are not kills;
inconclusive execution or failed controls make the evaluator fail.

For a recorded state failure, replay against the same source fault and tool version with
`npm run test:harness:stage-state:model -- --seed <seed> --path <path> --replay-path <replayPath>`.
A clean original is expected to pass, not reproduce the seeded failure. This is sequential
metadata coverage, not concurrency or goal-completion proof. The mutation scope excludes CLI
loading, the check helper, other operator families, and unrelated modules; a clean scoped score
is not repository-wide coverage.

## Adoption and Maintenance Reports

- `npm run harness:adoption:drift -- --canonical-root <path> --installed-root <path> [--json]` (report-only; generic file shape/hash drift, not semantic sidecar policy validation; defaults to `.github/skills` vs `.claude/skills`, explicit installed roots replace that default)
- `npm run harness:adoption:retention -- --dir <path> --max-count <n> [--max-age-days <n>]` (plan-only)
- `npm run harness:adoption:shortcuts -- --shell powershell|posix [--out <path>]` (stdout unless output is explicit)
- `npm run harness:adoption:hook-guard -- --platform posix|cmd|powershell --arg <token> [--arg <token> ...]` (renders a safely-quoted command string)

## Graph Freshness and Fallback Surfaces

- `npm run harness:graph -- status`
- `npm run harness:graph -- provider-status`
- `npm run harness:graph:refresh:once`
- `npm run harness:graph:refresh:loop -- --run-once`

## Compatibility Aliases

- `harness:run` -> `harness:loop`
- `harness:loop:list` -> `harness:loops`
- `harness:evolve:self` -> `harness:evolve:self-test`
