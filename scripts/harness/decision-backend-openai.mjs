#!/usr/bin/env node
/**
 * Lightweight decision backend: scores System One rows against an already-running
 * OpenAI-compatible local server (LM Studio, Ollama, llama.cpp, vLLM) using the
 * top-logprob distribution of a single forced label token. Prefill only, no decode.
 */

const LABELS = "ABCDEFGHIJKLMNOPQRST";
export const MAX_LOGPROB_OPTIONS = LABELS.length;
const FLOOR_PROBABILITY = 1e-6;
const UNPINNED_REVISION = "local-unpinned";

const SYSTEM_PROMPT =
  "You are a typed decision scorer. Read the state, then answer the question with exactly one " +
  "option label and nothing else. Output a single character.";

const JEV_PREAMBLE =
  "You are a decision function. Read the state, then answer the question by choosing exactly one option.";

function canonicalState(state) {
  return typeof state === "string" ? state : JSON.stringify(state);
}

function optionLegend(row) {
  return row.options.map((option, index) => `${LABELS[index]}. ${option.description}`).join("\n");
}

// Jev-style decision models require this exact layout; chat-shaped prompts produce text continuation.
function jevPrompt(row) {
  return [
    {
      role: "user",
      content: `${JEV_PREAMBLE}\n\n[State]\n${canonicalState(row.state)}\n\n[Question]\n${row.question}\n\n[Options]\n${optionLegend(row)}\n\nAnswer:`,
    },
  ];
}

// State comes before the question so the KV prefix cache is reused across questions in one request.
function chatPrompt(row) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `State:\n${canonicalState(row.state)}\n\nOptions:\n${optionLegend(row)}\n\nQuestion: ${row.question}\n\nAnswer with one label from the list above.`,
    },
  ];
}

const PROMPT_STYLES = { jev: jevPrompt, chat: chatPrompt };

export class BackendError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function distributionFromLogprobs(entries, optionCount) {
  const mass = new Array(optionCount).fill(FLOOR_PROBABILITY);
  for (const entry of entries) {
    const token = typeof entry?.token === "string" ? entry.token.trim().toUpperCase() : "";
    if (token.length !== 1) continue;
    const index = LABELS.indexOf(token);
    if (index < 0 || index >= optionCount) continue;
    const logprob = entry.logprob;
    if (!Number.isFinite(logprob)) continue;
    mass[index] += Math.exp(logprob);
  }
  const total = mass.reduce((sum, value) => sum + value, 0);
  return mass.map((value) => value / total);
}

function topLogprobEntries(payload) {
  const content = payload?.choices?.[0]?.logprobs?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new BackendError("missing_logprobs", "server response did not include token logprobs");
  }
  const first = content[0];
  const top = Array.isArray(first?.top_logprobs) ? first.top_logprobs : [];
  return top.length > 0 ? top : [first];
}

export class OpenAiLogprobScorer {
  constructor({
    endpoint = "http://127.0.0.1:1234",
    model = null,
    revision = UNPINNED_REVISION,
    device = "gpu",
    dtype = "server-managed",
    requestTimeoutMs = 10000,
    warmup = false,
    promptStyle = "jev",
    fetchImpl = globalThis.fetch,
    logger = process.stderr,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("a fetch implementation is required");
    if (!PROMPT_STYLES[promptStyle]) throw new TypeError(`unknown prompt style: ${promptStyle}`);
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.promptStyle = promptStyle;
    this.configuredModel = model;
    this.revision = revision || UNPINNED_REVISION;
    this.device = device;
    this.dtype = dtype;
    this.requestTimeoutMs = requestTimeoutMs;
    this.warmup = warmup;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.model = null;
    this.residencyVerified = false;
    this.failed = null;
  }

  ready() {
    return this.model !== null && this.failed === null;
  }

  metadata() {
    if (!this.model) return null;
    return { ...this.model, residencyVerified: this.residencyVerified };
  }

  async start() {
    if (this.ready()) return this.metadata();
    const source = this.configuredModel ?? (await this.resolveModelId());
    this.model = {
      source,
      revision: this.revision,
      backend: "openai-logprobs",
      device: this.device,
      dtype: this.dtype,
    };
    if (this.revision === UNPINNED_REVISION) {
      this.logger?.write?.(
        `[decision-backend-openai] warning: model "${source}" has no pinned revision; receipts will record "${UNPINNED_REVISION}" and promotion remains blocked\n`,
      );
    }
    if (this.warmup) {
      await this.score({
        id: "warmup",
        state: "warmup",
        question: "Is this server ready?",
        options: [{ id: "false", description: "No" }, { id: "true", description: "Yes" }],
      });
      this.residencyVerified = true;
    }
    return this.metadata();
  }

  async resolveModelId() {
    const payload = await this.request("/v1/models", null, "GET");
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    if (!first?.id || typeof first.id !== "string") {
      throw new BackendError("model_unresolved", "server did not report a usable model id");
    }
    return first.id;
  }

  async request(path, body, method = "POST") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.endpoint}${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BackendError("upstream_error", `local model server returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof BackendError) throw error;
      const aborted = error?.name === "AbortError";
      throw new BackendError(
        aborted ? "upstream_timeout" : "upstream_unreachable",
        aborted ? `local model server exceeded ${this.requestTimeoutMs}ms` : "local model server is unreachable",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async score(row) {
    const optionCount = row.options.length;
    if (optionCount > MAX_LOGPROB_OPTIONS) {
      throw new BackendError(
        "unsupported_option_count",
        `logprob backend supports at most ${MAX_LOGPROB_OPTIONS} options; received ${optionCount}`,
      );
    }
    if (!this.model) await this.start();
    const model = this.model;
    const payload = await this.request("/v1/chat/completions", {
      model: model.source,
      messages: PROMPT_STYLES[this.promptStyle](row),
      max_tokens: 1,
      temperature: 0,
      top_p: 1,
      stream: false,
      logprobs: true,
      // Always request the full top-k: a label absent from a narrow top-k floors to noise.
      top_logprobs: MAX_LOGPROB_OPTIONS,
    });
    if (typeof payload?.model === "string" && payload.model !== model.source) {
      this.failed = new BackendError("model_identity_changed", "local model server switched models mid-session");
      throw this.failed;
    }
    return {
      option_ids: row.options.map((option) => option.id),
      probabilities: distributionFromLogprobs(topLogprobEntries(payload), optionCount),
      input_tokens: Number.isInteger(payload?.usage?.prompt_tokens) ? payload.usage.prompt_tokens : 0,
      model,
    };
  }

  close() {
    this.model = null;
    this.residencyVerified = false;
  }
}
