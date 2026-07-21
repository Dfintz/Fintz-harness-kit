/**
 * Custom GraphQL Scalars
 * 
 * DateTime and UUID scalar types
 */

import { GraphQLScalarType, Kind } from 'graphql';

/**
 * DateTime scalar for ISO 8601 date-time strings
 */
export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date-time string',
  
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      // Validate and return
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new TypeError(`DateTime cannot serialize invalid date: ${value}`);
      }
      return date.toISOString();
    }
    throw new TypeError(
      `DateTime cannot serialize value: ${value}`
    );
  },
  
  parseValue(value: unknown): Date {
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new TypeError(`DateTime cannot parse invalid date: ${value}`);
      }
      return date;
    }
    if (value instanceof Date) {
      return value;
    }
    throw new TypeError(`DateTime cannot parse value: ${value}`);
  },
  
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) {
        throw new TypeError(`DateTime cannot parse invalid date: ${ast.value}`);
      }
      return date;
    }
    throw new TypeError(`DateTime cannot parse literal of kind: ${ast.kind}`);
  },
});

/**
 * UUID scalar for UUID strings
 */
export const UUIDScalar = new GraphQLScalarType({
  name: 'UUID',
  description: 'UUID string',
  
  serialize(value: unknown): string {
    if (typeof value === 'string') {
      if (!isValidUUID(value)) {
        throw new TypeError(`UUID cannot serialize invalid UUID: ${value}`);
      }
      return value;
    }
    throw new TypeError(`UUID cannot serialize value: ${value}`);
  },
  
  parseValue(value: unknown): string {
    if (typeof value === 'string') {
      if (!isValidUUID(value)) {
        throw new TypeError(`UUID cannot parse invalid UUID: ${value}`);
      }
      return value;
    }
    throw new TypeError(`UUID cannot parse value: ${value}`);
  },
  
  parseLiteral(ast): string {
    if (ast.kind === Kind.STRING) {
      if (!isValidUUID(ast.value)) {
        throw new TypeError(`UUID cannot parse invalid UUID: ${ast.value}`);
      }
      return ast.value;
    }
    throw new TypeError(`UUID cannot parse literal of kind: ${ast.kind}`);
  },
});

/**
 * Validate UUID format
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
