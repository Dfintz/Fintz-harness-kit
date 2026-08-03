---
summary: "Lesson: Auto-Heal Readiness Workflows"
type: lesson
status: promoted
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [auto-healing, graph-refresh, memory-link, infrastructure-hygiene, observability, automation]
---
# Lesson: Auto-Heal Readiness Workflows

**tags**: auto-healing, graph-refresh, memory-link, infrastructure-hygiene, observability, automation

## Context

The harness maintains several self-healing automated workflows that ensure critical observability and metadata surfaces remain fresh and consistent. These workflows run automatically but also support manual triggers for operators who need to verify state or recover from edge cases.

## Pattern: Three-Tier Auto-Heal Architecture

### Tier 1: Automatic (Background)
- Runs automatically during normal operations
- Examples: Memory-link index auto-builds on first `find` call after deletion; graph self-monitors freshness
- No operator action required
- **Benefit**: Transparent healing; operator never sees stale data

### Tier 2: Manual Trigger (Operator-Initiated)
- Operator explicitly runs a command to refresh/rebuild
- Examples: `npm run harness:graph:refresh` or `npm run harness:memory:links -- rebuild`
- Used when operator suspects staleness or needs to verify healing
- **Benefit**: Deterministic; operator has full control

### Tier 3: Fallback (Emergency Recovery)
- Last resort if auto-heal and manual trigger fail
- Examples: Delete and rebuild from scratch; inspect raw data sources
- Requires operator expertise and understanding of data dependencies
- **Benefit**: Guaranteed recovery path; no hard data loss

## Implementation Checklist

- [ ] Identify surfaces that need auto-healing (observability, metadata, indexes)
- [ ] Implement automatic refresh/rebuild logic (Tier 1)
- [ ] Expose manual trigger commands (Tier 2)
- [ ] Document fallback procedures (Tier 3)
- [ ] Add health status commands to monitor healing state
- [ ] Log healing events for operator visibility
- [ ] Test all three tiers (not just Tier 1)

## Real Example: Graph Freshness

### Tier 1: Automatic
- **How**: `graph-refresh-loop.mjs` runs periodically and detects staleness
- **Trigger**: Time-based interval or commit-based trigger
- **Operator sees**: `harness:graph status` reports "fresh" automatically

### Tier 2: Manual Trigger
- **Command**: `npm run harness:graph:refresh`
- **Output**: Logs refresh progress; reports success/failure
- **Use case**: Operator explicitly wants to refresh without waiting for auto-trigger

### Tier 3: Fallback
- **Procedure**:
  ```bash
  # Delete stale cache
  rm -f .understand-anything/knowledge-graph.json
  # Rebuild from scratch
  npm run harness:graph:refresh -- --force
  ```
- **Data sources**: Graph rebuilds from source files (safe operation)

## Real Example: Memory-Link Index

### Tier 1: Automatic
- **How**: `harness-mcp-tasks find` detects missing index and auto-builds it
- **Output**: `memoryLink.ok=true` and `memoryLink.autoBuilt=true` in response
- **Latency**: First call after deletion is slower (index rebuild)

### Tier 2: Manual Trigger
- **Command**: `npm run harness:memory:links -- rebuild`
- **Output**: Detailed rebuild progress and validation results
- **Use case**: Operator wants explicit verification or pre-warming before queries

### Tier 3: Fallback
- **Procedure**:
  ```bash
  # Delete stale index
  rm -f .understand-anything/intermediate/harness-memory-links.json
  # Trigger manual rebuild
  npm run harness:memory:links -- rebuild --verbose
  ```
- **Data sources**: Rebuilds from `.github/harness/memory/` lessons and briefs (safe operation)

## Status Commands

Always expose a status command for each auto-heal surface:

- `npm run harness:graph status` → shows freshness, last-refresh timestamp, drift from HEAD
- `npm run harness:memory:links -- status` → shows index exists, build timestamp, entry count
- `npm run harness:health -- --fast` → checks multiple surfaces in one pass

## Guidelines

1. **Prefer Tier 1 (Automatic)** — operator should rarely need to think about healing
2. **Document Tier 2** — make manual triggers discoverable via `npm run` help and docs
3. **Test Tier 3** — include fallback procedures in operator runbooks, not just auto-heal code
4. **Transparency**: Log all healing events; don't silently heal without leaving traces
5. **Alerting**: `harness:health` commands should surface stale/unhealthy surfaces early

## Deployment Checklist

- [ ] Automatic healing verified (Tier 1 working as expected)
- [ ] Manual trigger commands tested (Tier 2 succeeds)
- [ ] Fallback procedures documented and tested (Tier 3 walkthrough)
- [ ] Status command shows accurate health info
- [ ] Logs capture healing events for auditing

## Common Pitfalls

- **Over-aggressive auto-heal**: Don't auto-delete user data without explicit safeguard
- **Silent healing**: Always log so operators know something was healed
- **Missing Tier 2**: Manual triggers are essential for testing and operator confidence
- **Unverified fallback**: Don't assume Tier 3 works; test it explicitly

## See Also

- [Credential Deferral and Environment Constraints](#)
- [Release Cycle Closure Checklist](#)
