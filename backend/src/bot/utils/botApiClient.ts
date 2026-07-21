import { setTimeout as sleep } from 'node:timers/promises';

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { logger } from '../../utils/logger';
import { API_BASE_URL } from '../constants/api';

/** Status codes that are safe to retry (transient server errors). */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
/** Max retries for transient failures. */
const MAX_RETRIES = 2;
/** Base delay between retries in ms (doubled each attempt). */
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 15_000;

/**
 * Pre-configured axios instance for bot → backend internal calls.
 *
 * Automatically attaches:
 *   - X-Bot-Internal-Token (from BOT_INTERNAL_SECRET env var)
 *
 * Per-request callers should set X-Discord-Guild-Id (and optionally
 * X-Discord-User-Id) headers when invoking org-scoped endpoints.
 *
 * Routes that accept this client must use the `botOrUserAuth` middleware
 * (or `validateBotToken` / `validateBotRequest` for legacy bot-only routes).
 */
const botApiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  // Never silently follow redirects. The backend ingress is allowInsecure:false, so an HTTP
  // internal URL gets 301-redirected to HTTPS — and axios would re-issue a POST as GET with the
  // body dropped, turning POST-only routes into catch-all 404s. With maxRedirects:0 a 3xx surfaces
  // as a loud AxiosError instead of a silent method/body downgrade.
  maxRedirects: 0,
});

botApiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (secret) {
    config.headers.set('x-bot-internal-token', secret);
  } else if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    logger.warn('BOT_INTERNAL_SECRET is not set; bot API calls will likely fail with 401');
  }

  // When traffic goes through Azure Front Door, attach the FDID header
  // so the origin restriction middleware allows the request.
  const fdid = process.env.AZURE_FRONT_DOOR_ID;
  if (fdid) {
    config.headers.set('x-azure-fdid', fdid);
  }

  return config;
});

/** HTTP methods that are safe to retry (idempotent). */
const RETRYABLE_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);

// Retry interceptor for transient failures (timeouts, 5xx, 429)
botApiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config;
  if (!config) {
    throw error;
  }

  // Only retry idempotent methods — POST can create duplicates if the server
  // processed the request but the response was lost.
  const method = (config.method ?? 'get').toLowerCase();
  if (!RETRYABLE_METHODS.has(method)) {
    throw error;
  }

  const retryCount = ((config as unknown as Record<string, unknown>).__retryCount as number) || 0;
  const isRetryable =
    error.code === 'ECONNABORTED' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    (error.response && RETRYABLE_STATUS_CODES.has(error.response.status));

  if (!isRetryable || retryCount >= MAX_RETRIES) {
    throw error;
  }

  (config as unknown as Record<string, unknown>).__retryCount = retryCount + 1;
  const exponentialDelay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
  const delay = Math.max(0, Math.min(exponentialDelay, RETRY_MAX_DELAY_MS));
  logger.warn(
    `Bot API request failed (${error.code ?? error.response?.status}), retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
    { url: config.url, method: config.method }
  );
  await sleep(delay);
  return botApiClient(config);
});

/**
 * Helper to build the headers object for a Discord-originated API call.
 * Use spread into per-request `headers` to include guild/user context:
 *
 *   await botApiClient.get('/alliance-diplomacy', {
 *     headers: discordHeaders(interaction),
 *   });
 */
export function discordHeaders(interaction: {
  guildId: string | null;
  user: { id: string };
}): Record<string, string> {
  const headers: Record<string, string> = {};

  // Defensive: include bot internal auth header on per-request headers too.
  // The request interceptor also sets this header, but providing it here
  // avoids edge cases where custom headers or intermediary transforms could
  // drop interceptor-provided auth values.
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (secret) {
    headers['x-bot-internal-token'] = secret;
  }

  const fdid = process.env.AZURE_FRONT_DOOR_ID;
  if (fdid) {
    headers['x-azure-fdid'] = fdid;
  }

  if (interaction.guildId) {
    headers['x-discord-guild-id'] = interaction.guildId;
  }
  if (interaction.user?.id) {
    headers['x-discord-user-id'] = interaction.user.id;
  }
  return headers;
}

export { botApiClient };
