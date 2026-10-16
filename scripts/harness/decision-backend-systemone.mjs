#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { BackendError } from "./decision-backend-openai.mjs";

const execFileAsync = promisify(execFile);
const DEFAULT_JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_FOUNDRY_DEPLOYMENT = "Microsoft-Decision-1";
const UNPINNED_REVISION = "hosted-unpinned";
const FOUNDRY_SYSTEMONE_PATH = "/providers/microsoft/v1/systemone";

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function endpointFor(provider, env) {
  return provider === "jev"
    ? trimmed(env.HARNESS_DECISION_JEV_ENDPOINT) || DEFAULT_JEV_ENDPOINT
    : trimmed(env.HARNESS_DECISION_FOUNDRY_ENDPOINT);
}

export function resolveHostedDecisionProvider(env = process.env) {
  const override = trimmed(env.HARNESS_DECISION_HOSTED_PROVIDER);
  if (override && override !== "jev" && override !== "foundry") {
    throw new Error("HARNESS_DECISION_HOSTED_PROVIDER must be 'jev' or 'foundry'");
  }
  const apiKey = trimmed(env.TYPESAFE_API_KEY);
  const foundryEndpoint = trimmed(env.HARNESS_DECISION_FOUNDRY_ENDPOINT);
  let provider = override || null;
  if (!provider && apiKey) provider = "jev";
  else if (!provider && foundryEndpoint) provider = "foundry";
  if (!provider) return null;
  if (provider === "jev" && !apiKey) {
    throw new Error("HARNESS_DECISION_HOSTED_PROVIDER=jev requires TYPESAFE_API_KEY");
  }
  if (provider === "foundry" && !foundryEndpoint) {
    throw new Error("HARNESS_DECISION_HOSTED_PROVIDER=foundry requires HARNESS_DECISION_FOUNDRY_ENDPOINT");
  }
  const revision = trimmed(env.HARNESS_DECISION_REVISION) || UNPINNED_REVISION;
  if (provider === "jev") {
    const model = trimmed(env.HARNESS_DECISION_JEV_MODEL) || "jev-latest";
    return {
      provider,
      endpoint: endpointFor(provider, env),
      model,
      revision,
      apiKey,
      apiKeyPresent: true,
    };
  }
  return {
    provider,
    endpoint: endpointFor(provider, env),
    deployment: trimmed(env.HARNESS_DECISION_FOUNDRY_DEPLOYMENT) || DEFAULT_FOUNDRY_DEPLOYMENT,
    revision,
    apiKey: trimmed(env.AZURE_DECISION_API_KEY),
    apiKeyPresent: Boolean(trimmed(env.AZURE_DECISION_API_KEY)),
  };
}

function isLoopback(hostname) {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

function validatedEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new TypeError("hosted System One endpoint must be a valid URL");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new TypeError("hosted System One endpoint must use https unless it is loopback");
  }
  let normalized = url.toString();
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
}

function foundrySystemOneUrl(base) {
  return base.endsWith(FOUNDRY_SYSTEMONE_PATH) ? base : `${base}${FOUNDRY_SYSTEMONE_PATH}`;
}

function parseExpiry(value, now) {
  if (typeof value === "number" && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1e12 ? numeric : numeric * 1000;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return now();
}

async function defaultTokenProvider({ timeoutMs = 15000 } = {}) {
  // On Windows the Azure CLI is az.cmd, which Node only launches through a shell; all arguments are constants.
  const windows = process.platform === "win32";
  const { stdout } = await execFileAsync(
    windows ? "az.cmd" : "az",
    ["account", "get-access-token", "--resource", "https://cognitiveservices.azure.com", "--output", "json"],
    { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024, shell: windows },
  );
  const payload = JSON.parse(stdout);
  if (!trimmed(payload?.accessToken)) throw new Error("Azure CLI did not provide an access token");
  return { accessToken: payload.accessToken, expiresOn: payload.expires_on ?? payload.expiresOn };
}

function safeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function isPinnedJevModel(model) {
  return typeof model === "string" && model.trim() !== "" && !model.trim().toLowerCase().endsWith("latest");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function httpError(response) {
  const status = Number(response?.status) || 0;
  let code = "upstream_error";
  if (status === 401 || status === 403) code = "upstream_auth";
  else if (status === 429) code = "upstream_rate_limited";
  return new BackendError(code, `hosted System One request failed with status ${status}`);
}

function orderedProbabilities(answers, questionId, expectedIds) {
  if (!isPlainObject(answers) || Object.keys(answers).length !== 1 || !Object.hasOwn(answers, questionId)) {
    throw new BackendError("invalid_response", "hosted response did not contain the requested answer");
  }
  const probabilities = answers[questionId]?.probabilities;
  if (!isPlainObject(probabilities)) {
    throw new BackendError("invalid_response", "hosted response probabilities were invalid");
  }
  if (Object.keys(probabilities).length !== expectedIds.length || expectedIds.some((id) => !Object.hasOwn(probabilities, id))) {
    throw new BackendError("invalid_response", "hosted response probability ids did not match");
  }
  const ordered = expectedIds.map((id) => probabilities[id]);
  if (ordered.some((value) => !Number.isFinite(value) || value < 0) || ordered.reduce((total, value) => total + value, 0) <= 0) {
    throw new BackendError("invalid_response", "hosted response probabilities were invalid");
  }
  return ordered;
}

export class HostedSystemOneScorer {
  constructor({
    provider,
    endpoint,
    model = null,
    deployment = null,
    revision = UNPINNED_REVISION,
    apiKey = "",
    fetchImpl = globalThis.fetch,
    tokenProvider = defaultTokenProvider,
    requestTimeoutMs = 1200,
    startupTimeoutMs = 15000,
    refreshWindowMs = 300000,
    logger = process.stderr,
    now = Date.now,
  } = {}) {
    if (provider !== "jev" && provider !== "foundry") throw new TypeError("provider must be 'jev' or 'foundry'");
    if (typeof fetchImpl !== "function") throw new TypeError("a fetch implementation is required");
    if (typeof tokenProvider !== "function") throw new TypeError("a token provider is required");
    this.provider = provider;
    this.endpoint = provider === "foundry" ? foundrySystemOneUrl(validatedEndpoint(endpoint)) : validatedEndpoint(endpoint);
    this.configuredModel = provider === "jev" ? model : deployment;
    if (!trimmed(this.configuredModel)) throw new TypeError(`${provider} model or deployment is required`);
    this.revision = trimmed(revision) || UNPINNED_REVISION;
    this.apiKey = trimmed(apiKey);
    this.fetchImpl = fetchImpl;
    this.tokenProvider = tokenProvider;
    this.requestTimeoutMs = requestTimeoutMs;
    this.startupTimeoutMs = startupTimeoutMs;
    this.refreshWindowMs = refreshWindowMs;
    this.logger = logger;
    this.now = now;
    this.model = null;
    this.authMode = null;
    this.token = null;
    this.tokenExpiry = 0;
    this.failed = null;
    this.refreshTimer = null;
    this.refreshing = null;
  }

  ready() {
    return this.model !== null && this.failed === null;
  }

  metadata() {
    if (!this.model) return null;
    return {
      source: this.model.source,
      revision: this.model.revision,
      backend: "hosted-systemone",
      provider: this.provider,
      authMode: this.authMode,
      revisionPinned: this.model.revisionPinned,
      device: "hosted",
      dtype: "provider-managed",
    };
  }

  async start() {
    if (this.ready()) return this.metadata();
    const source = `${this.provider}:${this.configuredModel}`;
    this.model = {
      source,
      revision: this.revision,
      revisionPinned: false,
      backend: "hosted-systemone",
      provider: this.provider,
      device: "hosted",
      dtype: "provider-managed",
    };
    if (this.provider === "jev") {
      this.authMode = "bearer";
    } else {
      this.authMode = "entra";
      try {
        await this.acquireToken();
      } catch {
        if (!this.apiKey) {
          this.authMode = null;
          this.model = null;
          throw new BackendError("startup_auth", "hosted Foundry authentication could not be established");
        }
        this.authMode = "api-key";
      }
    }
    if (!isPinnedJevModel(this.configuredModel)) {
      this.logger?.write?.("[decision-backend-systemone] warning: hosted model revision is unpinned; promotion remains blocked\n");
    }
    return this.metadata();
  }

  async acquireToken() {
    const timeout = this.startupTimeoutMs;
    const result = await this.tokenProvider({ timeoutMs: timeout });
    const accessToken = trimmed(result?.accessToken);
    if (!accessToken) throw new Error("token provider did not return a token");
    this.token = accessToken;
    this.tokenExpiry = parseExpiry(result.expiresOn ?? result.expires_on, this.now);
    this.scheduleRefresh();
  }

  scheduleRefresh() {
    if (this.authMode !== "entra" || !this.tokenExpiry) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const delay = Math.max(0, this.tokenExpiry - this.now() - this.refreshWindowMs);
    this.refreshTimer = setTimeout(() => {
      this.refreshToken().catch(() => {});
    }, delay);
    this.refreshTimer.unref?.();
  }

  async refreshToken() {
    if (this.authMode !== "entra" || this.refreshing) return this.refreshing;
    this.refreshing = this.acquireToken().catch(() => {}).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  ensureTokenFresh() {
    if (this.authMode !== "entra") return;
    if (!this.token || this.tokenExpiry <= this.now()) {
      throw new BackendError("auth_expired", "hosted authentication token has expired");
    }
    if (this.tokenExpiry - this.now() <= this.refreshWindowMs) void this.refreshToken();
  }

  headers() {
    if (this.authMode === "bearer") return { authorization: `Bearer ${this.apiKey}` };
    if (this.authMode === "api-key") return { "api-key": this.apiKey };
    this.ensureTokenFresh();
    return { authorization: `Bearer ${this.token}` };
  }

  async score(row, { signal: externalSignal } = {}) {
    if (!this.model) await this.start();
    if (this.failed) throw this.failed;
    const controller = new AbortController();
    let externalAborted = externalSignal?.aborted === true;
    const abortExternal = () => {
      externalAborted = true;
      controller.abort();
    };
    externalSignal?.addEventListener("abort", abortExternal, { once: true });
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const criteria = Object.fromEntries(row.options.map((option) => [option.id, option.description]));
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.headers() },
        body: JSON.stringify({
          model: this.configuredModel,
          state: row.state,
          questions: {
            [row.id]: { type: "choice", instructions: row.question, criteria },
          },
        }),
        signal: controller.signal,
      });
      if (!response?.ok) throw httpError(response);
      const payload = await response.json();
      this.checkIdentity(payload?.model);
      const expectedIds = row.options.map((option) => option.id);
      return {
        option_ids: expectedIds,
        probabilities: orderedProbabilities(payload?.answers, row.id, expectedIds),
        input_tokens: safeInteger(payload?.usage?.input_tokens ?? payload?.usage?.prompt_tokens),
        model: this.model,
      };
    } catch (error) {
      if (error instanceof BackendError) throw error;
      if (externalAborted) throw new BackendError("aborted", "hosted request was aborted");
      if (controller.signal.aborted) throw new BackendError("upstream_timeout", "hosted request exceeded its timeout");
      throw new BackendError("upstream_error", "hosted System One request failed");
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
  }

  checkIdentity(responseModel) {
    if (this.provider !== "jev" || !isPinnedJevModel(this.configuredModel)) return;
    if (typeof responseModel !== "string" || responseModel !== this.configuredModel) {
      this.failed = new BackendError("model_identity_changed", "hosted Jev model identity changed");
      throw this.failed;
    }
    this.model.revisionPinned = true;
  }

  close() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
}
