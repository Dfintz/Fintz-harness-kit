import crypto from 'node:crypto';

import { logger } from './logger';

/** Maximum age for OAuth state tokens (10 minutes) */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Per-process random fallback secret for OAuth state signing.
 * Only used when JWT_SECRET and COOKIE_SECRET are both missing.
 * Tokens signed with this will not survive a process restart, but
 * that is acceptable — stale OAuth redirects simply fail gracefully.
 */
const PROCESS_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

/**
 * Returns the HMAC signing secret for OAuth state tokens.
 * Prefers explicit env vars; falls back to a per-process random key.
 */
export function getOAuthSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.COOKIE_SECRET;
  if (!secret) {
    logger.warn(
      'Neither JWT_SECRET nor COOKIE_SECRET is set — using per-process random secret for OAuth state. ' +
        'Set one of these environment variables for production use.'
    );
    return PROCESS_FALLBACK_SECRET;
  }
  return secret;
}

/** Result of validating an OAuth state token */
export interface OAuthStateResult {
  valid: boolean;
  /** User ID embedded during initiate when user was already authenticated (account linking flow) */
  linkUserId?: string;
}

/**
 * Generate HMAC-signed OAuth state for CSRF protection.
 *
 * Format (login):  `nonce.timestamp(base36).hmac_signature`
 * Format (link):   `nonce.timestamp(base36).linkUserId(base64url).hmac_signature`
 *
 * When `linkUserId` is provided the authenticated user's ID is embedded
 * in the state so the callback can link the provider to that user even
 * when cookies are stripped during the cross-site redirect chain
 * (backend → provider → backend).
 */
export function generateOAuthState(linkUserId?: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  const parts = [nonce, timestamp];
  if (linkUserId) {
    parts.push(Buffer.from(linkUserId).toString('base64url'));
  }
  const payload = parts.join('.');
  const secret = getOAuthSecret();
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Validate an HMAC-signed OAuth state token.
 *
 * @returns validation result with optional `linkUserId` when account linking.
 */
export function validateOAuthState(state: string | undefined): OAuthStateResult {
  if (!state) {
    logger.warn('OAuth state is missing');
    return { valid: false };
  }

  const parts = state.split('.');
  // 3 parts = login flow (nonce.ts.sig), 4 parts = link flow (nonce.ts.userId.sig)
  if (parts.length !== 3 && parts.length !== 4) {
    logger.warn('OAuth state malformed', { partCount: parts.length });
    return { valid: false };
  }

  const signature = parts.at(-1) ?? '';
  const payload = parts.slice(0, -1).join('.');
  const timestamp = parts[1];

  const secret = getOAuthSecret();
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Timing-safe comparison
  const sigValid =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!sigValid) {
    logger.warn('OAuth state signature invalid');
    return { valid: false };
  }

  // Verify timestamp is within max age
  const stateTime = Number.parseInt(timestamp, 36);
  if (Number.isNaN(stateTime) || Date.now() - stateTime > STATE_MAX_AGE_MS) {
    logger.warn('OAuth state expired', { ageMs: Date.now() - stateTime });
    return { valid: false };
  }

  // Extract linkUserId if present (4 parts = link flow)
  let linkUserId: string | undefined;
  if (parts.length === 4) {
    try {
      linkUserId = Buffer.from(parts[2], 'base64url').toString('utf8');
    } catch {
      logger.warn('OAuth state linkUserId decode failed');
      return { valid: false };
    }
  }

  return { valid: true, linkUserId };
}
