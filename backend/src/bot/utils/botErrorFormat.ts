/**
 * Shared bot→API error formatting utility.
 *
 * Extracts a user-friendly error message from axios errors returned by
 * internal API calls. Also logs the full response details so production
 * failures are diagnosable.
 */

import { logger } from '../../utils/logger';

/**
 * Recursively extract error message from response data.
 * Handles nested error structures like { error: { message: "..." } }
 */
function extractResponseMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const record = data as Record<string, unknown>;

  // Prefer `message`, then `error` (if string), then nested `error.message`
  if (typeof record.message === 'string') {
    return record.message;
  }
  if (typeof record.error === 'string') {
    return record.error;
  }
  if (
    record.error &&
    typeof record.error === 'object' &&
    typeof (record.error as Record<string, unknown>).message === 'string'
  ) {
    return (record.error as { message: string }).message;
  }
  return undefined;
}

/** Extract a user-friendly error message from a bot→API axios error.
 *  Also logs the full response details so production failures are diagnosable. */
export function formatBotApiError(error: unknown, fallback: string, context?: string): string {
  const axiosError = error as {
    response?: { status?: number; data?: unknown };
    config?: { url?: string; method?: string };
    code?: string;
    message?: string;
  };

  // Always log the full error details for production diagnosis
  logger.error(`Bot API error${context ? ` [${context}]` : ''}`, {
    status: axiosError.response?.status,
    data: axiosError.response?.data,
    url: axiosError.config?.url,
    method: axiosError.config?.method,
    code: axiosError.code,
    message: axiosError.message,
  });

  // 403 from the Front Door middleware means BOT_INTERNAL_SECRET is
  // missing or mismatched — surface actionable guidance for admins.
  if (axiosError.response?.status === 403) {
    const responseMsg = extractResponseMessage(axiosError.response?.data);
    if (responseMsg === 'Direct access not permitted') {
      return (
        'Bot-to-API authentication failed (Direct access not permitted).\n' +
        '💡 Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both ' +
        'the API and bot containers.'
      );
    }
  }

  // 401 "Access token required" / "invalid bot token" on a bot-only route
  // means the bot did not send (or sent the wrong) X-Bot-Internal-Token —
  // i.e. BOT_INTERNAL_SECRET is unset or mismatched on the bot container.
  if (axiosError.response?.status === 401) {
    const responseMsg = extractResponseMessage(axiosError.response?.data);
    if (
      responseMsg === 'Access token required' ||
      responseMsg === 'Unauthorized: invalid bot token' ||
      responseMsg === 'Unauthorized: BOT_INTERNAL_SECRET is not configured'
    ) {
      return (
        `Bot-to-API authentication failed (${responseMsg}).\n` +
        '💡 Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both ' +
        'the API and bot containers, then restart the bot.'
      );
    }
  }

  // Try to extract message from response data first (handles nested objects)
  const responseMsg = extractResponseMessage(axiosError.response?.data);
  return responseMsg ?? (error instanceof Error ? error.message : fallback);
}
