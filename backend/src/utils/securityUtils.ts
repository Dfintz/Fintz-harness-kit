/**
 * Security Utilities
 *
 * Shared utilities for data sanitization and security operations
 */

/**
 * Sanitize query parameters to remove sensitive data
 *
 * Automatically redacts values for keys that contain sensitive terms
 * like password, token, secret, key, apikey, api_key
 *
 * @param query - Query parameters object
 * @returns Sanitized query parameters with sensitive values redacted
 */
export function sanitizeQueryParams(query: unknown): Record<string, unknown> {
  if (!query || typeof query !== 'object') {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'apikey',
    'api_key',
    'auth',
    'authorization',
    'credential',
    'private',
  ];

  for (const [key, value] of Object.entries(query)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize object for logging by removing sensitive fields
 *
 * @param obj - Object to sanitize
 * @param sensitiveFields - Array of field names to redact
 * @returns Sanitized object
 */
export function sanitizeObject(
  obj: Record<string, unknown>,
  sensitiveFields: string[] = [
    'password',
    'token',
    'secret',
    'key',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
  ]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        item !== null && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>, sensitiveFields)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
