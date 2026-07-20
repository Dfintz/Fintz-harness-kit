import { isApiClientError } from '@/services/apiClient';
import { isAxiosError } from 'axios';

const RETRYABLE_GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * Retry a request on gateway errors (502/503/504).
 *
 * The apiClient interceptor skips retries for non-GET methods, so idempotent
 * DELETE/POST calls that are safe to repeat use this helper instead.
 *
 * NOTE: axiosClient's response interceptor converts AxiosErrors into
 * ApiClientError instances, so we check both error types.
 */
export async function withGatewayRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      let statusCode: number | undefined;
      if (isApiClientError(error)) {
        statusCode = error.statusCode;
      } else if (isAxiosError(error)) {
        statusCode = error.response?.status;
      }
      const isRetryable = statusCode !== undefined && RETRYABLE_GATEWAY_STATUSES.has(statusCode);
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff with jitter
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
