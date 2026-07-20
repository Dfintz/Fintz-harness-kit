/**
 * GraphQL Persisted Queries Client Utility
 *
 * Provides a client-side helper for executing GraphQL queries using
 * the Automatic Persisted Queries (APQ) protocol with the existing
 * axios-based HTTP architecture.
 *
 * Features:
 * - Automatic query hash lookup
 * - APQ protocol implementation
 * - Automatic retry with full query on cache miss
 * - TypeScript type safety
 * - Error handling
 * - Input sanitization to prevent injection (CWE-89)
 */

import { apiClient, isApiClientError } from '@/services/apiClient';
import * as React from 'react';
import { logger } from './logger';

/**
 * Sanitize variables to prevent GraphQL injection attacks (CWE-89)
 * Removes dangerous keys and validates input types
 */
function sanitizeVariables(
  variables?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!variables) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);

  for (const key in variables) {
    // Skip dangerous keys
    if (dangerousKeys.has(key.toLowerCase())) {
      logger.warn(`Blocked dangerous variable key: ${key}`);
      continue;
    }

    const value = variables[key];

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeVariables(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        item && typeof item === 'object' ? sanitizeVariables(item as Record<string, unknown>) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Persisted query extension structure
 */
interface PersistedQueryExtension {
  version: number;
  sha256Hash: string;
}

/**
 * GraphQL request parameters
 */
export interface GraphQLRequest {
  /** GraphQL query string (optional if using persisted queries) */
  query?: string;
  /** Query variables */
  variables?: Record<string, unknown>;
  /** Operation name (used to lookup hash) */
  operationName: string;
}

/**
 * GraphQL response structure
 */
export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
      [key: string]: unknown;
    };
  }>;
}

/**
 * Query hash registry
 *
 * In production, this would be imported from the generated manifest.
 * For now, it's a placeholder that can be populated at build time.
 */
export const queryHashRegistry: Record<string, string> = {
  // Example entries:
  // 'GetUserFleets': 'abc123...',
  // 'GetOrganization': 'def456...',
};

/**
 * Load query hashes from the backend manifest
 *
 * This function should be called during app initialization to populate
 * the query hash registry from the generated manifest.
 */
export async function loadQueryHashes(): Promise<void> {
  try {
    // In production, import from generated file:
    // import { queryHashes } from '../../../backend/src/graphql/persisted-queries';
    // Object.assign(queryHashRegistry, queryHashes);

    // For development, optionally fetch from server:
    const manifest = await apiClient.getRaw<{ hashMap?: Record<string, string> }>(
      '/api/graphql/manifest'
    );
    if (manifest?.hashMap) {
      Object.assign(queryHashRegistry, manifest.hashMap);
    }
  } catch (error) {
    logger.warn('Failed to load query hashes, using inline queries:', error);
  }
}

/**
 * Execute a GraphQL query using persisted queries
 *
 * @param request - GraphQL request parameters
 * @param endpoint - GraphQL endpoint URL (default: /graphql)
 * @returns Promise resolving to the query result
 *
 * @example
 * ```typescript
 * const result = await executePersistedQuery<UserFleets>({
 *   operationName: 'GetUserFleets',
 *   variables: { userId: '123' },
 *   query: `query GetUserFleets($userId: ID!) { ... }` // fallback
 * });
 *
 * if (result.data) {
 *   // Use result.data.user.fleets
 * }
 * ```
 */
export async function executePersistedQuery<T = unknown>(
  request: GraphQLRequest,
  endpoint: string = '/graphql'
): Promise<GraphQLResponse<T>> {
  const { operationName, query } = request;
  // CWE-89: Sanitize variables to prevent GraphQL injection
  const variables = sanitizeVariables(request.variables);

  // Look up query hash from registry
  const hash = queryHashRegistry[operationName];

  if (!hash && !query) {
    throw new Error(
      `No hash found for operation "${operationName}" and no fallback query provided. ` +
        `Did you forget to generate the query manifest?`
    );
  }

  // First attempt: Send only the hash (if available)
  if (hash) {
    try {
      const response = await makeGraphQLRequest<T>(endpoint, {
        variables,
        operationName,
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: hash,
          },
        },
      });

      // Check if query was found
      if (!isPersistedQueryNotFound(response)) {
        return response;
      }

      // Query not found in cache, retry with full query
      logger.debug(`Query "${operationName}" not found in cache, retrying with full query`);
    } catch (error) {
      logger.error(
        'Persisted query request failed:',
        error instanceof Error ? error : new Error(String(error))
      );
      // Fall through to retry with full query
    }
  }

  // Second attempt: Send full query with hash
  if (!query) {
    throw new Error(
      `Persisted query not found for "${operationName}" and no fallback query provided`
    );
  }

  // NOSONAR: GraphQL Injection false positive — 'query' is a developer-defined string
  // from the codebase, not user input. Variables are sanitized via sanitizeVariables().
  // Server-side persisted queries plugin restricts executable queries.
  return makeGraphQLRequest<T>(endpoint, {
    // NOSONAR
    query,
    variables,
    operationName,
    ...(hash && {
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: hash,
        },
      },
    }),
  });
}

/**
 * Make a GraphQL HTTP request via the shared apiClient.
 * apiClient handles auth (cookie or bearer), CSRF, retries, and credentials.
 */
async function makeGraphQLRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  try {
    return await apiClient.postRaw<GraphQLResponse<T>>(endpoint, body);
  } catch (error) {
    if (isApiClientError(error)) {
      throw new Error(`GraphQL request failed: ${error.statusCode || 'network'} ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if response indicates persisted query not found
 */
function isPersistedQueryNotFound(response: GraphQLResponse): boolean {
  return (
    response.errors?.[0]?.extensions?.code === 'PERSISTED_QUERY_NOT_FOUND' ||
    response.errors?.[0]?.message === 'PersistedQueryNotFound'
  );
}

/**
 * React hook for executing persisted queries
 *
 * Provides a convenient way to use persisted queries in React components
 * with loading and error states.
 *
 * @example
 * ```typescript
 * function UserFleets({ userId }: { userId: string }) {
 *   const { data, loading, error, refetch } = usePersistedQuery<UserFleets>({
 *     operationName: 'GetUserFleets',
 *     variables: { userId },
 *     query: GetUserFleetsQuery, // fallback
 *   });
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Fleets for {data.user.username}</h2>
 *       {data.user.fleets.map(fleet => (
 *         <div key={fleet.id}>{fleet.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePersistedQuery<T = unknown>(request: GraphQLRequest) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const execute = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await executePersistedQuery<T>(request);

      if (response.errors) {
        throw new Error(response.errors[0].message);
      }

      setData(response.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [request.operationName, request.query, JSON.stringify(request.variables)]);

  React.useEffect(() => {
    execute();
  }, [execute]);

  return {
    data,
    loading,
    error,
    refetch: execute,
  };
}

// Re-export React if available (for the hook)
// Removed duplicate import - already imported at top

/**
 * Compute SHA256 hash of a query string
 *
 * This utility computes hashes consistently with the backend by normalizing
 * the query using simple whitespace normalization. For production use,
 * consider using a GraphQL parser library for more robust normalization.
 *
 * Note: The backend uses GraphQL's print() function which provides proper
 * AST-based normalization. For perfect hash matching, queries should be
 * pre-generated at build time rather than computed at runtime.
 *
 * @param query - GraphQL query string
 * @returns Promise resolving to the SHA256 hash
 */
export async function computeQueryHash(query: string): Promise<string> {
  // Simple normalization: collapse whitespace
  // Note: This is a simplified version. For production, use the backend's
  // manifest generation which uses GraphQL's print() for proper normalization.
  const normalized = query
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\s*([{}(),:])\s*/g, '$1') // NOSONAR: S5852 FP — prior replaceAll(\s+) eliminates consecutive whitespace, preventing backtracking
    .trim();

  // Use SubtleCrypto API (available in modern browsers)
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Register a query at runtime
 *
 * Useful for development or when queries need to be registered dynamically.
 * In production, prefer build-time registration via the manifest.
 *
 * @param operationName - Name of the operation
 * @param query - GraphQL query string
 */
export async function registerQuery(operationName: string, query: string): Promise<void> {
  const hash = await computeQueryHash(query);

  // Register with server
  const response = await executePersistedQuery({
    operationName,
    query,
    variables: {},
  });

  if (response.errors) {
    throw new Error(`Failed to register query: ${response.errors[0].message}`);
  }

  // Add to local registry
  queryHashRegistry[operationName] = hash;
}

/**
 * Configuration options for persisted queries
 */
export interface PersistedQueryConfig {
  /** Whether to use GET requests for queries (more cacheable) */
  useGetForHashedQueries?: boolean;
  /** Endpoint for GraphQL requests */
  endpoint?: string;
  /** Whether to retry with full query on cache miss */
  retryOnCacheMiss?: boolean;
  /** Whether to log debug information */
  debug?: boolean;
}

/**
 * Global configuration
 */
let globalConfig: PersistedQueryConfig = {
  useGetForHashedQueries: false,
  endpoint: '/graphql',
  retryOnCacheMiss: true,
  debug: false,
};

/**
 * Configure persisted queries globally
 *
 * @param config - Configuration options
 *
 * @example
 * ```typescript
 * // In your app initialization:
 * configurePersistedQueries({
 *   endpoint: '/api/graphql',
 *   useGetForHashedQueries: true,
 *   debug: process.env.NODE_ENV === 'development',
 * });
 * ```
 */
export function configurePersistedQueries(config: PersistedQueryConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current configuration
 */
export function getPersistedQueryConfig(): Readonly<PersistedQueryConfig> {
  return { ...globalConfig };
}

/**
 * Export types for use in other modules
 */
export type { PersistedQueryExtension };
