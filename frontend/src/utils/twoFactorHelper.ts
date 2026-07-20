/**
 * Two-Factor Authentication Helper
 * 
 * Utilities for managing 2FA codes in API requests
 */

import axios from 'axios';

/**
 * Set 2FA code in axios headers for the next request
 * @param code - The 6-digit 2FA code
 */
export const set2FACode = (code: string): void => {
  if (code && code.length === 6) {
    axios.defaults.headers.common['X-2FA-Code'] = code;
  }
};

/**
 * Clear 2FA code from axios headers
 */
export const clear2FACode = (): void => {
  delete axios.defaults.headers.common['X-2FA-Code'];
};

/**
 * Execute an API call with 2FA code if provided
 * @param code - Optional 2FA code
 * @param apiCall - The API call to execute
 * @returns Promise with the API call result
 */
export const executeWith2FA = async <T,>(
  code: string | null,
  apiCall: () => Promise<T>
): Promise<T> => {
  try {
    if (code) {
      set2FACode(code);
    }
    const result = await apiCall();
    return result;
  } finally {
    if (code) {
      clear2FACode();
    }
  }
};

/**
 * Check if an error is related to 2FA
 * @param error - The error object from axios
 * @returns True if the error is 2FA-related
 */
export const is2FAError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return false;
  }
  const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
  return (
    axiosError.response?.status === 403 &&
    (axiosError.response?.data?.error?.toLowerCase().includes('2fa') ||
      axiosError.response?.data?.error?.toLowerCase().includes('two-factor') ||
      false)
  );
};
