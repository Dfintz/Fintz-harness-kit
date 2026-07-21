/**
 * GraphQL Context
 *
 * Provides request context for all GraphQL resolvers
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { container } from 'tsyringe';

import { logger } from '../utils/logger';
import { DataLoaderContext } from '../utils/query/DataLoaderFactory';

import { createDataLoaders, DataLoaders } from './dataloaders';

// Re-export DataLoaders type for use in resolvers
export type { DataLoaders } from './dataloaders';

export interface User {
  id: string;
  username: string;
  email?: string;
  organizationIds?: string[];
}

export interface GraphQLContext {
  /**
   * Current authenticated user (null if not authenticated)
   */
  user: User | null;

  /**
   * Express request object (for HTTP requests)
   */
  req?: Request;

  /**
   * Express response object (for HTTP requests)
   */
  res?: Response;

  /**
   * Dependency injection container
   */
  container: typeof container;

  /**
   * DataLoaders for batching queries
   *
   * These are created per-request to ensure proper batching and caching.
   * Use these loaders instead of direct database queries to prevent N+1 problems.
   *
   * @example
   * ```typescript
   * // Instead of:
   * const user = await userRepository.findOne({ where: { id } });
   *
   * // Use:
   * const user = await context.loaders.userById.load(id);
   * ```
   */
  loaders: DataLoaders;

  /**
   * Request-scoped generic loaders for resolver paths that need ad-hoc batching.
   * Tenant/org scope must be passed explicitly via additionalWhere when creating loaders.
   */
  tenantLoaders: DataLoaderContext;
}

interface CreateContextOptions {
  req?: Request;
  res?: Response;
  token?: string;
}

/**
 * Extract user from request (JWT token)
 */
function getUserFromRequest(req?: Request): User | null {
  if (!req) {
    return null;
  }

  // Check for user attached by authentication middleware
  const user = (req as Request & { user?: User }).user;
  if (user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      organizationIds: user.organizationIds,
    };
  }

  return null;
}

/**
 * Extract user from WebSocket token
 */
function getUserFromToken(token?: string): User | null {
  if (!token) {
    return null;
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.replace(/^Bearer\s+/i, '');

  try {
    // CWE-547: Require JWT_SECRET in production, use secure random fallback in development only
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('JWT_SECRET is required in production environment');
        return null;
      }
      logger.warn('JWT_SECRET not set - token verification disabled in development');
      return null;
    }

    // Verify and decode JWT token. Pin the algorithm allowlist to HS256 (SEC-05)
    // so a token presented with any other `alg` (algorithm-confusion) is rejected.
    const decoded = jwt.verify(cleanToken, jwtSecret, { algorithms: ['HS256'] }) as User;
    return {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      organizationIds: decoded.organizationIds,
    };
  } catch {
    // NOSONAR - invalid/expired JWT tokens are expected; returning null triggers unauthenticated context
    return null;
  }
}

/**
 * Create DataLoaders for the request
 *
 * Creates a fresh set of DataLoaders for each request. This ensures:
 * - Each request has its own cache (no stale data between requests)
 * - Batching is scoped to the request (optimal query batching)
 * - Memory is released after the request completes
 */
function createLoaders(): DataLoaders {
  return createDataLoaders();
}

/**
 * Create GraphQL context for a request
 */
export function createContext(options: CreateContextOptions): GraphQLContext {
  const { req, res, token } = options;

  // Get user from request or token
  const user = req ? getUserFromRequest(req) : getUserFromToken(token);

  return {
    user,
    req,
    res,
    container,
    loaders: createLoaders(),
    tenantLoaders: new DataLoaderContext(),
  };
}
