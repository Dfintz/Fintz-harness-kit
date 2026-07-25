# Architecture Brief: Phase 2 Local Discovery for Runs & Loops

**Status:** ARCHITECTURE APPROVED  
**Phase:** Implementation  
**Resource:** scripts/harness/graph-provider.mjs, harness.config.json, harness.config.schema.json, templates/project-adoption/harness.config.json

---

## Context Sufficiency Check

### 1. Inventory of Artifacts

| Artifact | Content | Owner | Domain |
|----------|---------|-------|--------|
| scripts/harness/graph-provider.mjs | Graph/memory discovery functions, config reading | harness-core | Configuration discovery |
| harness.config.json | Project configuration (models, commands, memory paths) | harness-kit | Harness config |
| harness.config.schema.json | JSON Schema validation for harness.config.json | harness-kit | Config validation |
| templates/project-adoption/harness.config.json | Example config for adopting projects | harness-kit | Project adoption |
| .github/harness/runs/ | Run journals (created by run-loop.mjs) | harness-runs | Telemetry storage |
| .github/harness/loops/ | Loop definitions (JSON) | harness-loops | Workflow definitions |

### 2. Scope Statement

**Scope:** Software / configuration  
**Primary boundary:** Harness core configuration discovery layer (graph-provider.mjs) and project-level configuration (harness.config.json)  
**Secondary boundary:** Consumer tools that currently hard-code paths (run-loop.mjs, harness-report.mjs, etc.)

### 3. Missing Context Check

✅ **No critical missing artifacts** — All Phase 1 implementation patterns are present; this is a known-shape extension.

---

## Core Procedure

### Step 1: Map the Current Shape

**Current owner of runs/loops paths:**
- Hard-coded in individual tool files (run-loop.mjs, run-experiment.mjs, harness-report.mjs, etc.)
- No central discovery or configuration point

**Adjacent artifacts already in place:**
- Phase 1: `discoverLocalGraphs()` — discovers knowledge graphs
- Phase 1: `discoverMemoryDomains()` — discovers lessons/briefs/radar
- Phase 1: `resolveGraphProviderState()` — central hub that returns discovered state
- Config already includes: `graph.localGraphPaths`, `memory.local*Paths` arrays

**Reusable patterns:**
- Discovery function pattern: check configured paths first, then auto-discover common locations
- Fallback priority: explicit config → auto-discovery → defaults
- State aggregation in `resolveGraphProviderState()`

**Consumers:**
- Direct readers: run-loop.mjs, run-experiment.mjs, record-run.mjs, harness-report.mjs, experiment-loop.mjs, harness-evolve.mjs
- Indirect: all tools that import graph-provider.mjs

**Validations in place:**
- None currently for runs/loops paths (but can follow memory domain precedent)

---

### Step 2: Run Architectural Gates

#### Gate 1: Domain / Module Alignment ✅
- **Change:** Add runs/loops discovery to graph-provider.mjs
- **Verdict:** APPROVED — This is the correct owner. graph-provider.mjs is already the central discovery hub for harness state (graphs, memory). Runs and loops are analogous state that should live here.

#### Gate 2: Generality ✅
- **Remove domain nouns:** "discover configurable directories in common locations"
- **Should this apply elsewhere?** YES — Any harness directory that should be project-relocatable should use this pattern
- **Verdict:** APPROVED — Discovery pattern is general and reusable. Phase 2 focuses on runs/loops; Phase 3 can extend to eval-sets, catalog, etc. See scope boundary below.

#### Gate 3: Ownership ✅
- **State owner:** runs/ stores journals created by run-loop.mjs; loops/ stores definitions loaded by run-loop.mjs
- **Decision owner:** graph-provider.mjs (via config) decides where to look
- **Verdict:** APPROVED — graph-provider.mjs is the right owner. It is already the configuration discovery layer for the harness core.

#### Gate 4: Boundary Integrity ✅
- **Responsibility placement:** Discovery (where paths are) ← graph-provider | Consumption (reading/writing) → individual tools
- **Thin delivery surfaces:** graph-provider exports discovery functions; tools call them and use returned paths
- **Verdict:** APPROVED — Boundary is clean. Discovery is a configuration concern; usage is a tool concern.

#### Gate 4b: Isolation / Safety Boundary ✅
- **Could this cross a boundary it should preserve?** NO — runs and loops are internal harness state, not user-facing or permission-sensitive
- **Approval required?** NO — No security, tenancy, or destructive defaults being weakened
- **Verdict:** APPROVED — No safety boundary issues.

#### Gate 5: Reuse ✅
- **First occurrence of runs/loops discovery?** YES for these paths specifically
- **Pattern is duplicated?** YES — The discovery pattern itself is already proven in Phase 1
- **Extract now?** YES — Already extracted in Phase 1 (discoverLocalGraphs, discoverMemoryDomains); extend now
- **Verdict:** APPROVED — Reuse the existing discovery pattern from Phase 1.

---

### Step 3: Design the Change Set

#### Artifacts to Create

**None.** All changes are in existing files that already follow the discovery pattern.

#### Artifacts to Modify

| Path | Change | Why |
|------|--------|-----|
| scripts/harness/graph-provider.mjs | Add `discoverRunsDir(repoRoot, config)` function | Central discovery for runs directory |
| scripts/harness/graph-provider.mjs | Add `discoverLoopsDir(repoRoot, config)` function | Central discovery for loops directory |
| scripts/harness/graph-provider.mjs | Update `resolveGraphProviderState()` to call both discovery functions and populate state | Aggregate discovered paths into state |
| harness.config.json | Add `harness.runs.localPaths` array (default: [".github/harness/runs"]) | Configuration point for adopting projects |
| harness.config.json | Add `harness.loops.localPaths` array (default: [".github/harness/loops"]) | Configuration point for adopting projects |
| harness.config.schema.json | Add schema for `harness.runs.localPaths` (array of strings) | Validate runs configuration |
| harness.config.schema.json | Add schema for `harness.loops.localPaths` (array of strings) | Validate loops configuration |
| templates/project-adoption/harness.config.json | Add example `harness.runs` and `harness.loops` sections | Guide adopting projects |

#### Pseudo-Code / Design

```javascript
// graph-provider.mjs

export function discoverRunsDir(repoRoot, config = {}) {
  // 1. Check configured paths in config.harness?.runs?.localPaths
  // 2. Check default: .github/harness/runs
  // 3. Return { primary: firstFound, all: allDiscovered }
}

export function discoverLoopsDir(repoRoot, config = {}) {
  // Same pattern as discoverRunsDir
  // 1. Check configured paths in config.harness?.loops?.localPaths
  // 2. Check default: .github/harness/loops
  // 3. Return { primary: firstFound, all: allDiscovered }
}

export function resolveGraphProviderState(overrides = {}) {
  // Existing code for graphs and memory...
  
  // Add:
  const runsDir = discoverRunsDir(repoRoot, config);
  const loopsDir = discoverLoopsDir(repoRoot, config);
  
  // Aggregate into state.harness
  state.harness = {
    runs: runsDir,
    loops: loopsDir
  };
  
  return state;
}
```

#### Configuration Shape

```json
{
  "harness": {
    "runs": {
      "localPaths": [".github/harness/runs"]
    },
    "loops": {
      "localPaths": [".github/harness/loops"]
    }
  }
}
```

#### Schema Shape

```json
{
  "harness": {
    "type": "object",
    "properties": {
      "runs": {
        "type": "object",
        "properties": {
          "localPaths": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Paths (relative to repoRoot) to search for runs directory. Checked in order; first found is used."
          }
        }
      },
      "loops": {
        "type": "object",
        "properties": {
          "localPaths": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Paths (relative to repoRoot) to search for loops directory. Checked in order; first found is used."
          }
        }
      }
    }
  }
}
```

---

## Key Decisions

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| Put discovery in graph-provider.mjs, not separate file | Consolidates all harness discovery in one module; follows Phase 1 precedent | Separate discovery module (harder to maintain, splits pattern) |
| Use `harness.runs.localPaths` and `harness.loops.localPaths` | Mirrors structure of memory domain; groups related config; future-proofs for Phase 3 | Flat config like `runsPath`, `loopsPath` (less scalable) |
| Default to `.github/harness/runs` and `.github/harness/loops` | Maintains backward compatibility; matches current hard-coded paths | Custom defaults (breaks existing projects) |
| Return object with `{ primary, all }` from discovery functions | Allows tools to use first found (primary) or list all for diagnostics; follows Phase 1 | Return single path (loses diagnostics) |

---

## Scope & Boundaries

### What This Phase Includes

✅ Discovery for runs directory (.github/harness/runs)  
✅ Discovery for loops directory (.github/harness/loops)  
✅ Configuration in harness.config.json  
✅ Schema validation in harness.config.schema.json  
✅ Template example for adopting projects  
✅ Functions exported for other tools to use  

### What This Phase Explicitly Does NOT Include

❌ Changes to individual tool files (run-loop.mjs, harness-report.mjs, etc.)  
❌ Phase 3 extensions (eval-sets, catalog, understanding, reviews, spotcheck)  
❌ Consumer tool refactoring to use new discovery functions  

**Rationale for exclusions:** This phase establishes the discovery mechanism. Phase 3 can wire tools to use it. This boundary keeps the change set small, reviewable, and testable.

---

## Handoff Contract

### To Implement Stage

**Inputs provided:**
- This brief as the architecture decision record
- Phase 1 implementation as working reference
- Configuration and schema templates

**Implementation must produce:**
- Modified graph-provider.mjs with exported discovery functions
- Updated harness.config.json with new sections
- Updated harness.config.schema.json with schema definitions
- Updated template adoption config
- Verification: Functions export correctly, config parses, state includes runs/loops

### To Review Breadth

**Proof artifacts:**
- Modified files showing clear change scope
- Verification that schema matches config structure
- Tests showing discovery works in default and custom paths

### To Review Depth

**Structural review against brief:**
- Verify functions follow Phase 1 discovery pattern (check configured first, then defaults)
- Verify state aggregation in resolveGraphProviderState() includes both runs and loops
- Verify no breaking changes to existing graph/memory discovery

---

## Assumptions

| Assumption | Justification | Risk |
|-----------|---------------|------|
| Runs and loops are created by harness tools, not user | Current behavior | If adopting projects create custom runs/loops, path discovery will still find them |
| Default paths `.github/harness/runs` and `.github/harness/loops` will not change | Backward compatibility requirement | None (paths are internal; tools can adapt via config if needed) |
| Consumer tools will eventually use discovered paths (Phase 3) | Out of scope for this brief; left for Phase 3 | Consumer tools remain hard-coded until Phase 3; Phase 2 proves discovery works |

---

## DO-NOTs (Guardrails)

❌ Do NOT modify consumer tools (run-loop.mjs, harness-report.mjs, etc.) in this phase  
❌ Do NOT change the default paths from `.github/harness/` (breaks backward compat)  
❌ Do NOT add auto-discovery to non-.github locations (keeps harness structure opaque)  
❌ Do NOT export discovery functions without testing they return correct structures  
❌ Do NOT merge config schema changes without schema validation test  

---

## Success Criteria

1. **Functions export correctly:** `discoverRunsDir()` and `discoverLoopsDir()` callable from other modules
2. **Config parsed correctly:** harness.config.json has `harness.runs.localPaths` and `harness.loops.localPaths` arrays
3. **Schema validates:** harness.config.schema.json matches new config structure
4. **State aggregation works:** `resolveGraphProviderState()` returns `state.harness.{runs, loops}` with discovered paths
5. **Discovery finds default paths:** When no custom config, discovery locates `.github/harness/runs` and `.github/harness/loops`
6. **Discovery respects custom paths:** When config specifies paths, discovery checks them first
7. **Backward compatibility:** All existing code that ignores new config still works
