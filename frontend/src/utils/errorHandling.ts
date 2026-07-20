/**
 * Utility functions for handling and formatting errors
 */

import { getBackendUrl } from '@/config/env';
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
export function isAxiosError(error: unknown): error is { response?: { status?: number; data?: unknown } } {
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
 * Handle fetch errors and provide detailed error messages
 * Detects network failures (ERR_NAME_NOT_RESOLVED, connection refused, etc.)
 * and provides actionable feedback to users
 * 
 * @param error - The error caught from a fetch request
 * @param context - Additional context for the error message (e.g., "Authentication", "Demo login")
 * @returns NetworkErrorDetails with formatted message and metadata
 */
export function handleFetchError(error: unknown, context: string = 'Request'): NetworkErrorDetails {
  // Check if it's a network error (Failed to fetch, ERR_NAME_NOT_RESOLVED, etc.)
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    const backendUrl = getBackendUrl();
    const message = `Cannot connect to backend server at ${backendUrl}. Please check your network connection and ensure the backend is running.`;
    
    // Log diagnostic information for debugging
    logger.error(`${context} - Backend connection failed`, error, {
      backendUrl,
      viteApiUrl: import.meta.env.VITE_API_URL,
    });
    
    return {
      message,
      isNetworkError: true,
      backendUrl
    };
  }
  
  // Check if it's an Error instance with a message
  if (error instanceof Error) {
    return {
      message: error.message,
      isNetworkError: false
    };
  }
  
  // Unknown error type
  return {
    message: `${context} failed`,
    isNetworkError: false
  };
}

/**
 * Create a user-friendly error message for authentication failures
 * 
 * @param error - The error caught from an authentication request
 * @param authType - Type of authentication (e.g., "Discord", "Azure AD", "Demo")
 * @returns Formatted error message
 */
export function getAuthErrorMessage(error: unknown, authType: string): string {
  const details = handleFetchError(error, `${authType} authentication`);
  return details.message;
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
 * @param error - The error caught from an axios request
 * @returns AxiosErrorInfo with message, code, and status
 */
export function getAxiosErrorInfo(error: unknown): AxiosErrorInfo {
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as { message?: string; error?: string; code?: string };
    return {
      message: data.message || data.error || 'Request failed',
      code: data.code,
      status: error.response.status,
    };
  }
  
  if (isError(error)) {
    return {
      message: error.message,
    };
  }
  
  return {
    message: 'An unexpected error occurred',
  };
}
