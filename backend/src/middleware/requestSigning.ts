/**
 * Request Signing Middleware
 *
 * Provides cryptographic request signing for critical API calls to ensure:
 * - Request integrity (data hasn't been tampered with)
 * - Request authenticity (request comes from authorized client)
 * - Replay protection (request can't be reused)
 *
 * Security Hardening Feature
 *
 * Usage:
 * - Client generates signature: HMAC-SHA256(timestamp + method + path + body, secret)
 * - Client sends signature in X-Request-Signature header
 * - Client sends timestamp in X-Request-Timestamp header
 * - Server validates signature and timestamp freshness
 */

import crypto from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { getNonceStorage } from '../services/security/core/NonceStorage';
import { logger } from '../utils/logger';

// Type for authenticated request with user
interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

// Configuration
const SIGNATURE_HEADER = 'x-request-signature';
const TIMESTAMP_HEADER = 'x-request-timestamp';
const NONCE_HEADER = 'x-request-nonce';
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory nonce cache for backwards compatibility and fallback
 * @deprecated Use NonceStorage for distributed deployments
 */
const usedNonces = new Map<string, number>();
const NONCE_CACHE_SIZE = 10000;

/**
 * Clean up expired nonces from in-memory cache
 * @deprecated Use NonceStorage for distributed deployments
 */
function cleanupNonces(): void {
  const now = Date.now();
  const expiredThreshold = now - MAX_TIMESTAMP_DRIFT_MS * 2;

  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (timestamp < expiredThreshold) {
      usedNonces.delete(nonce);
    }
  }
}

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(cleanupNonces, 5 * 60 * 1000).unref();

/**
 * Request signing validation result
 */
export interface SignatureValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Generate expected signature for a request
 * @param method HTTP method
 * @param path Request path
 * @param timestamp Request timestamp
 * @param body Request body (stringified)
 * @param secret Signing secret
 * @returns HMAC-SHA256 signature
 */
export function generateRequestSignature(
  method: string,
  path: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  const payload = `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Common signature validation logic (DRY helper)
 * Extracted to eliminate duplication between sync and async validators
 */
function validateSignatureHeaders(
  signature: string | undefined,
  timestamp: string | undefined
): { isValid: false; error: string } | { isValid: true; requestTime: number } {
  // Check required headers
  if (!signature) {
    return { isValid: false, error: 'Missing request signature' };
  }

  if (!timestamp) {
    return { isValid: false, error: 'Missing request timestamp' };
  }

  // Validate timestamp format and freshness
  const requestTime = Number.parseInt(timestamp, 10);
  if (Number.isNaN(requestTime)) {
    return { isValid: false, error: 'Invalid timestamp format' };
  }

  const now = Date.now();
  const drift = Math.abs(now - requestTime);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    return { isValid: false, error: 'Request timestamp expired or too far in future' };
  }

  return { isValid: true, requestTime };
}

/**
 * Common signature comparison logic (DRY helper)
 * Uses constant-time comparison to prevent timing attacks
 */
function compareSignatures(
  signature: string,
  expectedSignature: string
): { isValid: false; error: string } | { isValid: true } {
  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { isValid: false, error: 'Invalid signature' };
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { isValid: false, error: 'Invalid signature' };
  }

  return { isValid: true };
}

/**
 * Validate a request signature
 * @param req Express request
 * @param secret Signing secret
 * @returns Validation result
 */
export function validateRequestSignature(req: Request, secret: string): SignatureValidationResult {
  // Use req.get() to normalize headers (handles string arrays automatically)
  const signature = req.get(SIGNATURE_HEADER) || undefined;
  const timestamp = req.get(TIMESTAMP_HEADER) || undefined;
  const nonce = req.get(NONCE_HEADER) || undefined;

  // Validate headers using DRY helper
  const headerCheck = validateSignatureHeaders(signature, timestamp);
  if (!headerCheck.isValid) {
    return headerCheck;
  }

  // After validation, signature and timestamp are guaranteed to be strings
  // TypeScript's control flow analysis ensures this through the return path above
  const validSignature = signature as string;
  const validTimestamp = timestamp as string;

  // Check nonce for replay protection (if provided)
  if (nonce) {
    if (usedNonces.has(nonce)) {
      return { isValid: false, error: 'Request nonce already used (replay attack prevented)' };
    }
    // Store nonce with cleanup if cache is full
    if (usedNonces.size >= NONCE_CACHE_SIZE) {
      cleanupNonces();
    }
    usedNonces.set(nonce, headerCheck.requestTime);
  }

  // Generate expected signature
  const body = req.body ? JSON.stringify(req.body) : '';
  const expectedSignature = generateRequestSignature(
    req.method,
    req.path,
    validTimestamp,
    body,
    secret
  );

  // Compare signatures using DRY helper
  return compareSignatures(validSignature, expectedSignature);
}

/**
 * Middleware factory for request signature validation
 * @param options Configuration options
 * @returns Express middleware
 */
export function requireSignedRequest(options?: {
  secret?: string;
  optional?: boolean; // If true, skip validation for unsigned requests
}): (req: Request, res: Response, next: NextFunction) => void {
  const secret = options?.secret || process.env.REQUEST_SIGNING_SECRET;
  const optional = options?.optional || false;

  // In production, warn if secret is not configured when middleware is created
  // We don't throw here to avoid breaking the application during startup
  // But we will return 500 for any requests that require signing
  if (!secret && process.env.NODE_ENV === 'production') {
    logger.error(
      'REQUEST_SIGNING_SECRET not configured in production environment. ' +
        'Requests to endpoints using this middleware will fail with 500 error. ' +
        'Set REQUEST_SIGNING_SECRET environment variable to enable request signing.'
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if no secret configured (development mode)
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Request signing failed - REQUEST_SIGNING_SECRET not configured');
        res.status(500).json({ error: 'Request signing not configured' });
        return;
      }
      logger.debug('Request signing skipped - no secret configured');
      next();
      return;
    }

    // Check if request has signature header
    const hasSignature = !!req.headers[SIGNATURE_HEADER];

    // If optional and no signature provided, skip validation
    if (optional && !hasSignature) {
      next();
      return;
    }

    // Validate signature
    const result = validateRequestSignature(req, secret);

    if (!result.isValid) {
      const authReq = req as AuthenticatedRequest;
      logger.warn(`Request signature validation failed: ${result.error}`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: authReq.user?.id,
      });
      res.status(401).json({
        error: 'Request signature validation failed',
        details: result.error,
      });
      return;
    }

    logger.debug(`Request signature validated for ${req.method} ${req.path}`);
    next();
  };
}

/**
 * Middleware for critical operations that require signed requests
 * Uses combined approach: signature required only for sensitive operations
 */
export const criticalOperationSignature = requireSignedRequest({ optional: false });

/**
 * Middleware for operations where signing is optional but validated if present
 */
export const optionalSignature = requireSignedRequest({ optional: true });

/**
 * Generate a nonce for client use
 * @returns Random nonce string
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Helper function for clients to sign a request
 * @param method HTTP method
 * @param path Request path
 * @param body Request body object
 * @param secret Signing secret
 * @returns Headers to include in request
 */
export function signRequest(
  method: string,
  path: string,
  body: object | undefined,
  secret: string
): { [key: string]: string } {
  const timestamp = Date.now().toString();
  const nonce = generateNonce();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = generateRequestSignature(method, path, timestamp, bodyStr, secret);

  return {
    [SIGNATURE_HEADER]: signature,
    [TIMESTAMP_HEADER]: timestamp,
    [NONCE_HEADER]: nonce,
  };
}

/**
 * Async version of validateRequestSignature that uses Redis-backed nonce storage
 * Suitable for distributed deployments
 * @param req Express request
 * @param secret Signing secret
 * @returns Validation result
 */
export async function validateRequestSignatureAsync(
  req: Request,
  secret: string
): Promise<SignatureValidationResult> {
  // Use req.get() to normalize headers (handles string arrays automatically)
  const signature = req.get(SIGNATURE_HEADER) || undefined;
  const timestamp = req.get(TIMESTAMP_HEADER) || undefined;
  const nonce = req.get(NONCE_HEADER) || undefined;

  // Validate headers using DRY helper
  const headerCheck = validateSignatureHeaders(signature, timestamp);
  if (!headerCheck.isValid) {
    return headerCheck;
  }

  // After validation, signature and timestamp are guaranteed to be strings
  const validSignature = signature as string;
  const validTimestamp = timestamp as string;

  // Check nonce for replay protection using Redis-backed storage
  if (nonce) {
    const nonceStorage = getNonceStorage();
    const isReplay = await nonceStorage.checkAndMark(nonce, headerCheck.requestTime);
    if (isReplay) {
      return { isValid: false, error: 'Request nonce already used (replay attack prevented)' };
    }
  }

  // Generate expected signature
  const body = req.body ? JSON.stringify(req.body) : '';
  const expectedSignature = generateRequestSignature(
    req.method,
    req.path,
    validTimestamp,
    body,
    secret
  );

  // Compare signatures using DRY helper
  return compareSignatures(validSignature, expectedSignature);
}

/**
 * Middleware factory for distributed request signature validation
 * Uses Redis-backed nonce storage for replay protection across multiple instances
 * @param options Configuration options
 * @returns Express async middleware
 */
export function requireSignedRequestDistributed(options?: {
  secret?: string;
  optional?: boolean;
}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const secret = options?.secret || process.env.REQUEST_SIGNING_SECRET;
  const optional = options?.optional || false;

  if (!secret && process.env.NODE_ENV === 'production') {
    logger.error(
      'REQUEST_SIGNING_SECRET not configured in production environment. ' +
        'Requests to endpoints using this middleware will fail with 500 error.'
    );
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if no secret configured (development mode)
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Request signing failed - REQUEST_SIGNING_SECRET not configured');
        res.status(500).json({ error: 'Request signing not configured' });
        return;
      }
      logger.debug('Request signing skipped - no secret configured');
      next();
      return;
    }

    // Check if request has signature header
    const hasSignature = !!req.headers[SIGNATURE_HEADER];

    // If optional and no signature provided, skip validation
    if (optional && !hasSignature) {
      next();
      return;
    }

    // Validate signature with async nonce storage
    const result = await validateRequestSignatureAsync(req, secret);

    if (!result.isValid) {
      const authReq = req as AuthenticatedRequest;
      logger.warn(`Request signature validation failed: ${result.error}`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: authReq.user?.id,
      });
      res.status(401).json({
        error: 'Request signature validation failed',
        details: result.error,
      });
      return;
    }

    logger.debug(`Request signature validated for ${req.method} ${req.path}`);
    next();
  };
}

/**
 * Middleware for critical operations in distributed deployments
 * Uses Redis-backed nonce storage
 */
export const criticalOperationSignatureDistributed = requireSignedRequestDistributed({
  optional: false,
});

/**
 * Middleware for optional signing in distributed deployments
 */
export const optionalSignatureDistributed = requireSignedRequestDistributed({ optional: true });
