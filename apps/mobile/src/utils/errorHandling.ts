/**
 * Error handling utilities for the mobile app.
 * Platform-agnostic — mirrors frontend/src/utils/errorHandling.ts
 */

import { logger } from './logger';

/**
 * Interface for network error details
 */
export interface NetworkErrorDetails {
  message: string;
  isNetworkError: boolean;
  backendUrl?: string;
}

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if error has a response property (axios error)
 */
export function isAxiosError(
  error: unknown
): error is { response?: { status?: number; data?: unknown } } {
  return error !== null && typeof error === 'object' && 'response' in error;
}

/**
 * Convert unknown error to Error instance
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(String(error));
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data as { message?: string; error?: string };
    return data.message || data.error || 'An error occurred';
  }
  return 'An unexpected error occurred';
}

/**
 * Handle fetch errors and provide detailed error messages.
 * Adapted for React Native — no DOM/browser references.
 */
export function handleFetchError(error: unknown, context: string = 'Request'): NetworkErrorDetails {
  if (error instanceof TypeError && error.message.includes('Network request failed')) {
    logger.error(`${context} - Network connection failed`, error);
    return {
      message: 'Cannot connect to the server. Please check your network connection and try again.',
      isNetworkError: true,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      isNetworkError: false,
    };
  }

  return {
    message: `${context} failed`,
    isNetworkError: false,
  };
}

/**
 * Interface for axios error information
 */
export interface AxiosErrorInfo {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Extract error information from an axios error
 */
export function getAxiosErrorInfo(error: unknown): AxiosErrorInfo {
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as {
      message?: string;
      error?: string;
      code?: string;
    };
    return {
      message: data.message || data.error || 'Request failed',
      code: data.code,
      status: error.response.status,
    };
  }

  if (isError(error)) {
    return { message: error.message };
  }

  return { message: 'An unexpected error occurred' };
}
