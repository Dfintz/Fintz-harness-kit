# MCP Command Dispatch for Adopting Projects

## Overview

The harness-kit exposes `harness-command-dispatch`, an MCP tool that allows external projects to invoke commands defined in a project's `harness.config.json`. This enables cross-project command orchestration without creating new scripts or deployments.

## Quick Start

### 1. Define Commands in Your Project

Add command definitions to your `harness.config.json`:

```json
{
  "commands": {
    "lint": "npm run lint",
    "test": "npm test",
    "build": "npm run build",
    "typeCheck": "npm run type-check",
    "format": "prettier --write .",
    "pressure-test": "npm run test:e2e"
  }
}
```

### 2. Invoke via MCP

Call the `harness-command-dispatch` tool from any MCP-compatible client:

```bash
# Example: Using the Harness MCP CLI
mcp call harness-kit harness-command-dispatch --command lint

# Example: Using mcp-cli (if available)
npx mcp-cli call harness-kit harness-command-dispatch --command lint
```

**⚠️ Timeout Configuration:** The default timeout is 30 seconds. If your test suite, build, or other command runs longer, **you must configure a longer timeout** in `harness.config.json` before your first invocation:

```json
{
  "commandDispatch": {
    "timeoutMs": 120000
  }
}
```

### 3. Expected Response

**Success Case (exit code 0):**
```json
{
  "ok": true,
  "command": "lint",
  "commandResolved": "npm run lint",
  "exitCode": 0,
  "stdout": "✓ Linting passed (42 files checked)",
  "stderr": "",
  "elapsedMs": 2156,
  "timeout": 30000,
  "status": "success"
}
```

**Command Not Found:**
```json
{
  "ok": false,
  "error": "Command 'foo' not found or is not a string in harness.config.json",
  "availableCommands": ["lint", "test", "build", "typeCheck", "format", "pressure-test"],
  "status": "error"
}
```

**Timeout Case (default 30s):**
```json
{
  "ok": false,
  "command": "test",
  "commandResolved": "npm test",
  "exitCode": -1,
  "stdout": "Running 42 tests...",
  "stderr": "Command timed out after 30000ms",
  "elapsedMs": 30000,
  "timeout": 30000,
  "status": "timeout",
  "error": "Command timed out after 30000ms"
}
```

**Non-Zero Exit (command ran but failed):**
```json
{
  "ok": false,
  "command": "test",
  "commandResolved": "npm test",
  "exitCode": 1,
  "stdout": "Running 42 tests...",
  "stderr": "Test suite failed:\n  - Error in src/utils/helpers.test.ts",
  "elapsedMs": 5234,
  "timeout": 30000,
  "status": "exit-nonzero",
  "error": null
}
```

## Configuration

The harness-kit defines default configuration in `harness.config.json`:

```json
{
  "commandDispatch": {
    "enabled": true,
    "timeoutMs": 30000,
    "auditPath": ".github/harness/runs/command-dispatch.jsonl"
  }
}
```

### Customizing in Your Project

Override these values in your project's `harness.config.json`:

```json
{
  "commandDispatch": {
    "enabled": true,
    "timeoutMs": 60000,
    "auditPath": ".github/harness/logs/command-audit.jsonl"
  },
  "commands": {
    "lint": "npm run lint",
    "test": "npm test"
  }
}
```

**Configuration Fields:**
- `enabled` (boolean): Whether command dispatch is active. Default: `true`
- `timeoutMs` (number): Command execution timeout in milliseconds. Default: `30000` (30 seconds)
- `auditPath` (string): Path to immutable JSONL audit log. Default: `.github/harness/runs/command-dispatch.jsonl`

## Audit Trail

Every command execution is logged to an immutable JSONL file (one JSON object per line). This provides:
- **Compliance**: Immutable record of all harness commands invoked
- **Debugging**: Inspect exit codes, stdout/stderr, and timing
- **Observability**: Track command success rates and performance

**⚠️ Security Note:** Audit logs capture command stdout/stderr. Do not define harness commands that output secrets (API keys, credentials, tokens). Use environment variables or secure credential managers instead. The audit trail is append-only and intended for operator debugging.

**Audit Record Schema:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "at": "2026-02-04T18:30:45.123Z",
  "command": "test",
  "commandResolved": "npm test",
  "exitCode": 0,
  "stdout": "✓ All tests passed (42/42)",
  "stderr": "",
  "elapsedMs": 8234,
  "timeout": 30000,
  "status": "success",
  "error": null
}
```

**Example: Query Audit Trail**
```bash
# Count successful lint runs
jq 'select(.command=="lint" and .status=="success") | .id' .github/harness/runs/command-dispatch.jsonl | wc -l

# Find slow tests (> 10s)
jq 'select(.command=="test" and .elapsedMs > 10000)' .github/harness/runs/command-dispatch.jsonl

# List all failed commands with timestamps
jq 'select(.ok == false) | {at, command, status, exitCode}' .github/harness/runs/command-dispatch.jsonl

# Find commands that timed out
jq 'select(.status == "timeout")' .github/harness/runs/command-dispatch.jsonl

# Export to CSV for analysis
jq -r '[.at, .command, .status, .exitCode, .elapsedMs] | @csv' .github/harness/runs/command-dispatch.jsonl > audit-report.csv
```

## Timeout and Error Handling

### Timeout Behavior

If a command exceeds `timeoutMs`, execution is terminated and a timeout response is returned:

- Partial stdout is included in the response (useful for debugging)
- `elapsedMs` will equal (or slightly exceed) `timeoutMs`
- Status: `"timeout"`
- ok: `false`

### Increasing Timeout

For long-running commands (e.g., integration tests), increase the timeout:

```json
{
  "commandDispatch": {
    "timeoutMs": 120000
  },
  "commands": {
    "test": "npm run test:integration"
  }
}
```

### Error Taxonomy

The tool returns one of the following statuses:

| Status | Meaning | ok | Error Handling |
|--------|---------|----|----|
| `"success"` | Exit code 0 | `true` | N/A — command succeeded |
| `"exit-nonzero"` | Exit code 1+ | `false` | Check `exitCode` and stderr for failure details |
| `"timeout"` | Command exceeded timeoutMs | `false` | Increase timeout or optimize command speed |
| `"error"` | Command spawn/execution failed | `false` | Check `error` field for spawn error (e.g., "command not found") |

## Adoption Checklist

- [ ] Define `commands` in your `harness.config.json` (lint, test, build, typeCheck, etc.)
- [ ] Optionally customize `commandDispatch.timeoutMs` for your project
- [ ] Optionally customize `commandDispatch.auditPath` for your audit retention policy
- [ ] Test locally: `mcp call harness-kit harness-command-dispatch --command lint`
- [ ] Verify audit log is created at `.github/harness/runs/command-dispatch.jsonl`
- [ ] Integrate into your MCP client (GitHub Copilot, Claude, automation workflows, etc.)
- [ ] Add `.github/harness/runs/` to `.gitignore` if you don't want audit logs in version control

## Troubleshooting

### Command Not Found

**Error:** `Command 'foo' not found or is not a string in harness.config.json`

**Solution:**
1. Check that `commands.foo` exists in `harness.config.json`
2. Use the `availableCommands` list in the error response to see what's available
3. Verify the command string is a valid shell command

### Timeout

**Error:** `Command timed out after 30000ms`

**Solution:**
1. Increase `commandDispatch.timeoutMs` in `harness.config.json`
2. Optimize your command (e.g., run tests in parallel)
3. Break large commands into smaller steps

### Audit File Not Created

**Error:** `.github/harness/runs/command-dispatch.jsonl` doesn't exist

**Solution:**
1. Check that `.github/harness/runs/` directory is writable
2. Verify no permission errors in MCP server logs
3. Run at least one successful command to trigger audit creation

### High-Volume Audit Trail

**Issue:** `.github/harness/runs/command-dispatch.jsonl` grows very large

**Solution:**
1. Archive old audit logs (e.g., weekly rotation)
2. Consider using a shorter `auditPath` name and rotating files
3. Example rotation script:
   ```bash
   # Rotate audit log weekly
   if [ -f .github/harness/runs/command-dispatch.jsonl ]; then
     mv .github/harness/runs/command-dispatch.jsonl \
        .github/harness/runs/command-dispatch-$(date +%Y%m%d).jsonl
   fi
   ```

## Design Decisions

### Why Whitelist-Only Command Execution?

The `harness-command-dispatch` tool only executes commands explicitly defined in `harness.config.json`. This prevents:
- Command injection attacks
- Accidental execution of arbitrary shell commands
- Exposure of internal tools or credentials

Commands must be fully resolved at config time — no templating or variable substitution.

### Why Immutable Audit Trail?

Audit trails are append-only JSONL, never modified or deleted. This ensures:
- Compliance: Record of all executions for regulatory/security review
- Debugging: Full history to trace when/why commands were run
- Observability: Detect patterns (e.g., repeated failures) over time

### Why MCP?

MCP (Model Context Protocol) is the standard interface for tool dispatch in AI agents. By exposing `harness-command-dispatch` as an MCP tool, the harness integrates with:
- GitHub Copilot and Claude agents
- Custom MCP clients
- Automation workflows (CI/CD, orchestration)
- Multi-agent systems

## Examples

### Example 1: Lint Check in a Review Workflow

```bash
mcp call harness-kit harness-command-dispatch --command lint
```

Uses the `lint` command from `commands.lint` in your project's `harness.config.json`.

### Example 2: Run Tests with Custom Timeout

Modify your `harness.config.json`:
```json
{
  "commandDispatch": {
    "timeoutMs": 120000
  },
  "commands": {
    "test": "npm run test:all"
  }
}
```

Then invoke:
```bash
mcp call harness-kit harness-command-dispatch --command test
```

### Example 3: Pressure-Test in Architect Stage

The harness `architect` skill now has access to the `pressure-test` command via MCP dispatch:

```bash
mcp call harness-kit harness-command-dispatch --command pressure-test
```

This resolves the original issue: "The optional pressure-test command referenced by the prompt was unavailable in this repo path."

## FAQ

**Q: Can I use environment variables in command strings?**
A: No — commands are resolved statically from `harness.config.json`. Use shell expansion if needed (e.g., `"echo $HOME"` will expand at runtime).

**Q: What if a command takes longer than my timeout?**
A: The process is terminated and a timeout response is returned. Increase `timeoutMs` or optimize your command.

**Q: Who has access to command dispatch?**
A: Any MCP client that connects to the harness MCP server. Secure your MCP transport (stdio, TCP, etc.) appropriately.

**Q: Can I audit who ran which commands?**
A: Yes — check the audit trail in `.github/harness/runs/command-dispatch.jsonl`. Include the timestamp and executor context for full accountability.

**Q: How do I delete audit logs?**
A: Manually delete or archive `.github/harness/runs/command-dispatch.jsonl` as part of your log retention policy. The tool will recreate the file on the next command invocation.

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review the audit trail for command details
3. Consult the [harness-kit documentation](../../README.md)
4. Open an issue on the harness-kit repository
