/**
 * Token Validation Utilities
 * 
 * Provides validation functions for authentication tokens
 * to ensure only valid tokens are sent to backend services.
 */

/**
 * Check if a token should be sent to WebSocket or other services
 * 
 * Filters out placeholder tokens used internally for cookie-based auth
 * and other invalid token formats that shouldn't be sent to the backend.
 * 
 * @param token - The token to validate
 * @returns true if the token should be sent, false otherwise
 */
export const shouldSendToken = (token: string | null | undefined): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Remove whitespace
  const trimmedToken = token.trim();
  
  if (trimmedToken === '') {
    return false;
  }

  // Check for placeholder tokens used in cookie-based auth
  // These are used internally but should not be sent to the backend
  const invalidPlaceholders = ['cookie-auth', 'undefined', 'null'];
  if (invalidPlaceholders.includes(trimmedToken)) {
    return false;
  }

  return true;
};
