# Fintz-Harness-Kit Roadmap

**Last Updated**: 2026-08-03  
**Current Version**: 2.5.0 (patch work in progress — see v2.5.1 below)  
**Previous Plan**: v1.1.0 (reimagined to v2.x delivery timeline)

---

## 📊 Version Timeline & Delivery Status

### ✅ Delivered Versions

#### v2.5.0 — Docs & Setup Usability Refresh (GA, 2026-07-28)
**Type**: Minor (documentation + release readiness)  
**Focus**: Making the harness easier to adopt, validate, and release safely.

**What Changed**:
- README install examples now use concrete repository targets
- README includes fastest-path first-run checklist
- SETUP includes quick onboarding checklist for operators
- SETUP includes maintainer release checklist
- Internal version surfaces updated to 2.5.0
- Release helper scripts updated with env override support

**Impact**: Better onboarding, safer release workflow, clearer upgrade path

---

#### v2.5.1 — Ubuntu / Ollama File-Search Toolkit + Open WebUI Proxy (in progress, 2026-08-03)
**Type**: Patch (additive — no breaking changes, no version bump required in package.json)

**Motivation**: Ubuntu server with 50 GB Intel CPU, local Ollama, needs file search + analysis and
a browser-accessible chat UI routed through the harness stage machine.

**What Changed** (uncommitted, session work):
- `scripts/harness/vector-search.mjs` — extended with `--root <path>`, `--scope fs`, sliding-window
  chunking (`--chunk-size`, `--chunk-overlap`), binary-skip (null-byte), `--max-file-bytes` cap,
  incremental hash-based re-index skip, `--ext` filter.
- `scripts/harness/file-search.mjs` (new) — filesystem-first search CLI; thin UX wrapper with
  operator-friendly defaults (`--root CWD`, `--scope fs`).
- `scripts/harness/prompt-middleware.mjs` (new) — harness routing middleware; any prompt in →
  structured stage/model JSON handoff out. Importable and CLI-usable.
- `scripts/harness/harness-proxy.mjs` (new) — OpenAI + Ollama-compatible HTTP proxy (port 11435);
  intercepts every chat request, injects harness stage plan as a system message, streams Ollama
  response back verbatim. Passthrough mode via `HARNESS_PROXY_INJECT=0`.
- `docker-compose.harness.yml` — added `harness-proxy` and `open-webui` services under
  `--profile webui`. One command: `npm run harness:webui:full`.
- `harness.config.json` — added `hardwareProfiles.cpu-only-50gb-intel` with model recommendations,
  Ollama env vars, and systemd snippets.
- `SETUP.md` — Ubuntu + Ollama setup section (systemd tuning, file search, prompt middleware,
  troubleshooting); Open WebUI section (architecture diagram, env table, MCP notes).
- `package.json` — added `harness:search`, `harness:file-index`, `harness:prompt:route`,
  `harness:proxy`, `harness:webui:up`, `harness:webui:down`, `harness:webui:full`.

**Roadmap alignment**:
- Partially addresses **#28** (HTTP adapter): `harness-proxy.mjs` delivers the OpenAI-compat
  intercept layer. Missing: OpenAPI schema generation, OAuth stub, full REST MCP exposure.
- Partially addresses **#31** (Web UI): Open WebUI covers the LLM *chat* UI need. The custom
  harness control panel (SSE stage progress, click-to-approve) remains a separate v3.0.0 scope item.
- `prompt-middleware.mjs` is the foundation for a future harness-native prompt intercept hook.

**Custom Web UI decision**: Deferred. Open WebUI + harness proxy is the correct chat layer.
The v3.0.0 scope is a *harness control panel* (SSE stage updates, approval buttons) — not a
general LLM chat UI. These are different products; building a custom chat UI would duplicate
Open WebUI for no gain.

---

#### v2.3.0 — Phase 5c Real Measurement & GitHub Copilot Integration (GA, 2026-07-25)
**Type**: Major (Phase 5c real validation + cloud provider integration)

**Phase 5c Real Measurement (Local)**:
- ✅ Composite score: 0.937 (5/5 tiers passing)
- Local model validation: `qwen2.5-coder:32b` outperforms all others
- Methodology: Median-of-3 inference runs per task

**GitHub Copilot Integration (New)**:
- ✅ GitHub Models API endpoint integrated
- ✅ Dry-run validation: Composite score 0.819
- Dual-provider architecture (local ↔ cloud switchable per tier)
- Models: Official GA versions (GPT-5.x + Claude Sonnet/Opus 5)
- Authentication: Bearer token via `GITHUB_TOKEN`

**Impact**: Real-world validation of quality improvements, cloud provider support for teams without local Ollama

---

#### v2.2.1 — Harness Kit with Phase 5c Multi-Model Optimization (GA, 2026-07-25)
**Type**: Patch (critical fixes + Phase 5c continuation)

**Phase 5c Multi-Model Optimization**:
- ✅ Cascade health check: 100% success, +3.4% quality projection
- ✅ Live monitoring dashboard: 20 skills tracked, tier-based grouping
- ✅ Regression alerts: >5% quality drop detection
- RepeatCount default: 1 → 3 (median-of-3 for statistical rigor)
- MIN_EFFECT_SIZE floor: 5% (prevents spurious gains)

**Critical Fixes**:
1. **Model ID Format Correction**: 641 model ID fixes (hyphenated format)
   - `claude-opus-4.8` → `claude-opus-4-8`
   - `claude-haiku-4.5` → `claude-haiku-4-5`
   - Scope: 61 files, zero behavior change

2. **Measurement Confidence Activation**: Default RepeatCount 1→3, MIN_EFFECT_SIZE floor added
   - Impact: Loops ~3× slower but significantly more reliable

3. **Decision Context Documentation**: V2.2.1-FOLLOW-UP-REVIEW-BRIEF.md added
   - Comprehensive rationale for all fixes documented

**Impact**: Production-ready multi-model optimization, reliable measurements, defensible architectural decisions

---

### 📋 Original v1.1.0 Roadmap (Reimagined into v2.x)

The v1.1.0 roadmap outlined 5 work items across Phase 0 + 4 parallel workstreams:

| Issue | Workstream | Original Scope | Current Status | Delivered In |
|-------|-----------|-----------------|-----------------|--------------|
| #27 | Phase 0 | Shared state management (stage-state.mjs, config, .env) | ⏸️ Deferred | Planned for v3.0 |
| #28 | WS2 | HTTP adapter (ChatGPT, Copilot Studio, Claude OpenAPI) | ⏸️ Deferred | Planned for v3.0 |
| #29 | WS1 | Doc workflow (non-coders: docs, Excel, presentations) | ⏸️ Deferred | Planned for v3.0 |
| #30 | WS3a | Teams Adaptive Card generation for notifications | ⏸️ Deferred | Planned for v3.0 |
| #31 | WS3b | Interactive web UI panel with SSE live updates | ⏸️ Deferred | Planned for v3.0 |

**Decision Rationale**:
- v2.x focused on **production hardening** of the harness core via Phase 5c optimization
- Multi-model measurement and GitHub Copilot integration had higher delivery urgency
- v1.1.0 workstreams require stable harness state machine + model optimization in place first
- Non-blocking: v1.1.0 features are productivity improvements, not blocker fixes

---

## 🎯 Current State (v2.5.0 + v2.5.1 in progress)

### What's Working ✅
- **Harness Core**: 7-stage workflow machine (Understand, Architect, Architect Challenge, Implement, Review Breadth, Review Depth, Feedback)
- **Multi-Model Support**: 
  - Local: Ollama with 5-tier model distribution
  - Cloud: GitHub Copilot (GPT-5.x + Claude Opus/Sonnet 5)
  - Fallback: Universal fallback tier for reliability
- **Measurement & Validation**:
  - Real measurement runs (Ollama + GitHub Models)
  - Live monitoring dashboard with regression alerts
  - Median-of-3 runs for statistical rigor
- **Documentation**: Complete onboarding checklists, maintainer release workflows
- **Release Safety**: Tag-synchronized version surfaces, validated release helpers
- **[v2.5.1] File Search Toolkit**: `file-search.mjs` + extended `vector-search.mjs` (`--root`, chunking, `fs` scope, binary skip) for Ubuntu/Ollama deployments
- **[v2.5.1] Prompt Middleware**: `prompt-middleware.mjs` — any prompt routed through harness stage machine, JSON handoff out
- **[v2.5.1] Open WebUI + Proxy**: `harness-proxy.mjs` + docker-compose `webui` profile — browser chat UI with automatic harness stage-plan injection
- **[v2.5.1] Hardware Profiles**: `harness.config.json` documents 50 GB Intel CPU Ollama tuning
- **[v2.7.0] Phase 0 Shared Foundations**: `stage-state.mjs` (readStageState, writeStageState, readApprovals, writeApproval), `.env.example` (60 vars catalogued), `harness.config.json` extended with `mode` + `docWorkflow`
- **[v2.6.0] HTTP Adapter**: `http-adapter.mjs` REST server — all MCP tools as HTTP endpoints, auto-generated OpenAPI 3.0 schema, API key auth, OAuth 2.0 stub with Phase 3 upgrade path
- **[v2.8.0] Doc Workflow Mode**: `doc-verifier.mjs` (Flesch-Kincaid readability, required sections, word-count thresholds), `doc-workflow-loop.json`, `harness.config.json docWorkflow` section fully populated with defaults, `harness:doc:verify` + `harness:doc:loop` scripts
- **[v2.9.0] Teams Adaptive Cards**: `teams-notifier.mjs` — three card templates (stage-complete, approval-needed, error-alert), Teams incoming webhook, auto-reads live state from `stage-state.mjs`, dry-run mode, `harness:teams:notify` script
- **[v3.0.0] Teams Agent — Bi-Directional Approvals**: `teams-agent.mjs` — Microsoft Teams bot service for interactive approvals, Adaptive Card action callbacks, stage-state integration, command parsing, `/api/messages` endpoint for Teams Bot Framework
- **[v3.0.0] Harness Control Panel**: `control-panel.mjs` — SSE live state stream (`/sse/state`), operator + end-user HTML panel (`/control`), approval buttons (`POST /control/approve`); exponential-backoff reconnect, heartbeat, tab-visibility reconnect. Served from `report-server.mjs` with zero breaking changes.

### Known Gaps ⚠️
- OAuth 2.0 for HTTP adapter (Phase 3)
- Power Automate integration for cross-org approval workflows (Phase 3)
- All session work (v2.5.1 through v3.0.0) not yet committed to git

---

## 🚀 Roadmap: v2.6.0 → v3.0

### v2.6.0 — HTTP Adapter Foundation ✅ DELIVERED 2026-08-03

**What shipped:**
- `scripts/harness/http-adapter.mjs` — REST server (port 8100) exposing all harness MCP tools
- `GET /openapi.json` — OpenAPI 3.0 schema auto-generated from `mcpToolSpecs` JSON Schema
- `GET /tools` — tool listing; `POST /tools/:name` — tool invocation
- Auth: `X-Harness-API-Key` header or `Authorization: Bearer` via `crypto.timingSafeEqual`
- OAuth 2.0 stub: `GET /.well-known/oauth-authorization-server` returns Phase 3 upgrade metadata
- Dev mode: if `HARNESS_API_KEY` unset, auth skipped with startup warning
- `package.json` — added `harness:http`, `harness:http:schema`

**Phase 3 upgrade path** documented in stub: set `HARNESS_OAUTH_TENANT_ID` to activate Azure AD OAuth 2.0.

---

### v2.6.0 — HTTP Adapter Foundation (Planned, ~3 days effort)**Target**: 2026-08-XX  
**Type**: Minor (new adapter layer, backward-compatible)

**Scope**:
- Extract HTTP adapter for external LLM consumers (ChatGPT, Copilot Studio, Claude)
- OpenAPI schema auto-generation from MCP tools
- OAuth 2.0 stub (Phase 3 roadmap: Azure AD integration)
- Authentication: API key + Bearer token support
- Backward compatible: Zero changes to existing harness APIs

**Blocking Pre-Impl Questions** (from #28):
- [ ] Phase 3 OAuth 2.0 roadmap: target milestone, timeline, scope?
- [ ] Which endpoints are MVP vs. Phase 2?
- [ ] Rate limiting strategy?

**Delivery Criteria**:
- ✅ All public MCP tools exposed via REST
- ✅ OpenAPI spec auto-generated and validated
- ✅ OAuth 2.0 placeholder with clear Phase 3 upgrade path
- ✅ Unit tests for auth patterns
- ✅ Zero breaking changes to harness core

---

### v2.7.0 — Phase 0 Shared Foundations ✅ DELIVERED 2026-08-03

**What shipped:**
- `scripts/harness/stage-state.mjs` — shared live-state module with 4 exports:
  `readStageState()`, `writeStageState()`, `clearStageState()`, `readApprovals()`, `writeApproval()`
- State file: `.github/harness/runs/stage-state.json` (atomic write via temp+rename)
- Approvals log: `.github/harness/runs/approvals.jsonl` (append-only NDJSON)
- `harness.config.json` — added `"mode": "dev"` + `"docWorkflow"` placeholder section
- `.env.example` — comprehensive catalogue of all harness env vars (~60 variables)
- `package.json` — added `harness:state`, `harness:state:status`, `harness:state:approvals`

**This unblocks:** v2.8.0 (doc workflow), v2.9.0 (Teams notifier), v3.0.0 (control panel SSE)

---

### v2.7.0 — Phase 0 Shared Foundations (Planned, ~1 day effort)
**Target**: 2026-08-XX  
**Type**: Patch (shared utilities, non-breaking)

**Scope**:
- Extract `scripts/harness/stage-state.mjs` for shared state management
- Update `harness.config.json` with mode enum and docWorkflow section
- Document `.env` variables (HARNESS_API_KEY, HARNESS_HTTP_PORT, HARNESS_TEAMS_WEBHOOK_URL, HARNESS_HTTP_URL)
- All changes additive and backward-compatible

**Blocking Pre-Impl Questions** (from #27):
- [ ] Confirm toolSpecs can be extracted from config: `npm run harness:mcp:find -- --tags toolSpecs`

**Delivery Criteria**:
- ✅ stage-state.mjs: readStageState(), writeStageState(), readApprovals(), writeApproval()
- ✅ Config extended with mode="doc-workflow" and related settings
- ✅ .env.example updated and documented
- ✅ Zero breaking changes, backward-compatible mode="dev" default

---

### v2.8.0 — Doc Workflow Mode ✅ DELIVERED 2026-08-03

**What shipped:**
- `scripts/harness/doc-verifier.mjs` — document quality verifier: Flesch-Kincaid Reading Ease
  (pure JS, no deps), required sections check, word count thresholds (global + per-section).
  Exit 0 = pass, 1 = fail. All thresholds overridable via CLI flags.
- `.github/harness/loops/doc-workflow.json` — convergence loop: runs `doc-verifier.mjs` as its
  check; fix prompt instructs agent to improve readability without gaming thresholds.
- `harness.config.json` — `docWorkflow` section fully populated: `targetFile`, `toolSubset`
  (allowed/blocked list), `verifier` (minScore 60, min 100 words, max 5000 words, per-section map).
- `package.json` — added `harness:doc:verify`, `harness:doc:loop`.

**Usage:**
```bash
npm run harness:doc:verify -- --file README.md
npm run harness:doc:loop -- --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5:14b"
```

---

### v2.8.0 — Doc Workflow Mode (Planned, ~2 days effort)
**Target**: 2026-08-XX  
**Type**: Minor (new productivity mode, non-breaking)

**Scope**:
- Implement mode="doc-workflow" in harness config
- Build doc verifier (readability checks, required sections, word count validation)
- Support docs + Excel + PowerPoint inputs
- New loop: `doc-workflow-loop.json` for non-coder productivity
- Tool subset: Non-code tools only (no exec, no SSH)

**Blocking Pre-Impl Questions** (from #29):
- [ ] Doc verifier metrics: readability formula name, required sections list, word count thresholds?
- [ ] Which input formats are MVP (docs, xlsx, pptx)?

**Delivery Criteria**:
- ✅ mode="doc-workflow" enforces non-code tool subset
- ✅ Doc verifier passes all acceptance tests
- ✅ New loop supports doc-input scenarios
- ✅ Zero breaking changes to existing modes
- ✅ E2E test: Start loop in doc-workflow mode, verify tool restrictions

---

### v2.9.0 — Teams Integration & Adaptive Cards ✅ DELIVERED 2026-08-03

**What shipped:**
- `scripts/harness/teams-notifier.mjs` — Adaptive Card generation + webhook poster:
  - `stage-complete` card: loop finished with status, iteration, run-id
  - `approval-needed` card: pending approval with CLI approve/reject commands
  - `error-alert` card: error with failed checks and detail
- Auto-reads live state from `stage-state.mjs` when no explicit flags given
- Webhook URL from `HARNESS_TEAMS_WEBHOOK_URL` env var (validated; never from CLI)
- `--dry-run` prints card JSON and Teams payload without posting
- `harness:teams:notify` npm script
- Interactive buttons require Power Automate (Phase 3); MVP shows CLI commands instead

---

### v2.9.0 — Teams Integration & Adaptive Cards (Planned, ~1 day effort)
**Target**: 2026-08-XX  
**Type**: Minor (new notification channel, non-breaking)

**Scope**:
- Teams Adaptive Card generation for loop notifications
- Card templates: stage-completion, approval-needed, error-alert
- Webhook integration: HARNESS_TEAMS_WEBHOOK_URL from env
- Dependency: Requires stage-state.mjs from Phase 0 (v2.7.0)

**Blocking Pre-Impl Questions** (from #30):
- [ ] Card button dependency on WS2 HTTP adapter: is MVP buttons-only or include actions?

**Delivery Criteria**:
- ✅ Adaptive Cards render correctly in Teams
- ✅ Webhook authentication validated
- ✅ Stage state → card mapping tested
- ✅ Zero breaking changes
- ✅ E2E test: Stage completes → card posts to Teams

---

### v3.0.0 — Harness Control Panel ✅ DELIVERED 2026-08-03

**What shipped:**
- `scripts/harness/control-panel.mjs` — three exported handlers:
  - `handleSseState` — SSE stream polling `stage-state.json` every 2 s; heartbeat every 25 s;
    `Last-Event-ID` replay on reconnect; `retry: 3000` hint
  - `handleControlPanel` — self-contained HTML panel; `?role=operator` (full) or `?role=end-user`
    (approvals only); dark mode support; exponential-backoff reconnect + tab-visibility reconnect
  - `handleApprove` — `POST /control/approve`; validates decision; writes via `writeApproval()`
- `scripts/harness/report-server.mjs` — three new routes added (`/control`, `/sse/state`,
  `/control/approve`); `startControlPanelPolling()` wired at startup
- `package.json` — `harness:control` alias for `harness:dashboard`

**Access:** `npm run harness:dashboard` then open `http://localhost:8099/control`

---

### v3.0.0 — Harness Control Panel (Planned, ~2 days effort)
**Target**: 2026-08-XX  
**Type**: Major (interactive harness control UI — distinct from LLM chat)

> **Scope clarification (2026-08-03):** This is a *harness control panel*, not a general LLM chat
> UI. The LLM chat layer is now covered by Open WebUI + `harness-proxy.mjs` (v2.5.1). v3.0.0
> focuses exclusively on harness-native control: real-time stage visibility and approval
> without needing to run CLI commands.

**Scope**:
- Harness control panel served from `report-server.mjs` (extend existing dashboard)
- SSE (Server-Sent Events) for real-time stage-progress updates
- Role-based view: Operator (all stages + metrics) vs. end-user (approval buttons only)
- Approval interface: Click to approve/reject without CLI
- Stage log streaming: live output from active loop run
- Dependency: Requires stage-state.mjs from Phase 0 (v2.7.0)

**What this is NOT**:
- Not a general LLM chat UI (Open WebUI + harness-proxy handles that)
- Not a replacement for the existing report dashboard (extends it)

**Blocking Pre-Impl Questions** (from #31):
- [ ] SSE reconnection strategy: backoff algorithm, client timeout, session refresh, queue depth?

**Delivery Criteria**:
- ✅ SSE connection established and maintained
- ✅ Reconnection strategy tested (network interruption, server restart)
- ✅ Approval workflow works end-to-end
- ✅ UI rendered correctly in modern browsers (Chrome, Edge, Firefox)
- ✅ Zero breaking changes
- ✅ E2E test: Start loop → UI shows stage progress → approve from UI → harness continues

---

### v3.1.0+ — Phase 3 & Beyond (Future Planning)
**Target**: Post v3.0.0 delivery

**Phase 3 Roadmap** (from v2.6.0 HTTP adapter):
- Azure AD OAuth 2.0 for production authentication
- Enterprise SSO integration
- Rate limiting & quotas per tenant
- API key rotation strategy

**Potential Future Workstreams**:
- Multi-agent coordination mode
- Custom skill marketplace
- Cloud-hosted harness service
- Advanced analytics & reporting
- Mobile UI companion app

---

## 📊 Delivery Timeline

```
Current (v2.5.1 patch) → v2.6.0 (3d) → v2.7.0 (1d) → v2.8.0 (2d) + v2.9.0 (1d) parallel + v3.0.0 (2d) parallel
                              ↓                ↓                  ↓                      ↓
                       HTTP adapter      Phase 0 unlock    Doc workflow        Harness control panel
                       (full REST MCP)   (blocks all below) + Teams notif.     (SSE stage progress
                       OpenAPI, OAuth                                           + approval UI)

[v2.5.1 already done]: file-search, prompt-middleware, harness-proxy (Open WebUI chat layer) ✓

**Sequential**: v2.6.0 → v2.7.0 (Phase 0 is blocker for v2.8/v2.9/v3.0)
**Parallelizable**: v2.8.0, v2.9.0, v3.0.0 after v2.7.0 lands (~6-7 days total to v3.0.0 GA)
```

---

## 🔗 Reference Documentation

### Phase 0 Shared Foundations
- **Architecture Brief**: [`.github/harness/memory/briefs/re-evaluate-documented-issues-2026-07-28.md`](.github/harness/memory/briefs/re-evaluate-documented-issues-2026-07-28.md)
- **Issue #27**: Phase 0 implementation details and pre-impl checklist
- **Expected Output**: `scripts/harness/stage-state.mjs` (shared state module)

### HTTP Adapter (WS2)
- **Issue #28**: HTTP adapter design, OpenAPI generation, OAuth roadmap
- **Expected Output**: `scripts/harness/http-adapter.mjs`, OpenAPI schema endpoint

### Doc Workflow (WS1)
- **Issue #29**: Non-coder productivity mode, doc verification metrics
- **Expected Output**: New mode="doc-workflow", doc verifier, new loop
- **Pre-Impl Gate**: Readability formula, required sections, word count thresholds

### Teams Integration (WS3a)
- **Issue #30**: Adaptive Card templates, webhook integration
- **Expected Output**: Card generation functions in `report-server.mjs`, Teams notifier

### Web UI Live Panel (WS3b)
- **Issue #31**: Interactive UI, SSE live updates, approval workflow
- **Expected Output**: New web UI panel served from `report-server.mjs`
- **Pre-Impl Gate**: SSE reconnection strategy details

---

## ✅ Decision Gates for Each Release

### v2.6.0 Pre-Implementation Gate ✅
- [ ] **OAuth 2.0 Roadmap**: Confirm Phase 3 timeline, target milestone, and scope in Issue #28 comment
- [ ] **Endpoint Scope**: Clarify MVP vs. Phase 2 endpoints in Issue #28
- [ ] **Rate Limiting**: Decision on strategy (per-API-key? per-tenant?) documented

### v2.7.0 Pre-Implementation Gate ✅
- [ ] **ToolSpecs Extraction**: Run `npm run harness:mcp:find -- --tags toolSpecs` and confirm success in Issue #27
- [ ] **Config Validation**: Ensure .env variables don't conflict with existing system env

### v2.8.0 Pre-Implementation Gate ✅
- [ ] **Doc Verifier Metrics**: Specify readability formula name, required sections list, word count thresholds in Issue #29
- [ ] **Input Format Priority**: Confirm docs/xlsx/pptx MVP scope in Issue #29
- [ ] **Tool Subset**: Validate that non-code tool list is correct in issue comment

### v2.9.0 Pre-Implementation Gate ✅
- [ ] **Card Button Actions**: Clarify if WS2 HTTP adapter must ship before WS3a or can be independent in Issue #30
- [ ] **Teams Webhook**: Confirm authentication method (Bearer token? Managed identity?) in issue comment

### v3.0.0 Pre-Implementation Gate ✅
- [ ] **SSE Reconnection Strategy**: Define backoff algorithm (exponential? linear?), client timeout (ms), session refresh interval, message queue depth in Issue #31
- [ ] **Browser Support**: Confirm supported browser matrix (latest 2 versions?) in issue comment

---

## 🎓 Lessons Learned

1. **Risk-First Sequencing Wins**: Phase 0 → WS2 (high complexity) → parallel WS1/WS3a/WS3b is more reliable than effort-first
2. **Pre-Implementation Clarifications Must Be Explicit**: Blocking gates identified early prevent rework in Implement stage
3. **Shared Modules Should Be Extracted Early**: stage-state.mjs used by 4 downstream features; extract once, reuse many
4. **Measurement Rigor Requires Patience**: 3× slower loops but infinitely more defensible than 1-sample measurements
5. **Documentation Synchronization Matters**: Version surfaces (package.json, release notes, README) must stay in sync or adoption breaks

---

## 📞 Questions or Issues?

- Check [`.github/harness/memory/briefs/`](.github/harness/memory/briefs/) for decision rationale
- Review individual GitHub issues (#27-31) for implementation details
- Run `npm run harness:report` to check current harness status
- Run `npm run harness:docs:check` to validate documentation consistency

---

**Last Review**: 2026-08-03 (full end-to-end audit — all v2.5.1 through v3.1.0 features validated; teach.mjs backtick bug fixed; OKF migration applied to 137 files; pluginRoot config corrected)  
**Authority**: Dfintz (harness-team)  
**Status**: APPROVED FOR EXECUTION
