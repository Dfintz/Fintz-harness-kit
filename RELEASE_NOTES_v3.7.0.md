# Release Notes v3.7.0

Date: 2026-09-30

## Summary

v3.7.0 adds an offline, review-gated decision calibration workflow, evidence-backed convergence goals, and an HTTP MCP initialization handshake. It also records architecture and research assessments for future harness work.

## Highlights

- Decision evaluation now supports bounded private candidate export, deterministic-only reports, and atomic imports of explicitly reviewed and consented cases. Promotion remains disabled pending independent evidence.
- Convergence loops can publish goal progress with journal-backed check references; conflicting goals and journal write failures do not create completion evidence.
- The HTTP MCP adapter handles `initialize` and initialized notifications, enabling remote HTTP MCP clients to discover harness tools.
- Architect guidance can draft acceptance checks when existing checks do not cover a testable change.
- Additional briefs, review records, and radar notes capture proposed work without enabling new runtime behavior.

## Validation

- `npm run test:harness:core`
- `npm run test:mcp:http:initialize`
- `npm run harness:docs:check`
- `npm run harness:health -- --fast`
