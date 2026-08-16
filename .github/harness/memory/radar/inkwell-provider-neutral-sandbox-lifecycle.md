---
summary: "Explicit mount, execute, observe, harvest, and human-approved teardown phases are a reusable sandbox lifecycle shape."
status: parked
source: https://github.com/disler/inkwell-agent-sandboxes-and-software-factory
author_project: disler/inkwell-agent-sandboxes-and-software-factory
captured: 2026-08-10
tags: [sandboxing, lifecycle, observability, human-approval]
---

# Provider-Neutral Sandbox Lifecycle

## Technique Summary

The source project treats environment creation, task execution, observation, artifact retrieval,
and teardown as separate, recoverable lifecycle phases. Teardown is deliberately an explicit human
action so the sandbox remains available as evidence until its result is accepted or discarded.

## Repository Relevance

The harness already has bounded loops, leases, workflow journals, OpenTelemetry export, and human
approval markers. A future executor should map its lifecycle into those surfaces rather than import
the source project's `just`, `exe.dev`, OpenRouter, Bun, or Python implementation.

## Adoption Notes

- **Target files/domains:** `scripts/harness/lease-envelope.mjs`, `scripts/harness/record-run.mjs`, `.github/harness/runs/`, `scripts/harness/otel-export.mjs`, and a future provider-neutral executor interface.
- **Risks/constraints:** Full lifecycle ownership would change the kit from an operating-contract toolkit into an execution runtime. Provider-specific setup, networking, teardown, cost control, and recovery require a concrete operator use case and threat model.
- **Next step:** Revisit only when users need isolated, parallel, or unattended agent runs. Start with an Architecture Brief for a minimal executor contract and one opt-in provider.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-10 | candidate | Initial capture from external sandbox-factory assessment | GitHub Copilot |
| 2026-08-10 | parked | Keep as reference architecture; do not adopt the provider runtime or its toolchain without a current use case. | GitHub Copilot |