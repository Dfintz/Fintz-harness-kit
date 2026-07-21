/**
 * Internal Service Authentication Middleware
 *
 * Zero Trust Security: Request signing for internal service-to-service communication
 *
 * Provides cryptographic authentication for internal API calls between services:
 * - Service identity verification using shared secrets
 * - Request integrity validation using HMAC-SHA256 signatures
 * - Replay attack prevention with nonces and timestamps
 * - Service-level authorization based on allowed service identities
 *
 * Usage:
 * - Each internal service has a unique service ID and shared secret
 * - Requests include signed headers for authentication
 * - Server validates signature before processing the request
 *
 * Zero Trust Principles:
 * - Never trust, always verify
 * - Assume breach - verify every request
 * - Least privilege - services only access what they need
 * - Microsegmentation - network isolation + application-level auth
 *
 * Security Note (CWE-400):
 * - RegEx patterns for endpoint matching include ReDoS protection
 * - For production systems, consider using 're2' library for guaranteed safety
 * - Admin-controlled patterns are validated for dangerous backtracking patterns
 */

import crypto from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { getNonceStorage } from '../services/security/core/NonceStorage';
import { logger } from '../utils/logger';

// Service authentication headers
const SERVICE_ID_HEADER = 'x-service-id';
const SERVICE_SIGNATURE_HEADER = 'x-service-signature';
const SERVICE_TIMESTAMP_HEADER = 'x-service-timestamp';
const SERVICE_NONCE_HEADER = 'x-service-nonce';

// Configuration
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes
const SERVICE_NONCE_PREFIX = 'svc_nonce:';

// Restrict endpoint patterns to simple glob-style matching to avoid ReDoS from complex regex
const UNSUPPORTED_PATTERN_TOKENS = /[(){}[\]|+]/;

const buildSafeEndpointRegex = (pattern: string): RegExp | null => {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === '*' || trimmed === '.*' || trimmed === '/*') {
    return /^.*$/;
  }

  if (UNSUPPORTED_PATTERN_TOKENS.test(trimmed)) {
    return null;
  }

  if (trimmed.length > 200) {
    return null;
  }

  // For patterns like /api/internal/.*, handle .* as a regex wildcard not glob
  // Escape other meta characters except . and * when they appear together
  let escaped = '';
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const next = trimmed[i + 1];

    // Special handling for .*
    if (char === '.' && next === '*') {
      escaped += '.*';
      i++; // Skip next char
    } else if (char === '*' && trimmed[i - 1] !== '.') {
      // Glob-style * (not part of .*)
      escaped += '.*';
    } else if (/[+?^${}|()[\]\\]/.test(char)) {
      // Escape special regex chars
      escaped += `\\${  char}`;
    } else {
      escaped += char;
    }
  }

  const anchored = escaped.startsWith('^') ? escaped : `^${escaped}`;
  const finalPattern = anchored.endsWith('$') ? anchored : `${anchored}$`;

  return new RegExp(finalPattern);
};

const matchesAllowedEndpoint = (path: string, allowedPatterns: string[]): boolean => allowedPatterns.some(pattern => {
    const safeRegex = buildSafeEndpointRegex(pattern);
    if (!safeRegex) {
      logger.warn('Blocked unsafe endpoint pattern for internal service', {
        pattern,
        path,
      });
      return false;
    }

    // Avoid matching extremely long paths to prevent backtracking costs
    if (path.length > 2000) {
      logger.warn('Path too long for safe matching', { pathLength: path.length });
      return false;
    }

    return safeRegex.test(path);
  });

/**
 * Service identity configuration
 */
export interface ServiceIdentity {
  serviceId: string;
  serviceName: string;
  allowedEndpoints: string[]; // Regex patterns for allowed endpoints
  secret: string;
}

/**
 * In-memory service registry (should be loaded from Key Vault in production)
 */
const serviceRegistry = new Map<string, ServiceIdentity>();

/**
 * Initialize the service registry from environment or Key Vault
 * Zero Trust: Service identities should be rotated regularly
 */
export function initializeServiceRegistry(services: ServiceIdentity[]): void {
  for (const service of services) {
    serviceRegistry.set(service.serviceId, service);
    logger.info(`Registered internal service: ${service.serviceName} (${service.serviceId})`);
  }
  logger.info(`Internal service registry initialized with ${services.length} services`);
}

/**
 * Load service registry from environment variables
 * Format: INTERNAL_SERVICES='[{"serviceId":"svc1","serviceName":"Backend","allowedEndpoints":[".*"],"secret":"..."}]'
 */
export function loadServiceRegistryFromEnv(): void {
  const servicesJson = process.env.INTERNAL_SERVICES;
  if (!servicesJson) {
    logger.debug('No internal services configured');
    return;
  }

  try {
    const services = JSON.parse(servicesJson) as ServiceIdentity[];
    initializeServiceRegistry(services);
  } catch (err: unknown) {
    logger.error('Failed to parse INTERNAL_SERVICES environment variable', { error: err });
  }
}

/**
 * Get a service from the registry
 */
export function getService(serviceId: string): ServiceIdentity | null {
  return serviceRegistry.get(serviceId) ?? null;
}

/**
 * Validation result for internal service requests
 */
export interface InternalServiceValidationResult {
  isValid: boolean;
  serviceId?: string;
  serviceName?: string;
  error?: string;
}

/**
 * Generate signature for internal service request
 * @param serviceId Service identifier
 * @param method HTTP method
 * @param path Request path
 * @param timestamp Request timestamp
 * @param body Request body (stringified)
 * @param secret Service shared secret
 * @returns HMAC-SHA256 signature
 */
export function generateInternalServiceSignature(
  serviceId: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  const payload = `${serviceId}.${timestamp}.${method.toUpperCase()}.${path}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Validate an internal service request
 * Zero Trust: Verify every request, never trust implicitly
 * @param req Express request
 * @returns Validation result with service identity
 */
export async function validateInternalServiceRequest(
  req: Request
): Promise<InternalServiceValidationResult> {
  const serviceId = req.headers[SERVICE_ID_HEADER] as string;
  const signature = req.headers[SERVICE_SIGNATURE_HEADER] as string;
  const timestamp = req.headers[SERVICE_TIMESTAMP_HEADER] as string;
  const nonce = req.headers[SERVICE_NONCE_HEADER] as string;

  // Check required headers
  if (!serviceId) {
    return { isValid: false, error: 'Missing service ID header' };
  }

  if (!signature) {
    return { isValid: false, error: 'Missing service signature header' };
  }

  if (!timestamp) {
    return { isValid: false, error: 'Missing service timestamp header' };
  }

  if (!nonce) {
    return { isValid: false, error: 'Missing service nonce header (replay protection required)' };
  }

  // Look up service in registry
  const service = serviceRegistry.get(serviceId);
  if (!service) {
    logger.warn(`Unknown service ID attempted authentication: ${serviceId}`, {
      ip: req.ip,
      path: req.path,
    });
    return { isValid: false, error: 'Unknown service ID' };
  }

  // Validate timestamp format and freshness
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return { isValid: false, error: 'Invalid timestamp format' };
  }

  const now = Date.now();
  const drift = Math.abs(now - requestTime);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    return { isValid: false, error: 'Request timestamp expired or too far in future' };
  }

  // Check nonce for replay protection using Redis-backed storage
  const nonceStorage = getNonceStorage();
  const nonceKey = `${SERVICE_NONCE_PREFIX}${nonce}`;
  const isReplay = await nonceStorage.checkAndMark(nonceKey, requestTime);
  if (isReplay) {
    logger.warn(`Service replay attack prevented for ${service.serviceName}`, {
      serviceId,
      nonce,
      ip: req.ip,
    });
    return { isValid: false, error: 'Request nonce already used (replay attack prevented)' };
  }

  // Check if service is allowed to access this endpoint using safe, bounded regex
  const isEndpointAllowed = matchesAllowedEndpoint(req.path, service.allowedEndpoints);

  if (!isEndpointAllowed) {
    logger.warn(`Service ${service.serviceName} attempted unauthorized endpoint access`, {
      serviceId,
      path: req.path,
      allowedEndpoints: service.allowedEndpoints,
    });
    return {
      isValid: false,
      serviceId,
      serviceName: service.serviceName,
      error: 'Service not authorized for this endpoint',
    };
  }

  // Generate expected signature
  const body = req.body ? JSON.stringify(req.body) : '';
  const expectedSignature = generateInternalServiceSignature(
    serviceId,
    req.method,
    req.path,
    timestamp,
    body,
    service.secret
  );

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return {
      isValid: false,
      serviceId,
      serviceName: service.serviceName,
      error: 'Invalid signature',
    };
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    logger.warn(`Invalid signature from service ${service.serviceName}`, {
      serviceId,
      path: req.path,
      ip: req.ip,
    });
    return {
      isValid: false,
      serviceId,
      serviceName: service.serviceName,
      error: 'Invalid signature',
    };
  }

  return {
    isValid: true,
    serviceId: service.serviceId,
    serviceName: service.serviceName,
  };
}

/**
 * Express request with internal service identity
 */
export interface InternalServiceRequest extends Request {
  internalService?: {
    serviceId: string;
    serviceName: string;
  };
}

/**
 * Middleware for requiring internal service authentication
 * Zero Trust: All internal service calls must be authenticated
 */
export function requireInternalServiceAuth(): (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip in development if no services configured
    if (serviceRegistry.size === 0) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Internal service authentication required but no services configured');
        res.status(500).json({ error: 'Internal service authentication not configured' });
        return;
      }
      logger.debug('Internal service auth skipped - no services configured');
      next();
      return;
    }

    // Validate the request
    const result = await validateInternalServiceRequest(req);

    if (!result.isValid) {
      logger.warn(`Internal service authentication failed: ${result.error}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        serviceId: result.serviceId,
      });
      res.status(401).json({
        error: 'Internal service authentication failed',
        details: result.error,
      });
      return;
    }

    // Add service identity to request
    const serviceReq = req as InternalServiceRequest;
    if (result.serviceId && result.serviceName) {
      serviceReq.internalService = {
        serviceId: result.serviceId,
        serviceName: result.serviceName,
      };
    }

    logger.debug(`Internal service authenticated: ${result.serviceName}`, {
      serviceId: result.serviceId,
      path: req.path,
      method: req.method,
    });

    next();
  };
}

/**
 * Middleware for optional internal service authentication
 * Authenticates if headers present, continues otherwise
 */
export function optionalInternalServiceAuth(): (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if service authentication headers are present
    const hasServiceId = !!req.headers[SERVICE_ID_HEADER];

    if (!hasServiceId) {
      next();
      return;
    }

    // Validate if headers present
    const result = await validateInternalServiceRequest(req);

    if (!result.isValid) {
      logger.warn(`Optional internal service authentication failed: ${result.error}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        serviceId: result.serviceId,
      });
      res.status(401).json({
        error: 'Internal service authentication failed',
        details: result.error,
      });
      return;
    }

    // Add service identity to request
    const serviceReq = req as InternalServiceRequest;
    if (result.serviceId && result.serviceName) {
      serviceReq.internalService = {
        serviceId: result.serviceId,
        serviceName: result.serviceName,
      };
    }

    next();
  };
}

/**
 * Generate a unique nonce for internal service requests
 */
export function generateServiceNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Helper to sign an internal service request
 * Use this in service clients to create signed requests
 * @param serviceId Service identifier
 * @param method HTTP method
 * @param path Request path
 * @param body Request body object
 * @param secret Service shared secret
 * @returns Headers to include in request
 */
export function signInternalServiceRequest(
  serviceId: string,
  method: string,
  path: string,
  body: object | null | undefined,
  secret: string
): Record<string, string> {
  const timestamp = Date.now().toString();
  const nonce = generateServiceNonce();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = generateInternalServiceSignature(
    serviceId,
    method,
    path,
    timestamp,
    bodyStr,
    secret
  );

  return {
    [SERVICE_ID_HEADER]: serviceId,
    [SERVICE_SIGNATURE_HEADER]: signature,
    [SERVICE_TIMESTAMP_HEADER]: timestamp,
    [SERVICE_NONCE_HEADER]: nonce,
  };
}

/**
 * Check if a request is from an internal service
 */
export function isInternalServiceRequest(req: Request): boolean {
  return !!(req as InternalServiceRequest).internalService;
}

/**
 * Get internal service identity from request
 */
export function getInternalServiceIdentity(
  req: Request
): { serviceId: string; serviceName: string } | null {
  return (req as InternalServiceRequest).internalService ?? null;
}

// Export middleware instances for convenience
export const internalServiceAuthRequired = requireInternalServiceAuth();
export const internalServiceAuthOptional = optionalInternalServiceAuth();
