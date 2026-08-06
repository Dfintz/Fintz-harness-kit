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
