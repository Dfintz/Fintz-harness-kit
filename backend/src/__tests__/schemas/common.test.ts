/**
 * Tests for the shared pagination primitives in `schemas/common.ts`.
 *
 * `paginationKeysWith(limitDefault, maxLimit)` is the single source of truth
 * for page-based `{ page, limit }` query validation. These tests lock in the
 * defaults/limits so the domain schemas that spread it stay behavior-identical
 * to the inline `page`/`limit` pairs they replaced.
 */
import Joi from 'joi';

import {
  pageSizeKeysWith,
  pagination,
  paginationKeys,
  paginationKeysWith,
} from '../../schemas/common';

describe('common pagination schemas', () => {
  describe('paginationKeysWith() — default (20, 100)', () => {
    const schema = Joi.object(paginationKeysWith());

    it('applies defaults page=1, limit=20 when omitted', () => {
      const { error, value } = schema.validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({ page: 1, limit: 20 });
    });

    it('coerces numeric strings to integers', () => {
      const { error, value } = schema.validate({ page: '3', limit: '50' });
      expect(error).toBeUndefined();
      expect(value).toEqual({ page: 3, limit: 50 });
    });

    it('rejects page < 1', () => {
      expect(schema.validate({ page: 0 }).error).toBeDefined();
    });

    it('rejects limit < 1', () => {
      expect(schema.validate({ limit: 0 }).error).toBeDefined();
    });

    it('rejects limit above the default max of 100', () => {
      expect(schema.validate({ limit: 100 }).error).toBeUndefined();
      expect(schema.validate({ limit: 101 }).error).toBeDefined();
    });

    it('rejects non-integer page/limit', () => {
      expect(schema.validate({ page: 1.5 }).error).toBeDefined();
      expect(schema.validate({ limit: 2.5 }).error).toBeDefined();
    });
  });

  describe('paginationKeysWith(limitDefault)', () => {
    it('honors a custom limit default (10)', () => {
      const { error, value } = Joi.object(paginationKeysWith(10)).validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({ page: 1, limit: 10 });
    });

    it('honors a custom limit default (25)', () => {
      const { value } = Joi.object(paginationKeysWith(25)).validate({});
      expect(value).toEqual({ page: 1, limit: 25 });
    });

    it('still enforces the default max of 100 when only the default changes', () => {
      const schema = Joi.object(paginationKeysWith(10));
      expect(schema.validate({ limit: 100 }).error).toBeUndefined();
      expect(schema.validate({ limit: 101 }).error).toBeDefined();
    });
  });

  describe('paginationKeysWith(limitDefault, maxLimit)', () => {
    it('honors a custom max limit (500)', () => {
      const schema = Joi.object(paginationKeysWith(25, 500));
      expect(schema.validate({}).value).toEqual({ page: 1, limit: 25 });
      expect(schema.validate({ limit: 500 }).error).toBeUndefined();
      expect(schema.validate({ limit: 501 }).error).toBeDefined();
    });
  });

  describe('named exports (default-20 convenience)', () => {
    it('paginationKeys equals paginationKeysWith(20)', () => {
      const { value } = Joi.object(paginationKeys).validate({});
      expect(value).toEqual({ page: 1, limit: 20 });
    });

    it('pagination (Joi.object) validates with the default-20 shape', () => {
      const { error, value } = pagination.validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({ page: 1, limit: 20 });
    });
  });

  describe('pageSizeKeysWith() — page + pageSize variant', () => {
    it('applies defaults page=1, pageSize=20 when omitted', () => {
      const { error, value } = Joi.object(pageSizeKeysWith()).validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({ page: 1, pageSize: 20 });
    });

    it('honors a custom pageSize default (25)', () => {
      const { value } = Joi.object(pageSizeKeysWith(25)).validate({});
      expect(value).toEqual({ page: 1, pageSize: 25 });
    });

    it('emits a `pageSize` key (not `limit`)', () => {
      const { value } = Joi.object(pageSizeKeysWith(25)).validate({ pageSize: 40 });
      expect(value).toHaveProperty('pageSize', 40);
      expect(value).not.toHaveProperty('limit');
    });

    it('coerces numeric strings and enforces bounds', () => {
      const schema = Joi.object(pageSizeKeysWith(20));
      expect(schema.validate({ page: '2', pageSize: '50' }).value).toEqual({
        page: 2,
        pageSize: 50,
      });
      expect(schema.validate({ pageSize: 0 }).error).toBeDefined();
      expect(schema.validate({ pageSize: 100 }).error).toBeUndefined();
      expect(schema.validate({ pageSize: 101 }).error).toBeDefined();
    });

    it('honors a custom max page size', () => {
      const schema = Joi.object(pageSizeKeysWith(20, 200));
      expect(schema.validate({ pageSize: 200 }).error).toBeUndefined();
      expect(schema.validate({ pageSize: 201 }).error).toBeDefined();
    });
  });
});
