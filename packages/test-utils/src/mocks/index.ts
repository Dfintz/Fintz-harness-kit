/**
 * Mock Utilities
 * 
 * Provides mock implementations for common dependencies.
 */

/**
 * Creates a mock logger that captures log calls
 */
export function createMockLogger() {
  const logs: { level: string; message: string; meta?: unknown }[] = [];

  return {
    logs,
    debug: (message: string, meta?: unknown) => logs.push({ level: 'debug', message, meta }),
    info: (message: string, meta?: unknown) => logs.push({ level: 'info', message, meta }),
    warn: (message: string, meta?: unknown) => logs.push({ level: 'warn', message, meta }),
    error: (message: string, meta?: unknown) => logs.push({ level: 'error', message, meta }),
    clear: () => { logs.length = 0; },
    hasLog: (level: string, messagePattern: string | RegExp) =>
      logs.some(log =>
        log.level === level &&
        (typeof messagePattern === 'string'
          ? log.message.includes(messagePattern)
          : messagePattern.test(log.message))
      ),
  };
}

/**
 * Creates a mock cache implementation
 */
export function createMockCache<T = unknown>() {
  const store = new Map<string, { value: T; expires: number | null }>();

  return {
    store,
    get: async (key: string): Promise<T | null> => {
      const item = store.get(key);
      if (!item) return null;
      if (item.expires && Date.now() > item.expires) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    set: async (key: string, value: T, ttl?: number): Promise<void> => {
      store.set(key, {
        value,
        expires: ttl ? Date.now() + ttl * 1000 : null,
      });
    },
    delete: async (key: string): Promise<boolean> => store.delete(key),
    clear: async (): Promise<void> => { store.clear(); },
    has: async (key: string): Promise<boolean> => {
      const item = store.get(key);
      if (!item) return false;
      if (item.expires && Date.now() > item.expires) {
        store.delete(key);
        return false;
      }
      return true;
    },
  };
}

/**
 * Creates a mock event emitter
 */
export function createMockEventEmitter() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const emittedEvents: { event: string; args: unknown[] }[] = [];

  return {
    emittedEvents,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(listener);
    },
    off: (event: string, listener: (...args: unknown[]) => void) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    },
    emit: (event: string, ...args: unknown[]) => {
      emittedEvents.push({ event, args });
      const eventListeners = listeners.get(event) || [];
      eventListeners.forEach(listener => listener(...args));
    },
    hasListener: (event: string) => (listeners.get(event)?.length ?? 0) > 0,
    listenerCount: (event: string) => listeners.get(event)?.length ?? 0,
    clear: () => {
      listeners.clear();
      emittedEvents.length = 0;
    },
  };
}

/**
 * Creates a delayed promise for testing async behavior
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock function that can be awaited
 */
export function createAsyncMock<T>(returnValue: T, delayMs = 0) {
  const calls: unknown[][] = [];
  
  const mock = async (...args: unknown[]): Promise<T> => {
    calls.push(args);
    if (delayMs > 0) {
      await delay(delayMs);
    }
    return returnValue;
  };

  mock.calls = calls;
  mock.clear = () => { calls.length = 0; };

  return mock;
}

/**
 * Mock WebSocket for testing real-time features
 */
export function createMockWebSocket() {
  const sentMessages: unknown[] = [];
  const handlers: { [event: string]: Array<(data: unknown) => void> } = {};

  return {
    sentMessages,
    readyState: 1, // OPEN
    send: (data: unknown) => { sentMessages.push(data); },
    close: () => { /* mock close */ },
    addEventListener: (event: string, handler: (data: unknown) => void) => {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(handler);
    },
    removeEventListener: (event: string, handler: (data: unknown) => void) => {
      if (handlers[event]) {
        const index = handlers[event].indexOf(handler);
        if (index > -1) {
          handlers[event].splice(index, 1);
        }
      }
    },
    // Test helper to simulate receiving a message
    simulateMessage: (data: unknown) => {
      (handlers['message'] || []).forEach(h => h({ data: JSON.stringify(data) }));
    },
    clear: () => {
      sentMessages.length = 0;
      Object.keys(handlers).forEach(key => delete handlers[key]);
    },
  };
}

/**
 * Creates a stable TypeORM QueryBuilder mock suitable for use in Jest tests.
 *
 * Returns a single object whose methods all use `jest.fn().mockReturnThis()` for
 * chainable calls, and `jest.fn().mockResolvedValue(defaultValue)` for terminal calls.
 *
 * Because every call to `createQueryBuilder()` returns the **same** object reference,
 * test-side mock configuration (e.g. `qb.getOne.mockResolvedValue(record)`) is
 * immediately visible to the production code under test.
 *
 * Usage:
 * ```ts
 * import { createMockQueryBuilder } from '@sc-fleet-manager/test-utils';
 *
 * let mockQB: ReturnType<typeof createMockQueryBuilder>;
 * let mockRepo: { createQueryBuilder: jest.Mock };
 *
 * beforeEach(() => {
 *   mockQB = createMockQueryBuilder();
 *   mockRepo = { createQueryBuilder: jest.fn(() => mockQB) };
 * });
 *
 * it('fetches record', async () => {
 *   mockQB.getOne.mockResolvedValue({ id: '1' });
 *   // ... call service under test ...
 * });
 * ```
 *
 * Pass `overrides` to replace specific method defaults for the entire test suite.
 */
export function createMockQueryBuilder(overrides?: Record<string, jest.Mock>) {
  const qb = {
    // Projection
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    // Filtering
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    // Joining
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    // Grouping & ordering
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    // Pagination
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    // Parameters
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    // Terminal — single row
    getOne: jest.fn<Promise<unknown>, []>().mockResolvedValue(null),
    getRawOne: jest.fn<Promise<unknown>, []>().mockResolvedValue(null),
    // Terminal — multiple rows
    getMany: jest.fn<Promise<unknown[]>, []>().mockResolvedValue([]),
    getRawMany: jest.fn<Promise<unknown[]>, []>().mockResolvedValue([]),
    getManyAndCount: jest.fn<Promise<[unknown[], number]>, []>().mockResolvedValue([[], 0]),
    // Terminal — count / execute
    getCount: jest.fn<Promise<number>, []>().mockResolvedValue(0),
    execute: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    ...overrides,
  };
  return qb;
}
