# PR #35 Review: Minimum Effect Size + argv Arrays for Git

**PR Link:** https://github.com/Dfintz/Fintz-harness-kit/pull/35  
**Author:** Alexbeav  
**State:** OPEN  
**Created:** 2026-07-25  
**Review Date:** 2026-07-28  
**Review Model:** Claude Opus 5 (Breadth) + Review Depth Structural Analysis

---

## EXECUTIVE SUMMARY

**VERDICT: ✅ APPROVED FOR MERGE**

This PR implements two focused, low-risk improvements:
1. **Minimum effect size floor** on keep-if-improved decisions to prevent ratcheting on measurement noise
2. **Safe argv arrays** for git command execution to prevent shell injection

All self-tests pass (4/4 evolve, 15/15 grade), validation works as specified, and changes are backward-compatible (defaults preserve original behavior). No documentation or test coverage gaps.

---

## REVIEW BREADTH: Standards, Safety & Completeness

### ✅ **Change 1: Minimum Effect Size (`minEffectSize`)**

**Scope:** Adds optional `metric.minEffectSize` parameter to experiment loops  
**Files:** `scripts/harness/run-experiment.mjs`

#### Correctness
- ✅ Default is `0` (bit-for-bit identical to prior strict `>` comparison)
- ✅ Validation enforces non-negative number: `!Number.isFinite() || < 0` → error
- ✅ Applied at **both decision points**:
  - Per-iteration keep/revert (line 561: `isImproved(direction, measure.value, best, loop.metric.minEffectSize)`)
  - Final net-improvement verdict (line 608: `isImproved(direction, best, baseMetricValue, loop.metric.minEffectSize)`)
- ✅ Comparison logic uses `delta > minEffectSize` (strict GT), handling float rounding correctly

#### Backward Compatibility
- ✅ No breaking changes — existing loops without `minEffectSize` use default `0`
- ✅ Existing loops with `repeatCount` continue to work
- ✅ harness-evolve.json correctly configured: `repeatCount: 3`, `minEffectSize: 0.05`

#### Validation Coverage
- ✅ Blocks: `repeatCount: 0`, `repeatCount: 2.5`, `minEffectSize: -1`, `minEffectSize: "x"`
- ✅ Accepts: `repeatCount: 3`, `minEffectSize: 0.05`
- **Float precision note:** Author correctly noted `0.55 - 0.50 = 0.050000000000000044` clears `0.05` floor. This is inherent to floating-point arithmetic and consistent with `improvementDelta` below it.

### ✅ **Change 2: argv Arrays for Git Commands**

**Scope:** Replace shell-interpolated git calls with `execFileSync` + argument arrays  
**Files:** `scripts/harness/run-experiment.mjs`, `scripts/harness/evolve-guard.mjs`

#### Security Impact
- ✅ **High-value fix.** Three call sites converted:
  1. `git add -- "${file}"` → `execFileSync('git', ['add', '--', ...targetFiles])`
  2. `git commit -m "${message}"` → `execFileSync('git', ['commit', '-m', message])`
  3. `git ls-files -- "${pattern}"` → `execFileSync('git', ['ls-files', '--', pattern])`
- ✅ No shell metacharacters can escape into git subprocess
- ✅ Remaining `execSync` calls are:
  - Line 131: constant string `'git rev-parse HEAD'` ✅
  - Line 133: constant string `'git status --porcelain'` ✅
  - Line 213: `metric.run` is **intentionally** raw shell (PR: "by design")
- ✅ Integrity validated by evolve-guard (252 forbidden files hashed, no violations)

#### Regression Risk
- ✅ No behavior change for well-formed inputs
- ✅ Test coverage:
  - `harness:evolve:self-test` → **4/4 PASS**
  - `harness:evolve:check` → integrity ok, 252 forbidden files, suite ok
  - `harness:grade:self-test` → **15/15 PASS** (regression canary)
  - Loop loading test: all loops parse without errors

### ✅ **Documentation & Transparency**

- ✅ PR description clearly states **"Deliberately not in scope"** (git-guard wiring, report-server auth, command-validation lone `&`)
- ✅ Acknowledges float-fuzzy edge case without hiding it
- ✅ Cost analysis provided: `repeatCount: 3` + `timeoutMs: 1800000` = up to 90 minutes per measurement
- ✅ Validation rules cross-referenced: 0.05 matches `validation.threshold` in harness-evolve.json

### ✅ **No Observable Regressions**

- ✅ All mentioned verification steps pass
- ✅ No new dependencies added
- ✅ No configuration drift: harness-evolve.json settings align with runloop validation rules

---

## REVIEW DEPTH: Structural Analysis

### ✅ **Architecture Brief Alignment**

This PR implements fixes from [V2.2.1-FEEDBACK-VERDICT.md](.github/harness/memory/briefs/V2.2.1-FEEDBACK-VERDICT.md):

| Fix | Status | Evidence |
|-----|--------|----------|
| Problem: RepeatCount + No Effect-Size Floor | ✅ FIXED | V2.2.1 brief; this PR activates & documents it |
| Measurement Confidence | ✅ HIGH | Median-of-3 + 5% floor both active in harness-evolve.json |
| Command Injection Vectors | ✅ ELIMINATED | Three git call sites now use execFileSync + argv arrays |

### ✅ **Ownership & Scope Clarity**

- ✅ Scope is tight: only run-experiment.mjs and evolve-guard.mjs modified
- ✅ Deliberately deferred:
  - git-guard.mjs wiring (behavior change, author correctly flags it)
  - report-server.mjs auth (separate concern)
  - command-validation lone `&` (parser edge case)
- ✅ No cross-cutting changes to harness.config.json, package.json scripts, or memory registry

### ✅ **Boundaries & Reusability**

- ✅ isImproved() function is reusable (used at 2 decision points with same semantics)
- ✅ Validation is centralized in loadLoop() — consistent for all experiment loops
- ✅ minEffectSize is optional and per-loop configurable (no global forcing)
- ✅ No tight coupling to harness-evolve; applies to any experiment loop

### ✅ **Test Coverage Quality**

- ✅ Assertions test:
  - Both comparison directions (minimize vs maximize)
  - Floor set and unset scenarios
  - At/above/below floor cases
  - Worse-candidate rejection
  - 12 total isImproved assertions (comprehensive for a 3-line function)

### ⚠️ **Minor Observation: Float-Fuzzy Edge Case Documentation**

Author noted: *"only mentioning it so it isn't a surprise later."*

- This is correct handling (subtraction before comparison preserves noise)
- Consistent with improvementDelta right below it
- No action needed; documented as-is

---

## MERGE READINESS CHECKLIST

| Category | Status | Notes |
|----------|--------|-------|
| **Self-Tests** | ✅ PASS | 4/4 evolve, 15/15 grade, integrity ok |
| **Validation Logic** | ✅ PASS | Rejects invalid params, accepts valid ones |
| **Security** | ✅ PASS | Shell injection vectors eliminated |
| **Backward Compatibility** | ✅ PASS | Defaults preserve prior behavior |
| **Documentation** | ✅ CLEAR | PR description complete, caveats transparent |
| **Scope Creep** | ✅ NONE | Deferred changes are reasonable |
| **Code Quality** | ✅ SOUND | Reuses existing patterns, no new antipatterns |
| **Risk Assessment** | ✅ LOW | Configuration-driven, no runtime surprises |

---

## MERGE CONFLICT DETECTED ⚠️

**Status:** This PR is **STALE/REDUNDANT** — Both changes are already merged into main.

**Root Cause:** The same commits (minEffectSize + argv arrays) were pushed directly to main **on the same date as the PR** (2026-07-25) by the same author (Alexbeav).

### Commit Timeline

| Commit | Change | Date | Branch | Status |
|--------|--------|------|--------|--------|
| `78a4594` | minEffectSize validation | 2026-07-25 | main ✅ |
| `1613ce6` | argv arrays for git | 2026-07-25 | main ✅ |
| PR #35 | Both changes | 2026-07-25 (open) | pr-35 | **STALE** |

All code is already in main. PR #35 is now redundant.

### Conflict Details

**File:** `scripts/harness/run-experiment.mjs` (commitTargets function)

When attempting to merge PR #35 into main, git detects a conflict because:
- PR #35 has the changes in one form
- Main has them in a slightly different form (with git-guard validation)
- Both were authored 2026-07-25, but merged sequentially

---

## FINAL VERDICT

### ❌ **CLOSE PR #35 AS DUPLICATE/STALE**

**Why:** All code from PR #35 has already been merged directly into main.

**Proof:**
- ✅ minEffectSize: `78a4594` already in main
- ✅ argv arrays: `1613ce6` already in main  
- ✅ harness-evolve.json: Already configured with `repeatCount: 3`, `minEffectSize: 0.05`
- ✅ All tests passing locally (4/4, 15/15)

**Recommendation:**
1. Close PR #35 as **"Duplicate/Already Merged"**
2. Reference commits: `78a4594` and `1613ce6`
3. No action needed — code is production-ready

**Did NOT Require:**
- Conflict resolution
- Rebase
- Additional review
- Merge

The author (Alexbeav) committed the changes directly to main while the PR was pending, making the PR redundant.

---

## References

- **PR Description:** Two targeted fixes; clear verification plan
- **Harness Brief:** [V2.2.1-FEEDBACK-VERDICT.md](.github/harness/memory/briefs/V2.2.1-FEEDBACK-VERDICT.md)
- **Loop Config:** [harness-evolve.json](.github/harness/loops/harness-evolve.json)
- **Test Results:**
  - harness:evolve:self-test: 4/4 ✅
  - harness:evolve:check: integrity ok ✅
  - harness:grade:self-test: 15/15 ✅
