/**
 * Environment Validation State
 * Stores validation errors from environment variable checks
 * Used by health checks to report configuration issues
 * 
 * Note: This module uses module-level state that is set once during
 * application startup and then read-only afterward. This is safe
 * because validation only happens once when app.ts initializes.
 */

let validationErrors: string[] = [];

export const setValidationErrors = (errors: string[]): void => {
    validationErrors = errors;
};

export const getValidationErrors = (): string[] => validationErrors;

export const hasValidationErrors = (): boolean => validationErrors.length > 0;
