# Release Notes v3.9.0

Date: 2026-10-13

## Summary

v3.9.0 adds conservative provenance metadata to stdio MCP tool results and a default-off,
bounded command-output retention pilot inspired by the REA techniques radar assessment.
No REA dependency, external skill, or analysis engine is installed.

## Highlights

- Application-level stdio tool successes, continuations, and errors carry untrusted-data provenance.
  Existing execution permissions, memory ACLs, and prompt-as-data boundaries remain authoritative.
- Operators can opt into byte-bounded dispatch previews and redacted, session-local output resources.
  Exact Unicode-safe pages preserve diagnostic tails without rerunning the command.
- Retained output uses full caller fingerprints, opaque server-local references, fresh permission
  checks, five-minute access expiry, and explicit capture/storage limits. It is not publicly listed.
- Fresh configuration snapshots no longer overwrite the default cache; dispatch policy is passed
  explicitly through the existing admission guards.
- The SDK delivery regression is included in the MCP dispatch test aggregate. Radar entries,
  implementation Brief, review adjudications, and operator documentation record the first slices.
- Release preflight requires patched MCP SDK and network-address dependency versions for the
  OAuth credential-disclosure and IP trust-boundary advisories found during isolated installation.

## Validation

Implementation checks passed before release preparation:

- `npm run test:mcp:dispatch`, including `test:mcp:stdio:delivery`
- `npm run test:mcp:stdio:mrtr`
- `npm run harness:config:self-test`
- `npm run test:mcp:memory:acl`
- `npm run harness:docs:check`
- Snyk Code scans reported zero issues for the seven changed first-party JavaScript files.
- Independent Architect Challenge and depth review approved after evidence-backed revisions.

Release preflight additionally passed against an isolated checkout of the exact staged snapshot:

- `npm ci --ignore-scripts` and `npm run test:full`
- Documentation contracts and the direct fast-health entrypoint
- Package/lockfile/catalog version consistency and staged whitespace checks
- npm dependency audit: zero vulnerabilities after the compatible security refresh

Snyk dependency scanning reports one remaining high-severity Zod resource-exhaustion advisory,
`SNYK-JS-ZOD-20510278`. Zod 4.4.3 is unchanged from v3.8.0, and the advisory lists no fixed
version. This finding was not ignored or waived; it remains a dependency risk, especially for
unbounded attacker-controlled array validation. The release is not claimed dependency-vulnerability-free.

## Compatibility And Limits

- Retention stays disabled by default. To use it, explicitly configure
  `commandDispatch.retainedOutput.enabled: true` and supply supported caller bookkeeping.
- The pilot is for one trusted stdio client per server process, not hostile multi-user authentication.
  It does not add command execution permissions or apply to HTTP, async tasks, or standalone CLI output.
- Output retention is memory-only and is lost on server closure/restart. Redaction is best-effort;
  arbitrary or encoded secrets are not guaranteed detectable.
- `responseBytes` bounds serialized results, not the enclosing JSON-RPC frame. Capture overflow
  and timeouts remain partial outcomes. Durable artifacts and other transports are separate follow-ups.
- Existing unrelated static diagnostics remain. Distinct review-model identity was not attested.
- Pre-existing local decision-model bakeoff work and generated artifacts are excluded from this release.
