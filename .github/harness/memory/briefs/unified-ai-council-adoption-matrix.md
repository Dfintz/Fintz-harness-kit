# Brief: Unified AI Council adoption matrix for harness-kit - active

Date: 2026-06-15

## Scope

Adopt selected Unified-AI-Council patterns into harness-kit without replacing the harness stage machine.

## Impacted files

- scripts/harness/command-validation.mjs (new)
- scripts/harness/council-review.mjs (new)
- scripts/harness/workspace-memory.mjs (new)
- scripts/harness/run-loop.mjs
- scripts/harness/run-experiment.mjs
- scripts/harness/plan-review.mjs
- package.json
- README.md
- .github/harness/registry.json

## Architectural gate verdicts

1. Domain/module alignment: PASS

- New modules stay in harness runtime/security/orchestration responsibilities under scripts/harness.

1. Generality test: PASS

- Command validation and council synthesis are reusable across multiple loops and review workflows.

1. Data ownership verification: PASS

- Existing loop journals remain owned by existing runners; workspace-memory utility writes only transient local context.

1. Layer boundary audit: PASS

- CLI utilities are decoupled from dashboard and MCP surfaces; registry/docs only expose entrypoints.

1. Reuse potential: PASS

- Security validator centralizes shell safety checks; council utility enables optional parallel responder workflows for review synthesis.

## Decisions

- Adopt now:

  - Strong executable allowlist + shell metachar rejection for spawned model commands.
  - Council-style parallel responders via a dedicated review synthesizer utility.
  - Local-first synthesis mode: heuristic (`nano`) with optional Ollama fallback.
  - Workspace memory JSONL utility for transient, per-workspace notes.

- Defer (documented only for now):

  - VS Code webview UI panel and command palette contribution surface.
  - WSL execution adapter abstraction.

- Keep harness vocabulary and stage machine unchanged; map council mode profiles to existing stages in docs and utility modes.

## Do-NOTs

- Do not replace the stage machine with chat-panel-first orchestration.
- Do not bypass existing review/deadlock controls.
- Do not permit arbitrary executable names or shell metacharacter payloads in model commands.

## Assumptions

- Most users will run council synthesis as an optional operator tool around review steps.
- Existing local model support (Ollama/LM Studio) remains the foundation for local-first synthesis.

## Validation plan

- Run security validator self-test.
- Run council-review in nano mode with `--json` and verify parallel responder outputs are synthesized.
- Run workspace-memory append/list/reset flow.
- Verify existing loop scripts still execute with valid agent commands.
