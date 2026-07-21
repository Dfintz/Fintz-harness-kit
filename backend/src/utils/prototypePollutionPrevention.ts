/**
 * Prototype Pollution Prevention Utilities
 * Prevents CWE-1321: Improperly Controlled Modification of Object Prototype Attributes
 */

/**
 * List of dangerous property names that can lead to prototype pollution
 * These should never be allowed as object keys from user input
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check if a key is safe to use for object property assignment
 * Prevents prototype pollution by blocking dangerous property names
 *
 * @param key - The property key to validate
 * @returns true if the key is safe to use
 */
export function isSafeKey(key: string | symbol): boolean {
  if (typeof key !== 'string') {
    return true;
  } // Symbols are safe
  return !DANGEROUS_KEYS.has(key.toLowerCase());
}

/**
 * Safely assign properties from source to target object
 * Only assigns own properties and blocks dangerous keys
 *
 * @param target - Target object to assign properties to
 * @param source - Source object to copy properties from
 * @returns The target object with safely assigned properties
 */
export function safeAssign<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown> | null | undefined
): T {
  if (!source || typeof source !== 'object') {
    return target;
  }

  // Only iterate over own properties, not inherited ones
  for (const key of Object.keys(source)) {
    if (isSafeKey(key) && Object.hasOwn(source, key)) {
      (target as Record<string, unknown>)[key] = source[key];
    }
  }

  return target;
}

/**
 * Create a safe object from user input by filtering out dangerous keys
 * Returns a new object with only safe properties
 *
 * @param input - User-controlled input object
 * @param allowedKeys - Optional whitelist of allowed property names
 * @returns A new object with only safe properties
 */
export function sanitizeObject<T = Record<string, unknown>>(
  input: Record<string, unknown> | null | undefined,
  allowedKeys?: readonly string[]
): Partial<T> {
  // Use a null prototype to avoid inheriting Object.prototype; keeps __proto__ undefined
  const result = Object.create(null) as Record<string, unknown>;

  if (!input || typeof input !== 'object') {
    return result as Partial<T>;
  }

  const keys = allowedKeys ?? Object.keys(input);

  for (const key of keys) {
    if (isSafeKey(key) && Object.hasOwn(input, key) && input[key] !== undefined) {
      result[key] = input[key];
    }
  }

  return result as Partial<T>;
}

/**
 * Safely set a property on an object with key validation
 * Prevents prototype pollution by validating the key first
 *
 * @param obj - Target object
 * @param key - Property key
 * @param value - Property value
 * @returns true if property was set, false if blocked
 */
export function safeSetProperty<T extends Record<string, unknown>>(
  obj: T,
  key: string,
  value: unknown
): boolean {
  if (!isSafeKey(key)) {
    return false;
  }

  (obj as Record<string, unknown>)[key] = value;
  return true;
}

/**
 * Create a safe object from query parameters
 * Extracts specific fields and validates types
 *
 * @param query - Express request query object
 * @param schema - Schema defining allowed fields and their types
 * @returns Sanitized query object
 */
export function sanitizeQueryParams<T = Record<string, unknown>>(
  query: Record<string, unknown>,
  schema: Record<string, 'string' | 'number' | 'boolean' | 'array'>
): Partial<T> {
  // Null prototype prevents accidental __proto__ access on sanitized output
  const result = Object.create(null) as Record<string, unknown>;

  for (const [key, type] of Object.entries(schema)) {
    if (!isSafeKey(key) || !(key in query)) {
      continue;
    }

    const value = query[key];

    switch (type) {
      case 'string':
        if (typeof value === 'string') {
          result[key] = value;
        }
        break;
      case 'number': {
        const num = Number(value);
        if (!Number.isNaN(num)) {
          result[key] = num;
        }
        break;
      }
      case 'boolean':
        result[key] = value === 'true' || value === true;
        break;
      case 'array':
        result[key] = Array.isArray(value) ? value : [value];
        break;
    }
  }

  return result as Partial<T>;
}
