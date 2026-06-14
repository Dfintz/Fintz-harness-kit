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
- **Where:** [`scripts/harness/ollama-agent.mjs`](scripts/harness/ollama-agent.mjs),
  [`scripts/harness/ollama-apply-agent.mjs`](scripts/harness/ollama-apply-agent.mjs),
  [`scripts/harness/vector-search.mjs`](scripts/harness/vector-search.mjs).

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

## License
Released under the MIT License (see `LICENSE`). Adapted components retain their upstream licenses;
where a file adapts upstream work, its header notes the source.
