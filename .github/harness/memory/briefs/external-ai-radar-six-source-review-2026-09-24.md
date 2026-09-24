# Architecture Brief: External AI Radar Six-Source Review
resource: <https://github.com/walkinglabs/awesome-harness-engineering>, <https://github.com/James-Chahwan/repo-graph>, <https://github.com/modelcontextprotocol/servers>, <https://github.com/mattpocock/skills>, <https://github.com/disler/self-compact-pi-agent>, <https://github.com/disler>, .github/skills/ai-techniques-radar/SKILL.md, .github/harness/memory/radar/, scripts/harness/graph.mjs, scripts/harness/graph-provider.mjs, scripts/harness/context-compaction.mjs, scripts/harness/context-growth-guard.mjs
Status: active

## Architecture Brief

### Objective

- Evaluate all six requested sources against current harness capabilities and persist concise, source-linked adoption decisions without implementing external techniques in the triage run.

### Scope and boundaries

- In scope: current upstream README, changelog, benchmark, and design evidence; existing local radar and brief overlap; one radar entry per idea with a distinct adoption path.
- In scope: classify ideas as `adopted`, `parked`, or `rejected` using the radar adoption gate.
- Out of scope: vendoring external code or skill files, changing runtime behavior, installing MCP servers, or implementing any adopted follow-up.
- Primary boundary: committed decision memory under `.github/harness/memory/`.
- Understand status, verified 2026-09-24: `understand-anything` matches HEAD `b01ec72`; `fresh: true`, `commitsBehind: 0`, `sourceFilesChanged: 0`.

### Artifacts to create

- `.github/harness/memory/radar/repo-graph-structured-absence.md` - adopt a bounded follow-up for explicit graph miss reasons, evidence class, searched scope, and blind spots.
- `.github/harness/memory/radar/disler-self-compact-forced-checkpoint.md` - park context-threshold tool blocking until the harness owns a compatible long-running agent runtime boundary.
- `.github/harness/memory/radar/disler-self-compact-verbatim-continuation.md` - park durable, byte-preserving continuation delivery until a local interrupted-session recovery gap is demonstrated.
- `.github/harness/memory/radar/mattpocock-redaction-first-diagnostics.md` - park redaction-first diagnostic evidence handling pending SkillSpector evidence or a named waiver.
- `.github/harness/memory/radar/awesome-harness-engineering-delta-feed.md` - park a periodic delta-based discovery feed until a bounded intake command and deduplication rule are designed.
- `.github/harness/memory/radar/disler-peer-agent-messaging.md` - park a bounded peer-agent messaging envelope until a current non-hierarchical coordination need exists.
- `.github/harness/memory/radar/disler-profile-overlap-scan.md` - reject broad profile-level adoption and link to this Brief's owned disposition table.
- `.github/harness/memory/radar/mcp-reference-servers-overlap.md` - reject direct adoption of educational reference servers and preserve the existing local conformance evidence.
- `.github/harness/memory/radar/mattpocock-domain-modeling.md` - park active glossary curation pending SkillSpector evidence or an authorized waiver and a non-duplicative ownership decision; selective ADR-policy adoption is outside this run.

### Artifacts to modify

- Original delivery modified no pre-existing artifacts. Feedback authorizes documentation corrections to this run's mutable Brief, challenge, implementation summary, and radar entries only.
- Preserve the frozen Breadth ledger and all eight pre-existing untracked radar files.

### Key decisions

- Decision: adopt RepoGraph's structured absence contract as a future local task. A current, refreshed local query for `__radar_missing_symbol__` returns only `{ ok: true, count: 0, results: [] }`, so callers cannot distinguish no match from extraction blindness. Upstream's 56-run benchmark reports about 3x lower cost in every matched pair, while explicitly finding no safety improvement; the local claim must stay limited to uncertainty and cost.
- Decision: park self-compaction's forced checkpoint. The harness already has deterministic loop-history compaction and a prompt-size warning. Blocking every tool except compaction belongs to Pi's persistent runtime and does not map safely onto current one-shot CLI calls.
- Decision: separately park verbatim crash-safe continuation. Compact handoffs and continuation metadata already cover planned stage transitions, but the source adds durable handoff ids, exact-note round trips, unanswered-handoff recovery, and one-time acknowledgement. That is a distinct recovery contract and needs local interrupted-session evidence before adoption.
- Decision: park redaction-first diagnostics. It is a real local documentation gap, but it comes from an external skill file and SkillSpector is not currently evidenced; the radar gate forbids adoption without a scan or named human waiver.
- Decision: park the awesome-list delta feed. The catalog is active and high-signal, but broad ingestion would duplicate 70+ existing entries. A future intake must compare source revisions and emit only deduplicated candidates.
- Decision: no new adoption from `modelcontextprotocol/servers`. The repo labels its servers educational references, not production components. This harness uses the official SDK client over stdio for resources, streaming, and MRTR continuation, plus raw HTTP contract tests for OAuth and subscriptions.
- Decision: no new adoption from mattpocock's tracer-ticket material in this pass. Tracer slices, blocker edges, frontier ordering, wayfinder, design-it-twice, prototypes, review axes, and debugging feedback loops are already present. Active glossary curation remains parked pending SkillSpector evidence or an authorized waiver plus a non-duplicative owner between ontology and glossary guidance; selective ADR-policy adoption is outside this run.
- Decision: no broad adoption from the rendered disler profile snapshot. The review covered GitHub's displayed popular repositories and September 2026 activity, then cross-checked `external-harness-learnings-2026-08-03.md` for SSSF/fusion-harness and the three `inkwell-*` radar entries for Inkwell. The Brief is the sole owner of the dated six-repository coverage table; the profile radar entry records only rejection of broad profile-level adoption and links here plus the separate technique decisions. The bounded dispositions are:

| Rendered popular repository | Disposition | Evidence |
| --- | --- | --- |
| `claude-code-hooks-mastery` | overlap | Lifecycle hooks, command guards, builder-validator roles, and status/report surfaces already exist locally; upstream warns Stop hooks can loop. |
| `pi-vs-claude-code` | park one delta | Existing pipeline, tool guard, model routing, and UI ideas overlap; capture only the four-tool peer messaging envelope with hop/auth/audit rails. |
| `claude-code-hooks-multi-agent-observability` | overlap | Local run journals, OTel export, reports, lifecycle events, and MCP metrics cover the harness-relevant behavior without its Bun/SQLite/Vue stack. |
| `always-on-ai-assistant` | reject | Voice/STT/TTS product runtime is outside this repository's agent-harness mission. |
| `multi-agent-postgres-data-analytics` | reject | Frozen three-year-old product experiment; role/orchestrator/structured-output ideas are already represented by newer local contracts. |
| `super-simple-software-factory` | already reviewed | `external-harness-learnings-2026-08-03.md` and `external-harness-source-audit-2026-08-03.md` already adopted gate-first acceptance, run bundles, and comparative ledgers. |

	September 2026 profile activity points to `self-compact-pi-agent`, which is handled by two separate parked entries. This is not a claim about all 54 repositories.
- Gate 1, domain alignment: PASS. Decisions belong in radar memory; future graph response semantics belong to graph CLI/provider/MCP owners.
- Gate 2, generality: PASS. Structured absence is provider-neutral; Pi-specific locking is deliberately not generalized prematurely.
- Gate 3, ownership: PASS. This run owns decisions only, not implementation. Each adopted or parked entry names its eventual owner.
- Gate 4, boundary integrity: PASS. External claims remain evidence, never executable instructions; no runtime or security boundary changes occur.
- Gate 4b, isolation and safety: PASS. No third-party package, skill, server, credential, or auto-permission is installed.
- Gate 5, reuse: PASS. Existing radar templates and stage artifacts are reused. Coverage evidence stays in this Brief; each radar entry owns one adoption decision, and the profile entry links back rather than duplicating the coverage table.
- Feedback amendment, 2026-09-24, run `run-20260924055756-baee24d5`: accept the four breadth-added radar artifacts for peer messaging, profile overlap, MCP-reference overlap, and domain modeling subject to `external-ai-radar-six-source-review-feedback-2026-09-24.md`. Accept the bounded profile coverage table and retirement of the stale-graph assumption. This acceptance does not extend the earlier Architect Challenge verdict retrospectively; no repeat challenge is required for this decision-memory-only amendment.

### Constraints

- Follow `.github/harness/memory/radar/_template.md` frontmatter and keep one idea per file.
- Use summaries in original words and retain source URLs and the 2026-09-24 capture date.
- Adopted entries must name a concrete follow-up and target files; parked entries must state the missing trigger or prerequisite.
- Do not claim structured absence improves deletion safety; upstream evidence supports cost reduction only.
- Before marking an external skill-file or skill-pack-pattern entry adopted, capture an acceptable SkillSpector result or a waiver containing written rationale, a named human approver, and a retroactive scan target date within 14 days of approval. Original-word summaries do not create an exemption.
- Treat the technique-triage loop as review-only; no code or workflow implementation may occur.

### Validation plan

- Run the technique-triage rubric against every new entry.
- Run `npm run harness:docs:check` after the first radar edit and after any repair.
- Run a direct frontmatter/status/source/decision-log scan over all new entries because untracked files are not covered by `git diff --check`.
- Run `git diff --check -- .github/harness/memory/briefs .github/harness/memory/radar` as supplementary whitespace validation.
- Review Breadth must verify requirement coverage, evidence precision, security/SkillSpector compliance, and source coverage.
- Review Depth must verify one-idea-per-file ownership and conformance to this Brief.
- After Feedback corrections, check every named local target and cross-link, verify one adoption decision per radar entry, rerun the nine-entry template/status check and `harness:docs:check`, and obtain focused Breadth and Depth rechecks against this amended Brief.

### Do NOT

- Do not implement structured absence, hard-stop compaction, a domain-modeling skill, MCP fixtures, or automated catalog ingestion in this run.
- Do not vendor, install, or execute source repository code.
- Do not modify or delete the eight pre-existing untracked radar files shown by `git status`.
- Do not represent GitHub popularity, README claims, or a single-model benchmark as proof of local quality improvement.
- Do not create duplicate radar entries for already adopted tracer slices, HarnessCard/CAR, context compaction, design-it-twice, review axes, or official-SDK MCP client tests.
- Do not imply retrospective challenge approval, erase review provenance, treat legacy scan exceptions as policy, or implement glossary/ADR workflows in this run.

### Assumptions and risks

- `[UNVERIFIED]` GitHub's rendered pages and raw main-branch files reflect the source revisions intended by the user; force-pushed or deleted upstream content could change details.
- Retired on 2026-09-24: stale-graph uncertainty, supported by the recorded fresh-at-HEAD result. Exact pre-amendment Brief contents and original Breadth severities are not reconstructed.
- Upstream RepoGraph's absence benchmark uses one model, 14 symbols, and a self-authored harness; a local eval-first follow-up is required before implementation is promoted as beneficial.
- The broad `disler` profile and awesome list can change continuously; this review is a dated snapshot, not an exhaustive permanent judgment.
