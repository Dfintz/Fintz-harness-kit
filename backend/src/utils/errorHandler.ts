/**
 * Error Handler Utilities
 *
 * Provides standardized error handling patterns across the codebase
 * to replace unsafe `error: any` patterns with proper type guards.
 */

import axios, { AxiosError } from 'axios';

import { logger } from './logger';

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if error is an Axios error
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

/**
 * Type guard to check if error has a message property
 */
export function hasMessage(error: unknown): error is { message: string } {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false;
  }

  return typeof error.message === 'string';
}

/**
 * Type guard to check if error has a response property (Axios-like)
 */
export function hasResponse(
  error: unknown
): error is { response: { data?: { message?: string } } } {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false;
  }

  return typeof error.response === 'object' && error.response !== null;
}

/**
 * Safely extract error message from unknown error type
 * @param error - Unknown error object
 * @param fallback - Fallback message if extraction fails
 * @returns Error message string
 */
function extractResponseDataMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  // Prefer `message`, then `error` (used by many internal middlewares),
  // then nested `error.message` (ApiError-style envelopes).
  if (typeof record.message === 'string') {
    return record.message;
  }
  if (typeof record.error === 'string') {
    return record.error;
  }
  if (
    record.error &&
    typeof record.error === 'object' &&
    typeof (record.error as Record<string, unknown>).message === 'string'
  ) {
    return (record.error as { message: string }).message;
  }
  return undefined;
}

export function getErrorMessage(error: unknown, fallback = 'An unknown error occurred'): string {
  if (isAxiosError(error)) {
    const responseMessage = extractResponseDataMessage(error.response?.data);
    return responseMessage || error.message || fallback;
  }

  if (hasResponse(error)) {
    const responseMessage = extractResponseDataMessage(error.response?.data);
    return responseMessage || fallback;
  }

  if (isError(error)) {
    return error.message || fallback;
  }

  if (hasMessage(error)) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error || fallback;
  }

  return fallback;
}

/**
 * Log error with context
 * @param error - Unknown error object
 * @param context - Context information for logging
 */
export function logError(error: unknown, context: string): void {
  const message = getErrorMessage(error);

  if (isError(error)) {
    logger.error(`${context}: ${message}`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
  } else if (isAxiosError(error)) {
    logger.error(`${context}: ${message}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
    });
  } else {
    logger.error(`${context}: ${message}`, { error });
  }
}

/**
 * Format error for user-friendly display
 * @param error - Unknown error object
 * @param includeDetails - Whether to include technical details
 * @returns Formatted error message
 */
export function formatUserError(error: unknown, includeDetails = false): string {
  const message = getErrorMessage(error);

  if (!includeDetails) {
    return message;
  }

  if (isAxiosError(error) && error.response) {
    return `${message} (Status: ${error.response.status})`;
  }

  if (isError(error) && error.name !== 'Error') {
    return `${error.name}: ${message}`;
  }

  return message;
}

/**
 * Execute async operation with standardized error handling
 * @param operation - Async operation to execute
 * @param context - Context for error logging
 * @returns Result or throws with logged error
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    logError(error, context);
    throw error;
  }
}

/**
 * Execute async operation and return result with error
 * @param operation - Async operation to execute
 * @returns Tuple of [error, result]
 */
export async function safeAsync<T>(
  operation: () => Promise<T>
): Promise<[null, T] | [Error, null]> {
  try {
    const result = await operation();
    return [null, result];
  } catch (error: unknown) {
    if (isError(error)) {
      return [error, null];
    }
    return [new Error(getErrorMessage(error)), null];
  }
}
