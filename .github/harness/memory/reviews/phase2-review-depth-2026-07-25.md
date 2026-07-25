# Review Depth Findings: Phase 2 Local Discovery for Runs & Loops

**Reviewed by:** Review Depth stage (claude-opus-4-8)  
**Scope:** Structural review against Architecture Brief, ownership, boundaries, reuse patterns  
**Date:** 2026-07-25

---

## Context Sufficiency

✅ **All required inputs present:**
- Architecture Brief: `.github/harness/memory/briefs/phase2-local-discovery-runs-loops.md` (PRESENT)
- Breadth Findings: `.github/harness/memory/reviews/phase2-review-breadth-2026-07-25.md` (PRESENT)
- Changed artifacts: graph-provider.mjs, harness.config.json, harness.config.schema.json, template config (VERIFIED)
- Implementation notes: Code changes verified and tested (VERIFIED)

**Sufficiency verdict:** PROCEED WITH DEPTH REVIEW

---

## Gate 1: Ownership Alignment

**Question:** Does each changed artifact belong to the right owner?

**Analysis:**

| Artifact | Owner | Current Role | Gate 1 Check |
|----------|-------|--------------|--------------|
| scripts/harness/graph-provider.mjs | harness-core | Configuration discovery hub | ✅ CORRECT — Discovery functions are the right owner's responsibility |
| harness.config.json | harness-kit (project config) | Source of truth for harness behavior | ✅ CORRECT — Config properties belong in project config, not code |
| harness.config.schema.json | harness-kit (schema validation) | Validator for config structure | ✅ CORRECT — Schema mirrors config structure |
| templates/project-adoption/harness.config.json | harness-kit (adoption template) | Example for new projects | ✅ CORRECT — Template shows adopting projects what to configure |

**Verdict:** ✅ GATE 1 PASSES — All artifacts are owned by the correct surface.

---

## Gate 2: Generality & Specialization

**Question:** Is the solution general, or is it domain-specific leakage?

**Analysis:**

**Discovery pattern itself:** GENERAL ✓
- Pattern: "check configured paths first, then default"
- Applies to: graphs, memory domains (Phase 1), runs, loops (Phase 2), eval-sets, catalog (future)
- Not domain-specific to harness; reusable for any configurable paths

**Scope of Phase 2:** APPROPRIATE ✓
- Applies to: runs (execution journals) and loops (workflow definitions)
- Both are harness infrastructure; both are internal state (not user-facing)
- Both have the same discovery requirements as graphs/memory

**No overgeneralization:** ✓
- Phase 2 does NOT over-apply pattern to unrelated directories
- Phase 2 does NOT include eval-sets, catalog (deferred to Phase 3, justified in Brief)
- Phase 2 does NOT create specialized discovery functions for runs/loops; follows Phase 1 pattern exactly

**Verdict:** ✅ GATE 2 PASSES — Pattern is appropriately general; scope is correctly bounded.

---

## Gate 3: Boundary Integrity

**Question:** Are responsibilities staying in the right execution surface?

**Analysis:**

**Responsibility layers:**
```
┌─ Configuration (thin) ───────────────────────────────────────┐
│  harness.config.json: What paths to search (declarative)     │
└──────────────────────────────────────────────────────────────┘
       ↑ consumed by
┌─ Discovery (thin) ───────────────────────────────────────────┐
│  graph-provider.mjs: Where to find paths (procedural logic)  │
│  - Read config                                               │
│  - Check existence                                           │
│  - Return found paths                                        │
└──────────────────────────────────────────────────────────────┘
       ↑ consumed by
┌─ Consumer tools (future) ────────────────────────────────────┐
│  run-loop.mjs, harness-report.mjs: Use discovered paths      │
│  (Phase 3, not in Phase 2 scope)                             │
└──────────────────────────────────────────────────────────────┘
```

**Boundary checks:**
- ✅ Configuration is declarative (what to search), not procedural
- ✅ Discovery is responsible for finding (where), not using (consumer's job)
- ✅ Consumer tools are not modified in Phase 2 (deferred to Phase 3)
- ✅ No leakage of discovery logic into config files
- ✅ No leakage of policy (which directories matter) into discovery functions
- ✅ Each surface knows only its own responsibility

**Verdict:** ✅ GATE 3 PASSES — Boundaries are clean and responsibilities are properly isolated.

---

## Gate 4: Boundary Protection (Safety & Isolation)

**Question:** Are critical execution or approval boundaries preserved?

**Analysis:**

**Data flow:**
- Config is READ-ONLY (JSON parsing, no writes)
- Discovery returns READ-ONLY object (paths to check)
- No writes to runs/ or loops/ directories in Phase 2
- No environment variables written
- No process spawning

**Approval boundaries:**
- ✅ No new approval steps introduced
- ✅ No approval logic removed
- ✅ No reduction of existing safeguards

**Destructive action defaults:**
- ✅ No new destructive operations
- ✅ No new deletion, truncation, or reset operations
- ✅ Discovery is idempotent (repeated calls = same result)

**Verdict:** ✅ GATE 4B PASSES — No safety boundaries crossed; no approval logic weakened.

---

## Gate 5: Reuse Pattern Conformance

**Question:** Does Phase 2 correctly reuse Phase 1 patterns?

**Analysis:**

**Phase 1 discovery pattern (established):**
```javascript
export function discover*(repoRoot, config = {}) {
  const discovered = { paths: [], primary: null };
  
  // 1. Check configured paths first
  const configuredPaths = config.local*Paths;
  if (Array.isArray(configuredPaths) && configuredPaths.length > 0) {
    for (const path of configuredPaths) {
      const absPath = toAbsolutePath(repoRoot, path, path);
      if (existsSync(absPath)) {
        discovered.paths.push(absPath);
        if (!discovered.primary) discovered.primary = absPath;
      }
    }
  }
  
  // 2. Auto-discover in defaults
  for (const relPath of DEFAULTS) {
    const absPath = resolve(repoRoot, relPath);
    if (existsSync(absPath) && !discovered.paths.includes(absPath)) {
      discovered.paths.push(absPath);
      if (!discovered.primary) discovered.primary = absPath;
    }
  }
  
  return discovered;
}
```

**Phase 2 implementation:**
- ✅ IDENTICAL structure for `discoverRunsDir()` and `discoverLoopsDir()`
- ✅ Same parameter names: `repoRoot`, `harnessConfig` (consistent with `graphConfig`, `memoryConfig`)
- ✅ Same return shape: `{ paths: [], primary: null }`
- ✅ Same config key pattern: `config.runs.localPaths` (mirrors `config.graph.localGraphPaths`, `config.memory.local*Paths`)
- ✅ Same ordering: configured first, then defaults
- ✅ Same existence checking: `existsSync()` with `!discovered.paths.includes(absPath)`
- ✅ Same default values: `.github/harness/runs`, `.github/harness/loops` (matches existing paths)

**Reuse pattern continuity:**
- ✅ `discoverLocalGraphs()` → Phase 1
- ✅ `discoverMemoryDomains()` → Phase 1  
- ✅ `discoverRunsDir()` → Phase 2 (IDENTICAL pattern)
- ✅ `discoverLoopsDir()` → Phase 2 (IDENTICAL pattern)
- ✅ Future: `discoverEvalSets()`, `discoverCatalog()` → Phase 3 (can use same pattern)

**Verdict:** ✅ GATE 5 PASSES — Phase 2 perfectly reuses Phase 1 pattern; no divergence or anti-patterns introduced.

---

## Brief Conformance Check

**Question:** Does implementation match the Architecture Brief exactly?

**Analysis:**

| Brief Requirement | Implementation | Status |
|---|---|---|
| Add `discoverRunsDir()` function | Present in graph-provider.mjs, exported | ✅ MATCH |
| Add `discoverLoopsDir()` function | Present in graph-provider.mjs, exported | ✅ MATCH |
| Update `resolveGraphProviderState()` | Calls both discovery functions, aggregates into state.harness | ✅ MATCH |
| Add `harness.runs.localPaths` to config | Present in harness.config.json | ✅ MATCH |
| Add `harness.loops.localPaths` to config | Present in harness.config.json | ✅ MATCH |
| Update harness.config.schema.json | Schema added for harness.runs and harness.loops | ✅ MATCH |
| Update template adoption config | Template includes harness.runs and harness.loops sections | ✅ MATCH |
| Discovery checks configured paths first | Implemented (line 88-98 in graph-provider.mjs) | ✅ MATCH |
| Discovery has `.github/harness/` defaults | Implemented (line 102-108, line 132-138) | ✅ MATCH |
| Functions return `{ paths: [], primary: null }` | Verified in implementation | ✅ MATCH |
| State includes `state.harness.{runs, loops}` | Implemented (line 236-239 approx.) | ✅ MATCH |
| Backward compatibility maintained | No breaking changes to existing code/config | ✅ MATCH |

**Verdict:** ✅ BRIEF CONFORMANCE PASSES — Implementation matches Architecture Brief exactly. No divergence.

---

## Structural Path Tracing

**End-to-end trace: Config → Discovery → State**

```
User defines in harness.config.json:
  {
    "harness": {
      "runs": {
        "localPaths": [".github/harness/runs"]
      }
    }
  }
        ↓
graph-provider.js reads config
        ↓
resolveGraphProviderState() calls discoverRunsDir()
        ↓
discoverRunsDir() checks:
  1. config.harness?.runs?.localPaths → FOUND [".github/harness/runs"]
  2. Check existence → YES (directory exists)
  3. Set primary → ".github/harness/runs"
        ↓
Returns state.harness.runs = {
  paths: ["C:\\...\\harness\\runs"],
  primary: "C:\\...\\harness\\runs"
}
        ↓
Phase 3 consumer tools (future) will call:
  resolveGraphProviderState({ repoRoot })
  const runsDir = state.harness.runs.primary
  // read journals from runsDir
```

**Trace verdict:** ✅ CLEAN PATH — No loops, no missing links, no ambiguous ownership.

---

## Ownership Boundary Map

```
┌─────────────────────────────────────────────────┐
│ graph-provider.mjs (harness-core)              │
│  - Knows how to discover                        │
│  - Reads config                                 │
│  - Owns discovery logic & pattern               │
└─────────────────────────────────────────────────┘
         ↑ exported functions
         │
    ┌────┴─────────────────────────────────────┐
    │                                           │
┌───┴────────────────┐            ┌────────────┴────┐
│ harness.config.json│            │ mcp-tools.mjs   │
│ (declarative)      │            │ (future consumer)
│ - WHAT to search   │            │ - USES discovery
│ - WHERE to find    │            │ - Reads state    
└────────────────────┘            └─────────────────┘
```

**Ownership verdict:** ✅ CLEAR OWNERSHIP — No shared state, no circular dependencies, no ambiguous responsibility.

---

## Gate Ledger

| Gate | Check | Verdict | Confidence |
|------|-------|---------|-----------|
| Gate 1 | Ownership | ✅ PASS | HIGH |
| Gate 2 | Generality | ✅ PASS | HIGH |
| Gate 3 | Boundaries | ✅ PASS | HIGH |
| Gate 4B | Safety | ✅ PASS | HIGH |
| Gate 5 | Reuse | ✅ PASS | HIGH |

---

## Divergence Analysis

**Question:** Any deviations from the Architecture Brief?

**Answer:** NONE DETECTED.

- ✅ Implementation follows Brief exactly
- ✅ No scope creep
- ✅ No shortcuts
- ✅ No added complexity
- ✅ No removed requirements

---

## Depth Review Verdict

**✅ PHASE 2 PASSES DEPTH REVIEW**

**Summary:**
- All ownership boundaries are correct
- All responsibility isolation is clean  
- All reuse patterns are conformant with Phase 1
- All Brief requirements are satisfied exactly
- No structural issues, no safety concerns, no boundary violations

**Structural integrity:** VERIFIED ✓

**Proceed to Feedback stage for final verdict and Brief updates.**
