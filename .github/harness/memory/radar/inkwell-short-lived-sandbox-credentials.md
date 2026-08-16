---
summary: "A sandbox should receive only a capped, revocable runtime credential while provisioning credentials remain host-only."
status: parked
source: https://github.com/disler/inkwell-agent-sandboxes-and-software-factory
author_project: disler/inkwell-agent-sandboxes-and-software-factory
captured: 2026-08-10
tags: [sandboxing, credentials, least-privilege, revocation]
---

# Short-Lived Sandbox Credentials

## Technique Summary

The source project separates a long-lived host provisioning credential from a disposable per-run
inference credential. Each sandbox key has a spend cap and is revoked during teardown, so a VM
cannot reuse the host's authority.

## Repository Relevance

The harness enforces API authentication, approval state, and rate limits, but does not currently
provision external execution environments. This is the right credential-boundary policy if that
runtime is introduced; it is not a reason to introduce provider keys or secret-management code now.

## Adoption Notes

- **Target files/domains:** future sandbox-executor configuration, `scripts/harness/mcp-auth-validator.mjs`, run manifests, and operator-facing security documentation.
- **Risks/constraints:** Never persist credentials in journals, manifests, telemetry, or committed memory. Provider-specific minting APIs must stay optional and require a separate threat model.
- **Next step:** When an isolated execution provider is proposed, require capability-scoped credentials, a spend or resource limit, explicit revocation, and teardown verification in its Architecture Brief.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-10 | candidate | Initial capture from external sandbox-factory assessment | GitHub Copilot |
| 2026-08-10 | parked | Record as a mandatory design constraint for any future sandbox provider, not a standalone current feature. | GitHub Copilot |