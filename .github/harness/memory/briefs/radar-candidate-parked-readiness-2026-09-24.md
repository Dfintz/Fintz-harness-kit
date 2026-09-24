# Architecture Brief: Radar Candidate and Parked Readiness

resource: .github/skills/ai-techniques-radar/SKILL.md, .github/harness/loops/technique-triage.json, .github/harness/memory/radar/, .github/harness/memory/briefs/radar-adopted-disposition-2026-09-24.md
Status: active

## Architecture Brief

### Objective

- Answer which candidates are pending adoption and which parked items are ready next, using current blockers and repository evidence rather than age or popularity.

### Scope and boundaries

- Inventory scope: all 80 radar entries; 0 candidate, 39 adopted, 32 parked, 9 rejected.
- Readiness scope: verify each of 32 parked entries against its recorded trigger, current code, run evidence, current SkillSpector policy, and owner boundary.
- Output categories: `ready-now`, `ready-for-pilot`, and `still-blocked`.
- Out of scope: implementing a parked item, promoting status without completing its adoption gate, installing external services, or treating research readiness as adoption readiness.
- Primary boundary: readiness decision memory under `.github/harness/memory/briefs/`; radar entries remain historical source decisions.
- Understand status: the graph matches committed HEAD `b01ec72`, but this assessment is a working-tree snapshot because 17 radar entries and related Briefs are not in that commit. The 32 evaluated radar inputs are content-addressed by `.github/harness/memory/briefs/radar-candidate-parked-readiness-input-manifest-2026-09-24.txt`. SkillSpector is not installed. Real plan-review artifacts exist, while no batched failure-by-hook-position evidence, unattended merge owner, persistent tool dispatcher, sandbox provider, or prompt-injection detection/screening gate was found. `untrusted.mjs` already supplies boundary and defang handling.

### Artifacts to create

- `.github/harness/memory/briefs/radar-candidate-parked-readiness-matrix-2026-09-24.md` - 32-entry readiness matrix, ranked pilots, blockers, owners, and triggers.
- `.github/harness/memory/briefs/radar-candidate-parked-readiness-input-manifest-2026-09-24.txt` - sorted SHA-256 manifest for the 32 evaluated parked radar files.
- `.github/harness/memory/briefs/radar-candidate-parked-readiness-implementation-2026-09-24.md` - delivered assessment and proof summary.

### Artifacts to modify

- None. This run evaluates readiness only; it does not alter radar frontmatter or Decision Logs.

### Key decisions

- Decision: there are no pending candidates; the candidate triage loop is converged.
- Decision: no parked entry is `ready-now`. Every item retains at least one adoption-gate blocker: missing empirical trigger, security scan/waiver, owner/runtime boundary, maturity evidence, or a separately reviewed architecture choice.
- Decision: exactly three entries are `ready-for-pilot`:
  - `awesome-harness-engineering-delta-feed`: owner Radar Governance Owner. Base pin is `walkinglabs/awesome-harness-engineering@cff9b006ef64c624a62cbb1ee36b0c4b2b3a67ad`. Run two 14-day cycles, each capped at 90 reviewer minutes and 50 changed links; each cycle pins its ending commit. An empty cycle is recorded, not extended. Persist `.github/harness/memory/briefs/awesome-harness-delta-feed-pilot-<end-date>.md`. The provisional gate promotes only if both cycles each produce at least one source-grounded nonduplicate candidate and the changed-link audit finds no misses; any empty cycle, miss, or budget overrun reparks the entry.
  - `openai-codex-harness-open-source`: owner Context Engineering Owner. Pin `openai/codex@29f056c26c09b51db123069ed3ec2095b227d6db`; inspect at most 25 files under `codex-rs/core`, `codex-rs/app-server`, `codex-rs/protocol`, and `codex-rs/app-server-protocol`, capped at four reviewer hours and 20,000 quoted/extracted source characters. Persist `.github/harness/memory/briefs/openai-codex-harness-source-read-29f056c.md`. The provisional gate promotes only if a cited portable difference is not already shipped and names one bounded local task; exhaustion of any cap or no qualifying difference reparks it as reference architecture.
  - `twelve-factor-agents`: owner Harness Architecture Owner. Pin `humanlayer/12-factor-agents@d20c728368bf9c189d6d7aab704744decb6ec0cc`; compare `README.md` plus the twelve `content/factor-*.md` files against `.github/harness/HARNESS.md` and `.github/harness/LOOPS.md`, capped at 15 source files, three reviewer hours, and 18,000 quoted/extracted source characters. Persist `.github/harness/memory/briefs/twelve-factor-agents-comparison-d20c728.md`. The provisional gate promotes only if the factor-by-factor table identifies at least one genuine local gap and one bounded task; exhaustion of a cap or renamed/already-shipped behavior reparks it.
- Decision: `omo-hyperplan-multi-critic` is not pilot-ready. Its proposed Briefs are post-review versions, no exact single-reviewer baseline is named, token/cost evidence is absent, and the inputs are uncommitted. It remains blocked until pre-review content-addressed inputs and a fixed measurable budget exist.
- Decision: `manus-kv-cache-stable-prefix` is not pilot-ready because its requested audit already ran and found all named failure modes absent; it remains a future regression guardrail.
- Decision: `anthropic-skill-security-scanning-and-open-standard` validates existing policy but names no missing capability; citation alone is not adoption.
- Decision: `harness-r1-lifecycle-hook-positions` cleared its shipped-feature prerequisite but still lacks the empirical failure distribution required by its own gate.
- Decision: `bholmesdev-done-feature-closeout` has newer approval surfaces, but current SkillSpector policy and destructive-operation design still block adoption.
- Decision: contextual embeddings and lexical fusion remain distinct; OpenAI and Sentinel guardrail entries remain separate design references; Inkwell sandbox entries remain separate lifecycle/harvest/credential decisions. No stale reclassification is justified in this run.
- Gate 1, domain alignment: PASS. Readiness classification belongs in radar decision memory.
- Gate 2, generality: PASS. The three categories apply uniformly to all parked techniques.
- Gate 3, ownership: PASS. Matrix owns current readiness; radar files own historical technique decisions.
- Gate 4, boundary integrity: PASS. Pilot recommendations are evidence collection, not implementation or permission expansion.
- Gate 4b, isolation and safety: PASS. Skill patterns remain scan-or-waiver gated; destructive/runtime/security items remain blocked.
- Gate 5, reuse: PASS. Reuses existing radar statuses, triggers, run evidence, and adopted disposition rather than duplicating techniques.

### Constraints

- Every parked entry must appear exactly once in the readiness matrix.
- `ready-for-pilot` must name a bounded, non-production evidence activity and a promotion/rejection decision gate.
- Every pilot must name an owner, pinned/fixed inputs, bounded output artifact, predeclared budget where models are invoked, and proceed-or-repark criterion.
- Owner labels are accountable repository roles, not proof of human assignment. The task opener must bind a named assignee to the role in the pilot artifact before execution; an unassigned pilot fails its start gate.
- A pilot may not start until the evaluated radar inputs pinned by `radar-candidate-parked-readiness-input-manifest-2026-09-24.txt` are committed. Its pilot artifact must record the commit SHA containing those inputs; a pilot opened against untracked inputs fails its start gate.
- The `twelve-factor-agents` pilot artifact must record `humanlayer/12-factor-agents@d20c728368bf9c189d6d7aab704744decb6ec0cc` as a related source alongside the entry's recorded HumanLayer blog source; it must not silently substitute one source for the other.
- Do not call research/pilot readiness “ready to adopt.”
- Do not promote an external skill pattern without SkillSpector evidence or authorized waiver.
- Preserve all existing radar statuses and Decision Logs.

### Validation plan

- Deterministically compare the matrix's unique entry IDs with the current parked-file ID set; fail on any duplicate, omission, or extra entry.
- Assert exactly 3 `ready-for-pilot` rows and 29 `still-blocked` rows.
- Verify the three pilot IDs are delta-feed, Codex, and Twelve-Factor; verify each exists and remains parked.
- Recompute the sorted 32-file SHA-256 input manifest and fail on drift.
- Verify each of the 29 blocked entries has a named blocker, trigger, and owner.
- Run `npm run harness:docs:check` and scoped `git diff --check`.
- Run independent Breadth and Depth reviews against this Brief.

### Do NOT

- Do not run or implement the pilots in this assessment.
- Do not invent thresholds unsupported by source or local baseline; pilot gates may define proposed measurements but must label them provisional.
- Do not merge one-idea-per-file radar entries merely because they share a prerequisite.
- Do not treat existing plan-review volume as proof that multi-critic review improves outcomes.
- Do not weaken human approval, security, sandbox, or persistent-runtime boundaries.

### Assumptions and risks

- `[UNVERIFIED]` Upstream source state may have changed since each entry was captured; readiness is based on recorded technique plus current local blockers, not a fresh upstream audit for all 32.
- A no-code pilot can still consume significant model/reviewer budget; execution requires its own task and explicit budget.
- The matrix may become stale as blockers clear; it is a dated snapshot, not automatic policy.
