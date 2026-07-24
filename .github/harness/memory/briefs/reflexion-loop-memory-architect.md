## Architecture Brief

### Objective

Add opt-in per-iteration reflexion memory to `run-loop.mjs` so that when a loop iteration fails, the agent writes a structured self-diagnosis (TRIED / OUTCOME / HYPOTHESIS), and that diagnosis is injected verbatim into the next iteration's fix prompt. This directly addresses the pattern where loops exhaust `maxIterations` repeating the same wrong approach because each iteration starts without a record of what the prior attempt concluded.

Source technique: [Reflexion (Shinn et al., arxiv 2303.11366)](https://arxiv.org/abs/2303.11366). Radar entry: `.github/harness/memory/radar/reflexion-loop-memory.md`.

---

### Scope and boundaries

**In scope:**
- `scripts/harness/run-loop.mjs` — inject reflexion into prompt, write scratchpad path, read prior reflexion
- `.github/harness/loops/_template.json` — add optional `reflexionEnabled` field with documentation comment
- `.github/harness/LOOPS.md` — add Reflexion section explaining the protocol

**Out of scope:**
- `scripts/harness/run-experiment.mjs` — experiment loops optimize a metric, not a fix loop; reflexion does not apply
- Any convergence loop JSON files — `reflexionEnabled` defaults to `false`; no existing loop is modified
- Any changes to `wrapUntrusted.mjs`, journal schema, or agent command format

---

### Artifacts to create

- None — all changes are additive modifications to existing files

### Artifacts to modify

- `scripts/harness/run-loop.mjs`
  - Add `reflexionScratchpadPath(journalFile, iteration)` helper → returns `<runsDir>/<journal-stem>-reflexion-<N>.md`
  - Add `loadPriorReflexion(journalFile, iteration)` helper → reads and `wrapUntrusted`-wraps the file if it exists, returns `null` if absent
  - Modify `composeFixPrompt(loop, failures, iteration, journal)` → add optional `priorReflexion` parameter; when present, inject before the failing checks block; when `loop.reflexionEnabled` is truthy, append the reflexion request at the end
  - After `invokeAgent(agentCmd, prompt)`, if `loop.reflexionEnabled`, attempt to read the scratchpad (no-op if not written by agent)

- `.github/harness/loops/_template.json`
  - Add `"reflexionEnabled": false` with a JSON comment (as a `_reflexionEnabled_note` string field explaining the opt-in)

- `.github/harness/LOOPS.md`
  - Add a **Reflexion** subsection under Invariants explaining the scratchpad contract

---

### Key decisions

- **Decision: opt-in via `reflexionEnabled: false` default.**
  Existing loops must not change behavior. A new flag avoids touching any existing loop JSON.

- **Decision: scratchpad file scoped to journal stem + iteration number.**
  This makes reflexion ephemeral (tied to a single run) and avoids cross-run pollution. Path: `runs/<loop>-<timestamp>-reflexion-<N>.md`. Deleted with the journal when runs are cleaned.

- **Decision: scratchpad is model-generated output → `wrapUntrusted` before injection.**
  The runner already uses `wrapUntrusted` for check outputs. The same pattern applies here. The reflexion block is wrapped and labeled `source: reflexion:<iteration-N>` before embedding in the next prompt. This prevents prompt injection attacks where a malicious codebase causes the agent to write a reflexion that manipulates the loop's guardrails.

- **Decision: no-op if agent does not write the reflexion.**
  The runner checks file existence after `invokeAgent` returns. If the agent ignored the request, the loop continues normally without error. This preserves backward-compatible behavior and avoids penalizing loops where the agent is non-compliant.

- **Decision: do NOT add reflexion to `run-experiment.mjs`.**
  Experiment loops edit a numeric target and revert on no improvement. The concept of "why my fix failed" does not map to metric optimization.

---

### Constraints

- `reflexionEnabled` must default to `false` — zero behavior change to existing loops
- Reflexion file must be read with `readFileSync` and wrapped with `wrapUntrusted` before any prompt injection
- The reflexion request must be at the END of the fix prompt (after guardrails), to minimize risk of the request overshadowing the actual fix instructions
- Reflexion files live under `runsDir` alongside the journal — do not write them anywhere else
- The loop runner must not fail if the agent does not produce the reflexion file
- No change to `record.iterations` journal schema — reflexion is a side-channel scratchpad, not a journal field

### Validation plan

1. `node scripts/harness/run-loop.mjs --list` — confirms loader still reads loops without error
2. `node scripts/harness/harness-evolve.mjs --check` — confirms forbidden-file integrity not broken
3. `node scripts/harness/eval/run-eval.mjs --self-test` — confirms eval suite hash unchanged
4. Manual dry-run: create a minimal test loop with `reflexionEnabled: true`, one always-failing check, `--max-iterations 2`; verify the second iteration prompt contains the reflexion block

### Do NOT

- Do not add `reflexionEnabled: true` to any shipped loop JSON — opt-in only
- Do not add reflexion to `run-experiment.mjs`
- Do not store reflexion in the journal `record.iterations` array — side-channel scratchpad only
- Do not let an absent reflexion file cause an error or early exit
- Do not inject raw reflexion text — always wrap with `wrapUntrusted` first

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
|---|---|---|
| Agents using `--agent "claude -p"` respect a request to write a file during a fix pass | Reflexion quality | If ignored, no-op; loop still converges normally. Low risk. |
| Scratchpad path (runs/ dir) is writable during loop execution | Feature availability | Runs dir is already used for journals; same writability assumption already made. |
