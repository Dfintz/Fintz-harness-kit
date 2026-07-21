/**
 * Tests for API v2 Query Parser Middleware
 */

import { Request, Response, NextFunction } from 'express';

import {
    parseQueryParams,
    buildHateoasLinks,
    selectFields,
    selectFieldsFromArray,
    queryParserMiddleware,
    validateSortField,
    validateFilters
} from '../../middleware/queryParser';

describe('Query Parser Middleware', () => {
    describe('parseQueryParams', () => {
        it('should parse limit and offset with defaults', () => {
            const result = parseQueryParams({});
            
            expect(result.limit).toBe(20);
            expect(result.offset).toBe(0);
        });

        it('should parse limit and offset from query', () => {
            const result = parseQueryParams({ limit: '10', offset: '50' });
            
            expect(result.limit).toBe(10);
            expect(result.offset).toBe(50);
        });

        it('should cap limit at 100', () => {
            const result = parseQueryParams({ limit: '200' });
            
            expect(result.limit).toBe(100);
        });

        it('should not allow limit below 1', () => {
            const result = parseQueryParams({ limit: '-5' });
            
            expect(result.limit).toBe(1);
        });

        it('should convert page to offset for backward compatibility', () => {
            const result = parseQueryParams({ page: '3', limit: '10' });
            
            expect(result.offset).toBe(20); // (3-1) * 10
        });

        it('should parse ascending sort', () => {
            const result = parseQueryParams({ sort: 'createdAt' });
            
            expect(result.sort).toEqual({ field: 'createdAt', order: 'ASC' });
        });

        it('should parse descending sort with - prefix', () => {
            const result = parseQueryParams({ sort: '-createdAt' });
            
            expect(result.sort).toEqual({ field: 'createdAt', order: 'DESC' });
        });

        it('should parse ascending sort with + prefix', () => {
            const result = parseQueryParams({ sort: '+name' });
            
            expect(result.sort).toEqual({ field: 'name', order: 'ASC' });
        });

        it('should parse filter parameters', () => {
            const result = parseQueryParams({
                'filter[status]': 'active',
                'filter[type]': 'mission'
            });
            
            expect(result.filters).toEqual({
                status: 'active',
                type: 'mission'
            });
        });

        it('should parse array filter parameters', () => {
            const result = parseQueryParams({
                'filter[status]': ['active', 'pending']
            });
            
            expect(result.filters).toEqual({
                status: ['active', 'pending']
            });
        });

        it('should parse fields parameter', () => {
            const result = parseQueryParams({ fields: 'id,name,createdAt' });
            
            expect(result.fields).toEqual(['id', 'name', 'createdAt']);
        });

        it('should parse search parameter', () => {
            const result = parseQueryParams({ search: 'test query' });
            
            expect(result.search).toBe('test query');
        });

        it('should handle empty search', () => {
            const result = parseQueryParams({ search: '' });
            
            expect(result.search).toBeNull();
        });
    });

    describe('buildHateoasLinks', () => {
        it('should build correct links for first page', () => {
            const links = buildHateoasLinks('/api/v2/items', 0, 20, 100);
            
            expect(links.self).toBe('/api/v2/items?limit=20&offset=0');
            expect(links.first).toBe('/api/v2/items?limit=20&offset=0');
            expect(links.last).toBe('/api/v2/items?limit=20&offset=80');
            expect(links.next).toBe('/api/v2/items?limit=20&offset=20');
            expect(links.prev).toBeUndefined();
        });

        it('should build correct links for middle page', () => {
            const links = buildHateoasLinks('/api/v2/items', 40, 20, 100);
            
            expect(links.self).toBe('/api/v2/items?limit=20&offset=40');
            expect(links.prev).toBe('/api/v2/items?limit=20&offset=20');
            expect(links.next).toBe('/api/v2/items?limit=20&offset=60');
        });

        it('should build correct links for last page', () => {
            const links = buildHateoasLinks('/api/v2/items', 80, 20, 100);
            
            expect(links.self).toBe('/api/v2/items?limit=20&offset=80');
            expect(links.prev).toBe('/api/v2/items?limit=20&offset=60');
            expect(links.next).toBeUndefined();
        });

        it('should include additional query params', () => {
            const links = buildHateoasLinks('/api/v2/items', 0, 20, 100, { search: 'test' });
            
            expect(links.self).toContain('search=test');
        });
    });

    describe('selectFields', () => {
        it('should return all fields when fields is null', () => {
            const obj = { id: 1, name: 'test', value: 100 };
            const result = selectFields(obj, null);
            
            expect(result).toEqual(obj);
        });

        it('should return only specified fields', () => {
            const obj = { id: 1, name: 'test', value: 100 };
            const result = selectFields(obj, ['id', 'name']);
            
            expect(result).toEqual({ id: 1, name: 'test' });
        });

        it('should ignore non-existent fields', () => {
            const obj = { id: 1, name: 'test' };
            const result = selectFields(obj, ['id', 'nonexistent']);
            
            expect(result).toEqual({ id: 1 });
        });
    });

    describe('selectFieldsFromArray', () => {
        it('should apply field selection to all items', () => {
            const items = [
                { id: 1, name: 'one', value: 100 },
                { id: 2, name: 'two', value: 200 }
            ];
            const result = selectFieldsFromArray(items, ['id', 'name']);
            
            expect(result).toEqual([
                { id: 1, name: 'one' },
                { id: 2, name: 'two' }
            ]);
        });
    });

    describe('validateSortField', () => {
        const allowedFields = ['name', 'createdAt', 'status'];

        it('should return sort if field is allowed', () => {
            const sort = { field: 'name', order: 'ASC' as const };
            const result = validateSortField(sort, allowedFields);
            
            expect(result).toEqual(sort);
        });

        it('should return null if field is not allowed', () => {
            const sort = { field: 'password', order: 'ASC' as const };
            const result = validateSortField(sort, allowedFields);
            
            expect(result).toBeNull();
        });

        it('should return null if sort is null', () => {
            const result = validateSortField(null, allowedFields);
            
            expect(result).toBeNull();
        });
    });

    describe('validateFilters', () => {
        const allowedFields = ['status', 'type', 'name'];

        it('should return only allowed filters', () => {
            const filters = {
                status: 'active',
                type: 'mission',
                password: 'secret'
            };
            const result = validateFilters(filters, allowedFields);
            
            expect(result).toEqual({
                status: 'active',
                type: 'mission'
            });
        });

        it('should return empty object if no filters match', () => {
            const filters = { password: 'secret', email: 'test@test.com' };
            const result = validateFilters(filters, allowedFields);
            
            expect(result).toEqual({});
        });
    });

    describe('queryParserMiddleware', () => {
        it('should attach parsed params to request', () => {
            const req = {
                query: {
                    limit: '10',
                    offset: '20',
                    sort: '-createdAt',
                    search: 'test'
                }
            } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            queryParserMiddleware(req, res, next);

            expect(req.queryParams).toBeDefined();
            expect(req.queryParams?.limit).toBe(10);
            expect(req.queryParams?.offset).toBe(20);
            expect(req.queryParams?.sort).toEqual({ field: 'createdAt', order: 'DESC' });
            expect(req.queryParams?.search).toBe('test');
            expect(next).toHaveBeenCalled();
        });
    });
});
