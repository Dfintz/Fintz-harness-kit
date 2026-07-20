import type { ApiError, ApiResponse, PaginatedResponse } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * API Client v2
 *
 * Modern, type-safe API client with automatic retry logic and standardized error handling.
 *
 * Features:
 * - Type-safe request/response handling
 * - Automatic retry with exponential backoff
 * - Standardized error handling via ApiClientError
 * - CSRF token support for state-changing requests
 * - Cookie-based and token-based authentication
 * - Request deduplication for GET requests
 *
 * For detailed documentation, see: docs/API_CLIENT_GUIDE.md
 * For builder patterns, see: ./builders/RequestBuilder.ts
 *
 * @example Basic usage
 * ```typescript
 * import { apiClient } from './services/apiClient';
 * import logger from './utils/logger';
 *
 * // GET request
 * const fleet = await apiClient.get<FleetV2>('/fleets/123');
 * logger.info('Fleet loaded:', fleet.data);
 *
 * // POST request
 * const newFleet = await apiClient.post<FleetV2>('/fleets', {
 *   name: 'Alpha Squadron'
 * });
 * ```
 *
 * @example With error handling
 * ```typescript
 * import { apiClient, isApiClientError } from './services/apiClient';
 * import logger from './utils/logger';
 *
 * try {
 *   const fleet = await apiClient.get<FleetV2>('/fleets/123');
 * } catch (error) {
 *   if (isApiClientError(error)) {
 *     logger.error('API Error:', error);
 *   }
 * }
 * ```
 */

/**
 * Custom error class for API v2 errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public requestId?: string,
    public details?: Record<string, unknown>,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Retry configuration for the API client
 */
interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** HTTP status codes that should trigger a retry (default: [408, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
  /** Whether to retry on network errors (default: true) */
  retryOnNetworkError?: boolean;
}

/**
 * Configuration for the API client
 */
interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  /** Retry configuration for failed requests */
  retry?: RetryConfig;
}

/**
 * Extended request config with retry tracking
 */
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  __retryCount?: number;
  __skipRetry?: boolean;
  __authRetried?: boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatusCodes: [408, 502, 503, 504],
  retryOnNetworkError: true,
};

/**
 * Public path prefixes where 401 responses should NOT trigger a login redirect.
 * These match the public (unauthenticated) routes defined in router/routes.tsx.
 */
const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/logout',
  '/directory',
  '/welcome',
  '/verify-deletion',
  '/join/',
  '/j/',
  '/opportunities',
  '/public/',
  '/changelog',
];

/**
 * Check if the current pathname is a public route where 401 is expected.
 */
const isPublicPath = (pathname: string): boolean =>
  pathname === '/' || PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));

/**
 * Unified API Client for v2 endpoints
 * Provides standardized request/response handling with automatic error normalization
 * and retry logic with exponential backoff
 */
export class ApiClient {
  private readonly client: AxiosInstance;
  private readonly retryConfig: Required<RetryConfig>;

  constructor(config: ApiClientConfig = {}) {
    const baseURL = config.baseURL || import.meta.env.VITE_API_URL || '';

    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retry,
    };

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 30000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  /**
   * Calculate delay for exponential backoff with jitter
   * @param retryCount Current retry attempt (0-based)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: baseDelay * 2^retryCount
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, retryCount);
    // Add jitter (±25% randomization) to prevent thundering herd
    // NOSONAR: Math.random is acceptable for non-security retry jitter
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1); // NOSONAR
    const delay = Math.round(exponentialDelay + jitter);
    // Cap at maxDelay
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Check if the error should trigger a retry
   */
  private shouldRetry(error: AxiosError, config: ExtendedAxiosRequestConfig): boolean {
    // Skip if retry is disabled for this request
    if (config.__skipRetry) {
      return false;
    }

    // Never retry non-idempotent methods — retrying POST/PUT/PATCH/DELETE
    // can cause duplicate resource creation or unintended side-effects
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return false;
    }

    const retryCount = config.__retryCount || 0;

    // Check if we've exceeded max retries
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    // Network error (no response)
    if (!error.response && this.retryConfig.retryOnNetworkError) {
      return true;
    }

    // Check if the status code is retryable
    if (error.response && this.retryConfig.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cookie value by name from document.cookie
   */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = new RegExp(`(?:^|; )${name}=([^;]*)`);
    const result = match.exec(document.cookie);
    return result ? decodeURIComponent(result[1]) : null;
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - add CSRF token and initialize retry count.
    // Authentication is cookie-based (httpOnly): the browser sends credentials
    // automatically because the axios instance is configured with `withCredentials: true`.
    this.client.interceptors.request.use(
      config => {
        // Ensure headers object exists
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }

        // Let axios set the correct Content-Type (with boundary) for FormData
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }

        // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
        const method = config.method?.toUpperCase();
        if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const csrfToken = this.getCookie('csrf_token');
          if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
          }
        }

        // Initialize retry count if not set
        const extendedConfig = config as ExtendedAxiosRequestConfig;
        extendedConfig.__retryCount ??= 0;
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor - handle retries and normalize errors
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError<ApiError>) => {
        const config = error.config as ExtendedAxiosRequestConfig;

        // Handle authentication errors — attempt token refresh, then redirect to login.
        // Auth is cookie-based: on successful refresh the new session cookie is set
        // automatically and we simply retry the original request unchanged.
        if (error.response?.status === 401 && config && !config.__authRetried) {
          config.__authRetried = true;

          try {
            // Dynamically import to avoid circular dependency
            const { useAuthStore } = await import('@/store/authStore');
            const store = useAuthStore.getState();

            if (store.isAuthenticated) {
              await store.refreshAuth();
              if (store.token) {
                return this.client.request(config);
              }
            }
          } catch {
            // Refresh failed — fall through to redirect
          }

          // Redirect to login — skip on public pages where 401 is expected
          if (globalThis.window !== undefined && !isPublicPath(globalThis.location.pathname)) {
            const currentPath = globalThis.location.pathname + globalThis.location.search;
            sessionStorage.setItem('redirectAfterLogin', currentPath);
            logger.warn('[ApiClient] Session expired — redirecting to login');
            globalThis.location.href = '/login?reason=session-expired';
          }
        }

        // Handle timeout errors - redirect to login (skip on public pages)
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          if (globalThis.window !== undefined && !isPublicPath(globalThis.location.pathname)) {
            logger.warn('[ApiClient] Request timeout - redirecting to login');
            const currentPath = globalThis.location.pathname + globalThis.location.search;
            sessionStorage.setItem('redirectAfterLogin', currentPath);
            globalThis.location.href = '/login?reason=timeout';
          }
        }

        // Check if we should retry the request
        if (config && this.shouldRetry(error, config)) {
          const retryCount = config.__retryCount || 0;
          let delay = this.calculateRetryDelay(retryCount);

          // Respect Retry-After header for 429 responses
          if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
              const retryAfterMs = Number(retryAfter) * 1000;
              if (!Number.isNaN(retryAfterMs) && retryAfterMs > 0) {
                delay = Math.min(retryAfterMs, this.retryConfig.maxDelay);
              }
            }
          }

          // Log retry attempt in development
          logger.debug(
            `[ApiClient] Retry attempt ${retryCount + 1}/${this.retryConfig.maxRetries} ` +
              `for ${config.method?.toUpperCase()} ${config.url} after ${delay}ms`
          );

          // Wait before retrying
          await this.sleep(delay);

          // Increment retry count and retry
          config.__retryCount = retryCount + 1;
          return this.client.request(config);
        }

        // Determine if error is retryable (for error reporting to callers like React Query).
        // If apiClient already exhausted its own retries, mark as NOT retryable to prevent
        // compound retries (apiClient retries × React Query retries = excessive requests).
        const alreadyRetried = (config?.__retryCount ?? 0) > 0;
        let isRetryable = false;
        if (!alreadyRetried) {
          if (error.response) {
            isRetryable = this.retryConfig.retryableStatusCodes.includes(error.response.status);
          } else {
            isRetryable = this.retryConfig.retryOnNetworkError;
          }
        }

        if (error.response?.data?.error) {
          const apiError = error.response.data.error;
          if (typeof apiError === 'string') {
            // Legacy error format: { error: 'Some error message' }
            const responseData = error.response.data as unknown as Record<string, unknown>;
            throw new ApiClientError(
              apiError,
              (responseData.code as string) ?? 'API_ERROR',
              error.response.status,
              undefined,
              undefined,
              isRetryable
            );
          }
          // API v2 error format: { error: { message, code, ... } }
          throw new ApiClientError(
            apiError.message,
            apiError.code,
            error.response.status,
            apiError.requestId,
            apiError.details,
            isRetryable
          );
        } else if ((error.response?.data as unknown as Record<string, unknown>)?.message) {
          // Validation error format: { message: 'Validation error', errors: [...] }
          const errData = error.response!.data as unknown as Record<string, unknown>;
          throw new ApiClientError(
            String(errData.message),
            'VALIDATION_ERROR',
            error.response!.status,
            undefined,
            errData.errors ? { errors: errData.errors } : undefined,
            isRetryable
          );
        } else if (error.response) {
          // Non-standard error
          throw new ApiClientError(
            error.response.statusText || 'Request failed',
            'UNKNOWN_ERROR',
            error.response.status,
            undefined,
            undefined,
            isRetryable
          );
        } else if (error.request) {
          // Network error
          throw new ApiClientError(
            'Network error - no response received',
            'NETWORK_ERROR',
            0,
            undefined,
            undefined,
            true // Network errors are retryable
          );
        } else {
          // Request setup error
          throw new ApiClientError(
            error.message || 'Request setup failed',
            'REQUEST_ERROR',
            0,
            undefined,
            undefined,
            false
          );
        }
      }
    );
  }

  /**
   * Perform GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * Perform GET and return the payload directly (unwraps ApiResponse envelope).
   * Use this instead of `get<T>().then(r => r.data)` to avoid double-unwrapping bugs.
   */
  async getData<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data;
  }

  /**
   * Perform GET request with pagination
   */
  async getPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
    const response = await this.client.get<PaginatedResponse<T>>(url, config);
    return response.data;
  }

  /**
   * Perform POST request
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * Perform POST and return the payload directly (unwraps ApiResponse envelope).
   */
  async postData<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  /**
   * Perform PUT request
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * Perform PUT and return the payload directly (unwraps ApiResponse envelope).
   */
  async putData<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  /**
   * Perform PATCH request
   */
  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * Perform DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * Perform GET for endpoints that return plain JSON (no ApiResponse envelope).
   * Use for legacy or third-party endpoints that don't wrap in { success, data, meta }.
   */
  async getRaw<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Perform POST for endpoints that return plain JSON (no ApiResponse envelope).
   * Use for legacy or third-party endpoints that don't wrap in { success, data, meta }.
   */
  async postRaw<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * Get the current retry configuration
   */
  getRetryConfig(): Required<RetryConfig> {
    return { ...this.retryConfig };
  }

  /**
   * Create request config that skips retry
   * Useful for requests that should not be retried (e.g., login, one-time operations)
   */
  static skipRetry(config: AxiosRequestConfig = {}): ExtendedAxiosRequestConfig {
    return { ...config, __skipRetry: true };
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Default export for backward compatibility
 */
/**
 * Helper function to check if an error is an ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

/**
 * Helper function to extract error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiClientError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Helper function to extract error code
 */
export function getErrorCode(error: unknown): string {
  if (isApiClientError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Helper function to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isApiClientError(error)) {
    return error.isRetryable;
  }
  return false;
}

/**
 * Helper function to check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (isApiClientError(error)) {
    return error.code === 'NETWORK_ERROR';
  }
  return false;
}

/**
 * Re-export the RetryConfig type for consumers
 */
export type { RetryConfig };

