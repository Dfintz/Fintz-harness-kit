---
name: observability-and-instrumentation
description: Telemetry, RED metrics, structured logging, and trace analysis. Use when adding or debugging observability in a service.
---

# Skill: Observability and Instrumentation

> Use when: Adding telemetry to a new feature, debugging production issues, setting up harness trace
> grading, or shipping anything that runs in production and needs measurable health signals.

Adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) —
`observability-and-instrumentation` skill. Condensed to this repo's stack (Winston, Application
Insights, OTEL harness tooling).

---

## Objective

Instrument as you build so that production and harness runs are observable, not inferred. Every new
feature should emit enough signal to answer: "Is this working? Is this slow? Is this failing?"

---

## Principles

- **Instrument as you build**, not after the fact.
- **RED metrics** for services: Request rate, Error rate, Duration.
- **Structured logging**: every log entry includes correlation ID, user/org context, and event type.
- **Vendor-neutral tracing**: use OpenTelemetry (`scripts/harness/otel-export.mjs`) as the primary
  export path. Application Insights is a configured sink, not the API.

---

## Process

### Step 1 — Decide signal type

| Signal                       | Use for                                                |
| ---------------------------- | ------------------------------------------------------ |
| Structured log (Winston)     | Per-request events, errors, audit trail                |
| Metric (App Insights custom) | Counters, durations, resource utilisation              |
| OTel trace span              | Distributed call chains, harness loop iteration traces |
| Harness run journal          | Loop convergence data, rubric pass rates               |

### Step 2 — Add instrumentation alongside code, not after

For every new service method or harness loop:

- Add a Winston log at entry (`logger.info`) with correlation ID and context.
- Add structured error logging in the catch block —
  `err instanceof Error ? err : new Error(String(err))`.
- For operations > 100ms or user-facing: add an App Insights duration metric.
- For harness loops: record the run with `npm run harness:record`.

### Step 3 — Verify signal is emitted

Do not merge instrumentation without confirming it fires:

- Run the feature locally and check logs.
- For OTel: run `npm run harness:otel -- --latest` after a loop run and confirm span output.
- For metrics: check App Insights query or `harness:report` dashboard.
- For loop/report observability: run `npm run harness:report` and confirm the expected loop,
  terminal state, and slow-check/rubric signals appear.
- For experiment evaluation: run `npm run harness:grade` and confirm the trajectory is scored as
  expected.

### Step 4 — Write symptom-based alerts, not cause-based

Good: "Error rate on `/api/v2/fleets` > 1% for 5 minutes" Bad: "CPU > 80%"

Alerts fire on user-visible symptoms. Metrics measure causes. Keep them separate.

---

## This Repo's Instrumentation Stack

| Layer                 | Tool                       | Config                                    |
| --------------------- | -------------------------- | ----------------------------------------- |
| App logging           | Winston                    | `backend/src/utils/logger.ts`             |
| Audit logging         | `DomainAuditLogger`        | `backend/src/services/shared/`            |
| Distributed tracing   | OpenTelemetry SDK          | `scripts/harness/otel-export.mjs`         |
| Production monitoring | Azure Application Insights | `APPINSIGHTS_INSTRUMENTATION_KEY` env var |
| Harness loop metrics  | `harness-report.mjs`       | `npm run harness:report`                  |
| Harness trace grading | `grade-trace.mjs`          | `npm run harness:grade`                   |

---

## Anti-Rationalization Table

| Excuse                          | Counter                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| "I'll add logging later."       | Later never comes. Logging added after the fact misses the context available at write time. |
| "console.log is fine for now."  | No. Winston is two lines. Use it. `console.log` in production is a policy violation.        |
| "The harness already has OTEL." | The harness traces harness runs. Your feature needs its own spans for production calls.     |
| "It's too much overhead."       | A missed correlation ID in production costs hours. Structured logging costs milliseconds.   |

---

## Verification

Instrumentation is complete when:

- [ ] Every new service method logs at entry and on error with correlation ID
- [ ] No `console.log`/`console.error` in new code
- [ ] OTel span or harness record emitted for loop/trace operations
- [ ] Signal verified to emit in local run before merge
- [ ] For harness work, the report/grade path was checked when the change affects loop outputs,
      traces, or evaluation behavior

## Usage Scenarios

### Scenario 1: How do I add Application Insights telemetry to my service?

**What this demonstrates:** Shows Winston logging, Application Insights SDK setup, and custom
metrics

### Scenario 2: I need to debug a production issue. What telemetry should I check?

**What this demonstrates:** Demonstrates correlation IDs, structured logging, and trace analysis
