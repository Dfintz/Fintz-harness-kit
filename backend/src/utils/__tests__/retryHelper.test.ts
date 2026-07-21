import { retryWithBackoff, retryWithJitter } from '../retryHelper';

describe('retryHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        retryWithBackoff(operation, {
          maxAttempts: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const onRetry = jest.fn();

      await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('should not retry non-retryable errors', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      class NonRetryableError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'NonRetryableError';
        }
      }

      const operation = jest.fn().mockRejectedValue(new NonRetryableError('Not retryable'));

      await expect(
        retryWithBackoff(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
          retryableErrors: [CustomError],
        })
      ).rejects.toThrow('Not retryable');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const startTime = Date.now();

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const onRetry = jest.fn((_, attempt) => {
        delays.push(Date.now() - startTime);
      });

      await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        onRetry,
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(delays.length).toBe(2);
      // First retry should be ~100ms, second ~200ms
      expect(delays[0]).toBeGreaterThanOrEqual(90);
      expect(delays[1]).toBeGreaterThanOrEqual(190);
    });

    it('should respect max delay', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 150,
        backoffMultiplier: 3,
      });

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should handle non-Error objects', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      await expect(
        retryWithBackoff(operation, {
          maxAttempts: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('string error');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryWithJitter', () => {
    it('should add jitter to initial delay', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const result = await retryWithJitter(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
