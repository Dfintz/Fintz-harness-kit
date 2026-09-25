#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_MAX_QUEUED = 8;
const DEFAULT_QUEUE_WAIT_MS = 3000;
const MAX_QUESTIONS = 64;
const MAX_CHOICE_OPTIONS = 64;
const MAX_SCORE_LEVELS = 10;
const MAX_WORKER_LINE_BYTES = 1024 * 1024;

class SidecarError extends Error {
  constructor(status, code, message, detail = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

class WorkQueue {
  constructor(maxQueued, queueWaitMs) {
    this.maxQueued = maxQueued;
    this.queueWaitMs = queueWaitMs;
    this.active = false;
    this.items = [];
    this.closed = false;
  }

  submit(work, signal) {
    if (this.closed) {
      return Promise.reject(new SidecarError(503, "queue_closed", "sidecar queue is closed"));
    }
    if (this.active && this.items.length >= this.maxQueued) {
      return Promise.reject(new SidecarError(503, "queue_full", "sidecar queue is full"));
    }
    return new Promise((resolve, reject) => {
      const item = { work, resolve, reject, signal, timer: null, started: false, abort: null };
      item.abort = () => {
        if (item.started) return;
        const index = this.items.indexOf(item);
        if (index >= 0) this.items.splice(index, 1);
        if (item.timer) clearTimeout(item.timer);
        reject(new SidecarError(499, "request_cancelled", "request was cancelled before execution"));
      };
      if (signal?.aborted) {
        item.abort();
        return;
      }
      signal?.addEventListener("abort", item.abort, { once: true });
      if (this.active) {
        item.timer = setTimeout(() => {
          const index = this.items.indexOf(item);
          if (index >= 0) this.items.splice(index, 1);
          signal?.removeEventListener("abort", item.abort);
          reject(new SidecarError(503, "queue_expired", "request expired while waiting for the scorer"));
        }, this.queueWaitMs);
        this.items.push(item);
      } else {
        this.start(item);
      }
    });
  }

  async start(item) {
    this.active = true;
    item.started = true;
    if (item.timer) clearTimeout(item.timer);
    item.signal?.removeEventListener("abort", item.abort);
    try {
      item.resolve(await item.work());
    } catch (error) {
      item.reject(error);
    } finally {
      this.active = false;
      const next = this.items.shift();
      if (next) this.start(next);
    }
  }

  close() {
    this.closed = true;
    for (const item of this.items.splice(0)) {
      if (item.timer) clearTimeout(item.timer);
      item.signal?.removeEventListener("abort", item.abort);
      item.reject(new SidecarError(503, "queue_closed", "sidecar queue is closed"));
    }
  }
}

export class SemifWorkerClient {
  constructor({
    command,
    args = [],
    cwd = process.cwd(),
    env = process.env,
    startupTimeoutMs = 180000,
    requestTimeoutMs = 10000,
    maxLineBytes = MAX_WORKER_LINE_BYTES,
  }) {
    if (!command) throw new TypeError("worker command is required");
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.startupTimeoutMs = startupTimeoutMs;
    this.requestTimeoutMs = requestTimeoutMs;
    this.maxLineBytes = maxLineBytes;
    this.process = null;
    this.buffer = "";
    this.pending = new Map();
    this.expiredIds = new Set();
    this.model = null;
    this.starting = null;
    this.startResolve = null;
    this.startReject = null;
    this.failed = null;
  }

  ready() {
    return this.model !== null && this.failed === null && this.process?.exitCode === null;
  }

  metadata() {
    return this.model;
  }

  async start() {
    if (this.ready()) return this.model;
    if (this.starting !== null) return this.starting;
    this.process = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => this.onData(chunk));
    this.process.stderr.on("data", (chunk) => process.stderr.write(`[semif-worker] ${chunk}`));
    this.process.once("error", (error) => this.fail(error));
    this.process.once("exit", (code, signal) => this.fail(new Error(`worker exited code=${code} signal=${signal}`)));
    this.starting = new Promise((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
    });
    const timer = setTimeout(() => this.fail(new Error("worker readiness timed out")), this.startupTimeoutMs);
    try {
      return await this.starting;
    } finally {
      clearTimeout(timer);
      this.starting = null;
      this.startResolve = null;
      this.startReject = null;
    }
  }

  onData(chunk) {
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > this.maxLineBytes && !this.buffer.includes("\n")) {
      this.fail(new Error("worker frame exceeds the line limit"));
      return;
    }
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim() && !this.processLine(line)) return;
    }
  }

  processLine(line) {
    if (Buffer.byteLength(line) > this.maxLineBytes) {
      this.fail(new Error("worker frame exceeds the line limit"));
      return false;
    }
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      this.fail(new Error("worker emitted malformed JSON"));
      return false;
    }
    if (frame?.version !== 1) {
      this.fail(new Error("worker protocol version mismatch"));
      return false;
    }
    if (frame.type === "ready") {
      if (this.model || !frame.model?.source || !frame.model?.revision) {
        this.fail(new Error("worker emitted an invalid ready frame"));
        return false;
      }
      this.model = frame.model;
      this.startResolve?.(this.model);
      return true;
    }
    const pending = this.pending.get(frame.id);
    if (!pending) {
      if (this.expiredIds.delete(frame.id)) return true;
      this.fail(new Error("worker emitted an unknown or duplicate response id"));
      return false;
    }
    this.pending.delete(frame.id);
    clearTimeout(pending.timer);
    if (frame.ok === true) pending.resolve(frame.result);
    else pending.reject(new Error(frame.error?.message ?? "worker scoring failed"));
    return true;
  }

  fail(error) {
    if (this.failed) return;
    this.failed = error instanceof Error ? error : new Error(String(error));
    this.model = null;
    this.startReject?.(this.failed);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(this.failed);
    }
    this.pending.clear();
    if (this.process?.exitCode === null) this.process.kill();
  }

  score(row, maxTokens = 4096) {
    if (!this.ready()) return Promise.reject(this.failed ?? new Error("worker is not ready"));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.expiredIds.add(id);
        while (this.expiredIds.size > 1024) {
          this.expiredIds.delete(this.expiredIds.values().next().value);
        }
        reject(new Error("worker request timed out"));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const frame = `${JSON.stringify({ version: 1, id, row, maxTokens })}\n`;
      this.process.stdin.write(frame, (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        clearTimeout(pending.timer);
        reject(error);
      });
    });
  }

  close() {
    this.fail(new Error("worker client closed"));
  }
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function validation(message, path = []) {
  return new SidecarError(422, "validation_error", message, [{
    error_type: "validation_error",
    message,
    path,
  }]);
}

function stableDescriptionValue(value) {
  if (Array.isArray(value)) return value.map(stableDescriptionValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, stableDescriptionValue(value[key])]),
  );
}

function canonicalDescription(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(stableDescriptionValue(value));
}

function questionText(question, id) {
  return canonicalDescription(question.instructions ?? id);
}

function validateQuestionId(id) {
  if (typeof id !== "string" || !id.trim()) throw validation("question ids must be non-empty strings");
}

export function rowsFromSystemOneRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validation("request body must be a JSON object");
  }
  if (typeof payload.model !== "string" || !payload.model.trim()) {
    throw validation("model must be a non-empty string", ["model"]);
  }
  if (!("state" in payload)) throw validation("state is required", ["state"]);
  if (!payload.questions || typeof payload.questions !== "object" || Array.isArray(payload.questions)) {
    throw validation("questions must be an object", ["questions"]);
  }
  const questions = Object.entries(payload.questions);
  if (questions.length < 1 || questions.length > MAX_QUESTIONS) {
    throw validation(`questions must contain 1-${MAX_QUESTIONS} entries`, ["questions"]);
  }
  return questions.map(([id, question]) => {
    validateQuestionId(id);
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw validation("question must be an object", ["questions", id]);
    }
    const type = question.type;
    let options;
    let legend = null;
    if (type === "noul") {
      const criteria = question.criteria && typeof question.criteria === "object" && !Array.isArray(question.criteria)
        ? question.criteria
        : {};
      options = [
        { id: "false", description: canonicalDescription(criteria.false ?? "No") },
        { id: "true", description: canonicalDescription(criteria.true ?? "Yes") },
      ];
    } else if (type === "choice") {
      if (!question.criteria || typeof question.criteria !== "object" || Array.isArray(question.criteria)) {
        throw validation("choice criteria must be an object", ["questions", id, "criteria"]);
      }
      const entries = Object.entries(question.criteria);
      if (entries.length < 2 || entries.length > MAX_CHOICE_OPTIONS) {
        throw validation(`choice criteria must contain 2-${MAX_CHOICE_OPTIONS} options`, ["questions", id, "criteria"]);
      }
      options = entries.map(([optionId, description]) => {
        if (!optionId) throw validation("choice option ids must be non-empty", ["questions", id, "criteria"]);
        return { id: optionId, description: canonicalDescription(description) };
      });
    } else if (type === "score") {
      if (!Array.isArray(question.criteria)) {
        throw validation("score criteria must be an array", ["questions", id, "criteria"]);
      }
      if (question.criteria.length < 2 || question.criteria.length > MAX_SCORE_LEVELS) {
        throw validation(`score criteria must contain 2-${MAX_SCORE_LEVELS} levels`, ["questions", id, "criteria"]);
      }
      legend = Object.fromEntries(question.criteria.map((description, index) => [String(index), description]));
      options = question.criteria.map((description, index) => ({ id: String(index), description: canonicalDescription(description) }));
    } else {
      throw validation("question type must be choice, score, or noul", ["questions", id, "type"]);
    }
    return {
      id,
      type,
      legend,
      row: { id, state: payload.state, question: questionText(question, id), options },
    };
  });
}

function normalizeWorkerResult(result, expectedIds, expectedModel) {
  if (!result || typeof result !== "object") throw new SidecarError(502, "invalid_worker_result", "worker result must be an object");
  if (!Array.isArray(result.option_ids) || result.option_ids.length !== expectedIds.length || result.option_ids.some((id, index) => id !== expectedIds[index])) {
    throw new SidecarError(502, "invalid_worker_result", "worker option_ids do not match the request");
  }
  if (!Array.isArray(result.probabilities) || result.probabilities.length !== expectedIds.length) {
    throw new SidecarError(502, "invalid_worker_result", "worker probabilities do not match the request");
  }
  if (!Number.isInteger(result.input_tokens) || result.input_tokens < 0) {
    throw new SidecarError(502, "invalid_worker_result", "worker input_tokens must be a non-negative integer");
  }
  if (!result.model || result.model.source !== expectedModel.source || result.model.revision !== expectedModel.revision) {
    throw new SidecarError(502, "invalid_worker_result", "worker model identity changed after readiness");
  }
  let total = 0;
  for (const probability of result.probabilities) {
    if (!Number.isFinite(probability) || probability < 0) {
      throw new SidecarError(502, "invalid_worker_result", "worker probabilities must be finite and non-negative");
    }
    total += probability;
  }
  if (total <= 0) throw new SidecarError(502, "invalid_worker_result", "worker probabilities must have positive mass");
  return { probabilities: result.probabilities.map((value) => value / total), inputTokens: result.input_tokens };
}

function confidence(probabilities) {
  const maximum = Math.max(...probabilities);
  const count = probabilities.length;
  return count === 1 ? 1 : Math.max(0, Math.min(1, (count * maximum - 1) / (count - 1)));
}

function answerFrom(type, legend, optionIds, probabilities) {
  let selected = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    if (probabilities[index] > probabilities[selected]) selected = index;
  }
  if (type === "noul") return { type: "noul", noul: probabilities[1] };
  const mapped = Object.fromEntries(optionIds.map((id, index) => [id, probabilities[index]]));
  if (type === "choice") {
    return { type: "choice", choice: optionIds[selected], probabilities: mapped, confidence: confidence(probabilities) };
  }
  return {
    type: "score",
    score: probabilities.reduce((sum, probability, index) => sum + index * probability, 0),
    legend,
    probabilities: mapped,
    confidence: confidence(probabilities),
  };
}

async function readJsonBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new SidecarError(413, "body_too_large", `request body exceeds ${limit} bytes`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SidecarError(400, "invalid_json", "request body must be valid JSON");
  }
}

function errorResponse(error) {
  if (error instanceof SidecarError) {
    return {
      status: error.status,
      body: error.detail ? { detail: error.detail } : { detail: { error_type: error.code, message: error.message } },
    };
  }
  return { status: 500, body: { detail: { error_type: "internal_error", message: "internal sidecar error" } } };
}

export function createDecisionSidecar({
  scorer,
  host = "127.0.0.1",
  port = 11437,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  maxQueued = DEFAULT_MAX_QUEUED,
  queueWaitMs = DEFAULT_QUEUE_WAIT_MS,
} = {}) {
  if (!scorer || typeof scorer.score !== "function") throw new TypeError("a scorer is required");
  if (!/^127\.0\.0\.1$|^::1$/.test(host)) throw new Error("decision sidecar must bind to loopback");
  const queue = new WorkQueue(maxQueued, queueWaitMs);
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", `http://${host}`).pathname;
      if (req.method === "GET" && path === "/health") return json(res, 200, { status: "ok" });
      if (req.method === "GET" && path === "/ready") {
        const ready = scorer.ready?.() !== false;
        return json(res, ready ? 200 : 503, {
          status: ready ? "ready" : "not_ready",
          model: ready ? scorer.metadata?.() ?? null : null,
        });
      }
      if (req.method !== "POST" || path !== "/v1/systemone") {
        return json(res, 404, { detail: { error_type: "not_found", message: "route not found" } });
      }
      if (scorer.ready?.() === false) throw new SidecarError(503, "not_ready", "scorer is not ready");
      const abort = new AbortController();
      req.once("aborted", () => abort.abort());
      res.once("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      const payload = await readJsonBody(req, maxBodyBytes);
      const questions = rowsFromSystemOneRequest(payload);
      const started = performance.now();
      const body = await queue.submit(async () => {
        const model = scorer.metadata?.();
        if (!model?.source || !model?.revision) throw new SidecarError(503, "not_ready", "scorer model identity is unavailable");
        const answers = {};
        let inputTokens = 0;
        for (const question of questions) {
          const result = await scorer.score(question.row);
          const normalized = normalizeWorkerResult(result, question.row.options.map((option) => option.id), model);
          inputTokens += normalized.inputTokens;
          answers[question.id] = answerFrom(
            question.type,
            question.legend,
            question.row.options.map((option) => option.id),
            normalized.probabilities,
          );
        }
        return {
          model: `${model.source}@${model.revision}`,
          answers,
          usage: { input_tokens: inputTokens, output_tokens: 0 },
        };
      }, abort.signal);
      if (abort.signal.aborted) return;
      res.setHeader("x-semif-total-ms", String(Math.max(0, performance.now() - started)));
      return json(res, 200, body);
    } catch (error) {
      const response = errorResponse(error);
      if (!res.headersSent) return json(res, response.status === 499 ? 499 : response.status, response.body);
      res.destroy();
    }
  });

  return {
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async close() {
      queue.close();
      scorer.close?.();
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeIdleConnections?.();
      });
    },
  };
}

function parseCliArgs(argv) {
  const values = {
    host: process.env.HARNESS_DECISION_HOST ?? "127.0.0.1",
    port: Number(process.env.HARNESS_DECISION_PORT ?? 11437),
    backend: process.env.HARNESS_DECISION_BACKEND ?? "semif",
    endpoint: process.env.HARNESS_DECISION_ENDPOINT ?? "http://127.0.0.1:1234",
    promptStyle: process.env.HARNESS_DECISION_PROMPT_STYLE ?? "jev",
    warmup: process.env.HARNESS_DECISION_WARMUP === "1",
    python: process.env.HARNESS_SEMIF_PYTHON ?? "python",
    model: process.env.HARNESS_SEMIF_MODEL ?? "Qwen/Qwen3.5-4B",
    revision: process.env.HARNESS_SEMIF_REVISION ?? "851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a",
    device: process.env.HARNESS_SEMIF_DEVICE ?? "cuda",
    dtype: process.env.HARNESS_SEMIF_DTYPE ?? "bfloat16",
    maxTokens: Number(process.env.HARNESS_SEMIF_MAX_TOKENS ?? 4096),
    maxQueued: Number(process.env.HARNESS_DECISION_MAX_QUEUED ?? DEFAULT_MAX_QUEUED),
    queueWaitMs: Number(process.env.HARNESS_DECISION_QUEUE_WAIT_MS ?? DEFAULT_QUEUE_WAIT_MS),
    requestTimeoutMs: Number(process.env.HARNESS_DECISION_TIMEOUT_MS ?? 10000),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${name} requires a value`);
      return value;
    };
    if (name === "--host") values.host = next();
    else if (name === "--port") values.port = Number(next());
    else if (name === "--backend") values.backend = next();
    else if (name === "--endpoint") values.endpoint = next();
    else if (name === "--prompt-style") values.promptStyle = next();
    else if (name === "--warmup") values.warmup = true;
    else if (name === "--python") values.python = next();
    else if (name === "--model") values.model = next();
    else if (name === "--revision") values.revision = next();
    else if (name === "--device") values.device = next();
    else if (name === "--dtype") values.dtype = next();
    else if (name === "--max-tokens") values.maxTokens = Number(next());
    else if (name === "--max-queued") values.maxQueued = Number(next());
    else if (name === "--queue-wait-ms") values.queueWaitMs = Number(next());
    else if (name === "--request-timeout-ms") values.requestTimeoutMs = Number(next());
    else throw new Error(`unknown option: ${name}`);
  }
  if (values.backend !== "semif" && values.backend !== "openai") {
    throw new Error(`unknown backend: ${values.backend} (expected semif or openai)`);
  }
  return values;
}

async function createScorer(options) {
  if (options.backend === "openai") {
    const { OpenAiLogprobScorer } = await import("./decision-backend-openai.mjs");
    return new OpenAiLogprobScorer({
      endpoint: options.endpoint,
      model: process.env.HARNESS_DECISION_MODEL ?? null,
      revision: process.env.HARNESS_DECISION_REVISION ?? undefined,
      requestTimeoutMs: options.requestTimeoutMs,
      warmup: options.warmup,
      promptStyle: options.promptStyle,
    });
  }
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), "semif-worker.py");
  return new SemifWorkerClient({
    command: options.python,
    args: [
      workerPath,
      "--model", options.model,
      "--revision", options.revision,
      "--device", options.device,
      "--dtype", options.dtype,
      "--max-tokens", String(options.maxTokens),
    ],
    requestTimeoutMs: options.requestTimeoutMs,
  });
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const scorer = await createScorer(options);
  await scorer.start();
  const sidecar = createDecisionSidecar({
    scorer,
    host: options.host,
    port: options.port,
    maxQueued: options.maxQueued,
    queueWaitMs: options.queueWaitMs,
  });
  const address = await sidecar.listen();
  const identity = scorer.metadata();
  process.stdout.write(
    `[decision-sidecar] ready http://${options.host}:${address.port} ${identity.source}@${identity.revision} (${options.backend})\n`,
  );
  const stop = async () => {
    await sidecar.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`[decision-sidecar] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
