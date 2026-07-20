// Use real axios for integration tests (setupTests.ts mocks it globally)
jest.unmock('axios');

import {
  ApiClient,
  ApiClientError,
  getErrorCode,
  getErrorMessage,
  isApiClientError,
  isNetworkError,
  isRetryableError,
} from '@/services/apiClient';
import { AxiosError } from 'axios';

/**
 * API Client Retry Logic Test Suite
 *
 * This file tests the retry logic and exponential backoff capabilities
 * of the unified API client.
 */

describe('API Client Retry Logic', () => {
  describe('ApiClientError', () => {
    it('should create error with correct properties', () => {
      const error = new ApiClientError(
        'Test error',
        'TEST_ERROR',
        500,
        'req-123',
        { field: 'value' },
        true
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.requestId).toBe('req-123');
      expect(error.details).toEqual({ field: 'value' });
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('ApiClientError');
    });

    it('should default isRetryable to false', () => {
      const error = new ApiClientError('Test', 'CODE', 400);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('isApiClientError', () => {
    it('should return true for ApiClientError instances', () => {
      const error = new ApiClientError('Test', 'CODE', 400);
      expect(isApiClientError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test');
      expect(isApiClientError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isApiClientError({ message: 'Test' })).toBe(false);
      expect(isApiClientError(null)).toBe(false);
      expect(isApiClientError(undefined)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable ApiClientError', () => {
      const error = new ApiClientError('Test', 'CODE', 503, undefined, undefined, true);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable ApiClientError', () => {
      const error = new ApiClientError('Test', 'CODE', 400, undefined, undefined, false);
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for non-ApiClientError', () => {
      expect(isRetryableError(new Error('Test'))).toBe(false);
      expect(isRetryableError({ isRetryable: true })).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      const error = new ApiClientError('Network error', 'NETWORK_ERROR', 0);
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for other error codes', () => {
      const error = new ApiClientError('Test', 'OTHER_ERROR', 500);
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from ApiClientError', () => {
      const error = new ApiClientError('API Error Message', 'CODE', 400);
      expect(getErrorMessage(error)).toBe('API Error Message');
    });

    it('should extract message from regular Error', () => {
      const error = new Error('Regular error message');
      expect(getErrorMessage(error)).toBe('Regular error message');
    });

    it('should return default message for non-error objects', () => {
      expect(getErrorMessage('string')).toBe('An unexpected error occurred');
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    });
  });

  describe('getErrorCode', () => {
    it('should extract code from ApiClientError', () => {
      const error = new ApiClientError('Test', 'CUSTOM_CODE', 400);
      expect(getErrorCode(error)).toBe('CUSTOM_CODE');
    });

    it('should return UNKNOWN_ERROR for non-ApiClientError', () => {
      expect(getErrorCode(new Error('Test'))).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(null)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('ApiClient Configuration', () => {
    it('should use default retry configuration', () => {
      const client = new ApiClient();
      const retryConfig = client.getRetryConfig();

      expect(retryConfig.maxRetries).toBe(3);
      expect(retryConfig.baseDelay).toBe(1000);
      expect(retryConfig.maxDelay).toBe(30000);
      expect(retryConfig.retryableStatusCodes).toEqual([408, 502, 503, 504]);
      expect(retryConfig.retryOnNetworkError).toBe(true);
    });

    it('should allow custom retry configuration', () => {
      const client = new ApiClient({
        retry: {
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 60000,
          retryableStatusCodes: [500, 503],
          retryOnNetworkError: false,
        },
      });
      const retryConfig = client.getRetryConfig();

      expect(retryConfig.maxRetries).toBe(5);
      expect(retryConfig.baseDelay).toBe(2000);
      expect(retryConfig.maxDelay).toBe(60000);
      expect(retryConfig.retryableStatusCodes).toEqual([500, 503]);
      expect(retryConfig.retryOnNetworkError).toBe(false);
    });

    it('should merge partial retry configuration with defaults', () => {
      const client = new ApiClient({
        retry: {
          maxRetries: 5,
        },
      });
      const retryConfig = client.getRetryConfig();

      expect(retryConfig.maxRetries).toBe(5);
      // Other values should be defaults
      expect(retryConfig.baseDelay).toBe(1000);
      expect(retryConfig.maxDelay).toBe(30000);
    });
  });

  describe('skipRetry configuration', () => {
    it('should create config with __skipRetry flag', () => {
      const config = ApiClient.skipRetry();
      expect((config as any).__skipRetry).toBe(true);
    });

    it('should preserve existing config options', () => {
      const config = ApiClient.skipRetry({
        headers: { 'X-Custom': 'value' },
        timeout: 5000,
      });

      expect((config as any).__skipRetry).toBe(true);
      expect(config.headers).toEqual({ 'X-Custom': 'value' });
      expect(config.timeout).toBe(5000);
    });
  });

  describe('compound retry prevention', () => {
    /**
     * Adds a request interceptor that rejects before the HTTP adapter fires.
     * This works in jsdom where adapter overrides are ignored because XHR is available.
     * The rejection flows through the response error interceptor chain normally.
     */
    function rejectWith504(client: ApiClient) {
      client.getAxiosInstance().interceptors.request.use(config => {
        throw new AxiosError(
          'Request failed with status code 504',
          'ERR_BAD_RESPONSE',
          config as any,
          null,
          { status: 504, statusText: 'Gateway Timeout', data: {}, headers: {}, config } as any
        );
      });
    }

    function rejectWithNetworkError(client: ApiClient) {
      client.getAxiosInstance().interceptors.request.use(config => {
        throw new AxiosError('Network Error', 'ERR_NETWORK', config as any, null, undefined);
      });
    }

    it('should mark network error as not retryable after apiClient exhausts retries', async () => {
      const client = new ApiClient({
        retry: { maxRetries: 1, baseDelay: 1, maxDelay: 1, retryOnNetworkError: true },
      });
      rejectWithNetworkError(client);

      let caughtError: unknown;
      try {
        await client.get('/test-endpoint');
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeDefined();
      expect(isApiClientError(caughtError)).toBe(true);
      const apiError = caughtError as ApiClientError;
      // Error code varies by how the network error was triggered (REQUEST_ERROR from interceptor)
      expect(['NETWORK_ERROR', 'REQUEST_ERROR']).toContain(apiError.code);
      // After apiClient exhausted its retry (maxRetries: 1), isRetryable must be false
      // to prevent React Query from compounding additional retries
      expect(apiError.isRetryable).toBe(false);
    });

    it('should mark 504 POST error as retryable when apiClient did not retry', async () => {
      const client = new ApiClient({
        retry: { maxRetries: 3, baseDelay: 1, maxDelay: 1 },
      });
      rejectWith504(client);

      let caughtError: unknown;
      try {
        await client.post('/test-endpoint', {});
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeDefined();
      expect(isApiClientError(caughtError)).toBe(true);
      const apiError = caughtError as ApiClientError;
      expect(apiError.statusCode).toBe(504);
      // POST is not retried by apiClient (non-idempotent), retryCount stays 0 — isRetryable true
      // (React Query mutations have retry: 0, so this won't compound in practice)
      expect(apiError.isRetryable).toBe(true);
    });

    it('should mark 504 GET error as not retryable after retries exhausted', async () => {
      const client = new ApiClient({
        retry: { maxRetries: 1, baseDelay: 1, maxDelay: 1 },
      });
      rejectWith504(client);

      let caughtError: unknown;
      try {
        await client.get('/test-endpoint');
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeDefined();
      expect(isApiClientError(caughtError)).toBe(true);
      const apiError = caughtError as ApiClientError;
      expect(apiError.statusCode).toBe(504);
      // apiClient retried once and exhausted — isRetryable must be false
      expect(apiError.isRetryable).toBe(false);
    });
  });
});
