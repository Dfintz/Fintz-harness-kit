import crypto from 'node:crypto';

import { NextFunction, Request, Response } from 'express';

import { COOKIE_NAMES, csrfTokenCookieOptions } from '../config/cookies';
import { logger } from '../utils/logger';

/**
 * CSRF Protection using Double-Submit Cookie Pattern
 *
 * This implementation uses the double-submit cookie pattern which doesn't require
 * server-side storage, making it suitable for distributed environments.
 *
 * How it works:
 * 1. A random token is generated and set in a non-httpOnly cookie
 * 2. The frontend reads this cookie and includes it in request headers
 * 3. The server validates that the header matches the cookie
 *
 * Security: Due to same-origin policy, only code running on our domain can
 * read the cookie and set the header. Attackers cannot read the cookie from
 * a different domain.
 */

/**
 * Generate a CSRF token
 * @returns Generated CSRF token
 */
export const generateCsrfToken = (): string => crypto.randomBytes(32).toString('hex');

/**
 * Validate a CSRF token using double-submit cookie pattern
 * @param cookieToken Token from cookie
 * @param headerToken Token from header
 * @returns True if valid
 */
export const validateCsrfToken = (cookieToken: string, headerToken: string): boolean => {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const cookieBuffer = Buffer.from(cookieToken, 'hex');
    const headerBuffer = Buffer.from(headerToken, 'hex');

    if (cookieBuffer.length !== headerBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
  } catch {
    return false;
  }
};

/**
 * Middleware to generate and set CSRF token
 * CWE-1004: Sets the token in a non-httpOnly cookie so JavaScript can read it
 * and include it in requests (double-submit cookie pattern)
 * Note: This is intentionally NOT httpOnly as the frontend needs to read it
 */
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check if token already exists in cookie
  const existingToken = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAMES.CSRF_TOKEN
  ];

  // Always refresh the cookie to ensure the correct domain is set.
  // When cookie domain config changes (e.g. adding cross-subdomain support),
  // the old cookie may still be sent by the browser but scoped to the wrong
  // domain. Re-setting it ensures the browser stores it with the new domain.
  const token: string = existingToken ?? generateCsrfToken();
  // NOSONAR: CWE-1004/CWE-614 false positive — csrfTokenCookieOptions (config/cookies.ts)
  // sets secure: true. httpOnly: false is intentional: the double-submit cookie pattern
  // requires JavaScript to read the token and send it in a request header.
  res.cookie(COOKIE_NAMES.CSRF_TOKEN, token, csrfTokenCookieOptions); // NOSONAR

  next();
};

/**
 * Middleware to validate CSRF token on state-changing requests
 *
 * Validates CSRF token for POST, PUT, PATCH, DELETE methods.
 * Token should be sent in X-CSRF-Token header or _csrf body field only.
 * Query parameter _csrf is NOT accepted to prevent token leakage via logs and referrer headers.
 * Uses double-submit cookie pattern: validates header token matches cookie token.
 */
export const validateCsrfMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get CSRF token from cookie (set by csrfTokenMiddleware)
  const cookieToken: string | undefined = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAMES.CSRF_TOKEN
  ];

  if (!cookieToken) {
    logger.warn('CSRF validation failed: No cookie token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF cookie not found',
      },
    });
    return;
  }

  // Get CSRF token from header or body only (query params excluded to prevent token leakage via logs/referrer)
  const csrfHeader = req.headers['x-csrf-token'];
  const csrfBody = (req.body as Record<string, unknown> | undefined)?._csrf;
  const headerToken: string | undefined =
    (typeof csrfHeader === 'string' ? csrfHeader : undefined) ??
    (typeof csrfBody === 'string' ? csrfBody : undefined);

  if (!headerToken) {
    logger.warn('CSRF validation failed: No header token provided', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF token required for this request. Include X-CSRF-Token header.',
      },
    });
    return;
  }

  // Validate that header token matches cookie token
  if (!validateCsrfToken(cookieToken, headerToken)) {
    logger.warn('CSRF validation failed: Token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Invalid CSRF token',
      },
    });
    return;
  }

  next();
};

/**
 * Middleware to apply CSRF protection to specific routes
 * This is a selective CSRF middleware that only validates on configured routes
 */
export const csrfProtection = {
  /**
   * Generate token middleware - use on pages that need CSRF protection
   */
  generate: csrfTokenMiddleware,

  /**
   * Validate token middleware - use on state-changing endpoints
   */
  validate: validateCsrfMiddleware,

  /**
   * Combined middleware - generates token and validates on state-changing requests
   */
  protect: (req: Request, res: Response, next: NextFunction): void => {
    csrfTokenMiddleware(req, res, () => {
      validateCsrfMiddleware(req, res, next);
    });
  },
};

/**
 * Route-level CSRF protection factory
 * Creates middleware that only validates CSRF for specified methods
 */
export const csrfProtectionFor =
  (methods: string[] = ['POST', 'PUT', 'PATCH', 'DELETE']) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // Always generate/refresh token
    csrfTokenMiddleware(req, res, () => {
      // Only validate for specified methods
      if (methods.includes(req.method.toUpperCase())) {
        validateCsrfMiddleware(req, res, next);
      } else {
        next();
      }
    });
  };
