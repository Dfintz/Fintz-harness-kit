import cors from 'cors';
import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ParamsDictionary } from 'express-serve-static-core';
import helmet from 'helmet';
import { ParsedQs } from 'qs';

import { normalizeIP } from '../utils/ipWhitelist';
import { removeSQLPatterns, sanitizeString } from '../utils/joiValidators';
import { logger } from '../utils/logger';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { AppError } from './errorHandler';

/**
 * Rate limiting key generator that handles IPv6-mapped IPv4 addresses
 * Uses the shared normalizeIP utility for consistency across the codebase
 * @param req - Express request object
 * @returns Normalized IP address string for rate limiting
 *
 * Note: express-rate-limit v8+ requires using ipKeyGenerator helper for IPv6 support
 */
const getRateLimitKey = (req: Request): string => {
  // Get IP from request - express-rate-limit provides this
  const ip = req.ip || 'unknown';

  // Use the built-in ipKeyGenerator which properly handles IPv6
  // This satisfies express-rate-limit's IPv6 validation requirements
  const baseIp = ipKeyGenerator(ip);

  // Apply our custom normalization on top of the base IP
  const normalizedIp = normalizeIP(baseIp);

  // Return normalized IP or 'unknown' if no valid IP could be determined
  return normalizedIp || 'unknown';
};

/**
 * Check if we're running in development mode
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Configure helmet for security headers
 * CWE-200: Explicitly disable X-Powered-By header to prevent information exposure
 *
 * Security: In production, use strict CSP without 'unsafe-inline'.
 * Swagger UI routes (/api-docs) are exempted from helmet's CSP and handled by swaggerCspMiddleware.
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      frameSrc: [
        "'self'",
        'https://verseguide.com',
        'https://snareplan.dolus.eu',
        'https://maps.adi.sc',
      ],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
    // Custom function to skip CSP for swagger-ui routes
    // This allows swaggerCspMiddleware to set proper CSP for those routes
    useDefaults: false,
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // CWE-200: Explicitly hide X-Powered-By header
  hidePoweredBy: true,
  // Security hardening: Add Referrer-Policy header
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

/**
 * Middleware to provide relaxed CSP specifically for Swagger UI routes.
 * This allows 'unsafe-inline' only for /api-docs paths in production.
 * Use this middleware only on routes that serve Swagger UI.
 *
 * Security consideration: This is a trade-off between functionality (Swagger UI)
 * and security (strict CSP). For maximum security, disable Swagger UI in production
 * or serve it from a separate domain.
 */
export const swaggerCspMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Always apply relaxed CSP for Swagger UI routes (this middleware is mounted on /api-docs)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self' data:;"
  );
  next();
};

/**
 * Additional middleware to ensure X-Powered-By is removed
 * This is a defense-in-depth measure
 */
export const removePoweredBy = (req: Request, res: Response, next: NextFunction): void => {
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Resolve whether Swagger UI / OpenAPI docs should be mounted.
 *
 * Fail-secure behavior:
 * - In production, Swagger is forced OFF regardless of SWAGGER_ENABLED.
 * - The only way to expose docs in production is to explicitly set
 *   SWAGGER_FORCE_PROD=true (an audited, opt-in escape hatch).
 * - If both NODE_ENV=production and SWAGGER_ENABLED!=='false' are set without
 *   the override, this throws at startup so the misconfiguration is loud
 *   rather than silently exposing the surface.
 *
 * Outside production, SWAGGER_ENABLED follows its existing semantics
 * (default-on; set to 'false' to disable).
 */
export function resolveSwaggerEnabled(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const requested = process.env.SWAGGER_ENABLED !== 'false';
  const forceProd = process.env.SWAGGER_FORCE_PROD === 'true';

  if (isProduction) {
    if (requested && !forceProd) {
      const msg =
        'FATAL: SWAGGER_ENABLED is not "false" in production. Swagger UI is disabled by default ' +
        'in production. To intentionally expose docs, set SWAGGER_FORCE_PROD=true; otherwise set ' +
        'SWAGGER_ENABLED=false to acknowledge the production posture.';
      logger.error(msg);
      throw new Error(msg);
    }
    return forceProd && requested;
  }

  return requested;
}

/**
 * Configure CORS
 *
 * Security: When credentials mode is enabled (for cookies/auth headers),
 * CORS origin cannot be wildcard '*'. This configuration:
 * - Uses specific origin(s) when CORS_ORIGIN is set (enables credentials)
 * - Supports comma-separated list for multiple origins
 * - Disables credentials when using wildcard (development/permissive mode)
 *
 * For production, ALWAYS set CORS_ORIGIN to your frontend domain(s).
 * Examples:
 *   CORS_ORIGIN=https://fringecore.space
 *   CORS_ORIGIN=https://fringecore.space,https://www.fringecore.space
 */
const rawCorsOrigin = process.env.CORS_ORIGIN?.trim() || '';
const corsOrigin = rawCorsOrigin || '*';
let isWildcardOrigin = corsOrigin === '*';

// Log CORS configuration for debugging
if (isWildcardOrigin) {
  logger.warn('⚠️  CORS_ORIGIN not configured - using wildcard (*). Credentials mode DISABLED.');
  logger.warn('⚠️  Authentication cookies will NOT work. Set CORS_ORIGIN to your frontend domain.');
} else {
  logger.info(`✓ CORS configured for origin(s): ${corsOrigin}`);
  logger.info('✓ Credentials mode ENABLED for cookie-based authentication');
}

/**
 * Parse CORS origin configuration
 * Handles single origin, multiple origins (comma-separated), or wildcard
 * Returns a list of allowed origins or a wildcard string
 * Filters out empty strings from comma-separated lists
 */
function parseCorsOrigin(origin: string, isWildcard: boolean): string[] | string {
  if (isWildcard) {
    return '*';
  }

  // Strip leading/trailing quote characters (non-regex, avoids ReDoS)
  const stripQuotes = (s: string) => {
    let start = 0;
    let end = s.length;
    while (start < end && (s[start] === '"' || s[start] === "'")) {
      start++;
    }
    while (end > start && (s[end - 1] === '"' || s[end - 1] === "'")) {
      end--;
    }
    return s.slice(start, end);
  };

  if (origin.includes(',')) {
    // Split, trim, strip quotes, and filter out empty strings
    return origin
      .split(',')
      .map(o => stripQuotes(o.trim()))
      .filter(o => o.length > 0);
  }

  // Return as array for consistent handling
  return [stripQuotes(origin)];
}

let allowedOrigins = parseCorsOrigin(corsOrigin, isWildcardOrigin);

// Safety check: if parsing resulted in an empty array, fall back to wildcard
if (Array.isArray(allowedOrigins) && allowedOrigins.length === 0) {
  logger.error('\u274c CORS_ORIGIN configured but resulted in empty origin list.');
  logger.error('\u274c Check your CORS_ORIGIN environment variable for invalid values.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: CORS_ORIGIN configured but resulted in empty origin list. ' +
        'This is a security misconfiguration. Set CORS_ORIGIN to valid origin(s).'
    );
  }
  // In non-production, fall back to wildcard with warning
  allowedOrigins = '*';
  isWildcardOrigin = true; // Update to reflect we're now in wildcard mode
}

/**
 * CORS origin callback function for dynamic origin validation
 * This ensures proper origin matching and prevents wildcard issues with credentials
 */
const corsOriginCallback = (
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  // If wildcard is configured, allow all origins (but credentials will be disabled)
  if (allowedOrigins === '*') {
    callback(null, true);
    return;
  }

  // If no origin header (like from Postman or same-origin requests), allow it
  if (!requestOrigin) {
    callback(null, true);
    return;
  }

  // Check if the request origin is in the allowed list
  if (Array.isArray(allowedOrigins) && allowedOrigins.includes(requestOrigin)) {
    callback(null, true);
    return;
  }

  // Origin not allowed – log and return 403 instead of bubbling as 500
  logger.warn('CORS rejection', {
    requestOrigin,
    allowedOrigins,
  });
  callback(new AppError('Not allowed by CORS', 403));
};

export const corsConfig = cors({
  origin: isWildcardOrigin ? '*' : corsOriginCallback,
  // SECURITY: Access-Control-Allow-Credentials
  // Only enable credentials when a specific origin is configured
  // Browsers reject credentials:true with origin:'*'
  // When enabled, allows frontend to send cookies and authentication headers
  credentials: !isWildcardOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Device-Fingerprint'],
  // Expose headers that the client may need to read
  // This allows JavaScript to access these headers from the response
  exposedHeaders: [
    'Content-Length',
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  // Access-Control-Max-Age: Cache preflight requests for 24 hours (86400 seconds)
  // This prevents the browser from sending OPTIONS requests for every request
  // Setting to 0 (the implicit default) forces preflight for every request which is inefficient
  // 24 hours is a good balance between security (can't be too long) and performance
  maxAge: 86400,
  // Don't pass the CORS preflight response to the next handler
  // Let the CORS middleware handle it completely
  preflightContinue: false,
  // Provide a successful OPTIONS response status
  // 204 is more appropriate than 200 for OPTIONS with no content
  optionsSuccessStatus: 204,
});

/**
 * General rate limiting configuration
 * Uses normalized IP addresses to handle IPv6-mapped IPv4 addresses correctly
 *
 * Disabled in development mode to prevent blocking legitimate requests during testing
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // Global limit per IP — SPAs with many parallel queries need headroom
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  skip: (req: Request) => {
    // Skip rate limiting in development
    if (isDevelopment) {
      return true;
    }
    // Never rate-limit health checks (Azure probes, monitoring)
    if (req.path.startsWith('/health')) {
      return true;
    }
    return false;
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * More restrictive to prevent brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
});

/**
 * Rate limiter for image uploads (resource intensive)
 * Prevents abuse of server resources
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 uploads per minute
  message: 'Too many uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
});

/**
 * Rate limiter for webhook creation (prevent abuse)
 * Restricts the number of webhooks that can be created
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 webhook creations per hour
  message: 'Too many webhook creation attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
});

/**
 * Rate limiter for RSI API calls (external API protection)
 * Protects against excessive external API requests
 */
export const rsiApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 RSI API calls per minute
  message: 'Too many RSI API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
});

/**
 * Input sanitization middleware
 * Uses Joi-based validators for comprehensive XSS, SQL, and NoSQL injection prevention
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitize = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      // Strip dangerous keys like __proto__/constructor/prototype
      const cleaned = sanitizeObject(obj as Record<string, unknown>);
      const sanitized: Record<string, unknown> = {};
      for (const key in cleaned) {
        const sanitizedKey = typeof key === 'string' ? sanitizeString(key) : key;
        sanitized[sanitizedKey] = sanitize(cleaned[key]);
      }
      return sanitized;
    }
    if (typeof obj === 'string') {
      // Use Joi-based sanitization to prevent XSS attacks
      // This escapes <, >, &, ', ", and / characters
      let sanitized = sanitizeString(obj);

      // Additional protection against SQL/NoSQL injection patterns
      sanitized = removeSQLPatterns(sanitized);

      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query) as ParsedQs;
  }
  if (req.params) {
    req.params = sanitize(req.params) as ParamsDictionary;
  }

  next();
};

/**
 * Validate JWT secret is secure in production
 */
function validateJwtSecret(isProduction: boolean, errors: string[]): void {
  const requiredEnvVars = ['JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
    logger.warn(`⚠️  Warning: ${errorMsg}`);
    if (isProduction) {
      errors.push(errorMsg);
    } else {
      logger.warn('Using default values - this is NOT secure for production!');
    }
  }

  if (
    isProduction &&
    (!process.env.JWT_SECRET ||
      process.env.JWT_SECRET.includes('change-in-production') ||
      process.env.JWT_SECRET.includes('change-this') ||
      process.env.JWT_SECRET.includes('dev-secret') ||
      process.env.JWT_SECRET.length < 32)
  ) {
    const errorMsg =
      'JWT_SECRET must be set to a secure value (minimum 32 characters) in production!';
    logger.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }
}

/**
 * Validate security-critical settings in production
 */
function validateSecuritySettings(isProduction: boolean, errors: string[]): void {
  if (isProduction && process.env.ALLOW_DEV_LOGIN === 'true') {
    const errorMsg =
      'ALLOW_DEV_LOGIN must not be enabled in production! This creates a critical security vulnerability.';
    logger.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }

  if (isProduction) {
    if (
      process.env.TOKEN_ENCRYPTION_KEY &&
      (process.env.TOKEN_ENCRYPTION_KEY.length < 32 ||
        process.env.TOKEN_ENCRYPTION_KEY.includes('dev-') ||
        process.env.TOKEN_ENCRYPTION_KEY.includes('not-for-prod'))
    ) {
      logger.warn(
        '⚠️  TOKEN_ENCRYPTION_KEY should be a secure value (minimum 32 characters) in production!'
      );
    } else if (!process.env.TOKEN_ENCRYPTION_KEY) {
      logger.warn('⚠️  TOKEN_ENCRYPTION_KEY should be set in production for secure token storage!');
    }
  }

  if (isProduction && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*')) {
    const errorMsg =
      'CORS_ORIGIN must be set to a specific origin in production! Wildcard (*) disables cookie-based authentication.';
    logger.error(`❌ ${errorMsg}`);
    logger.error(
      `❌ With wildcard CORS, credentials mode is disabled. Authentication cookies will not work!`
    );
    logger.error(`💡 Set CORS_ORIGIN to your frontend domain (e.g., https://fringecore.space)`);
    errors.push(errorMsg);
  }

  if (isProduction && process.env.DB_SYNCHRONIZE === 'true') {
    const errorMsg =
      'DB_SYNCHRONIZE must be false in production! Enabling this can cause data loss through automatic schema synchronization.';
    logger.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }
}

/**
 * Validate database credentials in production
 */
function validateDatabaseConfig(errors: string[]): void {
  const dbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingDbVars = dbVars.filter(varName => !process.env[varName]);

  if (missingDbVars.length > 0) {
    logger.warn(`⚠️  Database environment variables missing: ${missingDbVars.join(', ')}`);
    return;
  }

  const insecurePasswords = [
    'password',
    'postgres',
    'admin',
    '123456',
    'dev_password',
    'test',
    'password123',
    'secret',
    'changeme',
    'pass',
    'root',
    'dev_password_not_for_production',
    '',
  ];
  const dbPassword = process.env.DB_PASSWORD?.toLowerCase() || '';
  if (insecurePasswords.includes(dbPassword)) {
    const errorMsg =
      'DB_PASSWORD is set to an insecure default value! Use a strong, unique password in production.';
    logger.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  } else if (dbPassword.length < 12) {
    logger.warn(
      '⚠️  DB_PASSWORD must be at least 12 characters in production for adequate security!'
    );
  }

  const insecureUsers = ['user', 'admin', 'root', 'dev_user', 'test', 'postgres'];
  if (insecureUsers.includes(process.env.DB_USER?.toLowerCase() || '')) {
    logger.warn(
      '⚠️  DB_USER is set to an insecure default value. Use a unique database user in production!'
    );
  }

  if (process.env.DB_SSL === 'false') {
    logger.warn('⚠️  WARNING: Database SSL/TLS is disabled in production!');
    logger.warn('⚠️  This is a security risk. Enable SSL/TLS for database connections.');
  }
}

/**
 * Validate environment variables
 * Enhanced with Zero Trust security principles - validates all production secrets
 * Returns validation errors instead of throwing to allow server to start and report issues via health endpoint
 */
export const validateEnvironment = (): string[] => {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];

  validateJwtSecret(isProduction, errors);
  validateSecuritySettings(isProduction, errors);

  if (isProduction) {
    validateDatabaseConfig(errors);
  }

  // Log validation result
  if (errors.length > 0) {
    logger.error(`❌ Environment validation found ${errors.length} critical error(s)`);
    errors.forEach(err => logger.error(`   - ${err}`));
    logger.warn('⚠️  Server will start but may be unstable. Fix these issues immediately!');
  } else if (isProduction) {
    logger.info('✓ Environment variables validated successfully for production');
    logger.info('✓ Zero Trust security checks passed');
  } else {
    logger.info('✓ Environment variables validated for development');
  }

  return errors;
};
