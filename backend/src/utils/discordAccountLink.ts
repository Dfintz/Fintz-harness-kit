import { isAxiosError } from './errorHandler';

export const DISCORD_ACCOUNT_NOT_LINKED_CODE = 'DISCORD_ACCOUNT_NOT_LINKED';

export interface DiscordAccountLinkPrompt {
  message: string;
  loginUrl: string;
}

export interface ParseDiscordAccountLinkPromptOptions {
  allowedStatusCodes?: number[];
  fallbackMessage: string;
  fallbackLoginUrl: string;
}

export function getDiscordWebLoginUrl(): string {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://fringecore.space').replace(/\/$/, '');
  return `${frontendUrl}/login`;
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseDiscordAccountLinkPrompt(
  error: unknown,
  options: ParseDiscordAccountLinkPromptOptions
): DiscordAccountLinkPrompt | null {
  if (!isAxiosError(error)) {
    return null;
  }

  const allowedStatusCodes = new Set(options.allowedStatusCodes ?? [401, 403, 404]);

  const status = error.response?.status;
  const data = (error.response?.data ?? {}) as Record<string, unknown>;
  const errorCode = typeof data.errorCode === 'string' ? data.errorCode : '';
  const apiError = typeof data.error === 'string' ? data.error : '';
  const apiMessage = typeof data.message === 'string' ? data.message : '';
  const combined = `${apiError} ${apiMessage}`.toLowerCase();

  const isNotLinkedError =
    errorCode === DISCORD_ACCOUNT_NOT_LINKED_CODE ||
    (allowedStatusCodes.has(status ?? 0) &&
      (combined.includes('no platform user linked to this discord account') ||
        combined.includes('discord account is not linked') ||
        combined.includes('link your discord account on the web app first')));

  if (!isNotLinkedError) {
    return null;
  }

  return {
    message: apiMessage || options.fallbackMessage,
    loginUrl: isHttpUrl(data.loginUrl) ? data.loginUrl : options.fallbackLoginUrl,
  };
}
