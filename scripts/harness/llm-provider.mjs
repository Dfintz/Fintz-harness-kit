#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md (autoresearch, Understand-Anything, MCP, Ollama, LM Studio).
/**
 * Shared local-LLM provider adapter for harness agents and vector search.
 *
 * Supports two local runtimes behind one interface so loops/experiments and the
 * vector index can target either without code changes:
 *
 *   - ollama   — native API: POST /api/generate, POST /api/embed (legacy /api/embeddings).
 *                Default host http://localhost:11434.
 *   - lmstudio — OpenAI-compatible API: POST /v1/chat/completions, POST /v1/embeddings.
 *                Default host http://localhost:1234.
 *
 * Provider selection precedence (resolved by resolveProvider): explicit value >
 * HARNESS_LLM_PROVIDER env > 'ollama'. Aliases lm-studio / lm_studio / openai map to lmstudio.
 */

const DEFAULT_HOSTS = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
};

export function resolveProvider(value) {
  const raw = String(value ?? process.env.HARNESS_LLM_PROVIDER ?? 'ollama')
    .trim()
    .toLowerCase();
  const normalized = raw === 'lm-studio' || raw === 'lm_studio' || raw === 'openai' ? 'lmstudio' : raw;
  if (normalized !== 'ollama' && normalized !== 'lmstudio') {
    throw new Error(`Unknown LLM provider "${value}". Use "ollama" or "lmstudio".`);
  }
  return normalized;
}

export function defaultHost(provider) {
  return DEFAULT_HOSTS[resolveProvider(provider)];
}

export function normalizeHost(host, provider) {
  const resolved = resolveProvider(provider);
  const base = String(host || '').trim() || DEFAULT_HOSTS[resolved];
  return base.replace(/\/+$/, '');
}

function isNumberArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(entry => typeof entry === 'number' && Number.isFinite(entry))
  );
}

async function postJson(url, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Single-prompt text generation. Returns the model's response text.
 * @param {{provider?:string, host?:string, model:string, system?:string, prompt:string,
 *          temperature?:number, numPredict?:number, timeoutMs?:number}} opts
 */
export async function generateText(opts = {}) {
  const provider = resolveProvider(opts.provider);
  const host = normalizeHost(opts.host, provider);
  const { model, system, prompt, temperature, numPredict, timeoutMs } = opts;
  if (!model) throw new Error('generateText requires a model.');
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('generateText requires a non-empty prompt.');
  }

  if (provider === 'lmstudio') {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const body = { model, messages, stream: false };
    if (temperature !== undefined) body.temperature = temperature;
    if (numPredict !== undefined) body.max_tokens = Math.trunc(numPredict);
    const data = await postJson(`${host}/v1/chat/completions`, body, timeoutMs);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error(`LM Studio returned an empty chat completion (model ${model}).`);
    }
    return text;
  }

  // ollama
  const body = { model, prompt, stream: false };
  if (system) body.system = system;
  const options = {};
  if (temperature !== undefined) options.temperature = temperature;
  if (numPredict !== undefined) options.num_predict = Math.trunc(numPredict);
  if (Object.keys(options).length > 0) body.options = options;
  const data = await postJson(`${host}/api/generate`, body, timeoutMs);
  const text = typeof data?.response === 'string' ? data.response : '';
  if (text.trim().length === 0) {
    throw new Error(`Ollama returned an empty response payload (model ${model}).`);
  }
  return text;
}

/**
 * Embed a single string and return one numeric vector.
 * @param {{provider?:string, host?:string, model:string, input:string, timeoutMs?:number}} opts
 */
export async function embedOne(opts = {}) {
  const provider = resolveProvider(opts.provider);
  const host = normalizeHost(opts.host, provider);
  const { model, input, timeoutMs } = opts;
  if (!model) throw new Error('embedOne requires a model.');
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('embedOne requires a non-empty input string.');
  }

  if (provider === 'lmstudio') {
    const data = await postJson(`${host}/v1/embeddings`, { model, input }, timeoutMs);
    const vector = data?.data?.[0]?.embedding;
    if (!isNumberArray(vector)) {
      throw new Error(
        `LM Studio /v1/embeddings returned an unexpected shape for model ${model}. ` +
          'Ensure an embedding model is loaded in LM Studio and the server is running.'
      );
    }
    return vector;
  }

  // ollama: prefer /api/embed, fall back to legacy /api/embeddings (version-dependent).
  const errors = [];
  try {
    const payload = await postJson(`${host}/api/embed`, { model, input }, timeoutMs);
    if (isNumberArray(payload.embedding)) return payload.embedding;
    if (Array.isArray(payload.embeddings) && isNumberArray(payload.embeddings[0])) {
      return payload.embeddings[0];
    }
    errors.push('Unexpected /api/embed payload shape.');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    const payload = await postJson(`${host}/api/embeddings`, { model, prompt: input }, timeoutMs);
    if (isNumberArray(payload.embedding)) return payload.embedding;
    errors.push('Unexpected /api/embeddings payload shape.');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  throw new Error(
    [
      `Unable to fetch embeddings from Ollama at ${host} using model ${model}.`,
      'Ensure Ollama is running and the model is pulled locally.',
      `Details: ${errors.join(' | ')}`,
    ].join(' ')
  );
}
