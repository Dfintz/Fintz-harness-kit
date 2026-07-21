import crypto from 'node:crypto';

import { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

/**
 * Session binding data stored in token claims
 */
export interface SessionBinding {
  /** Hash of IP address */
  ipHash: string;
  /** Hash of user agent */
  uaHash: string;
  /** Optional device fingerprint hash */
  deviceHash?: string;
}

/**
 * Generate a session binding hash from request data
 * Uses SHA-256 for consistent hashing
 */
export const generateBindingHash = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);

/**
 * Create session binding from request
 */
export const createSessionBinding = (req: Request): SessionBinding => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

  return {
    ipHash: generateBindingHash(ip),
    uaHash: generateBindingHash(userAgent),
    deviceHash: deviceFingerprint ? generateBindingHash(deviceFingerprint) : undefined,
  };
};

/**
 * Session binding configuration
 */
export interface SessionBindingConfig {
  /** Validate IP address binding (default: true in production) */
  validateIp: boolean;
  /** Validate User-Agent binding (default: true) */
  validateUserAgent: boolean;
  /** Validate device fingerprint if present (default: true) */
  validateDeviceFingerprint: boolean;
  /** Allow IP changes within same /24 network (default: false) */
  allowSubnetChange: boolean;
  /** Log binding mismatches instead of rejecting (default: false) */
  warnOnly: boolean;
}

const defaultConfig: SessionBindingConfig = {
  validateIp: process.env.NODE_ENV === 'production',
  validateUserAgent: true,
  validateDeviceFingerprint: true,
  allowSubnetChange: false,
  warnOnly:
    process.env.SESSION_BINDING_WARN_ONLY === 'true' || process.env.NODE_ENV !== 'production',
};

/**
 * Validate session binding against stored binding data
 */
export const validateSessionBinding = (
  stored: SessionBinding,
  current: SessionBinding,
  config: SessionBindingConfig = defaultConfig
): { valid: boolean; mismatches: string[] } => {
  const mismatches: string[] = [];

  // Check IP binding
  if (config.validateIp && stored.ipHash !== current.ipHash) {
    mismatches.push('IP address changed');
  }

  // Check User-Agent binding
  if (config.validateUserAgent && stored.uaHash !== current.uaHash) {
    mismatches.push('User-Agent changed');
  }

  // Check device fingerprint if both are present
  if (
    config.validateDeviceFingerprint &&
    stored.deviceHash &&
    current.deviceHash &&
    stored.deviceHash !== current.deviceHash
  ) {
    mismatches.push('Device fingerprint changed');
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
};

/**
 * Middleware to validate session binding
 *
 * This middleware prevents token theft by binding sessions to specific
 * client characteristics (IP, User-Agent, device fingerprint).
 *
 * If the session binding doesn't match, the request is rejected or
 * a warning is logged (depending on configuration).
 *
 * Usage:
 * - Add session binding data when generating tokens
 * - Validate session binding on each authenticated request
 */
export const sessionBindingMiddleware = (config: Partial<SessionBindingConfig> = {}) => {
  const finalConfig = { ...defaultConfig, ...config };

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Skip if user not authenticated
    if (!req.user) {
      return next();
    }

    // Get stored session binding from token (if present)
    const storedBinding = (req.user as { sessionBinding?: SessionBinding }).sessionBinding;

    // Skip if no session binding in token (backward compatibility)
    if (!storedBinding) {
      return next();
    }

    // Create current binding from request
    const currentBinding = createSessionBinding(req);

    // Validate binding
    const validation = validateSessionBinding(storedBinding, currentBinding, finalConfig);

    if (!validation.valid) {
      const logLevel = finalConfig.warnOnly ? 'debug' : 'warn';
      logger[logLevel]('Session binding mismatch detected', {
        userId: req.user.id,
        mismatches: validation.mismatches,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      if (finalConfig.warnOnly) {
        // Log but allow the request
        return next();
      }

      // Reject the request
      res.status(403).json({
        error: 'Session binding validation failed',
        message: 'Your session may have been compromised. Please log in again.',
        code: 'SESSION_BINDING_MISMATCH',
      });
      return;
    }

    next();
  };
};

/**
 * Helper to add session binding to JWT payload
 * Use this when generating tokens
 */
export const addSessionBindingToPayload = (
  payload: Record<string, unknown>,
  req: Request
): Record<string, unknown> => ({
  ...payload,
  sessionBinding: createSessionBinding(req),
});

/**
 * Express declaration merge to add sessionBinding to user type
 */
declare module 'express' {
  interface Request {
    sessionBinding?: SessionBinding;
  }
}
