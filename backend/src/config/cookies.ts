import { CookieOptions } from 'express';

/**
 * Cookie Configuration
 *
 * Secure configuration for httpOnly cookies used for token storage.
 * Using httpOnly cookies instead of localStorage/sessionStorage reduces XSS attack surface
 * as JavaScript cannot access the token values.
 *
 * Security measures:
 * - httpOnly: Prevents JavaScript access (XSS protection - CWE-1004)
 * - secure: Only sent over HTTPS (CWE-614)
 * - sameSite: 'lax' for same-site request protection with top-level navigation support
 *   - CSRF protection is maintained through explicit CORS origin validation and CSRF token double-submit pattern
 * - domain: Scoped to parent domain for cross-subdomain sharing when applicable
 * - path: Restricted to API endpoints
 */

const _isProduction = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Parse ACCESS_TOKEN_EXPIRY env var (e.g. '1h', '30m', '2h') into milliseconds.
 * Falls back to 1 hour if not set or unrecognised.
 */
function getAccessTokenMaxAgeMs(): number {
  if (isDev) {
    return 24 * 60 * 60 * 1000;
  } // 24h in dev

  const raw = process.env.ACCESS_TOKEN_EXPIRY || '1h';
  const match = /^(\d+)([mhds])$/.exec(raw.trim());
  if (!match) {
    return 60 * 60 * 1000;
  } // default 1h

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? 3_600_000);
}

/**
 * Derive access-token lifetime (ms) from a JWT's iat/exp claims.
 * Returns null when claims are missing or malformed.
 */
function getJwtLifetimeMs(accessToken: string): number | null {
  const segments = accessToken.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadSegment = segments[1].replaceAll('-', '+').replaceAll('_', '/');
    const padded = payloadSegment.padEnd(
      payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4),
      '='
    );
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded) as { iat?: unknown; exp?: unknown };

    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }

    const lifetimeMs = (payload.exp - payload.iat) * 1000;
    return lifetimeMs > 0 ? lifetimeMs : null;
  } catch {
    return null;
  }
}

/**
 * Derive cookie domain for cross-subdomain cookie sharing.
 *
 * When frontend (fringecore.space) and backend (api.fringecore.space) are on
 * different subdomains, the CSRF cookie must be scoped to the parent domain
 * (`.fringecore.space`) so frontend JavaScript can read it.
 *
 * Resolution: COOKIE_DOMAIN env var > extracted from CORS_ORIGIN > undefined (browser default)
 */
function getCookieDomain(): string | undefined {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN;
  }

  // Extract parent domain from CORS_ORIGIN (e.g. https://fringecore.space → .fringecore.space)
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin && corsOrigin !== '*') {
    try {
      // Take the first origin if comma-separated
      const firstOrigin = corsOrigin.split(',')[0].trim();
      const hostname = new URL(firstOrigin).hostname;
      // Don't set domain for localhost / IP addresses
      if (hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        return `.${hostname}`;
      }
    } catch {
      // Invalid URL — fall through to undefined
    }
  }

  return undefined;
}

/**
 * Cookie configuration for access tokens
 * Short-lived, stored in memory-only cookie
 *
 * In production: secure=true, sameSite='lax', domain from CORS_ORIGIN (cross-subdomain sharing)
 * In development: secure=true, sameSite='lax' — localhost is treated as secure context by browsers
 *   Domain is unset in development so cookies work with localhost cross-port (frontend :3001 → backend :3000)
 */
export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
  maxAge: getAccessTokenMaxAgeMs(), // Derived from ACCESS_TOKEN_EXPIRY env var
};

/**
 * Access-token cookie options derived from the issued token lifetime.
 * This keeps cookie expiry aligned with role-specific JWT expirations.
 */
export function getAccessTokenCookieOptions(accessToken: string): CookieOptions {
  const maxAge = getJwtLifetimeMs(accessToken) ?? getAccessTokenMaxAgeMs();
  return {
    ...accessTokenCookieOptions,
    maxAge,
  };
}

/**
 * Cookie configuration for refresh tokens
 */
export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Cookie configuration for CSRF tokens
 * Not httpOnly so JavaScript can read and send in header.
 * Domain is set to the parent domain so the frontend on a different subdomain
 * can read the cookie value for the double-submit pattern.
 */
export const csrfTokenCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Cookie configuration for the short-lived PKCE verifier set during OAuth
 * initiate. Read once at the callback and then cleared. SameSite=Lax allows
 * the cookie to ride along the top-level GET callback redirect.
 */
export const pkceCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
  maxAge: 10 * 60 * 1000, // 10 minutes — matches OAuth state TTL
};

/**
 * Cookie names
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token',
  DISCORD_PKCE_VERIFIER: 'discord_pkce_verifier',
  MOBILE_REDIRECT: 'mobile_redirect',
} as const;

/**
 * Clear auth cookie options (for logout)
 * Must match the original cookie settings to clear properly
 */
export const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
};

/**
 * Clear refresh cookie options (for logout)
 * Must match the original cookie settings to clear properly
 */
export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
};

/**
 * Clear CSRF cookie options (for logout)
 * Must match the original csrfTokenCookieOptions to clear properly
 */
export const clearCsrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: getCookieDomain(),
};
