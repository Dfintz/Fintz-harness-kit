#!/usr/bin/env node
/**
 * Runs each local decision-model candidate through the live intent evaluator and ranks them.
 * Report-only: never downloads models, never edits config, never changes the sidecar freeze.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { OpenAiLogprobScorer, PROMPT_STYLE_NAMES } from "./decision-backend-openai.mjs";
import { evaluateLiveReport } from "./decision-eval.mjs";
import { createDecisionSidecar } from "./decision-sidecar.mjs";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KINDS = new Set(["ollama-logprob", "systemone-endpoint"]);
const DEFAULT_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 3000;

export function assertLoopback(value, label) {
  const url = new URL(value);
  if (!/^(127\.0\.0\.1|localhost|\[::1\])$/i.test(url.hostname)) {
    throw new Error(`${label} must use a loopback host`);
  }
  return url.origin;
}

export function validateMatrix(matrix) {
  if (matrix?.schemaVersion !== 1) throw new Error("candidate matrix schemaVersion must be 1");
  if (!Array.isArray(matrix.candidates) || matrix.candidates.length === 0) throw new Error("candidate matrix has no candidates");
  assertLoopback(matrix.ollamaEndpoint, "ollamaEndpoint");
  const ids = new Set();
  for (const candidate of matrix.candidates) {
    if (typeof candidate?.id !== "string" || !candidate.id) throw new Error("every candidate needs an id");
    if (ids.has(candidate.id)) throw new Error(`duplicate candidate id: ${candidate.id}`);
    ids.add(candidate.id);
    if (!KINDS.has(candidate.kind)) throw new Error(`${candidate.id}: unknown kind ${candidate.kind}`);
    if (candidate.kind === "ollama-logprob") {
      if (typeof candidate.model !== "string" || !candidate.model) throw new Error(`${candidate.id}: model is required`);
      if (!Array.isArray(candidate.promptStyles) || candidate.promptStyles.length === 0) {
        throw new Error(`${candidate.id}: promptStyles is required`);
      }
      for (const style of candidate.promptStyles) {
        if (!PROMPT_STYLE_NAMES.includes(style)) throw new Error(`${candidate.id}: unknown prompt style ${style}`);
      }
    } else {
      assertLoopback(candidate.endpoint, `${candidate.id} endpoint`);
      if (!Array.isArray(candidate.models) || candidate.models.length === 0) throw new Error(`${candidate.id}: models is required`);
    }
  }
  return matrix;
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

export function summariseRun(report) {
  const { summary, rows } = report;
  const latencies = rows.filter((row) => row.status !== "unavailable" && Number.isFinite(row.latencyMs)).map((row) => row.latencyMs);
  const { correct, wrong, abstained } = summary.sidecar;
  return {
    total: summary.total,
    correct,
    wrong,
    abstained,
    unavailable: summary.unavailable,
    confidentWrong: summary.confidentWrong,
    coverage: summary.total === 0 ? 0 : (correct + wrong) / summary.total,
    accuracy: summary.total === 0 ? 0 : correct / summary.total,
    deterministicCorrect: summary.deterministic.correct,
    latencyMs: { median: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
  };
}

function disqualification(result) {
  if (result.status !== "measured") return result.status;
  if (result.metrics.unavailable > 0) return "sidecar-unavailable";
  if (result.metrics.confidentWrong > 0) return "confident-wrong";
  return null;
}

function compareEligible(left, right) {
  const a = left.metrics;
  const b = right.metrics;
  return b.correct - a.correct
    || a.wrong - b.wrong
    || a.abstained - b.abstained
    || (a.latencyMs.median ?? Infinity) - (b.latencyMs.median ?? Infinity)
    || left.id.localeCompare(right.id);
}

export function rankResults(results) {
  const annotated = results.map((result) => ({ ...result, disqualifiedBy: disqualification(result) }));
  const eligible = annotated.filter((result) => result.disqualifiedBy === null).sort(compareEligible);
  const others = annotated.filter((result) => result.disqualifiedBy !== null).sort((a, b) => a.id.localeCompare(b.id));
  eligible.forEach((result, index) => { result.rank = index + 1; });
  return { bestCandidate: eligible[0]?.id ?? null, ranked: [...eligible, ...others] };
}

async function getJson(url, timeoutMs = PROBE_TIMEOUT_MS) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function ollamaInventory(endpoint) {
  const payload = await getJson(`${endpoint}/api/tags`);
  return new Map((payload.models ?? []).map((model) => [model.name, model]));
}

async function residentVramGb(endpoint, model) {
  try {
    const payload = await getJson(`${endpoint}/api/ps`);
    const entry = (payload.models ?? []).find((item) => item.name === model);
    return entry?.size_vram ? Number((entry.size_vram / 1024 ** 3).toFixed(2)) : null;
  } catch {
    return null;
  }
}

function silentLogger() {
  return { write() {} };
}

async function runLogprobCandidate(root, candidate, style, inventory, options) {
  const id = `${candidate.id}/${style}`;
  const base = { id, candidate: candidate.id, promptStyle: style, model: candidate.model, publisher: candidate.publisher, license: candidate.license };
  const installed = inventory.get(candidate.model);
  if (!installed) return { ...base, status: "not-installed" };
  const revision = `ollama-${installed.digest}`;
  const scorer = new OpenAiLogprobScorer({
    endpoint: options.ollamaEndpoint,
    model: candidate.model,
    revision,
    requestTimeoutMs: options.timeoutMs,
    promptStyle: style,
    disableThinking: candidate.disableThinking === true,
    logger: silentLogger(),
  });
  const coldStarted = performance.now();
  try {
    await scorer.start();
    await scorer.score({
      id: "warmup",
      state: "warmup",
      question: "Is this server ready?",
      options: [{ id: "false", description: "No" }, { id: "true", description: "Yes" }],
    });
  } catch (error) {
    scorer.close();
    return { ...base, revision, status: "warmup-failed", error: error?.code ?? error?.message ?? "unknown" };
  }
  const coldStartMs = Math.round(performance.now() - coldStarted);
  const sidecar = createDecisionSidecar({ scorer, port: 0 });
  try {
    const address = await sidecar.listen();
    const report = await evaluateLiveReport(root, {
      endpoint: `http://127.0.0.1:${address.port}`,
      model: candidate.model,
      revision,
      timeoutMs: options.timeoutMs,
    });
    return {
      ...base,
      revision,
      status: "measured",
      coldStartMs,
      vramGb: await residentVramGb(options.ollamaEndpoint, candidate.model),
      metrics: summariseRun(report),
      rows: report.rows.map(({ task: _task, ...row }) => row),
    };
  } finally {
    await sidecar.close();
  }
}

async function runEndpointCandidate(root, candidate, model, options) {
  const id = `${candidate.id}/${model}`;
  const base = { id, candidate: candidate.id, promptStyle: null, model, publisher: candidate.publisher, license: candidate.license };
  const endpoint = assertLoopback(candidate.endpoint, `${candidate.id} endpoint`);
  try {
    await getJson(`${endpoint}/v1/models`);
  } catch {
    return { ...base, status: "not-running" };
  }
  const report = await evaluateLiveReport(root, { endpoint, model, revision: `endpoint-${model}`, timeoutMs: options.timeoutMs });
  return { ...base, status: "measured", metrics: summariseRun(report), rows: report.rows.map(({ task: _task, ...row }) => row) };
}

function parseArgs(argv) {
  const values = { root: null, matrix: null, only: null, json: false, timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${name} requires a value`);
      return value;
    };
    if (name === "--repo-root") values.root = next();
    else if (name === "--matrix") values.matrix = next();
    else if (name === "--only") values.only = new Set(next().split(",").map((item) => item.trim()).filter(Boolean));
    else if (name === "--timeout-ms") values.timeoutMs = Number(next());
    else if (name === "--json") values.json = true;
    else throw new Error(`unknown option: ${name}`);
  }
  if (!Number.isFinite(values.timeoutMs) || values.timeoutMs <= 0) throw new Error("--timeout-ms must be a positive number");
  return values;
}

function writeTable(outcome) {
  for (const result of outcome.ranked) {
    const m = result.metrics;
    const cells = [
      String(result.rank ?? "-").padStart(2),
      result.id.padEnd(44),
      m ? `${m.correct}/${m.total} ok` : result.status,
      m ? `wrong=${m.wrong} abst=${m.abstained} cw=${m.confidentWrong} unav=${m.unavailable}` : "",
      m ? `cov=${m.coverage.toFixed(2)} p50=${Math.round(m.latencyMs.median ?? 0)}ms` : "",
      result.disqualifiedBy && result.status === "measured" ? `DQ:${result.disqualifiedBy}` : "",
    ];
    process.stdout.write(`${cells.join("  ")}\n`);
  }
  process.stdout.write(`\nbest candidate: ${outcome.bestCandidate ?? "none eligible"} (report-only; freeze unchanged)\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolve(options.root ?? process.env.HARNESS_PROJECT_ROOT ?? sourceRoot);
  if (!existsSync(join(root, "harness.config.json"))) throw new Error("repo root must contain harness.config.json");
  const evalRoot = join(root, ".github", "harness", "eval");
  const matrixPath = resolve(evalRoot, options.matrix ?? "decision-bakeoff-candidates.json");
  const fromEval = relative(evalRoot, matrixPath);
  if (fromEval.startsWith("..") || isAbsolute(fromEval)) throw new Error("--matrix must stay inside .github/harness/eval");
  const matrix = validateMatrix(JSON.parse(readFileSync(matrixPath, "utf8")));
  options.ollamaEndpoint = assertLoopback(matrix.ollamaEndpoint, "ollamaEndpoint");
  const candidates = matrix.candidates.filter((candidate) => !options.only || options.only.has(candidate.id));
  const needsOllama = candidates.some((candidate) => candidate.kind === "ollama-logprob");
  const inventory = needsOllama ? await ollamaInventory(options.ollamaEndpoint) : new Map();

  const results = [];
  for (const candidate of candidates) {
    const variants = candidate.kind === "ollama-logprob" ? candidate.promptStyles : candidate.models;
    for (const variant of variants) {
      process.stderr.write(`[decision-bakeoff] ${candidate.id}/${variant}\n`);
      results.push(candidate.kind === "ollama-logprob"
        ? await runLogprobCandidate(root, candidate, variant, inventory, options)
        : await runEndpointCandidate(root, candidate, variant, options));
    }
  }
  const outcome = { generatedAt: new Date().toISOString(), promotionEligible: false, freezeUnchanged: true, ...rankResults(results) };
  const outDir = join(root, ".github", "harness", "runs", "decision-bakeoff");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `bakeoff-${outcome.generatedAt.replaceAll(":", "").replaceAll(".", "")}.json`);
  writeFileSync(outPath, `${JSON.stringify(outcome, null, 2)}\n`);
  if (options.json) process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  else writeTable(outcome);
  process.stderr.write(`[decision-bakeoff] report: ${outPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`[decision-bakeoff] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
