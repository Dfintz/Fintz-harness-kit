# MCP Integration & Tool Contracts

> **Purpose:** Document how Model Context Protocol (MCP) tools augment the harness workflow without
> replacing the stage machine.  
> **Status:** Adapter pattern (read-only integration, no state mutations)  
> **Principle:** MCP enhances discovery, not control flow

---

## Overview

The AI agent harness uses MCP as an **adapter layer** for evidence gathering, not as a replacement
for the workflow stage machine.

**Canonical Flow:** Understand → Architect → Architect Challenge → Implement → Review Breadth →
Review Depth → Feedback

**MCP Role:** Augment the **Understand** stage with evidence commands that provide component impact
analysis and dependency tracing.

---

## MCP Tool Contracts

### Tool 1: `harness:mcp:find`

**Purpose:** Locate components and files affected by a change

**Invocation:**

```bash
npm run harness:mcp:find -- <component-name-or-pattern>
```

**Inputs:**

- `component`: String pattern (e.g., `SkillRegistry`, `registry.json`, `optimize-skills`)
- `context`: Optional file path for scope (default: workspace root)

**Output:**

```json
{
  "tool": "harness:mcp:find",
  "query": "SkillRegistry",
  "results": [
    {
      "file": "scripts/harness/skill-registry.mjs",
      "line": 1,
      "type": "class_definition",
      "excerpt": "export class SkillRegistry {"
    },
    {
      "file": "scripts/harness/prompt-router.mjs",
      "line": 7,
      "type": "import",
      "excerpt": "import { SkillRegistry } from './skill-registry.mjs';"
    }
  ],
  "matchCount": 7,
  "searchTime": 0.234
}
```

**Use Cases:**

- "Find all imports of `registry.json`" → understand registry consumers
- "Find references to `dspy-bridge.mjs`" → identify optimizer invocation points
- "Find all skill eval sets" → validate eval set completeness

**Contract:**

- Read-only: no file modification
- Returns: file path, line number, match type, code excerpt
- Timeout: <2s per query
- Error handling: Invalid pattern → return empty results, no exception

---

### Tool 2: `harness:mcp:impact`

**Purpose:** Analyze blast radius of changes to identify affected components

**Invocation:**

```bash
npm run harness:mcp:impact -- --files "<path1>,<path2>,..." [--depth 1-3]
```

**Inputs:**

- `files`: Comma-separated paths (e.g.,
  `.github/harness/registry.json, scripts/harness/dspy-bridge.mjs`)
- `depth`: Traversal depth (1 = direct dependents, 2 = transitive, 3 = full closure; default: 2)

**Output:**

```json
{
  "tool": "harness:mcp:impact",
  "input": {
    "files": [".github/harness/registry.json"],
    "depth": 2
  },
  "impactAnalysis": {
    "directDependents": [
      {
        "file": "scripts/harness/prompt-router.mjs",
        "type": "import",
        "reason": "Reads registry for skill routing"
      },
      {
        "file": "scripts/harness/optimize-skills.ps1",
        "type": "reference",
        "reason": "Passes registry entries to dspy-bridge"
      }
    ],
    "transitiveDependents": [
      {
        "file": "npm run harness:route",
        "type": "cli_usage",
        "reason": "CLI entry point that invokes prompt-router"
      },
      {
        "file": ".github/workflows/cicd.yml",
        "type": "ci_reference",
        "reason": "CI pipeline calls harness:route for routing decisions"
      }
    ],
    "layers": ["metadata", "orchestration", "ci-cd"],
    "riskLevel": "medium",
    "riskFactors": [
      "registry.json changes affect routing decisions across all tasks",
      "Transitive impact on CI/CD pipeline routing",
      "Skill discovery depends on registry structure"
    ]
  },
  "analysisTime": 0.567,
  "confidence": "high"
}
```

**Use Cases:**

- "What breaks if we change registry.json?" → cascade impact analysis
- "How does dspy-bridge change affect the workflow?" → dependency graph
- "What layers are impacted by this change?" → layer-based risk assessment

**Contract:**

- Read-only: static analysis only, no execution
- Returns: dependents, impact chain, layers, risk factors
- Timeout: <5s per analysis
- Confidence: high/medium/low based on graph freshness

---

### Provider-status helper: `graph-provider-status`

Use the MCP wrapper/server tool `graph-provider-status` to inspect configured provider mode
(`understand-anything`, `graphify`, `both`), active graph paths, and availability before relying on
graph evidence in an Understand pass.

Use `graph-genui-status` to fetch provider-agnostic `graph.html` serving readiness metadata for HTTP/GenUI consumers.
Use `graph-events` to read structured graph lifecycle events (`refresh.start|refresh.success|refresh.fail|query.fallback|degradation`).

All graph status surfaces now share core contract fields:
`provider`, `activeProviders`, `queryGraphPath`, `refreshReadiness`, `degradationReason`.

---

## Integration with Harness Workflow

### Understand Stage

```
┌──────────────────────────────────────────┐
│ Stage: UNDERSTAND                        │
│ Model: Claude Opus 4.8                   │
│ Skill: understand-process                │
└──────────────────────────────────────────┘
   │
   ├─ 1. Check graph freshness
   │     (→ provider-selected graph snapshot; inspect with `graph-provider-status`)
   │
   ├─ 2. Run /understand-chat on task
   │     (→ graph-based component discovery)
   │
   ├─ 3. [OPTIONAL] Run MCP tools for evidence
   │     ├─ npm run harness:mcp:find (locate components)
   │     └─ npm run harness:mcp:impact (blast radius)
   │
   ├─ 4. Combine findings: graph + MCP evidence
   │
   └─ 5. Output: impacted components, layers, dependencies
```

**When to Use MCP Tools in Understand:**

- ✅ Task touches orchestration files (registry, routing, scripts)
- ✅ Need to validate dependency chains before proposing changes
- ✅ Want to triple-check blast radius before architecture gates
- ❌ NOT needed for isolated component changes (component is self-contained)
- ❌ NOT needed if graph is fresh and complete

---

## MCP Security & Least Privilege

### Permission Model

| Tool     | Read Scope       | Write Scope | Timeout | Notes                                        |
| -------- | ---------------- | ----------- | ------- | -------------------------------------------- |
| `find`   | Entire workspace | None        | 2s      | File path + context only; no secrets exposed |
| `impact` | File graph only  | None        | 5s      | Static analysis; no file content inspection  |

### Threat Model

**Threats Mitigated:**

- ✅ Secret leakage: MCP tools are read-only; no credential exposure
- ✅ State mutation: MCP tools don't modify files or execute code
- ✅ Unauthorized access: Queries must specify component name (no wildcard glob without scope)
- ✅ DoS: Fixed timeouts (2s, 5s) prevent long-running queries

**Threats Out of Scope:**

- ❌ Malicious agent invocation (MCP tools assume trusted caller)
- ❌ Graph poisoning (assumes local knowledge graph is not compromised)

### Best Practices

1. **Audit MCP Results:** Don't blindly trust output; cross-check findings in code
2. **Scope Queries:** Use specific patterns; avoid overly broad searches
3. **Document Assumptions:** If relying on MCP evidence, state assumptions explicitly
4. **Validate Before Committing:** Run MCP tools during Understand; use findings to inform Architect
   decisions

---

## Examples

### Example 1: Registry Change Impact

**Task:** Add new skill to registry and document MCP tool contracts

**Understand Phase:**

```bash
# 1. Find registry consumers
npm run harness:mcp:find -- "registry.json"

# Output: prompt-router, optimize-skills, AGENTS.md, HARNESS.md

# 2. Analyze impact of registry changes
npm run harness:mcp:impact -- --files ".github/harness/registry.json" --depth 2

# Output: routing, skill discovery, CLI entry points all affected
# Risk: Medium (registry change cascades to routing decisions)
```

**Architect Decision:** Registry schema can be extended (v1 → v1.1) if backward-compatible. New
fields ignored by v1 clients.

---

### Example 2: Optimizer Script Changes

**Task:** Modify dspy-bridge.mjs to support new model auto-detection

**Understand Phase:**

```bash
# 1. Find who calls dspy-bridge
npm run harness:mcp:find -- "dspy-bridge.mjs"

# Output: optimize-skills.ps1, dspy-optimize-ollama.py, dspy-optimize.py

# 2. Analyze impact on optimization pipeline
npm run harness:mcp:impact -- --files "scripts/harness/dspy-bridge.mjs" --depth 2

# Output: Optimizer orchestration, eval-set loading, report generation affected
# Risk: Medium (optimizer is critical path for skill optimization workflow)
```

**Architect Decision:** Model auto-detection change is safe if fallback order is preserved and model
names are normalized.

---

## Integration Checklist for Agents

When working with harness-related tasks:

- [ ] Graph freshness checked (if stale, refresh with `/understand`)
- [ ] Understand-chat run on task to map primary components
- [ ] MCP find tool used to locate relevant files (optional but recommended for orchestration
      changes)
- [ ] MCP impact tool used to analyze blast radius (optional but recommended for metadata changes)
- [ ] Evidence documented in Understand stage output (graph status, components, MCP findings)
- [ ] Assumptions flagged if MCP tools unavailable or results unexpected

---

## Troubleshooting

### Issue: "npm run harness:mcp:find not found"

**Cause:** MCP tools not registered in package.json scripts

**Fix:** Ensure `scripts/harness/mcp-tools.mjs` exists and is invoked by npm wrapper

### Issue: MCP find returns 0 results

**Cause:** Pattern too specific or file uses different casing

**Fix:** Broaden pattern, try alternative spellings

### Issue: MCP impact analysis is slow (>5s)

**Cause:** Large dependency graph or high traversal depth

**Fix:** Reduce `--depth` parameter (use 1 for direct deps only)

### Issue: MCP tool output doesn't match my expectations

**Cause:** Graph may be stale or missing some files

**Fix:** Run `/understand --full` to refresh knowledge graph, then retry

---

## Related Documentation

- [HARNESS.md](./HARNESS.md) — Master workflow (MCP adapter policy)
- [OPTIMIZER.md](./OPTIMIZER.md) — Optimizer workflow (uses registry and eval sets)
- [registry.json](./registry.json) — Skill metadata (can be analyzed with MCP find)
- [understand-process skill](../skills/understand-process/SKILL.md) — Graph-based component
  discovery
