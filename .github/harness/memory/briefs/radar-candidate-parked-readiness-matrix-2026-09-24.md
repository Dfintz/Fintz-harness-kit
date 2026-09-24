# Radar Candidate and Parked Readiness Matrix

resource: .github/harness/memory/radar/, .github/harness/memory/briefs/radar-candidate-parked-readiness-2026-09-24.md
Status: active

## Summary

- Pending candidates: **0**.
- Parked entries: **32**.
- Ready for immediate adoption: **0**.
- Ready for bounded pilot/research: **3**.
- Still blocked: **29**.

## Ready for Pilot

The order below is the recommended execution order. All thresholds are provisional. Owner labels are accountable repository roles; the pilot task opener must record a named assignee before execution.

| Entry | Owner | Fixed input and bounded output | Proceed or repark gate |
| --- | --- | --- | --- |
| `awesome-harness-engineering-delta-feed` | Radar Governance Owner | Base `walkinglabs/awesome-harness-engineering@cff9b006ef64c624a62cbb1ee36b0c4b2b3a67ad`; run two 14-day cycles, each capped at 90 reviewer minutes and 50 changed links. Pin each ending commit and persist `.github/harness/memory/briefs/awesome-harness-delta-feed-pilot-<end-date>.md` with changed links, duplicates, candidates, missed-link audit, and effort. Empty cycles are recorded and not extended. | Provisional: promote only if both cycles each yield at least one source-grounded nonduplicate candidate with no changed-link miss; an empty cycle, miss, or budget overrun reparks. |
| `openai-codex-harness-open-source` | Context Engineering Owner | Pin `openai/codex@29f056c26c09b51db123069ed3ec2095b227d6db`; inspect at most 25 files under `codex-rs/core`, `codex-rs/app-server`, `codex-rs/protocol`, and `codex-rs/app-server-protocol`, capped at four reviewer hours and 20,000 quoted/extracted source characters. Persist `.github/harness/memory/briefs/openai-codex-harness-source-read-29f056c.md`. | Provisional: promote only if a cited portable difference is not shipped and names one bounded local task; cap exhaustion or no qualifying difference reparks as reference architecture. |
| `twelve-factor-agents` | Harness Architecture Owner | Pin `humanlayer/12-factor-agents@d20c728368bf9c189d6d7aab704744decb6ec0cc`; compare `README.md` and twelve `content/factor-*.md` files with `.github/harness/HARNESS.md` and `.github/harness/LOOPS.md`, capped at 15 source files, three reviewer hours, and 18,000 quoted/extracted source characters. Persist `.github/harness/memory/briefs/twelve-factor-agents-comparison-d20c728.md`. | Provisional: promote only if the cited factor table identifies a genuine local gap and one bounded task; cap exhaustion or only renamed/already-shipped behavior reparks. |

All three stay `parked` until their separate pilot gates pass.

## Still Blocked

| Entry | Owner | Current blocker | Trigger to reassess |
| --- | --- | --- | --- |
| `anthropic-hybrid-fusion-retrieval` | Retrieval Quality Owner | No benchmark evidence that semantic/contextual retrieval misses required thresholds; lexical fusion adds index/scoring complexity. | A fixed retrieval eval demonstrates exact-match/recall failures that contextual semantic retrieval cannot recover. |
| `anthropic-skill-security-scanning-and-open-standard` | Radar Governance Owner | Validates the existing SkillSpector gate but identifies no missing local capability. | SkillSpector policy is substantively revised or a cross-platform skill-package compatibility requirement appears. |
| `bholmesdev-done-feature-closeout` | PR Workflow Owner | External skill-pattern scan/waiver absent; destructive rebase/merge/ticket/worktree steps need explicit per-operation confirmation despite newer approval surfaces. | SkillSpector/waiver plus an Architect-approved confirmation and rollback contract. |
| `coleam00-dark-factory-dispatcher-priority-order` | Harness Evolution Owner | No autonomous dispatcher exists; the external skill-pack pattern also lacks SkillSpector/waiver evidence. | A reviewed autonomous dispatcher needs deterministic work priority and SkillSpector/waiver exists. |
| `continual-harness-trajectory-window-refinement` | Harness Evolution Owner | Live trusted-store mutation conflicts with quarantine/review promotion boundaries. | A separate task requests proposal-only trajectory refinement into quarantine with human promotion. |
| `dark-factory-autonomy-level-switch-proposal` | Harness Governance Owner | No concrete autonomous consumer; a generic level dial would be ornamental and risks weakening human gates. | Explicit user request for one named unattended behavior and its approval boundary. |
| `disler-peer-agent-messaging` | Multi-Agent Runtime Owner | No workflow requires peer equality over current producer-reviewer/supervisor handoffs. | A concrete workflow cannot be expressed hierarchically and defines hop/timeout/trust needs. |
| `disler-self-compact-forced-checkpoint` | Context Runtime Owner | No persistent tool-call dispatcher can enforce a hard cutoff mid-session. | Harness adopts a persistent runtime and measured sessions cross warning thresholds without checkpointing. |
| `disler-self-compact-verbatim-continuation` | Continuity Owner | No reproducible interrupted-session loss; continuation is intentionally metadata-only. | Reproducible checkpoint/delivery interruption that current journals and stage state cannot recover. |
| `harness-evolver-meta-harness` | Harness Evolution Owner | No completed real harness-evolve baseline cycle establishing stable score/runtime behavior. | One full real-agent evolve cycle completes with recorded score, verdict, and recovery evidence. |
| `harness-r1-lifecycle-hook-positions` | Hook Governance Owner | Batch-failure machinery is shipped, but no empirical failure distribution maps failures to intervention positions; fail-open is unsafe for security hooks. | At least a representative batch of graded failures supports a local position vocabulary and separates safety-critical fail-closed hooks. |
| `hermes-auto-memory-provider` | Memory Governance Owner | No consent, retention, privacy, tenant, or retrieval-quality policy; safer scratch notes are shipped. | Explicit operator auto-capture requirement plus privacy/retention policy and eval-first retrieval Brief. |
| `hermes-three-layer-wiki-curation` | Knowledge Curation Owner | No operator-owned external research workflow; duplicates radar/brief/lesson surfaces; the external skill pattern lacks SkillSpector/waiver evidence. | Project adoption explicitly requires curated external research with a named editorial owner and SkillSpector/waiver exists. |
| `inkwell-provider-neutral-sandbox-lifecycle` | Sandbox Runtime Owner | No sandbox runtime/operator use case; adopting it changes the kit into an execution runtime. | User need for isolated parallel/unattended execution plus threat model and one opt-in provider. |
| `inkwell-sandbox-artifact-harvest` | Sandbox Runtime Owner | No sandbox executor/ref exists to harvest from. | Sandbox lifecycle is approved; then architect ref-only import/provenance/merge contract. |
| `inkwell-short-lived-sandbox-credentials` | Security Boundary Owner | No sandbox provider consumes scoped credentials. | Sandbox provider proposal; require spend cap, capability scope, revocation, and teardown proof. |
| `llm-as-judge-rubrics` | Harness Evaluation Owner | No completed full harness-evolve cycle, calibrated eval baseline, or demonstrated failure of current deterministic/trajectory signals. | One full evolve cycle and eval baseline exist, and fixed traces with human labels show a scoring gap; then run eval-first rubric comparison without new release authority. |
| `manus-kv-cache-stable-prefix` | LLM Provider Owner | Requested audit already verified stable ordering, no timestamp prefix mutation, and no dynamic tool list; no active gap. | Provider prompt/tool assembly changes or production cache-miss evidence appears. |
| `mattpocock-domain-modeling` | Domain Governance Owner | SkillSpector is not installed and no waiver exists; ontology/glossary ownership is unresolved. | Scan/waiver plus Architect decision preventing duplicate `CONTEXT.md`/ontology/Brief ownership. |
| `mattpocock-redaction-first-diagnostics` | Security Documentation Owner | SkillSpector is not installed and no waiver exists. | Scan/waiver, then bounded documentation-only task for diagnostic evidence redaction. |
| `omo-hyperplan-multi-critic` | Harness Review Owner | Proposed inputs are post-review Briefs, no exact single-reviewer baseline is named, token/cost evidence is absent, and inputs are uncommitted; SkillSpector/waiver is also required before adopting the external skill pattern. | Content-addressed pre-review inputs, exact baseline artifacts, fixed measurable budget, and SkillSpector/waiver all exist. |
| `openai-guardrails-python-pipeline` | Guardrail Architecture Owner | OpenAI/Python coupling, new runtime dependencies, and no current prompt-injection detection/screening gate; `untrusted.mjs` already provides boundary/defang handling. | Dedicated provider-neutral prompt-injection/jailbreak screening gate is scoped; compare pipeline shape with Sentinel. |
| `pi-setup-thinking-budget-tokens` | Model Routing Owner | No first-class extended-thinking consumer/config surface; the external subagent skill pattern lacks SkillSpector/waiver evidence. | User requests extended-thinking support, model tiers need explicit thinking budgets, and SkillSpector/waiver exists. |
| `sentinel-ai-hook-mcp-guardrails` | Guardrail Architecture Owner | Young security dependency with unverified latency/security claims; no current prompt-injection detection/screening gate beyond the existing `untrusted.mjs` boundary/defang handling. | Independent security/eval evidence or explicit governance waiver plus a scoped provider-neutral screening gate. |
| `sloop-worktree-agent-scheduler` | Harness Evolution Owner | Same missing real evolve baseline as meta-harness; shallow-clone/worktree behavior unproven. | Real evolve baseline plus deterministic worktree add/remove test on supported environments. |
| `sruja-actor-never-grades-itself` | Deterministic Validation Owner | Vocabulary corroborates already shipped independence-line behavior; no new capability gap. | Next substantive deterministic-validation rewrite reveals a clarity gap worth evaluating. |
| `superpowers-human-partner-language` | Agent Interaction Owner | Broad terminology change has no local behavioral evidence. | New content pilot shows measurable uncertainty/escalation benefit before wider rewrite. |
| `superpowers-session-start-hook` | Platform Integration Owner | Platform-specific context injection lacks selected first client and bootstrap contract; the external skill-pack hook lacks SkillSpector/waiver evidence. | Concrete Claude Code/Copilot bootstrap failure, one-platform architecture task, and SkillSpector/waiver. |
| `typesafe-jev-system-one-guardrail-model` | Model Evaluation Owner | Early-access proprietary vendor; no independent benchmark or current classifier gap. | Broad access plus independent task-relevant quality/calibration and cost evidence. |

## Notes on Overlap

- The already-adopted contextual-embeddings technique is listed only as the comparison baseline for parked lexical fusion; no supersession decision is justified.
- OpenAI Guardrails and Sentinel remain separate pipeline versus hook/MCP design references.
- The three Inkwell entries remain separate because lifecycle, artifact import, and credential boundaries have distinct owners, even though they share the sandbox-provider prerequisite.
