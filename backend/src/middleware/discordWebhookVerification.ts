import crypto from 'node:crypto';

import { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger';

/**
 * Maximum age (in milliseconds) for a Discord webhook event timestamp
 * to be considered valid. Prevents replay attacks.
 */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify Ed25519 signature on an incoming Discord webhook event.
 *
 * Discord sends two headers with every webhook event:
 *  - `X-Signature-Ed25519` — hex-encoded Ed25519 signature
 *  - `X-Signature-Timestamp` — UNIX-style timestamp string
 *
 * The signed message is `timestamp + body`.
 *
 * Uses Node.js native `crypto.verify('Ed25519', ...)` — no external dependencies.
 */
function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  rawBody: Buffer
): boolean {
  try {
    const message = Buffer.concat([Buffer.from(timestamp, 'utf-8'), rawBody]);
    const signatureBuffer = Buffer.from(signature, 'hex');

    // Discord provides a raw 32-byte Ed25519 public key (hex-encoded).
    // Node.js crypto.verify expects a KeyObject, so we wrap the raw key
    // in the standard Ed25519 SubjectPublicKeyInfo DER structure.
    const ed25519SpkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const rawKey = Buffer.from(publicKey, 'hex');
    const derKey = Buffer.concat([ed25519SpkiPrefix, rawKey]);

    const keyObject = crypto.createPublicKey({
      key: derKey,
      format: 'der',
      type: 'spki',
    });

    return crypto.verify(null, message, keyObject, signatureBuffer);
  } catch (error) {
    logger.warn('Discord webhook Ed25519 signature verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Express middleware factory for Discord webhook event verification.
 *
 * Handles:
 *  1. Ed25519 signature validation (returns 401 on failure)
 *  2. PING acknowledgment (returns 204 for type 0 payloads)
 *  3. Timestamp freshness check (rejects events older than 5 minutes)
 *
 * The route MUST be mounted with `express.raw({ type: 'application/json' })`
 * so `req.body` is a raw Buffer for signature verification.
 */
export function discordWebhookVerification() {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    logger.warn(
      'DISCORD_PUBLIC_KEY not set — Discord webhook event endpoint will reject all requests'
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!publicKey) {
      logger.error('DISCORD_PUBLIC_KEY not configured — rejecting webhook event');
      res.status(500).json({ error: 'Webhook verification not configured' });
      return;
    }

    const signature = req.headers['x-signature-ed25519'] as string | undefined;
    const timestamp = req.headers['x-signature-timestamp'] as string | undefined;

    if (!signature || !timestamp) {
      logger.warn('Discord webhook missing signature headers');
      res.status(401).json({ error: 'Missing signature headers' });
      return;
    }

    // req.body is a Buffer when using express.raw()
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    // Verify Ed25519 signature
    if (!verifyDiscordSignature(publicKey, signature, timestamp, rawBody)) {
      logger.warn('Discord webhook signature verification failed');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Verify timestamp freshness (replay attack prevention)
    const timestampMs = Number(timestamp) * 1000;
    const now = Date.now();
    if (Number.isNaN(timestampMs) || Math.abs(now - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
      logger.warn('Discord webhook timestamp out of range', {
        timestamp,
        ageMs: now - timestampMs,
      });
      res.status(401).json({ error: 'Timestamp out of range' });
      return;
    }

    // Parse the JSON body for downstream handlers.
    // NOSONAR: Improper Type Validation FP — rawBody has already been authenticated via Ed25519
    // signature verification above (verifyDiscordSignature), so its contents are trusted to
    // originate from Discord. Downstream handlers further validate the parsed shape.
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>; // NOSONAR
    } catch {
      logger.warn('Discord webhook body is not valid JSON');
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    // Handle PING (type 0) — Discord sends this to verify the endpoint
    if (parsedBody.type === 0) {
      logger.info('Discord webhook PING received — acknowledging');
      // Discord requires a valid Content-Type even on 204 responses
      res.setHeader('Content-Type', 'application/json');
      res.status(204).end();
      return;
    }

    // Replace raw Buffer body with parsed JSON for downstream route handlers
    req.body = parsedBody;
    next();
  };
}
