---
summary: "Sandbox runs can import evidence through isolated refs or artifacts without mutating the host checkout."
status: parked
source: https://github.com/disler/inkwell-agent-sandboxes-and-software-factory
author_project: disler/inkwell-agent-sandboxes-and-software-factory
captured: 2026-08-10
tags: [sandboxing, artifact-provenance, git, human-approval]
---

# Sandbox Artifact Harvest

## Technique Summary

The source project retrieves sandbox results into a dedicated Git ref rather than merging them
into the host branch. This preserves the run as inspectable evidence and leaves selection and
integration as an explicit human decision.

## Repository Relevance

The harness already owns feature-run manifests, stage artifacts, approval state, and OpenTelemetry
exports. If it later runs agents in isolated environments, their output should enter those existing
evidence surfaces without automatically changing the operator checkout.

## Adoption Notes

- **Target files/domains:** `scripts/harness/prompt-router.mjs` feature-run manifests, `scripts/harness/record-run.mjs`, and a future sandbox-executor adapter.
- **Risks/constraints:** A ref-only import needs deterministic provenance, path containment, and an explicit comparison or merge decision. It must not add Git mutation to ordinary local runs.
- **Next step:** When a concrete isolated-agent execution user story exists, route a provider-neutral artifact-import contract through Understand and Architect.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-10 | candidate | Initial capture from external sandbox-factory assessment | GitHub Copilot |
| 2026-08-10 | parked | Preserve as a future sandbox-output contract; there is no current harness-owned sandbox runtime or operator use case. | GitHub Copilot |