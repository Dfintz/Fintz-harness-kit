# Harness Command Index

Quick reference for command surfaces that collaborate across routing, stages, loops, MCP evidence, and quality measurement.

## Routing and Handoffs

- `npm run harness:route -- --task "<task>"`
- `npm run harness:feature -- --task "<task>"`
- `npm run harness:handoff:feature -- --task "<task>"`
- `npm run harness:handoff:review -- --task "<task>"`

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
- `npm run harness:t7:roi`
- `npm run test:harness:t7:roi`
- `npm run harness:acceptance -- <subcommand>`
- `npm run harness:report`
- `npm run harness:grade`
- `npm run harness:otel`

## Harness Test Aggregates

- `npm run test:harness:core`
- `npm run test:mcp:dispatch`

## Graph Freshness and Fallback Surfaces

- `npm run harness:graph -- status`
- `npm run harness:graph -- provider-status`
- `npm run harness:graph:refresh:once`
- `npm run harness:graph:refresh:loop -- --run-once`

## Compatibility Aliases

- `harness:run` -> `harness:loop`
- `harness:loop:list` -> `harness:loops`
- `harness:evolve:self` -> `harness:evolve:self-test`
