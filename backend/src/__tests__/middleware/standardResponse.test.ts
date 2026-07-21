/**
 * Tests for API v2 Standard Response Middleware
 */

import { Request, Response, NextFunction } from 'express';

import { standardResponseMiddleware } from '../../middleware/standardResponse';

describe('Standard Response Middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;

    beforeEach(() => {
        req = {
            id: 'test-request-id'
        };

        jsonSpy = jest.fn();
        statusSpy = jest.fn().mockReturnThis();

        res = {
            json: jsonSpy,
            status: statusSpy
        };

        next = jest.fn();
    });

    it('should add success method to response', () => {
        standardResponseMiddleware(req as Request, res as Response, next);

        expect(res.success).toBeDefined();
        expect(typeof res.success).toBe('function');
        expect(next).toHaveBeenCalled();
    });

    it('should add paginated method to response', () => {
        standardResponseMiddleware(req as Request, res as Response, next);

        expect(res.paginated).toBeDefined();
        expect(typeof res.paginated).toBe('function');
    });

    it('should add error method to response', () => {
        standardResponseMiddleware(req as Request, res as Response, next);

        expect(res.error).toBeDefined();
        expect(typeof res.error).toBe('function');
    });

    describe('res.success', () => {
        beforeEach(() => {
            standardResponseMiddleware(req as Request, res as Response, next);
        });

        it('should return success response with data', () => {
            const data = { id: 1, name: 'test' };
            res.success(data);

            expect(jsonSpy).toHaveBeenCalledWith({
                success: true,
                data,
                meta: expect.objectContaining({
                    requestId: 'test-request-id',
                    timestamp: expect.any(String)
                })
            });
        });

        it('should include additional meta data', () => {
            const data = { id: 1 };
            res.success(data, { pagination: { total: 100, limit: 20, offset: 0, hasMore: true } });

            expect(jsonSpy).toHaveBeenCalledWith({
                success: true,
                data,
                meta: expect.objectContaining({
                    requestId: 'test-request-id',
                    pagination: expect.any(Object)
                })
            });
        });
    });

    describe('res.paginated', () => {
        beforeEach(() => {
            standardResponseMiddleware(req as Request, res as Response, next);
        });

        it('should return paginated response with data and pagination', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const pagination = {
                total: 100,
                limit: 20,
                offset: 0,
                hasMore: true
            };

            res.paginated(data, pagination);

            expect(jsonSpy).toHaveBeenCalledWith({
                success: true,
                data,
                meta: expect.objectContaining({
                    requestId: 'test-request-id',
                    pagination: expect.objectContaining({
                        total: 100,
                        limit: 20,
                        offset: 0,
                        hasMore: true
                    })
                })
            });
        });

        it('should include HATEOAS links when provided', () => {
            const data = [{ id: 1 }];
            const pagination = { total: 100, limit: 20, offset: 0, hasMore: true };
            const links = {
                self: '/api/v2/items?offset=0&limit=20',
                first: '/api/v2/items?offset=0&limit=20',
                next: '/api/v2/items?offset=20&limit=20',
                last: '/api/v2/items?offset=80&limit=20'
            };

            res.paginated(data, pagination, links);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                links
            }));
        });

        it('should calculate legacy pagination fields', () => {
            const data = [{ id: 1 }];
            const pagination = {
                total: 100,
                limit: 20,
                offset: 40,
                hasMore: true
            };

            res.paginated(data, pagination);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.meta.pagination.page).toBe(3); // offset 40, limit 20 = page 3
            expect(response.meta.pagination.totalPages).toBe(5); // 100 / 20 = 5
            expect(response.meta.pagination.hasNext).toBe(true);
            expect(response.meta.pagination.hasPrevious).toBe(true);
        });
    });

    describe('res.error', () => {
        beforeEach(() => {
            standardResponseMiddleware(req as Request, res as Response, next);
        });

        it('should return error response with default status 500', () => {
            res.error('INTERNAL_ERROR', 'Something went wrong');

            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(jsonSpy).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Something went wrong',
                    details: undefined,
                    timestamp: expect.any(String),
                    requestId: 'test-request-id'
                }
            });
        });

        it('should return error with custom status code', () => {
            res.error('NOT_FOUND', 'Resource not found', undefined, 404);

            expect(statusSpy).toHaveBeenCalledWith(404);
        });

        it('should include error details when provided', () => {
            const details = { field: 'email', reason: 'Invalid format' };
            res.error('VALIDATION_ERROR', 'Validation failed', details, 400);

            expect(jsonSpy).toHaveBeenCalledWith({
                success: false,
                error: expect.objectContaining({
                    details
                })
            });
        });
    });
});
