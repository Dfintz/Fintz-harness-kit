---
status: implemented
date: 2026-07-28
stage: Architect
brief_type: Feature
ownership: harness-team
artifact_family: architect
immutability: frozen
immutable_since: 2026-08-04
---

# Architecture Brief: MCP Command Dispatch Server

## Objective

Enable cross-repo harness command delivery via MCP by adding a new tool `harness-command-dispatch` to the existing MCP stdio server. This allows adopting projects to invoke harness commands (lint, test, build, typeCheck, etc.) through an MCP client without direct CLI execution.

**Outcome:** Adopting repositories can run: `mcp call harness-kit harness-command-dispatch --command lint` and get deterministic, auditable command execution.

---

## Scope & Constraints

### In Scope
- New MCP tool `harness-command-dispatch` with command resolution from harness.config.json
- Command execution via `spawnSync` with captured stdout/stderr
- Structured response (exitCode, stdout, stderr, commandResolved)
- Audit logging to `.github/harness/runs/command-dispatch.jsonl`
- MCP schema definition and tool registration
- Adoption guide documentation

### Out of Scope
- Real-time streaming command output (Phase 2 candidate)
- Remote command execution (security gate required)
- Cross-project shared credentials/auth (Phase 2)
- GUI/dashboard for command dispatch (Phase 3)

### Constraints
- No mutation of adopting project's harness.config.json during dispatch
- Must respect command timeouts (configurable, default 30s)
- Command must exist in harness.config.json (fail-safe: no fallback aliases)
- Audit trail preserved for all invocations (immutable .jsonl)
- Backward compatible: existing MCP tools unaffected

---

## Decision 1: Command Dispatch Architecture

**Decision:** Implement as a **stateless single-tool model** with command name → harness.config.json lookup.

**Rationale:**
- Minimal attack surface (no command aliases, no templating)
- Deterministic: command name must exist in adopting project's config
- Reuses existing config validation (harness.config.json schema)
- Audit-friendly (every dispatch logged with resolved command + args)

**Alternatives Rejected:**
1. Template-based dispatch (e.g., `harness-command-dispatch --template test-suite --filter unit`) — too complex for Phase 1
2. Credential-scoped dispatch (e.g., per-user token) — security gate required; defer to Phase 2

---

## Decision 2: Error Handling & Timeout

**Decision:** Use existing MCP error taxonomy; add two new codes:
- `COMMAND_NOT_FOUND (-32603)`: Command name not in harness.config.json
- `COMMAND_TIMEOUT (-32603)`: Execution exceeded timeout (default 30s)

**Rationale:**
- Reuses existing 4-core taxonomy (existing guard rails)
- Timeout prevents runaway processes (esp. over MCP stdio)
- Audit logging captures timeout + command for post-hoc analysis

**Timeout Strategy:**
- Default: 30 seconds (MCP stdio responsiveness)
- Configurable via `harness.config.json` under `commandDispatch.timeoutMs`
- Logged: timeout value + elapsed time in audit record

---

## Decision 3: Audit Trail

**Decision:** Log all dispatch requests + responses to `.github/harness/runs/command-dispatch.jsonl` (JSONL format, one record per line).

**Record Schema:**
```json
{
  "id": "cmd-dispatch-1234567890-uuid",
  "at": "2026-07-28T12:00:00.000Z",
  "caller": "remote-repo:mcp-client",
  "command": "lint",
  "commandResolved": "npm run lint",
  "args": [],
  "exitCode": 0,
  "stdout": "✓ lint passed",
  "stderr": "",
  "elapsedMs": 1234,
  "status": "success"
}
```

**Rationale:**
- Aligns with existing handoff telemetry pattern (.github/harness/runs/handoffs.jsonl)
- Immutable audit for compliance + debugging
- Searchable for command usage analytics
- Fits existing memory/telemetry surfaces

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture** | Stateless single-tool dispatch | Minimal attack surface, deterministic behavior |
| **Command Lookup** | Read from adopting project's harness.config.json | Decentralized config, no shared registry |
| **Error Model** | MCP error taxonomy + 2 new codes | Reuse guardrails, specific failure modes |
| **Timeout** | 30s default, configurable | MCP stdio responsiveness + runaway prevention |
| **Audit Trail** | `.github/harness/runs/command-dispatch.jsonl` | Immutable, aligns with harness telemetry pattern |

---

## Design: Implementation Strategy

### Phase 1a: MCP Tool Addition (MVP)

**File: `scripts/harness/mcp-contracts.mjs`**
- Add `harness-command-dispatch` to `mcpToolSpecs` array
- Schema: `{ command: string (required) }`
- Description: "Dispatch a harness command (lint, test, build, etc.) defined in harness.config.json"

**File: `scripts/harness/mcp-server.mjs`**
- Add handler in `handleCallTool` for `harness-command-dispatch`
- Resolve command from adopting project's harness.config.json
- Execute via `spawnSync` with timeout
- Return: `{ exitCode, stdout, stderr, commandResolved, elapsedMs }`

**File: `scripts/harness/mcp-tools.mjs`**
- Add `commandDispatch(command)` function
- Load config, resolve command string, spawn, capture output
- Return structured response

### Phase 1b: Audit & Configuration

**File: `harness.config.json` (schema + template)**
```json
{
  "commandDispatch": {
    "enabled": true,
    "timeoutMs": 30000,
    "auditPath": ".github/harness/runs/command-dispatch.jsonl"
  }
}
```

**File: `scripts/harness/mcp-audit.mjs` (new)**
- Append dispatch record to .jsonl after each call
- Immutable; never truncate
- Called by mcp-server.mjs after tool execution

### Phase 1c: Adoption Documentation

**File: `.github/ADOPTION-MCP-COMMANDS.md` (new)**
- Quick start: How to wire adopting project's MCP client
- Example: `mcp call harness-kit harness-command-dispatch --command lint`
- Command reference: All available commands
- Timeout & error handling reference

---

## Deliverables (Phase 1a)

| File | Change | LOC | Rationale |
|------|--------|-----|-----------|
| `mcp-contracts.mjs` | Add tool spec | +15 | Schema definition |
| `mcp-server.mjs` | Add handler | +25 | Tool invocation & error handling |
| `mcp-tools.mjs` | Add `commandDispatch()` | +40 | Command resolution & execution |
| `mcp-audit.mjs` | New file | +60 | Audit trail logging |
| `.github/ADOPTION-MCP-COMMANDS.md` | New file | +80 | User-facing docs |
| `harness.config.json` | Add `commandDispatch` section | +10 | Configuration template |

**Total:** ~230 LOC + documentation

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Command injection via malformed command name | HIGH | Whitelist: command must exist in harness.config.json; no templating allowed |
| Timeout prevents long-running tests | MEDIUM | Make timeout configurable in harness.config.json; log timeout + elapsed |
| Audit file grows unbounded | MEDIUM | Implement rotation (e.g., 1MB roll → archive) in Phase 1b |
| Remote MCP clients spam commands | MEDIUM | Rate limiting deferred to Phase 2; audit trail enables post-hoc analysis |
| Cross-project config conflicts | LOW | Each project has own harness.config.json; no shared registry in Phase 1 |

---

## Success Criteria

1. ✅ `harness-command-dispatch` tool is callable via MCP stdio
2. ✅ Command resolution from harness.config.json works (positive + negative test cases)
3. ✅ Timeout enforcement tested (30s default, configurable)
4. ✅ Audit trail in .jsonl format, searchable, no data loss
5. ✅ Documentation covers adoption workflow (quick start + examples)
6. ✅ No breaking changes to existing MCP tools or harness CLI

---

## Phase 2 Candidates (Out of Scope)

- Real-time streaming output (resource_chunk protocol)
- Rate limiting + quota management
- Cross-project shared command registry
- Remote auth/credential scoping
- Command template expansion
- GUI for command history/replay

---

## Approval Boundaries

**Approver:** harness-team

**Approval Gates:**
1. Code review: All tool + audit code follows existing style (mcp-tools.mjs, mcp-server.mjs)
2. Testing: Unit tests for command dispatch (positive/negative/timeout cases)
3. Documentation: Adoption guide is complete and examples are runnable
4. Safety: Audit logging is immutable and all dispatch events are captured

