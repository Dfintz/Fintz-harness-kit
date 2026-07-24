---
summary: MCP server fails to start with ERR_MODULE_NOT_FOUND because @modelcontextprotocol/sdk is an optionalDependency never installed by default on a fresh clone
type: lesson
status: promoted
source: human
reviewed_by: radar-pass
created: 2026-07-24
updated: 2026-07-24
tags: [mcp, setup, npm, dependencies]
---

# MCP server fails to start — @modelcontextprotocol/sdk not installed

- **Context:** Running `npm run harness:mcp:server` or using the harness MCP server in VS Code after a fresh clone.
- **Symptom:** `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@modelcontextprotocol/sdk'` on startup. VS Code MCP panel shows the server as failed/not connected.
- **Cause:** `@modelcontextprotocol/sdk` is declared as an `optionalDependency` in `package.json`. Some npm versions skip optional deps on install, and a repo without a `node_modules/` directory will always be missing it until `npm install` is run. The `.gitignore` excludes `node_modules/`, so the package is never committed.
- **Fix / approach that worked:** Run `npm install` in the repo root. This installs all dependencies including optional ones. The MCP server starts cleanly after that.
- **Why it matters:** Every new clone or CI environment will hit this. The SETUP.md should mention `npm install` as a required first step before using the MCP server. The error message does not hint at the optional-dep root cause.
