# Harness Observability (OTLP/JSON)

This directory contains OpenTelemetry traces in OTLP/JSON format for harness loop execution
telemetry.

## Structure

Each file `<loop_name>.otlp.json` contains a complete ResourceSpans trace for one harness run.

**Root span**: `invoke_agent` (harness loop orchestration)

- Attributes: loop kind, terminal state, iteration count
- Child spans: one per iteration (experiment loops) or per check (convergence loops)

## Generating Telemetry

```bash
# Export latest run as OTLP/JSON (saved to .github/harness/otel/)
npm run harness:otel

# Export all runs
npm run harness:otel:all

# Export specific journal
npm run harness:otel:file -- path/to/journal.json

# Print to stdout instead of saving
npm run harness:otel -- --stdout
```

## Consuming Telemetry

1. **Dashboard**: `harness-report.mjs` ingests .otlp.json files → renders "Harness Observability"
   panel
2. **Analytics**: Telemetry is deterministic (same input = same trace ID) → safe for aggregation
3. **External**: Optional POST to OpenTelemetry collector (future feature)

## Schema

See `otel-export.mjs --help` for full schema reference.

Spans follow GenAI semconv:

- `gen_ai.operation.name` = "invoke_agent"
- `gen_ai.system` = "harness-kit"
- `gen_ai.agent.name` = loop name (defanged)

Harness-specific attributes:

- `harness.loop.kind` = experiment | convergence | workflow
- `harness.loop.terminal_state` = converged | stuck | exhausted | unknown
- `harness.iteration.number` = 1..N
- `harness.iteration.metric_value` = raw metric from iteration

## Security

- All string attributes are defanged (injection markers prefixed with `⟪defanged⟫`)
- Trace IDs are deterministic (sha256 of loop name + start timestamp)
- Spans are never executed; pure observability (no injection risk)
