/**
 * GraphQL Input Validation Utilities
 *
 * Provides reusable validation functions for GraphQL resolver arguments
 * Integrates with Joi schemas from the main validation layer
 */

import { GraphQLError } from 'graphql';
import { ObjectSchema, ValidationError } from 'joi';

import { logger } from '../../utils/logger';

/**
 * Validation result interface
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    type?: string;
  }>;
}

/**
 * Validate input against a Joi schema
 * Throws GraphQLError with proper formatting for GraphQL responses
 *
 * @param data - The data to validate
 * @param schema - The Joi schema to validate against
 * @param options - Additional validation options
 * @returns The validated data (transformed by schema)
 * @throws GraphQLError if validation fails
 */
export function validateGraphQLInput<T>(
  data: unknown,
  schema: ObjectSchema,
  options?: {
    abortEarly?: boolean;
    context?: string; // For logging context
  }
): T {
  try {
    const { error, value } = schema.validate(data, {
      abortEarly: options?.abortEarly ?? false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
      }));

      logger.warn('GraphQL input validation failed', {
        context: options?.context || 'unknown',
        errorCount: details.length,
        fields: details.map(d => d.field),
      });

      throw new GraphQLError('Input validation failed', {
        extensions: {
          code: 'VALIDATION_ERROR',
          details,
          statusCode: 400,
        },
      });
    }

    return value as T;
  } catch (err) {
    if (err instanceof GraphQLError) {
      throw err;
    }

    logger.error('Unexpected validation error', {
      context: options?.context || 'unknown',
      error: err instanceof Error ? err.message : String(err),
    });

    throw new GraphQLError('Unexpected validation error', {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }
}

/**
 * Validate a field value against a Joi schema
 * Used for individual argument validation within resolvers
 *
 * @param value - The value to validate
 * @param schema - The Joi schema
 * @param fieldName - Name of the field (for error messages)
 * @throws GraphQLError if validation fails
 */
export function validateField(value: unknown, schema: ObjectSchema, fieldName: string): void {
  const { error } = schema.validate(value, { abortEarly: true });

  if (error) {
    throw new GraphQLError(`Invalid ${fieldName}: ${error.message}`, {
      extensions: {
        code: 'VALIDATION_ERROR',
        field: fieldName,
        statusCode: 400,
      },
    });
  }
}

/**
 * Check if a value is null or undefined
 * @param value - The value to check
 * @returns true if value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Create a type guard for validating object structure
 * @param keys - Required keys that must be present
 * @returns Type guard function
 */
export function createObjectTypeGuard(keys: string[]) {
  return (obj: unknown): obj is Record<string, unknown> => {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const record = obj as Record<string, unknown>;
    return keys.every(key => key in record);
  };
}

/**
 * Batch validate multiple arguments
 * Useful for resolvers with multiple complex arguments
 *
 * @param args - Object with field names as keys and validation schemas as values
 * @param data - The data object containing all arguments
 * @returns Validated data
 * @throws GraphQLError with all validation errors collected
 */
export function validateBatchArguments(
  args: Record<string, ObjectSchema>,
  data: Record<string, unknown>
): Record<string, unknown> {
  const validatedData: Record<string, unknown> = {};
  const errors: Array<{ field: string; message: string; type?: string }> = [];

  for (const [field, schema] of Object.entries(args)) {
    const value = data[field];

    const { error, value: validatedValue } = schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      errors.push(
        ...error.details.map(detail => ({
          field: `${field}.${detail.path.join('.')}`,
          message: detail.message,
          type: detail.type,
        }))
      );
    } else {
      validatedData[field] = validatedValue;
    }
  }

  if (errors.length > 0) {
    logger.warn('Batch validation failed', {
      errorCount: errors.length,
      fields: errors.map(e => e.field),
    });

    throw new GraphQLError('Input validation failed', {
      extensions: {
        code: 'VALIDATION_ERROR',
        details: errors,
        statusCode: 400,
      },
    });
  }

  return validatedData;
}

/**
 * Safe format validation errors for GraphQL response
 * Prevents information leakage while providing helpful error messages
 *
 * @param validationError - The Joi ValidationError
 * @returns Formatted error details
 */
export function formatValidationError(validationError: ValidationError) {
  return validationError.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type,
  }));
}
