---
summary: Official MCP reference servers are educational conformance examples, not production components to vendor into the harness.
status: rejected
source: https://github.com/modelcontextprotocol/servers
author_project: modelcontextprotocol/servers
captured: 2026-09-24
tags: [mcp, reference, conformance, overlap-scan]
---

# MCP Reference Servers Overlap

## Technique Summary

The official repository demonstrates MCP prompts, resources, tools, filesystem access, Git, memory,
fetching, and protocol edge cases. Its README explicitly directs production discovery to the MCP
Registry and warns that these servers are educational examples requiring an application-specific
threat model.

## Repository Relevance

Harness-kit is itself an MCP server and already validates stdio resources, streaming, and MRTR
continuation through the official SDK client. OAuth and subscriptions have raw HTTP contract tests.
Importing the Everything server or archived integrations would add a parallel sample runtime rather
than improve an identified local contract.

## Adoption Notes

- **Target files/domains:** none for direct adoption; use the upstream repository as protocol
  reference evidence when a specific compatibility failure appears.
- **Risks/constraints:** Reference code is not a production security baseline; archived servers are
  superseded; copying samples can create version drift.
- **Next step:** None until a named MCP feature fails local SDK-client or HTTP contract tests.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured from the requested official reference-server repository. | breadth-repair |
| 2026-09-24 | rejected | Existing local tests cover the relevant client/server contracts and no missing feature was identified. | radar-triage |
