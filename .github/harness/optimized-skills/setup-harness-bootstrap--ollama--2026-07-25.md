---
name: setup-harness-bootstrap
description: Adopt the harness in a new repository. Use when initializing stage workflows, skill trees, registry, and validation for a fresh project.
---

# Skill: Setup Harness Bootstrap

> Use when: onboarding or standardizing repository-level agent configuration for issue tracking,
> triage labels, and domain-doc layout.

## Objective

**Bootstrap harness adoption**: Initialize and configure the stage workflow, registry, and validation
gates so agent behavior is deterministic and repeatable. Adoption requires establishing the complete
stage structure, documentation, and monitoring — not just a partial setup. Success means new operators
can follow the same harness workflow without special knowledge.

---

## Recommended Models (Phase 5)

**Tier:** High-Reasoning  
**Primary:** `claude-opus-4-8` (Methodical Procedural Logic)  
**Fallback 1:** `gemini-3.6-flash` (Prototyping Bootstrap)  
**Fallback 2:** `gpt-5.5` (Procedural Guidance)  
**Fallback 3:** `claude-haiku-4-5` (Universal Safety Net)

**Why?** Bootstrap requires methodical step-by-step logic and detailed procedural guidance. Opus 4.8 excels at procedural workflows. Alternative: Gemini 3.6 Flash for prototyping bootstrap faster. Maintained +145.0% improvement. Phase 5 validation: stable structured initialization.

---

## Process

### 1. Explore Current State

Check these locations before proposing changes:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/harness/HARNESS.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`
- `docs/agents/domain.md`
- `.github/ISSUE_TEMPLATE/*.yml` (for label alignment)

### 2. Confirm Three Bootstrap Decisions

Capture and confirm these settings:

- Issue tracking mode:
  - `github` (default for this repository)
  - `local-markdown`
  - `other`
- Triage label vocabulary:
  - canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`
  - allow repo-specific aliases if they already exist
- Domain-doc layout:
  - `single-context` (root-level docs)
  - `multi-context` (context map + per-surface docs)

### 3. Write Bootstrap Docs

Update or create:

- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`
- `docs/agents/domain.md`

Keep each file concise and operational (what to do, where to read/write, guardrails).

#### Hierarchical AGENTS.md (large projects)

Adapted from [oh-my-openagent `/init-deep`](https://github.com/code-yeongyu/oh-my-openagent).

For projects with multiple modules or significant domain boundaries, supplement the root `AGENTS.md`
with directory-level and component-level files:

```
project/
├── AGENTS.md              ← project-wide harness entry point
├── src/
│   ├── AGENTS.md          ← src-specific constraints and conventions
│   └── payments/
│       └── AGENTS.md      ← domain-specific rules (owns payment schema)
```

Each file should contain only what is specific to that scope — no duplication of parent content.
Agents automatically load the AGENTS.md closest to their current working files. This reduces
context bloat: a component-level agent loads component constraints, not the full project context.

Create hierarchical AGENTS.md files only when a directory has genuinely different constraints
from its parent (different domain ownership, different coding conventions, different tools).

### 4. Keep Harness Registry Aligned

Ensure `.github/harness/registry.json` includes this skill with triggers for:

- bootstrap setup
- issue tracker mode
- triage labels
- domain doc layout

### 5. Deterministic Validation

Run:

- `npm run harness:skills:validate`

If docs were changed, run markdown diagnostics and fix broken links or malformed headings.

## Guardrails

- Do not modify product runtime code while running this skill.
- Do not create duplicate governance sections when one already exists; update in place.
- Do not invent labels that conflict with established issue templates without documenting aliases.

## Usage Scenarios

### Scenario 1: How do I initialize the harness for a new project?

**What this demonstrates:** Shows harness setup: registry, skills tree, workflows, validation

### Scenario 2: What documentation should I set up for issue-tracking mode?

**What this demonstrates:** Demonstrates issue template setup, label configuration, and routing

