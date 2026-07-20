/**
 * TanStack Query Client Configuration
 *
 * Centralized query client configuration with sensible defaults
 * for caching, retries, and error handling.
 *
 * Mutations declare `meta.invalidates` (see `mutationMeta.ts`) and a single
 * global handler here turns those declarations into `invalidateQueries` calls.
 * This keeps the "what cache slices does this mutation affect" question in
 * exactly one place per hook and removes the boilerplate `onSuccess` blocks.
 */

import { DefaultOptions, MutationCache, QueryClient } from '@tanstack/react-query';

// The `resolveInvalidates` import doubles as a side-effect import: it pulls in
// the `mutationMeta` module which augments TanStack Query's `Register` type
// with `mutationMeta.invalidates`.
import { resolveInvalidates } from './mutationMeta';

const defaultOptions: DefaultOptions = {
  queries: {
    // Data is considered fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Garbage collection after 30 minutes
    gcTime: 30 * 60 * 1000,
    // Retry failed requests with exponential backoff
    // Only retry on transient errors (502, 503, 504, network errors)
    // Don't retry: 400 (bad request), 401/403 (auth), 404 (not found), 429 (rate limit), 500 (server bug)
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;

      let statusCode: number | undefined;
      let isRetryable: boolean | undefined;

      if (error && typeof error === 'object') {
        // Support ApiClientError (statusCode, isRetryable) and Axios-style errors (status)
        if (
          'statusCode' in error &&
          typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ) {
          statusCode = (error as { statusCode: number }).statusCode;
        } else if (
          'status' in error &&
          typeof (error as { status?: unknown }).status === 'number'
        ) {
          statusCode = (error as { status: number }).status;
        }

        if (
          'isRetryable' in error &&
          typeof (error as { isRetryable?: unknown }).isRetryable === 'boolean'
        ) {
          isRetryable = (error as { isRetryable: boolean }).isRetryable;
        }
      }

      // Explicit retryability flag from ApiClientError takes precedence
      if (isRetryable === false) return false;
      if (isRetryable === true) return true;

      if (typeof statusCode === 'number') {
        if (statusCode < 500) return false; // Don't retry any 4xx
        if (statusCode === 500) return false; // Don't retry server bugs
        // Retry known transient server errors
        if (statusCode === 502 || statusCode === 503 || statusCode === 504) return true;
        // Other 5xx are treated as non-retryable by default
        return false;
      }

      // No status information: likely a network error; allow retry
      return true;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch on window focus for fresh data
    refetchOnWindowFocus: true,
    // Don't refetch on mount if data is fresh
    refetchOnMount: true,
    // Refetch on reconnect
    refetchOnReconnect: true,
  },
  mutations: {
    // Never retry mutations — they are non-idempotent (create, update, delete)
    retry: 0,
  },
};

/**
 * Create a new QueryClient instance with default configuration.
 *
 * Wires a global `MutationCache.onSuccess` handler that reads
 * `mutation.options.meta.invalidates` and invalidates each declared
 * query key. Hook authors should set `meta.invalidates` instead of writing
 * per-mutation `onSuccess` invalidation blocks.
 */
export function createQueryClient(): QueryClient {
  const mutationCache = new MutationCache({
    onSuccess: (data, variables, _context, mutation) => {
      const meta = mutation.options.meta;
      if (!meta) {
        return;
      }
      const keys = resolveInvalidates(meta.invalidates, data, variables);
      for (const key of keys) {
        // Fire-and-forget: invalidation is a hint to refetch; we don't await
        // each one so multiple mutations aren't serialised on the cache lock.
        void client.invalidateQueries({ queryKey: key });
      }
    },
  });

  const client = new QueryClient({
    defaultOptions,
    mutationCache,
  });

  return client;
}

/**
 * Singleton query client instance for the application
 */
export const queryClient = createQueryClient();
