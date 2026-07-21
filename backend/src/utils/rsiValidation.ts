/**
 * Shared validation for RSI identifiers (SIDs and handles).
 * CWE-918: SSRF defense-in-depth — only allow alphanumeric, underscore, and hyphen.
 */

import { ValidationError } from './apiErrors';

/** Allowed characters for RSI identifiers */
const RSI_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate an RSI identifier (SID or handle) to prevent path traversal.
 * @param value The identifier to validate
 * @param label Descriptive label for error messages (e.g. "organization SID", "citizen handle")
 * @throws ValidationError if the identifier contains disallowed characters
 */
export function validateRsiIdentifier(value: string, label: string): void {
  if (!value || !RSI_IDENTIFIER_PATTERN.test(value)) {
    throw new ValidationError(`Invalid RSI ${label}: contains disallowed characters`);
  }
}
