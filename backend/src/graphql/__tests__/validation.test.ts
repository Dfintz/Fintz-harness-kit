/**
 * GraphQL Input Validation Tests
 *
 * Comprehensive test suite for GraphQL resolver input validation
 */

import { GraphQLError } from 'graphql';
import Joi from 'joi';

import { activitySchemas } from '../../schemas/activitySchemas';
import {
  createObjectTypeGuard,
  isNullOrUndefined,
  validateBatchArguments,
  validateField,
  validateGraphQLInput,
} from '../validation/inputValidators';

/**
 * Mock logger to suppress console output during tests
 */
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('GraphQL Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateGraphQLInput', () => {
    it('should validate and return data for valid input', () => {
      const schema = Joi.object({
        title: Joi.string().min(3).max(200).required(),
        description: Joi.string().max(500).optional(),
      });

      const data = {
        title: 'Valid Activity',
        description: 'A valid activity description',
      };

      const result = validateGraphQLInput(data, schema);

      expect(result).toEqual(data);
    });

    it('should throw GraphQLError for invalid input', () => {
      const schema = Joi.object({
        title: Joi.string().min(3).max(200).required(),
      });

      const data = { title: 'ab' }; // Too short

      expect(() => {
        validateGraphQLInput(data, schema);
      }).toThrow(GraphQLError);
    });

    it('should format validation error with details', () => {
      const schema = Joi.object({
        title: Joi.string().min(3).required(),
        description: Joi.string().max(100).required(),
      });

      const data = {
        title: 'ab', // Too short
        description: 'x'.repeat(101), // Too long
      };

      try {
        validateGraphQLInput(data, schema);
      } catch (err) {
        if (err instanceof GraphQLError) {
          expect(err.extensions?.code).toBe('VALIDATION_ERROR');
          const details = err.extensions?.details as any[];
          expect(Array.isArray(details)).toBe(true);
          expect(details.length).toBeGreaterThan(0);
        }
      }
    });

    it('should strip unknown fields by default', () => {
      const schema = Joi.object({
        title: Joi.string().required(),
      });

      const data = {
        title: 'Valid',
        unknownField: 'should be removed',
      };

      const result = validateGraphQLInput(data, schema);

      expect(result).toEqual({ title: 'Valid' });
      expect(result).not.toHaveProperty('unknownField');
    });

    it('should convert and coerce types', () => {
      const schema = Joi.object({
        count: Joi.number().integer().required(),
        active: Joi.boolean().required(),
      });

      const data = {
        count: '42', // String, should be converted to number
        active: 'true', // String, should be converted to boolean
      };

      const result = validateGraphQLInput(data, schema);

      expect(result.count).toBe(42);
      expect(typeof result.count).toBe('number');
      expect(result.active).toBe(true);
      expect(typeof result.active).toBe('boolean');
    });
  });

  describe('validateField', () => {
    it('should not throw for valid field', () => {
      const schema = Joi.string().min(3);

      expect(() => {
        validateField('valid', schema, 'title');
      }).not.toThrow();
    });

    it('should throw GraphQLError for invalid field', () => {
      const schema = Joi.string().min(3);

      expect(() => {
        validateField('ab', schema, 'title');
      }).toThrow(GraphQLError);
    });

    it('should include field name in error', () => {
      const schema = Joi.string().min(3);

      try {
        validateField('ab', schema, 'title');
      } catch (err) {
        if (err instanceof GraphQLError) {
          expect(err.extensions?.field).toBe('title');
        }
      }
    });
  });

  describe('validateBatchArguments', () => {
    it('should validate multiple arguments', () => {
      const schemas = {
        title: Joi.string().min(3).required(),
        description: Joi.string().optional(),
      };

      const data = {
        title: 'Valid Title',
        description: 'Optional description',
      };

      const result = validateBatchArguments(schemas, data);

      expect(result).toEqual(data);
    });

    it('should collect all validation errors', () => {
      const schemas = {
        title: Joi.string().min(3).required(),
        description: Joi.string().max(100).required(),
      };

      const data = {
        title: 'ab', // Invalid: too short
        description: 'x'.repeat(101), // Invalid: too long
      };

      expect(() => {
        validateBatchArguments(schemas, data);
      }).toThrow(GraphQLError);
    });

    it('should ignore extra fields in data', () => {
      const schemas = {
        title: Joi.string().required(),
      };

      const data = {
        title: 'Valid',
        extra: 'field',
      };

      const result = validateBatchArguments(schemas, data);

      expect(result).toEqual({ title: 'Valid' });
      expect(result).not.toHaveProperty('extra');
    });
  });

  describe('isNullOrUndefined', () => {
    it('should return true for null', () => {
      expect(isNullOrUndefined(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isNullOrUndefined(undefined)).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isNullOrUndefined(0)).toBe(false);
      expect(isNullOrUndefined('')).toBe(false);
      expect(isNullOrUndefined(false)).toBe(false);
      expect(isNullOrUndefined({})).toBe(false);
    });
  });

  describe('createObjectTypeGuard', () => {
    it('should create a type guard function', () => {
      const guard = createObjectTypeGuard(['name', 'email']);

      expect(guard({ name: 'John', email: 'john@example.com' })).toBe(true);
      expect(guard({ name: 'John' })).toBe(false);
      expect(guard({})).toBe(false);
      expect(guard(null)).toBe(false);
      expect(guard('string')).toBe(false);
    });
  });

  describe('Activity Schema Validation', () => {
    it('should validate activity creation input', () => {
      const data = {
        title: 'Mining Operation',
        type: 'mission',
        description: 'Join us for a mining operation',
      };

      const result = validateGraphQLInput(data, activitySchemas.createV2);

      expect(result.title).toBe('Mining Operation');
      expect(result.type).toBe('mission');
    });

    it('should reject invalid activity type', () => {
      const data = {
        title: 'Valid Title',
        type: 'invalid_type', // Invalid type
      };

      expect(() => {
        validateGraphQLInput(data, activitySchemas.createV2);
      }).toThrow(GraphQLError);
    });

    it('should reject missing required title', () => {
      const data = {
        type: 'mission',
      };

      expect(() => {
        validateGraphQLInput(data, activitySchemas.createV2);
      }).toThrow(GraphQLError);
    });

    it('should reject title that is too short', () => {
      const data = {
        title: 'ab', // Min length is 3
        type: 'mission',
      };

      expect(() => {
        validateGraphQLInput(data, activitySchemas.createV2);
      }).toThrow(GraphQLError);
    });

    it('should reject maxParticipants greater than 100', () => {
      const data = {
        title: 'Valid Activity',
        type: 'mission',
        maxParticipants: 101, // Max is 100
      };

      expect(() => {
        validateGraphQLInput(data, activitySchemas.createV2);
      }).toThrow(GraphQLError);
    });

    it('should allow valid activity update', () => {
      const data = {
        title: 'Updated Title',
        status: 'in_progress',
      };

      const result = validateGraphQLInput(data, activitySchemas.updateV2);

      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('in_progress');
    });

    it('should allow partial update with only some fields', () => {
      const data = {
        title: 'Updated Title Only',
      };

      const result = validateGraphQLInput(data, activitySchemas.updateV2);

      expect(result).toEqual({ title: 'Updated Title Only' });
    });
  });

  describe('Error Logging', () => {
    it('should log validation errors with context', () => {
      const { logger } = require('../../../utils/logger');
      const schema = Joi.object({
        title: Joi.string().min(3).required(),
      });

      const data = { title: 'ab' };

      try {
        validateGraphQLInput(data, schema, { context: 'testContext' });
      } catch {
        // Expected to throw
      }

      expect(logger.warn).toHaveBeenCalledWith(
        'GraphQL input validation failed',
        expect.objectContaining({
          context: 'testContext',
        })
      );
    });
  });
});
