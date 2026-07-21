/**
 * Request Context using AsyncLocalStorage
 *
 * Propagates request correlation IDs through the entire call stack
 * without explicit parameter passing. Any service or utility can call
 * `getRequestContext()` to get the current request's correlation data.
 *
 * This is wired into the requestCorrelationMiddleware so every incoming
 * HTTP request automatically gets a context.
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  username?: string;
  startTime: number;
}

/**
 * Async local storage instance - automatically propagated through
 * async boundaries (promises, timers, event handlers).
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context, if any.
 * Returns undefined when called outside of a request (e.g. startup, cron jobs).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get correlation metadata suitable for passing to logger calls.
 * Returns an empty object when no request context is active,
 * so it's always safe to spread into log metadata.
 */
export function getCorrelationMeta(): Record<string, string> {
  const ctx = requestContextStorage.getStore();
  if (!ctx) {return {};}
  return {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    ...(ctx.userId ? { userId: ctx.userId } : {}),
  };
}
