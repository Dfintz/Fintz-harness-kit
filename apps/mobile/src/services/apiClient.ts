/**
 * API Client for React Native
 *
 * Modern, type-safe API client adapted from the web frontend.
 * Features:
 * - Type-safe request/response handling
 * - Automatic retry with exponential backoff + jitter
 * - Standardized error handling via ApiClientError
 * - Bearer token authentication via AsyncStorage
 * - No DOM/browser dependencies
 */

import type { ApiError, ApiResponse, PaginatedResponse } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import { getStoredValue } from '@/utils/storage';
import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

/**
 * Custom error class for API errors
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
 * Retry configuration
 */
interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryableStatusCodes?: number[];
  retryOnNetworkError?: boolean;
}

interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retry?: RetryConfig;
}

interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  __retryCount?: number;
  __skipRetry?: boolean;
  __authRetried?: boolean;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatusCodes: [408, 502, 503, 504],
  retryOnNetworkError: true,
};

/**
 * Unified API Client for v2 endpoints.
 * Adapted for React Native: no cookies, no CSRF, no window.location.
 * Uses Bearer token auth exclusively.
 */
export class ApiClient {
  private readonly client: AxiosInstance;
  private tokenProvider?: () => string | null;
  private readonly retryConfig: Required<RetryConfig>;
  private onAuthFailure?: () => void;

  constructor(config: ApiClientConfig = {}) {
    const baseURL =
      config.baseURL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retry,
    };

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  private calculateRetryDelay(retryCount: number): number {
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, retryCount);
    // NOSONAR: Math.random is acceptable for non-security retry jitter
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1); // NOSONAR
    const delay = Math.round(exponentialDelay + jitter);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  private shouldRetry(error: AxiosError, config: ExtendedAxiosRequestConfig): boolean {
    if (config.__skipRetry) {
      return false;
    }

    // Never retry non-idempotent methods
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return false;
    }

    const retryCount = config.__retryCount || 0;
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    // Network error (no response)
    if (!error.response && this.retryConfig.retryOnNetworkError) {
      return true;
    }

    // Retryable status code
    if (error.response && this.retryConfig.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set the function that provides the authentication token.
   */
  setTokenProvider(provider: () => string | null): void {
    this.tokenProvider = provider;
  }

  /**
   * Set a callback that fires when authentication fails (401 after retry).
   * Typically used to navigate to the login screen.
   */
  setOnAuthFailure(callback: () => void): void {
    this.onAuthFailure = callback;
  }

  /**
   * Normalize an AxiosError into an ApiClientError.
   * Extracted to reduce cognitive complexity of the response interceptor.
   */
  private normalizeError(error: AxiosError<ApiError>, isRetryable: boolean): never {
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      if (typeof apiError === 'string') {
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
      throw new ApiClientError(
        apiError.message,
        apiError.code,
        error.response.status,
        apiError.requestId,
        apiError.details,
        isRetryable
      );
    }

    if ((error.response?.data as unknown as Record<string, unknown>)?.message) {
      const errData = error.response!.data as unknown as Record<string, unknown>;
      throw new ApiClientError(
        String(errData.message),
        'VALIDATION_ERROR',
        error.response!.status,
        undefined,
        errData.errors ? { errors: errData.errors } : undefined,
        isRetryable
      );
    }

    if (error.response) {
      throw new ApiClientError(
        error.response.statusText || 'Request failed',
        'UNKNOWN_ERROR',
        error.response.status,
        undefined,
        undefined,
        isRetryable
      );
    }

    if (error.request) {
      throw new ApiClientError(
        'Network error - no response received',
        'NETWORK_ERROR',
        0,
        undefined,
        undefined,
        true
      );
    }

    throw new ApiClientError(
      error.message || 'Request setup failed',
      'REQUEST_ERROR',
      0,
      undefined,
      undefined,
      false
    );
  }

  private setupInterceptors(): void {
    // Request interceptor — add Bearer token
    this.client.interceptors.request.use(
      config => {
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }

        if (this.tokenProvider) {
          const token = this.tokenProvider();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // Let axios set the correct Content-Type for FormData
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }

        const extendedConfig = config as ExtendedAxiosRequestConfig;
        extendedConfig.__retryCount ??= 0;
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor — handle retries and normalize errors
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError<ApiError>) => {
        const config = error.config as ExtendedAxiosRequestConfig;

        // Handle 401 — attempt token refresh, then signal auth failure
        if (error.response?.status === 401 && config && !config.__authRetried) {
          config.__authRetried = true;

          try {
            // Dynamically import to avoid circular dependency
            const { useAuthStore } = await import('@/store/authStore');
            const store = useAuthStore.getState();

            if (store.isAuthenticated) {
              await store.refreshAuth();
              const newToken = store.token;

              if (newToken) {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${newToken}`;
                return this.client.request(config);
              }
            }
          } catch {
            // Refresh failed — fall through
          }

          // Signal auth failure so the app can navigate to login
          if (this.onAuthFailure) {
            this.onAuthFailure();
          }
        }

        // Check if we should retry the request
        if (config && this.shouldRetry(error, config)) {
          const retryCount = config.__retryCount || 0;
          let delay = this.calculateRetryDelay(retryCount);

          // Respect Retry-After header for 429
          if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
              const retryAfterMs = Number(retryAfter) * 1000;
              if (!Number.isNaN(retryAfterMs) && retryAfterMs > 0) {
                delay = Math.min(retryAfterMs, this.retryConfig.maxDelay);
              }
            }
          }

          logger.debug(
            `[ApiClient] Retry attempt ${retryCount + 1}/${this.retryConfig.maxRetries} ` +
              `for ${config.method?.toUpperCase()} ${config.url} after ${delay}ms`
          );

          await this.sleep(delay);
          config.__retryCount = retryCount + 1;
          return this.client.request(config);
        }

        // Determine if error is retryable for callers (e.g. React Query)
        const alreadyRetried = (config?.__retryCount ?? 0) > 0;
        let isRetryable = false;
        if (!alreadyRetried) {
          if (error.response) {
            isRetryable = this.retryConfig.retryableStatusCodes.includes(error.response.status);
          } else {
            isRetryable = this.retryConfig.retryOnNetworkError;
          }
        }

        // Normalize errors into ApiClientError
        this.normalizeError(error, isRetryable);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async getData<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data;
  }

  async getPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
    const response = await this.client.get<PaginatedResponse<T>>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async postData<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async putData<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  async getRaw<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async postRaw<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  getRetryConfig(): Required<RetryConfig> {
    return { ...this.retryConfig };
  }

  static skipRetry(config: AxiosRequestConfig = {}): ExtendedAxiosRequestConfig {
    return { ...config, __skipRetry: true };
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Initialize the API client with a stored token on app startup.
 */
export async function initializeApiClient(): Promise<void> {
  const token = await getStoredValue('accessToken');
  if (token) {
    apiClient.setTokenProvider(() => token);
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiClientError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function getErrorCode(error: unknown): string {
  if (isApiClientError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

export function isRetryableError(error: unknown): boolean {
  if (isApiClientError(error)) {
    return error.isRetryable;
  }
  return false;
}

export function isNetworkError(error: unknown): boolean {
  if (isApiClientError(error)) {
    return error.code === 'NETWORK_ERROR';
  }
  return false;
}

export type { RetryConfig };
