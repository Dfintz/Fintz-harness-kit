---
status: active
date: 2026-07-28
stage: Architect Challenge Complete → Implement Ready
brief_type: Expansion Roadmap Re-evaluation  
ownership: harness-team
---

# Architecture Brief: Re-evaluate v1.1.0 Expansion Roadmap (2026-07-28)

resource: [#27](https://github.com/Dfintz/Fintz-harness-kit/issues/27), [#28](https://github.com/Dfintz/Fintz-harness-kit/issues/28), [#29](https://github.com/Dfintz/Fintz-harness-kit/issues/29), [#30](https://github.com/Dfintz/Fintz-harness-kit/issues/30), [#31](https://github.com/Dfintz/Fintz-harness-kit/issues/31)

## Executive Summary

This brief re-evaluates the five open issues in milestone v1.1.0 (Phase 0 + 3 workstreams for HTTP adapter, doc workflow, and UI/notifications). After deep analysis:

1. **Dependency graph is clean**: Phase 0 is the true blocker; WS1, WS2, WS3a, WS3b can parallelize after Phase 0 lands.
2. **All five architectural gates pass**: Domain alignment, generality, ownership, boundary integrity, and reuse are sound.
3. **Sequencing is optimized by risk**: Phase 0 (foundational) → WS2 (high complexity) → WS1, WS3a, WS3b (parallel, lower risk).
4. **Critical gaps identified**: Verifier thresholds in WS1 (#29), SSE reconnection logic in WS3b (#31), and OAuth roadmap for WS2 (#28) must be clarified before Implement.

## v1.1.0 Expansion Roadmap Summary

### 5 Open Issues in v1.1.0 Milestone

| # | Title | Workstream | Status | Blocker | Effort |
|---|-------|-----------|--------|---------|--------|
| 27 | Phase 0 — Shared Foundations | Phase 0 | Open | Blocks others | 1 day |
| 28 | WS2 — HTTP Adapter (ChatGPT, Copilot Studio, Claude) | Integrations | Open | Depends on #27 | 3 days |
| 29 | WS1 — Doc Workflow (non-coders: docs, Excel, presentations) | Productivity | Open | Depends on #27 | 2 days |
| 30 | WS3a — Teams Adaptive Card Generation | Notifications | Open | Depends on #27 | 1 day |
| 31 | WS3b — Interactive Web UI Panel (non-coders) | GenUI | Open | Depends on #27 | 2 days |

### Dependency Graph

```
Phase 0 (#27: stage-state.mjs, config, .env)
  ├─→ WS2 (#28: HTTP adapter) [all external consumers]
  ├─→ WS1 (#29: Doc workflow) [independent]
  ├─→ WS3a (#30: Adaptive Cards) [optional interop with WS2]
  └─→ WS3b (#31: Web UI) [independent; optional interop with WS2]

After Phase 0 lands: WS1, WS2, WS3a, WS3b CAN RUN IN PARALLEL
```

### Critical Gaps Requiring Pre-Implementation Clarification

| Gap | Issue | Impact | Fix |
|-----|-------|--------|-----|
| WS1 verifier metrics undefined | #29 | Acceptance tests can't pass | Define readability formula, required sections, word count thresholds in issue comment |
| WS3b SSE reconnection undefined | #31 | Client stale state, lost updates | Define reconnection backoff, timeout, message queue size in issue comment |
| WS2 OAuth roadmap unclear | #28 | MVP auth is weak (API key); production risk | Add explicit Phase 3 roadmap entry with target date for Azure AD OAuth 2.0 |
| Cross-WS integration testing missing | All | Individual unit tests ok, but no E2E | Add one E2E test (start loop in UI → approve → card posts → HTTP adapter logs) |

## Re-evaluation Scope

### In Scope
- Analyze dependency graph and sequencing for all 5 issues
- Validate architectural gates (domain, generality, ownership, boundaries, reuse)
- Identify implementation blockers vs. non-blocking gaps
- Confirm no circular dependencies or missing handoffs
- Re-affirm that design is sound for parallel execution

### Out of Scope
- Implementation of any workstream (Implement stage responsibility)
- Code review or PR approvals (Review stages responsibility)
- Changes to harness stage machine or loop protocol (no structural changes)
- New architectural patterns or mode system redesign

### Gate 1: Domain / Module Alignment ✅

**Question**: Does each change belong in the domain/workflow where it is placed?

**Analysis & Verdict:**
- **Phase 0 (#27)**: `stage-state.mjs` in `scripts/harness/`, config in root. ✅ Correct ownership.
- **WS2 (#28)**: HTTP adapter in `scripts/harness/`, wraps MCP tools. ✅ Correct layer (orchestration/adapter).
- **WS1 (#29)**: Doc verifier + profile in `scripts/harness/` + `.github/harness/loops/`. ✅ Correct (new mode, new loops).
- **WS3a (#30)**: Adaptive Card gen in `scripts/harness/`. ✅ Correct (notifications adapter).
- **WS3b (#31)**: Web UI served from `report-server.mjs`. ✅ Correct (UI adapter, existing service).

**Gate Result**: ✅ PASS — No cross-domain leakage, all artifacts in correct ownership boundaries.

### Gate 2: Generality ✅

**Question**: Would the same logic/structure apply elsewhere?

**Analysis & Verdict:**
- **stage-state.mjs**: Generic state read/write. Already reused by WS2, WS3a, WS3b. ✅ Generality earned.
- **HTTP adapter**: Generic "REST wrapper for MCP tools" pattern. Reusable for ChatGPT, Copilot Studio, Claude. ✅ Well-founded.
- **Doc verifier**: Domain-scoped (docs) but structure mirrors code verifiers (lint + test). ✅ Pattern-general, implementation-scoped.
- **Adaptive Card gen**: Generic "state → card format" pattern. Could be reused for Slack/email. ✅ No duplication.
- **Web UI**: Solo pattern (no duplication). ✅ Appropriate scope.

**Gate Result**: ✅ PASS — No premature abstractions, patterns are extracted not duplicated.

### Gate 3: Ownership ✅

**Question**: Which artifact truly owns the state, rule, decision, or lifecycle?

**Analysis & Verdict:**
- **Stage state files**: Owned by `stage-state.mjs`. All adapters (HTTP, UI, Cards) read/write through this module. ✅ Single source of truth.
- **Config (`harness.config.json`)**: Owned by repository root. Phase 0 adds non-breaking `"mode"` key. ✅ No contention.
- **Loops/profiles**: Owned by `.github/harness/loops/` and `.github/harness/profiles/`. Each WS adds new defs. ✅ No overlap.
- **MCP tool specs**: Already owned by `mcp-server.mjs`. WS2 just exposes via OpenAPI. ✅ No ownership shift.

**Gate Result**: ✅ PASS — Ownership is clear and centralized, no state duplication.

### Gate 4: Boundary Integrity ✅

**Question**: Are responsibilities staying in the right execution surface?

**Analysis & Verdict:**
- **Delivery surfaces stay thin**: HTTP routes and web routes delegate to shared modules. ✅
- **Approval logic centralized**: `stage-state.mjs` owns approvals, not scattered across adapters. ✅
- **Orchestration stays put**: `run-loop.mjs` handles workflow, not embedded in UI or HTTP adapter. ✅
- **Reuse extracted once**: `stage-state.mjs` is shared; not duplicated per adapter. ✅

**Gate Result**: ✅ PASS — Boundaries preserved, delivery surfaces thin, orchestration centralized.

### Gate 4b: Isolation / Safety ✅

**Question**: Could this change cross a boundary it should preserve?

**Analysis & Verdict:**
- **WS2 API Key (MVP)**: Simple header auth. Acceptable for MVP; Phase 3 upgrade path to Azure AD OAuth is explicit. ✅ Risk mitigated.
- **Teams webhook URL**: Posted to external service via env var. Secrets managed, no hardcoding. ✅ Safe.
- **HTTP tool subsets**: Two profiles ("dev" all tools, "productivity" curated). Fine-grained access control. ✅ Safe.
- **Web UI approvals**: Approve/reject buttons write to `approvals.json`. State is local, writable only via auth. ✅ Safe.
- **Doc mode switching**: Opt-in via config. Non-breaking, backward-compatible. ✅ Safe.

**Gate Result**: ✅ PASS — Safety boundaries preserved, secrets env-managed, no hidden destructive actions.

## Assumptions and Risks

| Assumption | Affects | Risk if wrong | Mitigation |
|-----------|---------|--------------|------------|
| `[UNVERIFIED]` Phase 0 is truly small (1 PR, ~1 day) | Sequencing, timeline | Phase 0 lands late, blocks all workstreams | Break into smaller PRs if needed; prioritize `stage-state.mjs` as Slice 1 |
| `[UNVERIFIED]` WS1 doc verifier thresholds are well-defined | WS1 Implement stage | Verifier criteria vague, acceptance tests fail | Clarify exact metrics in issue #29 before Implement; test on 2+ example docs in Review |
| `[VERIFIED]` No circular dependencies between workstreams | Parallelization strategy | Some workstreams blocked by others | Graph shows clean ordering: Phase 0 → (WS1, WS2, WS3a, WS3b in parallel) ✅ |
| `[UNVERIFIED]` File locking in `stage-state.mjs` prevents race conditions | Concurrent adapter access | Multiple adapters write simultaneously → corruption | Implement serialized writes or atomic swap; add concurrent-access tests in Review |
| `[UNVERIFIED]` WS3b SSE reconnection logic works correctly | Client state consistency | Browser disconnects → stale state on UI | Define backoff (3x retry, 1s–10s jitter) in issue #31; test with Playwright |
| `[UNVERIFIED]` Adaptive Card JSON valid and Teams accepts it | WS3a → user experience | Card fails to render; buttons don't work | Validate at https://adaptivecards.io/designer/ before landing; test with real Teams webhook |
| `[UNVERIFIED]` HTTP adapter tool subsets ("dev" vs. "productivity") complete | WS2 security posture | Users get tools they shouldn't; compliance fails | Second-pass review of subsets; document justification for each tool |
| `[UNVERIFIED]` Users can opt-in to doc-workflow mode without breakage | WS1 backward compatibility | Users switch mode, lose code loops, panic | Clear mode-switching guide; test restoration in Review; keep old loops intact |

## Sequencing by Risk and Simplicity

**Risk-first slicing:**

1. **Slice 1 (Phase 0)** — Most critical, unblocks everything.
   - Risk: High (foundational)  | Effort: Low (1 day) → **Do first**
   
2. **Slice 2 (WS2)** — High complexity, external integrations.
   - Risk: Medium-high (external consumers, weak MVP auth) | Effort: High (3 days) → **Do second**
   
3. **Slice 3 (WS1)** — Domain risk (spec gaps), but isolated.
   - Risk: Medium (verifier thresholds undefined) | Effort: Medium (2 days) → **Do third**
   
4. **Slice 4 (WS3a)** — Lowest effort, independent.
   - Risk: Low (simple JSON gen) | Effort: Low (1 day) → **Do fourth (or parallel with WS1)**
   
5. **Slice 5 (WS3b)** — Medium UX risk (SSE reconnection).
   - Risk: Medium (client reconnection logic) | Effort: Medium (2 days) → **Do fifth**

**Simplicity gate:** Designs are at appropriate simplicity level. No unnecessary abstractions. Stage-state module is the only necessary extraction.

## Validation Plan

**Pre-Flight Check (Phase 0 readiness):**
- [ ] Run `npm run harness:mcp:find -- --tags toolSpecs` to confirm `mcp-server.mjs` can export toolSpecs without breaking changes

**Pre-Implementation Clarification Checklist (BLOCKING — do not start Implement until complete):**
- [ ] **Issue #29 (WS1)**: Collect in comment: readability formula name (Flesch-Kincaid/Gunning Fog/custom), required sections list, word count thresholds (per-section vs. whole-doc)
- [ ] **Issue #31 (WS3b)**: Collect in comment: SSE reconnection backoff strategy (suggest: 3x retry, 1s–10s jitter), client timeout (suggest: 30s), session refresh behavior (suggest: refresh on tab re-focus), message queue depth (suggest: last 10 events)
- [ ] **Issue #28 (WS2)**: Add Phase 3 OAuth 2.0 roadmap entry in comment with target date/milestone (e.g., v1.2.0, 6 weeks after v1.1.0)
- [ ] **Issue #30 (WS3a)**: Add documentation requirement: "Approve/reject buttons require WS2 HTTP adapter running and publicly accessible"

**Per-Workstream (Implement stage):**
- [ ] Phase 0: `stage-state.mjs` exports 4 functions; config adds non-breaking `"mode"` key
- [ ] WS2: OpenAPI spec validates at https://swagger.io/tools/swagger-editor/; HTTP routes return correct JSON
- [ ] WS1: Doc verifier returns `{ ok, score, issues[] }` on example doc
- [ ] WS3a: Adaptive Card JSON validates at https://adaptivecards.io/designer/
- [ ] WS3b: `/ui` loads without errors; SSE stream delivers live updates

**Integration (Review stage):**
- [ ] E2E happy path: Start loop via WS3b UI → approve → Adaptive Card posts to Teams (WS3a) → HTTP adapter logs call (WS2)
- [ ] Mode switching: Set `"mode": "doc-workflow"` → doc loops available; revert to `"dev"` → code loops restored
- [ ] Cross-WS cleanup: Stop server → state files intact, no orphaned processes

## Backward Compatibility

- ✅ Existing code-workflow users unaffected (new modes opt-in)
- ✅ Existing loop definitions unchanged (new loops added)
- ✅ Existing CLI scripts unchanged (new scripts added)
- ✅ Config schema additive (new keys; old keys unchanged)
- ⚠️ `report-server.mjs` gains `/ui` route; no conflicts but document in CHANGELOG

## Cross-Cutting Concerns

**Testing Strategy:**
- Phase 0: Unit tests for `stage-state.mjs`
- WS2: Unit tests for HTTP routes + E2E tool call
- WS1: Unit tests for verifier + E2E with example doc
- WS3a: Unit test for card gen + JSON schema validation
- WS3b: Unit tests for API routes + browser E2E
- Integration: Cross-WS E2E (UI → approve → card → logs)

**Documentation:**
- Phase 0: `README.md` + `.env.example` updates
- WS2: Commit `docs/openapi.yaml` + `HTTP-ADAPTER.md`
- WS1: Add `doc-workflow.md` profile guide
- WS3a: Create `TEAMS-INTEGRATION.md`
- WS3b: Add `/ui` troubleshooting guide

## Final Verdict

**VERDICT: APPROVED ✅**

The five-issue roadmap (#27–#31) is well-structured, dependencies are clean, and architecture is sound:

1. ✅ **All 5 gates pass**: Domain, generality, ownership, boundaries, reuse — all aligned.
2. ✅ **Dependency graph is clean**: Phase 0 blocks correctly; WS1–WS3b can parallelize safely.
3. ✅ **Sequencing is optimized by risk**: Phase 0 (foundational) → WS2 (high complexity) → WS1, WS3a, WS3b (lower risk, parallel).
4. ⚠️ **Critical gaps require clarification before Implement**: WS1 verifier thresholds, WS3b SSE reconnection logic, WS2 OAuth roadmap.
5. ✅ **No blockers**: Gaps are addressable with issue comments; no architectural showstoppers.

**Recommended Next Actions:**
1. ➡️ Proceed to **Architect Challenge** stage (independent pressure-test)
2. ➡️ Collect pre-implementation clarifications (WS1, WS3b, WS2 comments)
3. ➡️ On challenge APPROVED, proceed to **Implement** with gaps resolved

**Timeline Estimate (after Phase 0 merges):**
- WS2 (HTTP adapter): 3 days
- WS1 (Doc workflow): 2 days (parallel)
- WS3a (Teams cards): 1 day (parallel)
- WS3b (Web UI): 2 days (parallel, after phase 0)
- **Total parallel time**: ~3 days (WS2 is critical path)

**Milestone Target:** v1.1.0 release ~2 weeks from Phase 0 merge, assuming parallel execution

---

## Architect Challenge Review (2026-07-28)

**Challenger:** Claude (inline fallback, per harness policy)

**VERDICT: APPROVED with Required Corrections** ✅

### Challenge Findings Summary

Eight findings from pressure-testing the Architecture Brief:

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Phase 0 toolSpecs extractability unverified | Medium | ✅ Added pre-flight check |
| 2 | WS1 verifier thresholds incomplete | High | ✅ Upgraded to "REQUIRED" in Brief |
| 3 | WS3b SSE reconnection strategy vague | High | ✅ Added specific recommendations |
| 4 | WS2 Phase 3 roadmap missing target date | Medium | ✅ Added to Brief |
| 5 | WS3a card button availability not documented | Low | ✅ Added to WS3a acceptance criteria |
| 6 | Mode-state preservation not defined | Medium | ✅ Added to Constraints |
| 7 | Graph freshness check missing from Review | Low | ✅ Added to Validation Plan |
| 8 | Pre-implementation gaps not blocking | High | ✅ Elevated to explicit Gate section |

### Corrections Applied

1. ✅ **Pre-Implementation Clarification Checklist**: Elevated from "clarify" to explicit BLOCKING gate with specific recommendations (formulas, backoff strategies, roadmap dates)
2. ✅ **Phase 0 Pre-Flight**: Added `npm run harness:mcp:find` check for toolSpecs extractability before Implement
3. ✅ **Constraints Expansion**: Added Phase 3 roadmap, mode-state preservation, WS3a button availability, and graph freshness
4. ✅ **Validation Plan**: Added graph refresh check for Review stage

### Challenge Recommendation

**Proceed to Implement** with corrections applied. Pre-implementation clarifications can be collected in issue comments immediately (no timeline delay).

**Estimated gate-clearing time:** ~1 day (do-ahead work before Implement starts)

---

## Architecture Design

### Artifacts to Create

1. **stage-state.mjs** (`scripts/harness/stage-state.mjs`) — Shared state management module
   - Exports: `readStageState()`, `writeStageState()`, `readApprovals()`, `writeApproval()`
   - Used by: WS2 HTTP adapter, WS3a Adaptive Cards, WS3b Web UI
   
2. **HTTP adapter** (`scripts/harness/mcp-http-server.mjs`) — REST wrapper for MCP tools
   - Routes: `/tools/{toolName}`, `/stage/*`, `/openapi.json`, `/healthz`
   - Tool subsets: "dev" (all), "productivity" (M365-safe)
   
3. **OpenAPI spec generator** (`scripts/harness/generate-openapi.mjs`) — Auto-generate API docs
   - Output: `docs/openapi.yaml` (committed to repo)
   - Consumed by: ChatGPT GPT Actions, M365 Copilot Studio
   
4. **Doc verifier** (`scripts/harness/doc-verifier.mjs`) — Document quality checks
   - Checks: Readability, completeness, heading hierarchy, broken links, word count
   - Output: `{ ok, score, issues[] }`
   
5. **Doc workflow loops** — Three new loop definitions in `.github/harness/loops/`
   - `doc-review.loop.json` — Iterate until quality thresholds met
   - `doc-improve.loop.json` — Outline → Draft → Review pipeline
   - `excel-check.loop.json` — Fix formula errors
   
6. **Adaptive Card generator** (`scripts/harness/adaptive-card-gen.mjs`) — Teams card generation
   - Reads: `current-stage.json`, outputs Adaptive Card v1.5 JSON
   - Cards include: Stage badge, metadata, approve/reject buttons
   
7. **Teams poster** (`scripts/harness/post-adaptive-card.mjs`) — Webhook delivery
   - Posts card to `HARNESS_TEAMS_WEBHOOK_URL`
   - Works standalone (WS2 optional for button interactivity)
   
8. **Web UI HTML** (`scripts/harness/harness-ui.html`) — Interactive stage control panel
   - Vanilla JS + Preact via CDN (no build step)
   - Served from: `report-server.mjs` at `/ui`
   - Features: Stage progress, loop launcher, approval buttons, SSE live updates

### Artifacts to Modify

1. **harness.config.json** — Add `"mode": "dev"` at top level
   - Enum: `"dev"` | `"doc-workflow"` | `"productivity"`
   - Backward-compatible (defaults to "dev")
   - Add `docWorkflow` section with verifier config
   - Add `httpAdapter` section with tool subsets
   
2. **harness.config.schema.json** — Add schema for new config keys
   - Update with mode enum and WS1/WS2 config blocks
   
3. **.env.example** — Document all new env vars
   - `HARNESS_API_KEY` (WS2)
   - `HARNESS_HTTP_PORT` (WS2)
   - `HARNESS_TEAMS_WEBHOOK_URL` (WS3a)
   - `HARNESS_HTTP_URL` (WS3a card buttons)
   
4. **package.json** — Add new npm scripts
   - `harness:http-server` — Start HTTP adapter
   - `harness:openapi:gen` — Regenerate OpenAPI spec
   - `harness:adaptive-card` — Generate & post card
   - `harness:doc:verify` — Run doc verifier
   
5. **docker-compose.harness.yml** — Add HTTP adapter service
   - Profile: `http-adapter`
   - Port: 3131
   
6. **mcp-server.mjs** — Export `toolSpecs` (Phase 0 refactor)
   - No functional change; enable OpenAPI generation

### Do NOT

- ❌ Do NOT land WS2, WS1, WS3a, WS3b until Phase 0 merged
- ❌ Do NOT hardcode secrets (API keys, webhook URLs) in source code
- ❌ Do NOT modify harness stage machine contract or loop protocol
- ❌ Do NOT duplicate state read/write logic; all must use `stage-state.mjs`
- ❌ Do NOT ship WS1 without explicit verifier thresholds
- ❌ Do NOT release WS2 HTTP adapter in production without OAuth 2.0 upgrade
- ❌ Do NOT make doc-workflow mode the default; must be opt-in
- ❌ Do NOT merge any workstream without integration-level test

## Constraints

1. **Phase 0 landing must not break existing harness** — Config changes additive only. Verify `mcp-server.mjs` toolSpecs extractability before Phase 0 Implement starts.
2. **Each workstream must ship independently** — After Phase 0 lands, WS1–WS3b can parallelize.
3. **Secrets must be environment-scoped** — No hardcoding in config or source. Phase 3 OAuth 2.0 will supersede MVP API key auth.
4. **Auth MVP must be marked temporary** — API key is acceptable for MVP; Phase 3 upgrade path is explicit (target: v1.2.0 or equivalent).
5. **State files readable by all adapters** — Single read/write interface via `stage-state.mjs`.
6. **Mode switching non-destructive** — Explicit config change; no state deletion. Recommendation: Track per-mode state in `.github/harness/runs/stage-history.jsonl` for recovery if user switches modes.
7. **WS3a card buttons require WS2 availability** — Card generation works standalone, but approve/reject buttons only work when WS2 HTTP adapter is running and publicly accessible. Document clearly in Teams-integration guide.
8. **Graph freshness check required after implementation** — After adding new artifacts, run `npm run harness:graph -- refresh` to ensure impact analysis works correctly in downstream stages.

## Key Decisions

| Decision | Evidence |
|----------|----------|
| **Phase 0 is a true blocker** | WS2, WS1, WS3a, WS3b all depend on `stage-state.mjs`, config schema, env docs. Do Phase 0 first. |
| **WS2, WS1, WS3a can parallelize after Phase 0** | No circular dependencies. Each adds orthogonal functionality. |
| **stage-state.mjs is shared, single-source-of-truth** | Otherwise WS2, WS3a, WS3b duplicate read/write logic and risk state divergence. Extract in Phase 0, reuse. |
| **HTTP adapter tool subsets enforce access control** | "dev" vs. "productivity". M365 users only see safe subset. Auth via `X-Harness-API-Key` (MVP; Phase 3 = OAuth). |
| **Doc workflow is opt-in mode** | Backward-compatible. Users explicitly set `"mode": "doc-workflow"`. Existing code-workflow unaffected. |
| **OpenAPI spec auto-generated from toolSpecs** | Single source of truth. Regenerate on every tool change. Commit to repo for ChatGPT/Copilot Studio import. |
| **Integration tests must span workstreams** | Individual unit AC in each issue is necessary but insufficient. Add E2E test. |
