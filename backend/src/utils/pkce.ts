import crypto from 'node:crypto';

/**
 * PKCE (Proof Key for Code Exchange — RFC 7636) helpers for OAuth 2.0 flows.
 *
 * Although our OAuth integrations are confidential clients (they hold a
 * `client_secret`), PKCE provides defense-in-depth against authorization-code
 * interception and is required by OAuth 2.1 for all clients.
 */

/** PKCE pair returned by {@link generatePkcePair}. */
export interface PkcePair {
  /** High-entropy random string sent in the token-exchange request. */
  readonly verifier: string;
  /** SHA-256 hash of the verifier (base64url, unpadded) sent in the auth URL. */
  readonly challenge: string;
  /** Always `'S256'` — the only method we support. */
  readonly method: 'S256';
}

/**
 * Generate a cryptographically random PKCE verifier/challenge pair.
 *
 * The verifier is 64 hex characters (256 bits of entropy), well within the
 * RFC 7636 allowed length range of 43–128 characters.
 */
export function generatePkcePair(): PkcePair {
  const verifier = crypto.randomBytes(32).toString('hex');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}
