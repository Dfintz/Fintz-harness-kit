/**
 * Environment configuration for the frontend application.
 * Abstracts Vite's import.meta.env for testability.
 */

interface EnvConfig {
  API_URL: string;
  WS_URL: string;
  IS_DEV: boolean;
  IS_PROD: boolean;
  MODE: string;
}

// Default values for when running in test environment
const defaults: EnvConfig = {
  API_URL: '/api',
  WS_URL: 'http://localhost:3000',
  IS_DEV: false,
  IS_PROD: true,
  MODE: 'production',
};

/**
 * Safely get a value from import.meta.env
 * Returns undefined if import.meta is not available (e.g., in Jest)
 */
function getImportMetaEnv(key: string): string | boolean | undefined {
  // This function body will only execute in environments where import.meta is available
  // Jest will use the mock from __mocks__/config/env.ts instead
  switch (key) {
    case 'VITE_API_URL':
      return import.meta.env.VITE_API_URL;
    case 'VITE_WS_URL':
      return import.meta.env.VITE_WS_URL;
    case 'DEV':
      return import.meta.env.DEV;
    case 'PROD':
      return import.meta.env.PROD;
    case 'MODE':
      return import.meta.env.MODE;
    default:
      return undefined;
  }
}

/**
 * Get the backend URL with proper fallback logic
 * In production without VITE_API_URL, use relative URLs (relies on same-origin or proxy)
 * In development, fallback to localhost
 *
 * NOTE: This returns the base URL WITHOUT the /api path.
 * Consuming code should append the appropriate path (e.g., /api/auth/...).
 */
export function getBackendUrl(): string {
  const viteApiUrl = getImportMetaEnv('VITE_API_URL') as string | undefined;

  // If VITE_API_URL is explicitly set and not empty, use it
  // Strip trailing /api if present to avoid double /api in URLs
  if (viteApiUrl && viteApiUrl.trim() !== '') {
    let url = viteApiUrl.trim();
    // Remove trailing /api (case-insensitive)
    url = url.replace(/\/api\/?$/i, '');

    // Add https:// protocol if URL doesn't have a protocol and isn't a relative path
    // This handles cases like 'fringecore.space/api' -> 'https://fringecore.space'
    if (url && !url.match(/^https?:\/\//i) && !url.startsWith('/')) {
      url = 'https://' + url;
    }

    return url;
  }

  // In development, use relative URLs to leverage Vite proxy (defined in vite.config.ts)
  // The proxy maps /api to http://localhost:3000, making it appear same-origin for cookies
  // This solves the cross-origin cookie issue between localhost:3001 (frontend) and localhost:3000 (backend)
  const isDev = getImportMetaEnv('DEV') as boolean | undefined;
  if (isDev) {
    return '';
  }

  // In production without VITE_API_URL, use relative URL (same-origin)
  // This assumes the frontend and backend are served from the same domain
  // Returns empty string to allow relative paths like /api/...
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // Return empty string instead of '/api' to avoid double /api in URLs
  // The consuming code will append /api/... paths
  return '';
}

/**
 * Get the current environment configuration.
 * Uses Vite's import.meta.env when available, falls back to defaults for tests.
 */
function getEnv(): EnvConfig {
  return {
    API_URL: getBackendUrl(),
    WS_URL: getBackendWsUrl(),
    IS_DEV: (getImportMetaEnv('DEV') as boolean) ?? defaults.IS_DEV,
    IS_PROD: (getImportMetaEnv('PROD') as boolean) ?? defaults.IS_PROD,
    MODE: (getImportMetaEnv('MODE') as string) || defaults.MODE,
  };
}

/**
 * Get the backend WebSocket URL with proper fallback logic
 * In development, returns empty string to use relative URL with Vite proxy
 * In production, uses explicit backend URL
 */
export function getBackendWsUrl(): string {
  const viteWsUrl = getImportMetaEnv('VITE_WS_URL') as string | undefined;

  // If VITE_WS_URL is explicitly set and not empty, use it
  if (viteWsUrl && viteWsUrl.trim() !== '') {
    return viteWsUrl.trim();
  }

  // In development, use relative URL to leverage Vite proxy for WebSocket (/socket.io)
  // The proxy makes it appear same-origin, avoiding CORS issues
  const isDev = getImportMetaEnv('DEV') as boolean | undefined;
  if (isDev) {
    return '';
  }

  // In production, derive from current origin
  // This assumes frontend and backend are on the same domain
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // Fallback to defaults (for tests)
  return defaults.WS_URL;
}

export const env = getEnv();

// Export individual values for convenience
export const API_URL = env.API_URL;
export const WS_URL = env.WS_URL;
export const IS_DEV = env.IS_DEV;
export const IS_PROD = env.IS_PROD;
export const MODE = env.MODE;

/** Feature flag: enable the live-demo Guide Mode tour. Defaults to false. */
export const ENABLE_LIVE_DEMO_GUIDE: boolean =
  import.meta.env.VITE_ENABLE_LIVE_DEMO_GUIDE === 'true';
