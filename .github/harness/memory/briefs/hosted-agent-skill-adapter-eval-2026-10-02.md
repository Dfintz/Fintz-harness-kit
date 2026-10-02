# Hosted Agent for Skill Adapter Eval

resource: scripts/harness/hosted-agent.mjs, scripts/harness/skill-adapter-eval.mjs, scripts/harness/test/hosted-agent-test.mjs, scripts/harness/test/skill-adapter-eval-test.mjs, .github/harness/HARNESS.md, package.json, .github/harness/memory/briefs/skill-adapter-eval-2026-10-02.md

## Architecture Brief

### Objective

Make the 7 hosted families measurable with `skill-adapter-eval.mjs`, and stop local runs from
using `ollama run` (its CLI wraps lines and corrupts ACTIONS parsing).

### Understand summary

- `skill-adapter-eval.mjs` pipes the prompt to any `--agent` command with a minimal env plus
  `--pass-env` names and sets `HARNESS_EVAL_MODEL` from `--model family=id`.
- No in-repo stdin→stdout agent exists for hosted models. `ollama-agent.mjs` / `llm-provider.mjs`
  cover Ollama and LM Studio only. `measure-phase5c-real.mjs` has inline cloud calls but is a
  benchmark script, not an agent CLI, and its GitHub endpoint is dead: GitHub Models was retired
  on 2026-07-30 (docs.github.com/en/rest/models/inference, checked 2026-10-02).
- GitHub Copilot exposes no public inference API for scripts. The Copilot CLI is not installed
  here (only the VS Code install shim). Hosted access therefore means vendor APIs: OpenAI, Azure
  AI Foundry / Azure OpenAI (OpenAI-compatible v1), Anthropic Messages, and Gemini.
- No provider keys are present in this environment, so a live hosted run cannot happen in this
  session. The agent is proven with a local mock server.

### Decisions

1. **New `scripts/harness/hosted-agent.mjs`**: reads the prompt on stdin, writes model text on
   stdout. Providers: `openai`, `azure-openai`, `anthropic`, `gemini`, and `auto` (default;
   `claude-*` → anthropic, `gemini-*` → gemini, else openai). Model from `--model` or
   `HARNESS_EVAL_MODEL`. Default key env per provider (`OPENAI_API_KEY`, `AZURE_OPENAI_KEY`,
   `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` then `GOOGLE_API_KEY`), overridable with `--key-env`.
   Base URL from `--base-url`, a provider env var (`OPENAI_BASE_URL`, `AZURE_OPENAI_ENDPOINT`), or the
   vendor default.
2. Kept separate from `llm-provider.mjs` so local loop agents do not gain hosted reach as a side
   effect.
3. **Runner guards**: reject agent commands that invoke `ollama run`, pointing at
   `ollama-agent.mjs`. When the declared model's family differs from the family under test, force
   `signal: "inconclusive"` and record `familyMatch: false`.

### Constraints / Do-NOTs

- HTTPS only, except `localhost`/`127.0.0.1` (tests). Keys go only in headers; for Gemini that is
  `x-goog-api-key`, never the query string. Never print keys, request bodies, or response bodies.
  Errors report provider and HTTP status only.
- Model ids are validated (`[A-Za-z0-9._:/-]`, ≤128 chars) before they enter a URL path.
- No retries inside the agent; the runner owns repeats. Bounded by `--timeout-ms`.
- Do NOT add Copilot-internal or undocumented endpoints. Do NOT ask the user for secrets in chat.
- `measure-phase5c-real.mjs` is out of scope (dead endpoint noted as follow-up).

### Validation

- `scripts/harness/test/hosted-agent-test.mjs` against a local HTTP mock: request shape and auth
  header per provider, text extraction, missing key, non-HTTPS rejection, invalid model id, no key
  leakage in stderr.
- Eval tests: `ollama run` rejected; family mismatch forces inconclusive.
- `npm run test:harness:core`, `harness:docs:check`, `harness:commands:check`.

### Assumptions

- Vendor API shapes (OpenAI chat completions, Anthropic Messages `2023-06-01`, Gemini
  `v1beta generateContent`) are stable; Azure AI Foundry accepts the OpenAI v1 shape with an
  `api-key` header.
- Hosted model ids used by vendors may differ from Copilot ids; the operator declares what they
  call, and the family check flags mismatches.

### Architect challenge

Challenger (GPT-6 Sol) returned **VERDICT: REVISE**. Resolutions:

1. **Credential destinations.** Each provider has trusted hosts: `api.openai.com`,
   `api.anthropic.com`, `generativelanguage.googleapis.com`, and for `azure-openai` hostnames ending in
   `.openai.azure.com`, `.services.ai.azure.com`, or `.cognitiveservices.azure.com`. Any other host
   needs an exact `--allow-host <hostname>` opt-in. Plain HTTP is allowed only for
   `localhost`/`127.0.0.1`, and those still need `--allow-host`. Requests use `redirect: "error"`.
   Tests prove the agent refuses before any request (and so before any key is sent) to an
   unexpected host.
2. **Model IDs.** Gemini ids must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` and are
   `encodeURIComponent`-encoded as a single path segment. Body-only providers allow an optional
   `publisher/` prefix (`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(/[A-Za-z0-9][A-Za-z0-9._:-]{0,127})?$`).
   Traversal-style ids are tested.
3. **`auto` narrowed.** `claude-*` → anthropic, `gemini-*` → gemini, `gpt-*` / `o<digit>*` → openai.
   Anything else (`mai-*`, `name:tag`, Azure deployment names) is a configuration error that
   requires an explicit `--provider`. Azure is never inferred.
4. **Result validity.** Runs with a nonzero exit or timeout are `valid: false` and excluded from
   means. A case contributes to the signal only when both arms have valid runs. The family signal
   is forced `inconclusive` (with `signalReason`) when the model is undeclared, when the declared
   model's family differs from the family under test, or when fewer than `SIGNAL_MIN_REPEATS` valid
   paired repeats exist. Vendor aliases: a single `publisher/` prefix is stripped before family
   resolution, and `--alias name=canonical-id` maps Azure deployment names for the family check
   only (recorded in the journal).

Non-blocking accepted: the `ollama run` check is lexical and best-effort. It hard-rejects the
detectable form to fail fast and is documented as guidance, not a guarantee. The hosted agent shares
no code with `llm-provider.mjs` and never reports response bodies.

**Status after revision: APPROVED for Implement.**
