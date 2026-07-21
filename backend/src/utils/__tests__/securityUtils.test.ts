/**
 * Tests for Security Utilities
 */

import { sanitizeObject, sanitizeQueryParams } from '../securityUtils';

describe('Security Utilities', () => {
  describe('sanitizeQueryParams', () => {
    it('should redact sensitive query parameters', () => {
      const query = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        apikey: 'key123',
        api_key: 'key456',
      };

      const result = sanitizeQueryParams(query);

      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        token: '[REDACTED]',
        apikey: '[REDACTED]',
        api_key: '[REDACTED]',
      });
    });

    it('should handle case-insensitive matching', () => {
      const query = {
        PASSWORD: 'secret',
        Token: 'abc',
        ApiKey: 'key',
      };

      const result = sanitizeQueryParams(query);

      expect(result.PASSWORD).toBe('[REDACTED]');
      expect(result.Token).toBe('[REDACTED]');
      expect(result.ApiKey).toBe('[REDACTED]');
    });

    it('should redact parameters containing sensitive terms', () => {
      const query = {
        user_password: 'secret',
        access_token: 'abc',
        my_secret: 'xyz',
        auth_key: '123',
      };

      const result = sanitizeQueryParams(query);

      expect(result.user_password).toBe('[REDACTED]');
      expect(result.access_token).toBe('[REDACTED]');
      expect(result.my_secret).toBe('[REDACTED]');
      expect(result.auth_key).toBe('[REDACTED]');
    });

    it('should not redact non-sensitive parameters', () => {
      const query = {
        page: '1',
        limit: '10',
        sort: 'name',
        filter: 'active',
      };

      const result = sanitizeQueryParams(query);

      expect(result).toEqual(query);
    });

    it('should handle empty query object', () => {
      const result = sanitizeQueryParams({});
      expect(result).toEqual({});
    });

    it('should handle null or undefined input', () => {
      expect(sanitizeQueryParams(null)).toEqual({});
      expect(sanitizeQueryParams(undefined)).toEqual({});
    });

    it('should handle non-object input', () => {
      expect(sanitizeQueryParams('string')).toEqual({});
      expect(sanitizeQueryParams(123)).toEqual({});
    });
  });

  describe('sanitizeObject', () => {
    it('should redact sensitive fields with default sensitive list', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        secret: 'xyz789',
        key: 'key123',
        Authorization: 'Bearer test-token',
        api_key: 'uex-secret',
      };

      const result = sanitizeObject(obj);

      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        key: '[REDACTED]',
        Authorization: '[REDACTED]',
        api_key: '[REDACTED]',
      });
    });

    it('should use case-insensitive partial matching', () => {
      const obj = {
        PASSWORD: 'secret',
        AccessToken: 'abc',
        apiKey: 'key',
        mySecret: 'xyz',
      };

      const result = sanitizeObject(obj);

      expect(result.PASSWORD).toBe('[REDACTED]');
      expect(result.AccessToken).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.mySecret).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'john',
          password: 'secret',
          credentials: {
            token: 'abc123',
            apiKey: 'key456',
          },
        },
        metadata: {
          timestamp: '2024-01-01',
        },
      };

      const result = sanitizeObject(obj);

      expect(result.user.name).toBe('john');
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.user.credentials.token).toBe('[REDACTED]');
      expect(result.user.credentials.apiKey).toBe('[REDACTED]');
      expect(result.metadata.timestamp).toBe('2024-01-01');
    });

    it('should handle arrays of objects', () => {
      const obj = {
        users: [
          { name: 'john', password: 'secret1' },
          { name: 'jane', token: 'abc123' },
        ],
        metadata: {
          count: 2,
        },
      };

      const result = sanitizeObject(obj);

      expect(result.users[0].name).toBe('john');
      expect(result.users[0].password).toBe('[REDACTED]');
      expect(result.users[1].name).toBe('jane');
      expect(result.users[1].token).toBe('[REDACTED]');
      expect(result.metadata.count).toBe(2);
    });

    it('should handle arrays of primitives', () => {
      const obj = {
        tags: ['public', 'featured'],
        ids: [1, 2, 3],
      };

      const result = sanitizeObject(obj);

      expect(result.tags).toEqual(['public', 'featured']);
      expect(result.ids).toEqual([1, 2, 3]);
    });

    it('should handle custom sensitive fields', () => {
      const obj = {
        username: 'john',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        email: 'john@example.com',
      };

      const result = sanitizeObject(obj, ['ssn', 'creditCard']);

      expect(result.username).toBe('john');
      expect(result.ssn).toBe('[REDACTED]');
      expect(result.creditCard).toBe('[REDACTED]');
      expect(result.email).toBe('john@example.com');
    });

    it('should handle null and undefined values', () => {
      const obj = {
        name: 'john',
        password: null,
        token: undefined,
      };

      const result = sanitizeObject(obj);

      expect(result.name).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should handle empty objects', () => {
      const result = sanitizeObject({});
      expect(result).toEqual({});
    });

    it('should handle deeply nested structures', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              data: 'public',
            },
          },
        },
      };

      const result = sanitizeObject(obj);

      expect(result.level1.level2.level3.password).toBe('[REDACTED]');
      expect(result.level1.level2.level3.data).toBe('public');
    });

    it('should handle mixed arrays and objects', () => {
      const obj = {
        items: [
          { id: 1, secret: 'xyz' },
          { id: 2, data: 'public' },
        ],
        nested: {
          array: [{ token: 'abc' }, 'string', 123],
        },
      };

      const result = sanitizeObject(obj);

      expect(result.items[0].secret).toBe('[REDACTED]');
      expect(result.items[1].data).toBe('public');
      expect(result.nested.array[0].token).toBe('[REDACTED]');
      expect(result.nested.array[1]).toBe('string');
      expect(result.nested.array[2]).toBe(123);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
