---
name: setup-harness-bootstrap
description: Adopt the harness in a new repository. Use when initializing stage workflows, skill trees, registry, and validation for a fresh project.
---

# Skill: Setup Harness Bootstrap

> Use when: onboarding or standardizing repository-level agent configuration for issue tracking,
> triage labels, and domain-doc layout.

## Objective

Create or refresh the repository bootstrap docs consumed by workflow and governance skills so agent
behavior remains deterministic across sessions and operators.

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
