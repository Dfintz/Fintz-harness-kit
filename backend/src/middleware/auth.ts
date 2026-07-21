import { NextFunction, Request, Response } from 'express';

import { COOKIE_NAMES } from '../config/cookies';
import { AppDataSource } from '../data-source';
import { User } from '../models/User';
import { AuthenticationService } from '../services/authentication';
import { UserApiKeyService } from '../services/security/UserApiKeyService';
import { AuditEventType, logAuditEvent, logAuthenticationAttempt } from '../utils/auditLogger';
import { logger } from '../utils/logger';

import {
  createSessionBinding,
  validateSessionBinding,
  type SessionBinding,
} from './sessionBinding';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    discordId?: string;
    jti?: string; // JWT ID for revocation
    currentOrganizationId?: string;
    currentOrganizationName?: string;
    organizationIds?: string[]; // Array of organization IDs user belongs to
    /** Set when authenticated via API key instead of JWT */
    apiKeyId?: string;
    apiKeyScopes?: string[];
  };
  startTime?: number; // For request timing
}

const authService = new AuthenticationService();
const apiKeyService = new UserApiKeyService();

const SESSION_BINDING_WARN_COOLDOWN_MS = Number.parseInt(
  process.env.SESSION_BINDING_WARN_COOLDOWN_MS ?? '300000',
  10
);
const SESSION_BINDING_WARN_STATE_MAX = 5000;

type SessionBindingWarnState = {
  lastWarnAt: number;
  suppressedCount: number;
};

const sessionBindingWarnState = new Map<string, SessionBindingWarnState>();

const getSessionBindingWarnKey = (
  decodedId: string,
  path: string,
  mismatches: string[]
): string => {
  const normalizedMismatches = [...mismatches]
    .sort((left, right) => left.localeCompare(right))
    .join('|');
  return `${decodedId}:${path}:${normalizedMismatches}`;
};

const pruneSessionBindingWarnState = (): void => {
  if (sessionBindingWarnState.size < SESSION_BINDING_WARN_STATE_MAX) {
    return;
  }

  const oldestKey = sessionBindingWarnState.keys().next().value;
  if (oldestKey) {
    sessionBindingWarnState.delete(oldestKey);
  }
};

const getSessionBindingWarnMetadata = (
  key: string,
  now: number,
  cooldownMs: number
): { shouldWarn: boolean; suppressedSinceLastWarn: number } => {
  const current = sessionBindingWarnState.get(key);

  if (!current) {
    pruneSessionBindingWarnState();
    sessionBindingWarnState.set(key, { lastWarnAt: now, suppressedCount: 0 });
    return { shouldWarn: true, suppressedSinceLastWarn: 0 };
  }

  if (now - current.lastWarnAt >= cooldownMs) {
    const suppressedSinceLastWarn = current.suppressedCount;
    sessionBindingWarnState.set(key, { lastWarnAt: now, suppressedCount: 0 });
    return { shouldWarn: true, suppressedSinceLastWarn };
  }

  current.suppressedCount += 1;
  sessionBindingWarnState.set(key, current);
  return { shouldWarn: false, suppressedSinceLastWarn: current.suppressedCount };
};

export const __resetSessionBindingWarnStateForTests = (): void => {
  sessionBindingWarnState.clear();
};

/**
 * Authenticate via X-API-Key header.
 * Returns true if handled (success or error), false if no API key was provided.
 */
async function tryApiKeyAuth(
  req: AuthRequest,
  res: Response,
  ipAddress: string | undefined
): Promise<boolean> {
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  if (!apiKeyHeader) {
    return false;
  }

  try {
    const keyData = await apiKeyService.validateKey(apiKeyHeader, undefined, ipAddress);
    if (!keyData) {
      res.status(401).json({ message: 'Invalid or expired API key' });
      return true;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.role'])
      .where('user.id = :userId', { userId: keyData.userId })
      .getOne();
    if (!user) {
      res.status(401).json({ message: 'API key owner not found' });
      return true;
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role ?? 'member',
      apiKeyId: keyData.keyId,
      apiKeyScopes: keyData.scopes,
    };
    return true;
  } catch (error) {
    logger.error('API key authentication failed:', error);
    res.status(500).json({ message: 'API key authentication error' });
    return true;
  }
}

function handleSessionBindingValidation(
  req: AuthRequest,
  res: Response,
  decoded: { id: string; sessionBinding?: SessionBinding },
  ipAddress: string | undefined
): boolean {
  if (!decoded.sessionBinding) {
    return true;
  }

  const currentBinding = createSessionBinding(req);
  const validation = validateSessionBinding(decoded.sessionBinding, currentBinding);

  if (validation.valid) {
    return true;
  }

  // Default to warn-only — enforcement causes issues with browser UA changes
  const warnOnly = process.env.SESSION_BINDING_ENFORCE !== 'true';

  if (!warnOnly) {
    logger.warn('Session binding mismatch', {
      userId: decoded.id,
      mismatches: validation.mismatches,
      path: req.path,
      ip: ipAddress,
      enforced: true,
    });
  } else {
    const warnKey = getSessionBindingWarnKey(decoded.id, req.path, validation.mismatches);
    const warnMetadata = getSessionBindingWarnMetadata(
      warnKey,
      Date.now(),
      SESSION_BINDING_WARN_COOLDOWN_MS
    );

    if (warnMetadata.shouldWarn) {
      logger.warn('Session binding mismatch', {
        userId: decoded.id,
        mismatches: validation.mismatches,
        path: req.path,
        ip: ipAddress,
        enforced: false,
        warnCooldownMs: SESSION_BINDING_WARN_COOLDOWN_MS,
        suppressedSinceLastWarn: warnMetadata.suppressedSinceLastWarn,
      });
    }
  }

  if (!warnOnly) {
    res.status(403).json({
      message: 'Session binding validation failed. Please log in again.',
      code: 'SESSION_BINDING_MISMATCH',
    });
    return false;
  }

  return true;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  // Support both Authorization header and httpOnly cookie for access token
  const headerToken = authHeader?.split(' ')[1]; // Bearer TOKEN
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  const token = headerToken || cookieToken;

  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // ---- API Key authentication (X-API-Key header) ----
  const apiKeyHandled = await tryApiKeyAuth(req, res, ipAddress);
  if (apiKeyHandled) {
    if (req.user) {
      next();
    }
    return;
  }

  if (!token) {
    // Log missing token attempt
    logAuditEvent({
      eventType: AuditEventType.AUTH_MISSING_TOKEN,
      ipAddress,
      userAgent,
      message: 'Authentication attempt without token',
      metadata: {
        path: req.path,
        method: req.method,
        hasBotToken: !!req.headers['x-bot-internal-token'],
      },
    });
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  try {
    // Use unified AuthenticationService for verification to ensure consistent secret handling
    const decoded = await authService.validateAccessToken(token);

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      jti: decoded.jti,
    };

    // Validate session binding if present in token (ZT-03: token-to-device binding)
    if (!handleSessionBindingValidation(req, res, decoded, ipAddress)) {
      return;
    }

    // Log successful authentication
    logAuthenticationAttempt(true, decoded.id, decoded.username, ipAddress, userAgent);

    next();
  } catch (error) {
    // Log failed authentication
    logAuthenticationAttempt(
      false,
      undefined,
      undefined,
      ipAddress,
      userAgent,
      error instanceof Error ? error.message : 'Invalid or expired token'
    );
    const message = error instanceof Error ? error.message : 'Invalid or expired token';
    res.status(401).json({ message });
  }
};

export const generateToken = (payload: { id: string; username: string; role: string }): string =>
  // Delegate to AuthenticationService to ensure a single JWT secret source
  authService.generateAccessToken(payload);

// Export alias for backward compatibility
export const authenticate = authenticateToken;

/**
 * Combined authenticate + tenantContext middleware.
 * Authenticates the user first, then populates req.user.currentOrganizationId
 * via the tenantContext middleware. Use this on routes that access resources by ID
 * without :orgId in the URL path (e.g., GET /fleets/:id).
 */
export const authenticateWithTenant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // First authenticate
  await authenticateToken(req, res, (authErr?: unknown) => {
    if (authErr) {
      return next(authErr);
    }
    // Then set tenant context (lazy-import to avoid circular dependency)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tenantContext: setTenantContext } = require('./tenantContext');
    return setTenantContext(req, res, next);
  });
};
