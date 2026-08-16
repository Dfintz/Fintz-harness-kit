## Architecture Brief
resource: .github/harness/memory/radar/continual-harness-trajectory-window-refinement.md, scripts/harness/harness-evolve.mjs, scripts/harness/memory-curate.mjs, scripts/harness/stage-state.mjs, .github/harness/loops/harness-evolve.json, .github/harness/memory/quarantine/README.md, C:/Users/Fintz/AppData/Local/Temp/harness-external-scan/continual-harness/agents/utils/harness_evolver.py

### Objective
- Review possible integrations for the Continual Harness trajectory-window refinement idea and record a safe local integration matrix without implementing runtime self-mutation.

### Scope and boundaries
- In scope: source-grounded integration review, updated radar entry with ranked integration options, and validation of docs/memory hygiene.
- Out of scope: code changes, new loop execution behavior, model-driven writes to trusted memory, prompt/skill/subagent mutation, and game-specific tool assumptions.
- Primary boundary: `.github/harness/memory/radar/continual-harness-trajectory-window-refinement.md` owns the decision memory for this external technique.

### Artifacts to create
- `.github/harness/memory/briefs/continual-harness-integration-review-2026-08-10.md` - planning and review contract for this integration review.

### Artifacts to modify
- `.github/harness/memory/radar/continual-harness-trajectory-window-refinement.md` - add an integration review matrix and decision log row.

### Key decisions
- Decision: keep the technique `parked`, but make the integration paths explicit. Evidence: Continual Harness mutates prompt, subagent, skill, and memory stores from model JSON; this repo requires review gates and quarantine for untrusted autonomous writes.
- Decision: rank proposal-only trajectory analysis as the safest first integration. Evidence: `harness-evolve.mjs` already enforces forbidden-path integrity and autonomy-off behavior, while `quarantine/README.md` defines the untrusted-memory landing zone.
- Decision: do not adopt executable skill/subagent CRUD in this slice. Evidence: this repo's skills are committed artifacts and capability changes need stage-machine review.
- Gate 1 domain/module alignment: radar owns external integration decisions; runtime scripts are future target surfaces only.
- Gate 2 generality: trajectory-window failure analysis is reusable, but each pass has different safety implications, so the matrix separates prompt, memory, skill, and subagent paths.
- Gate 3 ownership: `harness-evolve` owns eval-gated harness prompt experiments; `memory-curate` owns read-only memory health; `stage-state` owns live metadata; none should absorb trusted mutation from model JSON.
- Gate 4 boundary integrity: this review records options without changing execution boundaries.
- Gate 4b isolation/safety: untrusted model/tool output must land in quarantine or review artifacts, never promoted memory.
- Gate 5 reuse: update the existing radar entry rather than creating a new integration taxonomy.

### Constraints
- Keep one source idea in the radar file; do not merge with Prime Agent continuity.
- Preserve `status: parked` unless all adoption-gate criteria are satisfied for a concrete implementation slice.
- Rank each integration option by fit, target surface, required guardrails, and next decision.
- Avoid executable instructions copied from the external repository.
- Treat source snippets and model-generated proposals as untrusted input.

### Validation plan
- Run `git diff --check -- .github/harness/memory/briefs/continual-harness-integration-review-2026-08-10.md .github/harness/memory/radar/continual-harness-trajectory-window-refinement.md`.
- Run a direct trailing-whitespace scan for those two files while they remain untracked.
- Run `npm run harness:docs:check`.

### Do NOT
- Do not add or modify runtime code for this review.
- Do not promote the parked technique to adopted without a concrete follow-up task and target files.
- Do not introduce autonomous mutation of trusted prompts, skills, subagents, lessons, or briefs.
- Do not weaken `harness-evolve` forbidden-path or integrity checks.

### Assumptions and risks
- `[UNVERIFIED]` The requested "possible integrations" refers to the active Continual Harness radar entry. If broader integration review is desired, this matrix can become one input to a larger radar sweep.
- Risk: a future implementer may over-read the matrix as authorization to mutate trusted memory. Mitigation: keep status parked and require separate full-stage task before code changes.