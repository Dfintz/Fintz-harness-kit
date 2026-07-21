/**
 * Test Helper Utilities
 * 
 * Common helper functions for testing.
 */

/**
 * Waits for a condition to be true, with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Waits for an element to appear in the DOM (for React Testing Library)
 */
export async function waitForElement<T extends Element>(
  getElement: () => T | null,
  options: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = getElement();
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Element not found after ${timeout}ms`);
}

/**
 * Creates a spy that tracks function calls
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(
  implementation?: T
) {
  const calls: { args: Parameters<T>; result?: ReturnType<T>; error?: Error }[] = [];
  
  const spy = ((...args: Parameters<T>) => {
    const call: { args: Parameters<T>; result?: ReturnType<T>; error?: Error } = { args };
    calls.push(call);
    
    if (implementation) {
      try {
        const result = implementation(...args);
        call.result = result as ReturnType<T>;
        return result;
      } catch (error) {
        call.error = error as Error;
        throw error;
      }
    }
    return undefined;
  }) as T & {
    calls: typeof calls;
    callCount: number;
    lastCall: typeof calls[number] | undefined;
    wasCalledWith: (...args: Partial<Parameters<T>>) => boolean;
    reset: () => void;
  };

  Object.defineProperty(spy, 'calls', { get: () => calls });
  Object.defineProperty(spy, 'callCount', { get: () => calls.length });
  Object.defineProperty(spy, 'lastCall', { get: () => calls[calls.length - 1] });
  
  spy.wasCalledWith = (...expectedArgs: Partial<Parameters<T>>) =>
    calls.some(call =>
      expectedArgs.every((arg, index) =>
        arg === undefined || JSON.stringify(call.args[index]) === JSON.stringify(arg)
      )
    );
  
  spy.reset = () => { calls.length = 0; };

  return spy;
}

/**
 * Deep freezes an object for immutability testing
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  });
  return obj;
}

/**
 * Creates a test context with setup and teardown
 */
export function createTestContext<T>(setup: () => T | Promise<T>) {
  let context: T;
  
  return {
    get value(): T {
      return context;
    },
    beforeEach: async () => {
      context = await setup();
    },
    afterEach: () => {
      // Allow garbage collection
      context = undefined as unknown as T;
    },
  };
}

/**
 * Asserts that a promise rejects with a specific error
 */
export async function expectToThrow(
  fn: () => Promise<unknown>,
  expectedError?: string | RegExp | { message?: string | RegExp; name?: string }
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (error instanceof Error && error.message === 'Expected function to throw, but it did not') {
      throw error;
    }
    
    const err = error as Error;
    
    if (expectedError) {
      if (typeof expectedError === 'string') {
        if (!err.message.includes(expectedError)) {
          throw new Error(`Expected error message to include "${expectedError}", got "${err.message}"`);
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(err.message)) {
          throw new Error(`Expected error message to match ${expectedError}, got "${err.message}"`);
        }
      } else {
        if (expectedError.message) {
          const matches = typeof expectedError.message === 'string'
            ? err.message.includes(expectedError.message)
            : expectedError.message.test(err.message);
          if (!matches) {
            throw new Error(`Expected error message to match ${expectedError.message}, got "${err.message}"`);
          }
        }
        if (expectedError.name && err.name !== expectedError.name) {
          throw new Error(`Expected error name to be "${expectedError.name}", got "${err.name}"`);
        }
      }
    }
    
    return err;
  }
}

/**
 * Generates random test data
 */
export const random = {
  string: (length = 10): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },
  
  number: (min = 0, max = 1000): number =>
    Math.floor(Math.random() * (max - min + 1)) + min,
  
  boolean: (): boolean =>
    Math.random() > 0.5,
  
  email: (): string =>
    `${random.string(8).toLowerCase()}@${random.string(6).toLowerCase()}.com`,
  
  date: (start = new Date(2020, 0, 1), end = new Date()): Date =>
    new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())),
  
  pick: <T>(array: T[]): T => {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return array[Math.floor(Math.random() * array.length)]!;
  },
  
  shuffle: <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  },
};
