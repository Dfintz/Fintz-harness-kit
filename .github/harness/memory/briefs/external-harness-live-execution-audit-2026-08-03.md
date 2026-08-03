---
summary: "Architecture Brief — live execution audit of SSSF and fusion-harness"
type: brief
status: active
source: research
created: 2026-08-03
updated: 2026-08-03
tags: [research, audit, live-execution, sssf, fusion-harness, 2026]
---
# Architecture Brief — live execution audit of SSSF and fusion-harness

resource: .github/harness/memory/briefs/external-harness-source-audit-2026-08-03.md, external runtime sandbox at %TEMP%/harness-live-audit, scripts/harness/graph-provider.mjs

**Date:** 2026-08-03  
**Status:** APPROVED

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| Prior source-audit brief | Current adoption recommendations before live execution | Harness memory |
| Temp SSSF clone + stamped target repo | Real install and workflow execution surface | External runtime sandbox |
| Temp fusion-harness clone | Real extension execution surface | External runtime sandbox |
| Disposable Pi config + local Ollama models | Headless local model runtime for audits | Local audit harness |
| Terminal outputs from SSSF and fusion runs | Executable proof of success/failure boundaries | Audit evidence |

**Scope:** workflow / runtime audit  
**Primary boundary:** validate whether the source-level recommendations survive contact with real execution on this workstation

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Hosted-provider credentials for the external repos' default rosters | Whether the same workflows succeed under their intended cloud model setup |
| A Pi TUI interactive session capture for fusion | Whether any TUI-only behavior differs materially from the verified JSON-mode execution path |

Proceeding is safe because this task is observational. The audit can still settle real runtime blockers and runtime-shape caveats even when the default cloud-provider path is unavailable.

## Understand Output

### Changed components

- `.github/harness/memory/briefs/` — new live-execution audit artifacts only

### Affected components

- Recommendation confidence for Slice A and Slice D
- Future operator docs if adoption work begins

### Layers involved

- External runtime execution
- Local audit environment assumptions
- Harness recommendation memory

### Complexity hotspots

- SSSF relies on `agent_pi.resolve_model()` during config validation before any workflow phase opens.
- fusion-harness can run slash commands headlessly in JSON mode, but its validator depends on actual tool-following behavior from the chosen model.

## Live Execution Findings

### SSSF workflow audit

**Workflow attempted:** `adw_build_test.py` in an isolated temp target repo, with the roster default overridden to `ollama/qwen2.5:latest`.

**Observed outcome:** failed before the first build phase in config validation.

**Concrete blocker:** inside the stamped ADW runtime on this Windows machine, SSSF's `agent_pi.resolve_model()` shells out to `pi --list-models` and does not find the `pi` executable from within the `uv run` Python subprocess. The resulting failure is:

- `model pattern 'ollama/qwen2.5:latest' not found in pi --list-models — authenticate/register it or fix the config`

Additional reproduction showed the lower-level cause more directly:

- a direct `subprocess.run(['pi', '--list-models'])` from the same `uv run` environment raised `FileNotFoundError: [WinError 2]`.

**Audit value:** this is not a model-quality failure. It is a Windows subprocess-discovery/runtime-bootstrap issue that prevents live execution before the actual SSSF phase machine starts.

### fusion `/auto-validate` audit

**Run attempted:** `pi -e extensions/fusion-harness/fusion-harness.ts --mode json ... -p "/auto-validate Create a file named fusion-audit.txt ..."` with both architect and builder set to `ollama/qwen2.5:latest`.

**Observed outcome:** the command executed headlessly and emitted structured custom events in JSON mode. The harness created prompt and banner events, then failed at validator gate authoring before any build round.

**Concrete failure:**

- `VALIDATOR (ollama/qwen2.5:latest) failed to design the acceptance gate — nothing was built.`
- `Expected the gate at \tmp\fusion-harness-YXM1lw\gate.py; no file was written and no fenced script was found in its reply.`

The validator replied with a short natural-language path summary instead of using its `write` tool to create the required gate file.

**Audit value:** fusion-harness's headless JSON-mode execution path is real and usable on this workstation with local Ollama. The first practical failure boundary is model/tool compliance with the validator contract, not harness bootstrap.

## Architectural Gates

### Gate 1 — Domain / module alignment

Pass. These findings belong in the external-harness evaluation memory surface and directly affect adoption confidence.

### Gate 2 — Generality

Pass with clarification. The runtime findings are environment-specific, but they still change what should be adopted:

- SSSF contributes a strong design, but its live portability on this Windows/Pi/Ollama path is weaker than the source audit alone suggested.
- fusion-harness proves that the gate-first workflow can execute headlessly with local models, even when the chosen validator model fails the contract.

### Gate 3 — Ownership

Pass. The resulting recommendations still belong to harness validation and artifact surfaces, not to editor UI surfaces.

### Gate 4 — Boundary integrity

Pass. The audit reinforces that gate-first value comes from preserving validator/build boundaries; the failure occurred exactly at that seam.

### Gate 4b — Isolation / safety boundary

Pass. The temp sandbox approach was necessary and should remain the default for future live third-party harness audits.

### Gate 5 — Reuse

Pass. No new adoption slice is required beyond the existing four, but their relative confidence changes.

## Key Decisions

1. **Keep Slice A first and increase confidence in its practicality.**
   fusion-harness demonstrated that a gate-first loop can actually execute headlessly with local models on this workstation. The observed failure was contract-following by the validator model, not harness orchestration.

2. **Keep Slice B second with unchanged confidence.**
   This audit did not materially change the run-bundle recommendation.

3. **Keep Slice C third with unchanged confidence.**
   This audit did not materially change the consensus/divergence artifact recommendation.

4. **Keep Slice D fourth and do not promote it further.**
   The live audit did not provide new execution evidence for mutation-audit adoption beyond the source-level case already recorded.

5. **Add a new caution to SSSF-derived adoption reasoning.**
   Treat SSSF's orchestration ideas as design inputs, but do not treat its Python/Pi runtime path as execution-portable on Windows without an explicit bootstrap compatibility pass.

## Constraints

- Do not generalize a local Windows subprocess-discovery failure into a design rejection of SSSF's workflow ideas.
- Do not generalize fusion's validator-model noncompliance into a rejection of gate-first validation as a pattern.
- Keep future live third-party audits in temp sandboxes and outside the repo worktree.

## Do-NOTs

- Do NOT adopt SSSF runtime assumptions without validating Windows subprocess resolution for Pi-based child calls.
- Do NOT assume a local model that can answer prompts will also satisfy strict write-tool contracts for validator phases.
- Do NOT mix third-party harness install experiments into the main repo again; use isolated targets only.

## Assumptions And Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| The SSSF validation failure here is specific to the local Windows/Pi path, not a universal SSSF defect | recommendation confidence | over-weighting this blocker could wrongly dismiss otherwise portable design ideas |
| fusion-harness JSON-mode slash-command execution is representative enough for a headless audit | live audit conclusions | a TUI-only code path could still differ in minor UX or session behavior |

## Validation Plan

- Persist this live-execution audit brief.
- Record that one external workflow reached a concrete bootstrap blocker and the other reached a concrete gate-authoring failure.
- Do not implement new local runtime changes in this pass.

## Understand Status

- Graph status: stale but refresh-ready; provider `understand-anything`
- Understand tools used: route/handoff, prerequisite checks, temp sandbox execution, targeted follow-up reads
- Residual risk: medium, because the live audit used local Ollama substitutions rather than the external repos' intended hosted-provider rosters
