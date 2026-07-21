/**
 * Query Parameter Utilities
 *
 * Helpers for safely parsing Express query parameters that may have been
 * coerced by Joi validateSchema middleware (convert: true converts string
 * "true"/"false" → boolean true/false, but Express ParsedQs types are
 * string-based).
 */

/**
 * Parse a query parameter value as boolean, handling both string and
 * Joi-coerced boolean values.
 *
 * @param value - The query parameter value (may be string, boolean, or undefined)
 * @param defaultValue - Value to return when the parameter is absent (default: false)
 * @returns boolean
 *
 * @example
 * ```ts
 * const includeInactive = parseBooleanQuery(req.query.includeInactive);
 * const activeOnly = parseBooleanQuery(req.query.activeOnly, true);
 * ```
 */
export function parseBooleanQuery(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value === 'true';
  }
  return defaultValue;
}
