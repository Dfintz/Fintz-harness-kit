/**
 * Unit tests for Prototype Pollution Prevention utilities
 * Tests protection against CWE-1321
 */

import {
  isSafeKey,
  safeAssign,
  safeSetProperty,
  sanitizeObject,
  sanitizeQueryParams,
} from '../prototypePollutionPrevention';

describe('Prototype Pollution Prevention', () => {
  describe('isSafeKey', () => {
    it('should allow safe property names', () => {
      expect(isSafeKey('name')).toBe(true);
      expect(isSafeKey('id')).toBe(true);
      expect(isSafeKey('fleetId')).toBe(true);
      expect(isSafeKey('category')).toBe(true);
    });

    it('should block __proto__', () => {
      expect(isSafeKey('__proto__')).toBe(false);
      expect(isSafeKey('__PROTO__')).toBe(false);
      expect(isSafeKey('__ProTo__')).toBe(false);
    });

    it('should block constructor', () => {
      expect(isSafeKey('constructor')).toBe(false);
      expect(isSafeKey('CONSTRUCTOR')).toBe(false);
      expect(isSafeKey('Constructor')).toBe(false);
    });

    it('should block prototype', () => {
      expect(isSafeKey('prototype')).toBe(false);
      expect(isSafeKey('PROTOTYPE')).toBe(false);
      expect(isSafeKey('Prototype')).toBe(false);
    });

    it('should allow symbols', () => {
      const sym = Symbol('test');
      expect(isSafeKey(sym)).toBe(true);
    });
  });

  describe('safeAssign', () => {
    it('should safely assign normal properties', () => {
      const target: Record<string, any> = {};
      const source = { name: 'Test', value: 42 };

      safeAssign(target, source);

      expect(target.name).toBe('Test');
      expect(target.value).toBe(42);
    });

    it('should block __proto__ pollution', () => {
      const target: Record<string, any> = {};
      const source: Record<string, any> = { name: 'Test' };
      source['__proto__'] = { polluted: true };

      safeAssign(target, source);

      expect(target.name).toBe('Test');
      expect((target as any).polluted).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should block constructor pollution', () => {
      const target: Record<string, any> = {};
      const source: Record<string, any> = {
        name: 'Test',
        constructor: { prototype: { polluted: true } },
      };

      safeAssign(target, source);

      expect(target.name).toBe('Test');
      expect(target.constructor).not.toBe(source.constructor);
    });

    it('should block prototype pollution', () => {
      const target: Record<string, any> = {};
      const source: Record<string, any> = {
        name: 'Test',
        prototype: { polluted: true },
      };

      safeAssign(target, source);

      expect(target.name).toBe('Test');
      expect(target.prototype).toBeUndefined();
    });

    it('should handle null and undefined sources', () => {
      const target: Record<string, any> = { existing: 'value' };

      safeAssign(target, null);
      expect(target.existing).toBe('value');

      safeAssign(target, undefined);
      expect(target.existing).toBe('value');
    });

    it('should only assign own properties', () => {
      const proto = { inherited: 'value' };
      const source = Object.create(proto);
      source.own = 'ownValue';

      const target: Record<string, any> = {};
      safeAssign(target, source);

      expect(target.own).toBe('ownValue');
      expect(target.inherited).toBeUndefined();
    });
  });

  describe('sanitizeObject', () => {
    it('should create safe object from user input', () => {
      const input = {
        name: 'Test',
        value: 42,
        __proto__: { polluted: true },
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('Test');
      expect(result.value).toBe(42);
      expect((result as any).__proto__).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should respect allowed keys whitelist', () => {
      const input = {
        name: 'Test',
        value: 42,
        secret: 'hidden',
      };

      const result = sanitizeObject(input, ['name', 'value']);

      expect(result.name).toBe('Test');
      expect(result.value).toBe(42);
      expect((result as any).secret).toBeUndefined();
    });

    it('should filter out undefined values', () => {
      const input = {
        name: 'Test',
        value: undefined,
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('Test');
      expect('value' in result).toBe(false);
    });

    it('should handle null and undefined input', () => {
      expect(sanitizeObject(null)).toEqual({});
      expect(sanitizeObject(undefined)).toEqual({});
    });
  });

  describe('safeSetProperty', () => {
    it('should set safe properties', () => {
      const obj: Record<string, any> = {};

      expect(safeSetProperty(obj, 'name', 'Test')).toBe(true);
      expect(obj.name).toBe('Test');
    });

    it('should block __proto__ property', () => {
      const obj: Record<string, any> = {};

      expect(safeSetProperty(obj, '__proto__', { polluted: true })).toBe(false);
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should block constructor property', () => {
      const obj: Record<string, any> = {};

      expect(safeSetProperty(obj, 'constructor', { evil: true })).toBe(false);
      expect((obj as any).evil).toBeUndefined();
    });

    it('should block prototype property', () => {
      const obj: Record<string, any> = {};

      expect(safeSetProperty(obj, 'prototype', { evil: true })).toBe(false);
      expect((obj as any).evil).toBeUndefined();
    });
  });

  describe('sanitizeQueryParams', () => {
    it('should extract and type-cast query parameters safely', () => {
      const query = {
        fleetId: 'fleet-123',
        category: 'weapons',
        lowStockOnly: 'true',
        limit: '10',
        __proto__: { polluted: true },
      };

      const result = sanitizeQueryParams(query, {
        fleetId: 'string',
        category: 'string',
        lowStockOnly: 'boolean',
        limit: 'number',
      });

      expect(result.fleetId).toBe('fleet-123');
      expect(result.category).toBe('weapons');
      expect(result.lowStockOnly).toBe(true);
      expect(result.limit).toBe(10);
      expect((result as any).__proto__).toBeUndefined();
    });

    it('should handle boolean parameters', () => {
      const query = {
        enabled: 'true',
        disabled: 'false',
        alsoTrue: true,
        alsoFalse: false,
      };

      const result = sanitizeQueryParams(query, {
        enabled: 'boolean',
        disabled: 'boolean',
        alsoTrue: 'boolean',
        alsoFalse: 'boolean',
      });

      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
      expect(result.alsoTrue).toBe(true);
      expect(result.alsoFalse).toBe(false);
    });

    it('should handle number parameters', () => {
      const query = {
        count: '42',
        price: '19.99',
        invalid: 'not-a-number',
      };

      const result = sanitizeQueryParams(query, {
        count: 'number',
        price: 'number',
        invalid: 'number',
      });

      expect(result.count).toBe(42);
      expect(result.price).toBe(19.99);
      expect((result as any).invalid).toBeUndefined();
    });

    it('should handle array parameters', () => {
      const query = {
        tags: ['tag1', 'tag2', 'tag3'],
        single: 'value',
      };

      const result = sanitizeQueryParams(query, {
        tags: 'array',
        single: 'array',
      });

      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(result.single).toEqual(['value']);
    });

    it('should ignore parameters not in schema', () => {
      const query = {
        allowed: 'value',
        notAllowed: 'secret',
        __proto__: { evil: true },
      };

      const result = sanitizeQueryParams(query, {
        allowed: 'string',
      });

      expect(result.allowed).toBe('value');
      expect((result as any).notAllowed).toBeUndefined();
      expect((result as any).__proto__).toBeUndefined();
    });
  });

  describe('Real-world attack scenarios', () => {
    it('should prevent prototype pollution via JSON payload', () => {
      // Simulate parsing JSON with __proto__
      const maliciousPayload = JSON.parse('{"name":"test","__proto__":{"polluted":true}}');

      const safeObject = sanitizeObject(maliciousPayload);

      expect(safeObject.name).toBe('test');
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should prevent pollution via query string', () => {
      // Simulate query string: ?fleetId=123&__proto__[polluted]=true
      const query = {
        fleetId: '123',
        __proto__: { polluted: true },
      };

      const result = sanitizeQueryParams(query, {
        fleetId: 'string',
      });

      expect(result.fleetId).toBe('123');
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should prevent pollution via nested constructor', () => {
      const target: Record<string, any> = {};
      const malicious = {
        name: 'test',
        constructor: {
          prototype: {
            polluted: true,
          },
        },
      };

      safeAssign(target, malicious);

      expect(target.name).toBe('test');
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
