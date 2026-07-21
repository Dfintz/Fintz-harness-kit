/**
 * Shared web-app URL helpers for bot-generated deep links.
 *
 * Centralises base-URL resolution and path normalisation so individual bot
 * commands do not each re-implement it (single source of truth).
 */

/** Public web app host used when no environment override is configured. */
const PUBLIC_APP_FALLBACK = 'https://fringecore.space';

/**
 * Resolve the web app base URL (no trailing slash) for bot deep links.
 *
 * Bot links are delivered to Discord and opened by remote users, so the base
 * URL must be publicly reachable. Prefer an explicit `APP_URL` (the convention
 * used across bot commands such as help/recruitment/wiki), then `FRONTEND_URL`,
 * then the canonical public host. Unlike `config/urls.getFrontendUrl`, this
 * never falls back to `localhost` in development.
 *
 * @returns The web app origin without a trailing slash.
 */
export function getAppBaseUrl(): string {
  const base = process.env.APP_URL ?? process.env.FRONTEND_URL ?? PUBLIC_APP_FALLBACK;
  return base.replace(/\/$/, '');
}

/**
 * Build an absolute web app URL for the given path.
 *
 * @param path - Path beginning with `/` (a leading slash is added if missing).
 * @returns Absolute URL combining the resolved base URL and the path.
 */
export function buildAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}
