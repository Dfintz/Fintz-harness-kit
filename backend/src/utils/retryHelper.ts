import { logger } from './logger';

/**
 * Retry options for async operations
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: Array<new (...args: unknown[]) => Error>;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, retryableErrors?: Array<new (...args: unknown[]) => Error>): boolean {
  if (!retryableErrors || retryableErrors.length === 0) {
    // By default, retry on any error
    return true;
  }

  return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @example
 * const result = await retryWithBackoff(
 *   async () => await fetch('https://api.example.com/data'),
 *   { maxAttempts: 5, initialDelayMs: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_RETRY_OPTIONS.maxAttempts,
    initialDelayMs = DEFAULT_RETRY_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_RETRY_OPTIONS.maxDelayMs,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    retryableErrors,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt === maxAttempts || !isRetryableError(lastError, retryableErrors)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier);

      logger.warn(`Operation failed, retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`, {
        error: lastError.message,
        attempt,
        maxAttempts,
        delayMs,
      });

      // Wait before retrying
      await sleep(delayMs);

      // Call retry callback if provided (after delay)
      if (onRetry) {
        try {
          onRetry(lastError, attempt);
        } catch (callbackError) {
          logger.error('Retry callback failed', { error: callbackError });
        }
      }
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError ?? new Error('Retry failed after maximum attempts');
}

/**
 * Retry with jitter to prevent thundering herd
 * Applies random jitter between 50% and 100% of the initial delay
 */
export async function retryWithJitter<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(operation, {
    ...options,
    initialDelayMs: (options.initialDelayMs || DEFAULT_RETRY_OPTIONS.initialDelayMs) * (0.5 + Math.random() * 0.5),
  });
}
