#!/usr/bin/env node
/**
 * Hosted-model agent: prompt on stdin, model text on stdout. Calls vendor APIs (OpenAI, Azure
 * OpenAI / AI Foundry, Anthropic, Gemini) for skill-adapter-eval and other `--agent` consumers.
 * Keys are sent only to trusted provider hosts or an explicit --allow-host; bodies are never logged.
 */
import { fileURLToPath } from "node:url";

const PROVIDERS = {
  openai: {
    keyEnv: ["OPENAI_API_KEY"],
    baseEnv: "OPENAI_BASE_URL",
    defaultBase: "https://api.openai.com/v1",
    trusted: (host) => host === "api.openai.com",
  },
  "azure-openai": {
    keyEnv: ["AZURE_OPENAI_KEY"],
    baseEnv: "AZURE_OPENAI_ENDPOINT",
    defaultBase: null,
    trusted: (host) => [".openai.azure.com", ".services.ai.azure.com", ".cognitiveservices.azure.com"].some((suffix) => host.endsWith(suffix)),
  },
  anthropic: {
    keyEnv: ["ANTHROPIC_API_KEY"],
    baseEnv: null,
    defaultBase: "https://api.anthropic.com/v1",
    trusted: (host) => host === "api.anthropic.com",
  },
  gemini: {
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    baseEnv: null,
    defaultBase: "https://generativelanguage.googleapis.com/v1beta",
    trusted: (host) => host === "generativelanguage.googleapis.com",
  },
};
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);
const BODY_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127})?$/;
const PATH_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class AgentConfigError extends Error {}

export function inferProvider(model) {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "gemini";
  if (/^(gpt-|o\d)/.test(model)) return "openai";
  throw new AgentConfigError(`cannot infer a provider for "${model}"; pass --provider openai|azure-openai|anthropic|gemini`);
}

export function validateModelId(provider, model) {
  const pattern = provider === "gemini" ? PATH_MODEL_ID : BODY_MODEL_ID;
  if (typeof model !== "string" || !pattern.test(model)) {
    throw new AgentConfigError(`invalid model id for ${provider}`);
  }
  return model;
}

export function resolveEndpoint(provider, rawBase, allowHosts) {
  const spec = PROVIDERS[provider];
  const base = rawBase || (spec.baseEnv && process.env[spec.baseEnv]) || spec.defaultBase;
  if (!base) throw new AgentConfigError(`${provider} needs --base-url or ${spec.baseEnv}`);
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new AgentConfigError(`invalid base URL for ${provider}`);
  }
  const host = url.hostname.toLowerCase();
  const allowed = allowHosts.includes(host) || (!LOOPBACK_HOSTS.has(host) && spec.trusted(host));
  if (!allowed) throw new AgentConfigError(`host ${host} is not trusted for ${provider}; pass --allow-host ${host} to opt in`);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOOPBACK_HOSTS.has(host))) {
    throw new AgentConfigError(`${provider} requires https`);
  }
  if (url.username || url.password) throw new AgentConfigError("credentials in the base URL are not allowed");
  return url.href.replace(/\/+$/, "");
}

function readKey(provider, keyEnv) {
  const names = keyEnv ? [keyEnv] : PROVIDERS[provider].keyEnv;
  const name = names.find((candidate) => process.env[candidate]);
  if (!name) {
    throw new AgentConfigError(`missing API key: set ${names.join(" or ")} (skill-adapter-eval: add --pass-env ${names[0]})`);
  }
  return process.env[name];
}

export function buildRequest({ provider, base, model, key, prompt, maxTokens }) {
  const messages = [{ role: "user", content: prompt }];
  switch (provider) {
    case "openai":
      return {
        url: `${base}/chat/completions`,
        headers: { Authorization: `Bearer ${key}` },
        body: { model, messages, max_completion_tokens: maxTokens },
      };
    case "azure-openai":
      return {
        url: `${base}/chat/completions`,
        headers: { "api-key": key },
        body: { model, messages, max_completion_tokens: maxTokens },
      };
    case "anthropic":
      return {
        url: `${base}/messages`,
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: { model, messages, max_tokens: maxTokens },
      };
    case "gemini":
      return {
        url: `${base}/models/${encodeURIComponent(model)}:generateContent`,
        headers: { "x-goog-api-key": key },
        body: { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } },
      };
    default:
      throw new AgentConfigError(`unknown provider ${provider}`);
  }
}

export function extractText(provider, data) {
  if (provider === "anthropic") {
    return (data?.content ?? []).filter((part) => part?.type === "text").map((part) => part.text).join("");
  }
  if (provider === "gemini") {
    return (data?.candidates?.[0]?.content?.parts ?? []).map((part) => part?.text ?? "").join("");
  }
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parseArgs(argv) {
  const options = { provider: "auto", allowHosts: [], maxTokens: 2048, timeoutMs: 120000 };
  const keys = {
    "--provider": "provider", "--model": "model", "--base-url": "baseUrl", "--key-env": "keyEnv",
    "--max-tokens": "maxTokens", "--timeout-ms": "timeoutMs",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const raw = argv[i + 1];
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (raw === undefined || raw.startsWith("--")) throw new AgentConfigError(`${arg} requires a value`);
    if (arg === "--allow-host") options.allowHosts.push(raw.toLowerCase());
    else if (keys[arg]) options[keys[arg]] = raw;
    else throw new AgentConfigError(`unknown argument: ${arg}`);
    i += 1;
  }
  options.maxTokens = Math.max(1, Number.parseInt(options.maxTokens, 10) || 2048);
  options.timeoutMs = Math.max(1000, Number.parseInt(options.timeoutMs, 10) || 120000);
  return options;
}

const HELP = `Usage: node scripts/harness/hosted-agent.mjs [--provider auto|openai|azure-openai|anthropic|gemini]
  [--model <id>] [--base-url <url>] [--allow-host <hostname>] [--key-env <NAME>] [--max-tokens N] [--timeout-ms N]

Reads the prompt on stdin and prints the model's text on stdout. --model defaults to HARNESS_EVAL_MODEL.
auto: claude-* -> anthropic, gemini-* -> gemini, gpt-*/o<digit>* -> openai; otherwise pass --provider.
Default key env: OPENAI_API_KEY, AZURE_OPENAI_KEY (+ AZURE_OPENAI_ENDPOINT), ANTHROPIC_API_KEY, GEMINI_API_KEY|GOOGLE_API_KEY.
`;

export async function runHostedAgent(argv, prompt) {
  const options = parseArgs(argv);
  if (options.help) return { help: HELP };
  const model = options.model ?? process.env.HARNESS_EVAL_MODEL;
  if (!model) throw new AgentConfigError("missing model: pass --model or set HARNESS_EVAL_MODEL");
  const provider = options.provider === "auto" ? inferProvider(model) : options.provider;
  if (!PROVIDERS[provider]) throw new AgentConfigError(`unknown provider ${provider}`);
  validateModelId(provider, model);
  const base = resolveEndpoint(provider, options.baseUrl, options.allowHosts);
  const key = readKey(provider, options.keyEnv);
  const request = buildRequest({ provider, base, model, key, prompt, maxTokens: options.maxTokens });
  let response;
  try {
    response = await fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...request.headers },
      body: JSON.stringify(request.body),
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError" ? "timeout" : "network error";
    throw new Error(`${provider} request failed: ${reason}`);
  }
  if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status}`);
  const text = extractText(provider, await response.json());
  if (!text.trim()) throw new Error(`${provider} returned no text`);
  return { text };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const argv = process.argv.slice(2);
    const result = await runHostedAgent(argv, argv.includes("--help") ? "" : await readStdin());
    process.stdout.write(result.help ?? `${result.text}\n`);
  } catch (error) {
    process.stderr.write(`[hosted-agent] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof AgentConfigError ? 2 : 1;
  }
}
