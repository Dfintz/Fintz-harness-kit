/**
 * Base service class with common patterns.
 * Provides shared functionality for all domain service classes.
 * Platform-agnostic — direct port from frontend/src/services/baseService.ts
 */

import type { PaginationMeta, PaginationParams } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import { ApiClientError, getErrorMessage } from './apiClient';

export abstract class BaseService {
  protected abstract basePath: string;

  /**
   * Build URL with path parameters
   */
  protected buildUrl(path: string, params?: Record<string, string | number>): string {
    let url = path;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url = url.replace(`:${key}`, String(value));
      });
    }
    return url;
  }

  /**
   * Build query string from parameters
   */
  protected buildQueryString(params?: Record<string, unknown>): string {
    if (!params) return '';

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    });

    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Handle pagination parameters
   */
  protected getPaginationParams(params?: PaginationParams) {
    return {
      page: params?.page || 1,
      limit: params?.limit || 20,
    };
  }

  /**
   * Generic error handler — logs and re-throws
   */
  protected handleError(error: unknown, context: string): never {
    if (error instanceof ApiClientError) {
      logger.error(`[${context}] API Error:`, {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        requestId: error.requestId,
        details: error.details,
      });
      throw error;
    }

    logger.error(
      `[${context}] Unexpected error:`,
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(getErrorMessage(error));
  }

  /**
   * Log service action (for debugging)
   */
  protected log(action: string, data?: unknown): void {
    logger.debug(`[${this.constructor.name}] ${action}`, data || '');
  }
}

/**
 * Helper to extract data from API response
 */
export function extractData<T>(response: { data: T }): T {
  return response.data;
}

/**
 * Unwrap apiClient response which may be the raw body or wrapped in { data: T }
 */
export function unwrapResponse<T>(response: unknown): T {
  const raw = response as Record<string, unknown>;
  return (raw?.data === undefined ? raw : raw.data) as T;
}

/**
 * Unwrap apiClient response expecting an array.
 */
export function unwrapArrayResponse<T>(response: unknown): T[] {
  const data = unwrapResponse<unknown>(response);
  return Array.isArray(data) ? (data as T[]) : [];
}

/**
 * Helper to extract paginated data
 */
export function extractPaginatedData<T>(response: {
  data: T[];
  meta: { pagination: PaginationMeta };
}) {
  return {
    items: response.data,
    pagination: response.meta.pagination,
  };
}

/**
 * Extract an array from an API response envelope.
 * Handles: direct array, { data: [...] }, or { [fieldName]: [...] }
 */
export function extractArrayFromEnvelope<T>(envelope: unknown, fieldName?: string): T[] {
  if (Array.isArray(envelope)) return envelope as T[];
  const obj = envelope as Record<string, unknown> | null | undefined;
  if (!obj) return [];
  if (Array.isArray(obj.data)) return obj.data as T[];
  if (fieldName && Array.isArray(obj[fieldName])) return obj[fieldName] as T[];
  if (Object.keys(obj).length > 0) {
    logger.warn('[extractArrayFromEnvelope] Non-null envelope with no array found', {
      keys: Object.keys(obj),
      fieldName,
    });
  }
  return [];
}

/**
 * Extract pagination metadata from an API response envelope.
 */
export function extractPaginationMeta(envelope: unknown): Record<string, number> | undefined {
  const obj = envelope as Record<string, unknown> | null | undefined;
  if (!obj) return undefined;
  if (obj.pagination && typeof obj.pagination === 'object')
    return obj.pagination as Record<string, number>;
  if (obj.meta && typeof obj.meta === 'object') {
    const meta = obj.meta as Record<string, unknown>;
    if (meta.pagination && typeof meta.pagination === 'object')
      return meta.pagination as Record<string, number>;
    if (typeof meta.total === 'number') return meta as Record<string, number>;
  }
  return undefined;
}
