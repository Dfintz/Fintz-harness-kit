# Architecture Brief: Deferred Harness Improvements (4 Tasks)

**Date:** 2026-07-20  
**Status:** Architect → Implement  
**Resource:** `HARNESS.md`, `registry.json`, `harness-evolve.mjs`, `scripts/harness/evolve-guard.mjs`, `.github/MCP-INTEGRATION.md` (new)

---

## Overview

Four deferred harness improvements, all safe-to-integrate and non-blocking to existing functionality:

1. **Documentation audit** — HARNESS.md loop table + registry.json fixes (cosmetic + completeness)
2. **Held-in/held-out acceptance rule** — component-count split + 6 self-tests (operational; opt-in)
3. **Final harness review** — 4 minor fixes (polish)
4. **sc-fleet-manager sync** — resolve non-fast-forward merge conflict (git operations)

All 4 are independent. No data migration, no breaking changes, no guardrail modifications.

---

## Task 1: Documentation Audit

### Scope
- **File:** `HARNESS.md`
  - Update workflow stage diagram (lines ~100–110): currently shows stages 0–4 (5 stages); should show 0–6 (7 stages)
  - Update "Workflow Stage Machine" prose: clarify that all 7 stages exist (Understand → Architect → Implement → Review Breadth → Review Depth → Feedback)
  - Fix loop count in "Skill Routing" section: currently says "7 loops", actually 12 loops (harness-evolve, validation, ci-green, review-fix, feature-cycle, test-fix, build-fix, type-check-fix, lint-fix, _template, plus 2 others)

- **File:** `registry.json`
  - Verify `mcpTools` array is present and populated with actual MCP tool references (if any exist)
  - Ensure all entrypoints and workflow stages are documented

- **File:** `.github/MCP-INTEGRATION.md` (new)
  - Create stub documenting how MCP tools are surfaced in the harness (if applicable)
  - Link to `registry.json` for machine-readable index

### Decisions
- **No rewrite.** Update existing sections; keep tone and audience consistent with current HARNESS.md.
- **Keep examples generic.** The harness kit is project-agnostic; do not bake in sc-fleet-manager examples.
- **Preserve loop definitions.** Do not modify actual loop JSON files; only update counts and references in docs.

### Constraints & Do-NOTs
- ❌ Do NOT modify loop JSON files themselves
- ❌ Do NOT change skill routing policy or model assignments
- ❌ Do NOT introduce new workflow stages
- ❌ Do NOT remove backward compatibility (e.g., CLAUDE.md adapters)

---

## Task 2: Held-in/Held-out Acceptance Rule

### Scope
- **File:** `scripts/harness/harness-evolve.mjs`
  - Add three functions: `extractConfidenceValues()`, `computeSplitScores()`, `applyAcceptanceRule()`
  - Purpose: Prevent noise-ratcheting where a single lucky improvement on a partial metric gets kept as "best-so-far"
  - Implementation: Component-count split (first-half / second-half markers in loop history) + median confidence vote

- **Logic:**
  1. Extract confidence values from all loop iterations (e.g., "pass count" / "total checks")
  2. Split iterations into held-in (first N/2) and held-out (second N/2) groups
  3. Compute average confidence for each group
  4. Apply acceptance threshold: only keep improvement if held-out confidence ≥ held-in confidence (≥50th percentile)
  5. Add 6 self-tests validating split computation and threshold logic

### Decisions
- **Opt-in.** Do NOT enable by default; requires explicit `--acceptance-rule` flag or loop config option.
- **Non-destructive.** If acceptance rule fails, fall back to standard keep-if-improved behavior.
- **Self-contained.** All logic in harness-evolve.mjs or a companion helper; no external dependencies.

### Constraints & Do-NOTs
- ❌ Do NOT modify FORBIDDEN_GLOBS or evolve-guard.mjs integrity checks
- ❌ Do NOT change loop JSON schema or alter existing loops
- ❌ Do NOT break backward compatibility (must remain opt-in)

---

## Task 3: Final Harness Review

### Scope
Four minor fixes (exact list TBD; likely includes):
- Self-test count update in harness-evolve.mjs (banner count)
- Stale comments or outdated prose in LOOPS.md or HARNESS.md
- Algorithm description refinements
- Minor typos or formatting

### Decisions
- **Low-risk changes.** No functional impact; documentation and code polish only.
- **Preserve naming conventions.** Keep kebab-case, existing code style.

### Constraints & Do-NOTs
- ❌ Do NOT refactor large sections
- ❌ Do NOT alter loop or harness behavior
- ❌ Do NOT introduce new dependencies

---

## Task 4: sc-fleet-manager Sync

### Scope
- **Situation:** sc-fleet-manager master is behind the remote (commit 907008e7a from sc-fleet-harness-kit has not been pushed)
- **Error:** `git push scfm master` rejected with non-fast-forward
- **Root cause:** sc-fleet-manager has local diverged commits (not descended from 907008e7a)

### Resolution Strategy
1. Check sc-fleet-manager git log to understand divergence
2. Either:
   - Option A: Rebase sc-fleet-manager onto the latest sc-fleet-harness-kit master
   - Option B: Merge sc-fleet-harness-kit master into sc-fleet-manager (preserve history)
   - Option C: Force-push if sc-fleet-manager local changes are unwanted
3. Verify no loss of critical commits
4. Push successfully to sc-fleet-manager master

### Decisions
- **Option B (merge)** preferred: preserves both histories, safer for collaborative workflows.
- If merge produces conflicts, resolve manually (likely in .github/harness/ directory structure).

### Constraints & Do-NOTs
- ❌ Do NOT force-push without understanding what commits are on sc-fleet-manager
- ❌ Do NOT lose any sc-fleet-manager-specific work
- ❌ Do NOT create orphaned commits

---

## Dependencies & Order

| Task | Depends On | Blocking |
|------|-----------|----------|
| 1 (Doc audit) | None | None |
| 2 (Acceptance rule) | None | None |
| 3 (Final review) | None | None |
| 4 (sc-fleet-manager sync) | Tasks 1–3 must commit first | None (but should be last) |

**Execution order:** 1, 2, 3 (in any order on sc-fleet-harness-kit master), then 4 (sync remote).

---

## Implementation Checklist

### Pre-Implementation
- [ ] Verify HARNESS.md line numbers match current file
- [ ] Confirm registry.json exists and is valid JSON
- [ ] Check harness-evolve.mjs for existing acceptance-rule logic (if any)
- [ ] Inspect sc-fleet-manager git log to understand divergence

### Implementation
- [ ] Task 1: Update HARNESS.md (stage diagram + loop count + prose)
- [ ] Task 1: Create `.github/MCP-INTEGRATION.md` (stub or full)
- [ ] Task 1: Verify registry.json mcpTools populated
- [ ] Task 2: Implement extractConfidenceValues() function
- [ ] Task 2: Implement computeSplitScores() function
- [ ] Task 2: Implement applyAcceptanceRule() function
- [ ] Task 2: Add 6 self-tests
- [ ] Task 3: Apply 4 minor fixes
- [ ] Task 4: Resolve sc-fleet-manager merge / rebase

### Post-Implementation
- [ ] Commit all changes to sc-fleet-harness-kit master
- [ ] Push to Fintz-harness-kit (via origin)
- [ ] Push to sc-fleet-manager (via scfm remote)
- [ ] Verify no CI/lint errors
- [ ] Test harness-evolve.mjs with --self-test flag (if new functions added)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| HARNESS.md diagram out-of-date | Low | Low | Recount stages in HARNESS.md and LOOPS.md |
| Acceptance rule breaks existing loop | Very Low | Medium | Implement as opt-in flag; test with --self-test |
| sc-fleet-manager merge conflict | Medium | Medium | Manual conflict resolution + human review |
| Accidental regression in loop behavior | Low | High | Run harness-evolve.mjs --self-test before commit |

---

## Success Criteria

1. ✅ HARNESS.md accurately documents 7 workflow stages and 12 loops
2. ✅ registry.json mcpTools array populated (or documented as empty if N/A)
3. ✅ `.github/MCP-INTEGRATION.md` exists (stub or full spec)
4. ✅ extractConfidenceValues, computeSplitScores, applyAcceptanceRule implemented with 6 passing self-tests
5. ✅ 4 minor fixes applied and verified
6. ✅ sc-fleet-manager master synced with sc-fleet-harness-kit master (no merge conflicts remaining)
7. ✅ All changes committed to sc-fleet-harness-kit master
8. ✅ Pushed to Fintz-harness-kit and sc-fleet-manager

---

## Assumptions

- HARNESS.md is the source of truth for public harness documentation
- registry.json is machine-readable; mcpTools is optional (may be empty array)
- sc-fleet-manager uses sc-fleet-harness-kit as its harness source
- All deferred tasks are non-blocking and can be sequenced independently
- No breaking changes to harness loop protocol or skill routing

---

## Questions for Review

1. Should `.github/MCP-INTEGRATION.md` be a full spec or a stub reference to registry.json?
2. Is the acceptance rule opt-in-only, or should it be enabled by default in harness-evolve.mjs?
3. What are the 4 minor fixes in Task 3? (Exact list needed before Implement)
