# Credits & Citations

This harness-kit is an original orchestration layer, but several of its ideas and components are
adapted from prior work. Attributions below; inline source links also appear in the header comments
of the adapted files.

## Direct inspirations

### karpathy/autoresearch — experiment loop

- **Source:** https://github.com/karpathy/autoresearch (MIT)
- **What we adapted:** the autonomous, metric-optimizing "experiment" loop — edit a focused target,
  re-measure a single numeric metric, **keep the edit only if it improved, else revert**, and repeat
  under a bounded budget while journaling every attempt.
- **Where:** [`scripts/harness/run-experiment.mjs`](scripts/harness/run-experiment.mjs),
  [`scripts/harness/experiment-loop.mjs`](scripts/harness/experiment-loop.mjs),
  [`.github/harness/loops/lint-debt-experiment.json`](.github/harness/loops/lint-debt-experiment.json).
- **How we differ:** autoresearch optimizes a single-GPU LLM training run (`val_bpb`); here the same
  hill-climb pattern is generalized to any shell-measurable code metric (lint/type/test/size), the
  agent is pluggable (any CLI, including a local model), and reverts are in-memory snapshots of the
  declared target only (never `git reset`).

### Egonex-AI/Understand-Anything — knowledge graph

- **Source:** https://github.com/Egonex-AI/Understand-Anything
- **What we adapted:** the deterministic code knowledge-graph that the harness treats as structural
  memory, and the graph-refresh sidecar that regenerates it.
- **Where:** [`scripts/harness/graph-refresh-loop.mjs`](scripts/harness/graph-refresh-loop.mjs),
  [`scripts/harness/refresh-graph.mjs`](scripts/harness/refresh-graph.mjs),
  [`scripts/harness/Dockerfile.graph-refresh`](scripts/harness/Dockerfile.graph-refresh).
- **Note:** the graph features require a local checkout of that plugin (see `SETUP.md`); the rest of
  the harness works without it.

### Model Context Protocol (MCP)

- **Source:** https://modelcontextprotocol.io · SDK: https://github.com/modelcontextprotocol
- **What we adapted:** exposing the harness's graph / memory / vector tools over MCP so any
  MCP-aware agent can call them.
- **Where:** [`scripts/harness/mcp-server.mjs`](scripts/harness/mcp-server.mjs),
  [`scripts/harness/mcp-tools.mjs`](scripts/harness/mcp-tools.mjs).

### Ollama — local LLM runtime

- **Source:** https://ollama.com
- **What we adapted:** local, zero-cost model inference for loop agents and embeddings, so the
  improvement loops can run without a hosted API.
- **Where:** [`scripts/harness/llm-provider.mjs`](scripts/harness/llm-provider.mjs),
  [`scripts/harness/ollama-agent.mjs`](scripts/harness/ollama-agent.mjs),
  [`scripts/harness/ollama-apply-agent.mjs`](scripts/harness/ollama-apply-agent.mjs),
  [`scripts/harness/vector-search.mjs`](scripts/harness/vector-search.mjs).

### LM Studio — local LLM runtime (OpenAI-compatible)

- **Source:** https://lmstudio.ai
- **What we adapted:** an alternative local runtime via its OpenAI-compatible API
  (`/v1/chat/completions`, `/v1/embeddings`), selectable alongside Ollama with `--provider lmstudio`.
- **Where:** [`scripts/harness/llm-provider.mjs`](scripts/harness/llm-provider.mjs) (shared adapter
  used by the agents and vector search).

### Anthropic Agent Skills / Claude Code & GitHub Copilot

- **Source:** https://docs.claude.com (Agent Skills) · https://github.com/features/copilot
- **What we adapted:** the "skills + workflow instructions" structuring and the multi-agent adapter
  idea (the same content served to Claude Code, Copilot/Codex, and other runtimes).
- **Where:** the workflow stage machine in
  [`.github/harness/HARNESS.md`](.github/harness/HARNESS.md) and the stage instructions under
  [`.github/instructions/`](.github/instructions/).

## Original to this kit

- The unified harness contract (skill routing + stage machine + loop protocol), the five
  architectural review gates, the convergence/workflow/experiment loop taxonomy, the config-token
  layer (`harness.config.json` + `scripts/harness/config.mjs`), and the live metrics dashboard
  (`scripts/harness/report-server.mjs`).

## Foundations & reference harnesses

These shaped the design and vocabulary; no code was copied from them.

- **Pi** (Earendil, MIT) — https://pi.dev/docs/latest — a minimal terminal coding harness. We adapted
  its **structured compaction/handoff summary format** (Goal / Constraints / Progress / Key Decisions
  / Next Steps / Critical Context + read/modified files) as the context-discipline convention in
  [`HARNESS_CARD.md`](HARNESS_CARD.md), and its candid security stance ("no built-in sandbox"; real
  isolation must come from a container/VM; prompt injection from untrusted content cannot be reliably
  prevented in-process) reinforced this kit's threat model.
- **OpenAI — Harness Engineering** — https://openai.com/index/harness-engineering/ — repo-local
  instructions, architectural constraints, validation, telemetry.
- **Anthropic — Effective harnesses for long-running agents** —
  https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents — self-verification
  and handoff artifacts across many context windows.
- **Agent Skill evals** — OpenAI *Testing Agent Skills with Evals* and OpenHands *How to Evaluate
  Agent Skills* — the no-skill-baseline + deterministic-verifier approach behind
  [`scripts/harness/eval/`](scripts/harness/eval/).
- **awesome-harness-engineering** (CC0) — https://github.com/walkinglabs/awesome-harness-engineering —
  the field map (CAR / HarnessCard framing, evals & observability, Lurkr capability-risk scanning)
  that informed the HarnessCard and the `dangerous-diff` control.

## License

Released under the MIT License (see `LICENSE`). Adapted components retain their upstream licenses;
where a file adapts upstream work, its header notes the source.
