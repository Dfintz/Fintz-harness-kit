import { Request } from 'express';

import { extractPaginationOptions, paginateArray, PaginationOptions } from '../../utils/pagination';

describe('Pagination Utility', () => {
    describe('extractPaginationOptions', () => {
        it('should extract default pagination options when no query params provided', () => {
            const req = {
                query: {}
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.page).toBe(1);
            expect(options.limit).toBe(20);
            expect(options.sortOrder).toBe('ASC');
        });

        it('should extract custom pagination options from query params', () => {
            const req = {
                query: {
                    page: '3',
                    limit: '25',
                    sortBy: 'title',
                    sortOrder: 'DESC'
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.page).toBe(3);
            expect(options.limit).toBe(25);
            expect(options.sortBy).toBe('title');
            expect(options.sortOrder).toBe('DESC');
        });

        it('should enforce maximum limit of 100', () => {
            const req = {
                query: {
                    limit: '200'
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.limit).toBe(100);
        });

        it('should enforce minimum page of 1', () => {
            const req = {
                query: {
                    page: '-5'
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.page).toBe(1);
        });

        it('should fall back to default limit for non-positive values', () => {
            const req = {
                query: {
                    limit: '0'
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.limit).toBe(20);
        });

        it('should default sortOrder to ASC for invalid values', () => {
            const req = {
                query: {
                    sortOrder: 'INVALID'
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.sortOrder).toBe('ASC');
        });

        it('should handle numeric query params from Joi convert: true', () => {
            const req = {
                query: {
                    page: 3,
                    limit: 50,
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.page).toBe(3);
            expect(options.limit).toBe(50);
        });

        it('should handle mixed string and numeric query params', () => {
            const req = {
                query: {
                    page: 2,
                    limit: '25',
                }
            } as unknown as Request;

            const options = extractPaginationOptions(req);

            expect(options.page).toBe(2);
            expect(options.limit).toBe(25);
        });
    });

    describe('paginateArray', () => {
        const testData = [
            { id: 1, name: 'Item 1', value: 10 },
            { id: 2, name: 'Item 2', value: 20 },
            { id: 3, name: 'Item 3', value: 30 },
            { id: 4, name: 'Item 4', value: 40 },
            { id: 5, name: 'Item 5', value: 50 },
            { id: 6, name: 'Item 6', value: 60 },
            { id: 7, name: 'Item 7', value: 70 },
            { id: 8, name: 'Item 8', value: 80 },
            { id: 9, name: 'Item 9', value: 90 },
            { id: 10, name: 'Item 10', value: 100 },
        ];

        it('should paginate array with default options', () => {
            const options: PaginationOptions = { page: 1, limit: 5 };
            const result = paginateArray(testData, options);

            expect(result.data.length).toBe(5);
            expect(result.data[0].id).toBe(1);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(5);
            expect(result.pagination.total).toBe(10);
            expect(result.pagination.totalPages).toBe(2);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(false);
        });

        it('should paginate to second page', () => {
            const options: PaginationOptions = { page: 2, limit: 5 };
            const result = paginateArray(testData, options);

            expect(result.data.length).toBe(5);
            expect(result.data[0].id).toBe(6);
            expect(result.pagination.page).toBe(2);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(true);
        });

        it('should handle last page with fewer items', () => {
            const options: PaginationOptions = { page: 3, limit: 4 };
            const result = paginateArray(testData, options);

            expect(result.data.length).toBe(2);
            expect(result.data[0].id).toBe(9);
            expect(result.pagination.totalPages).toBe(3);
        });

        it('should return empty array for out of range page', () => {
            const options: PaginationOptions = { page: 10, limit: 5 };
            const result = paginateArray(testData, options);

            expect(result.data.length).toBe(0);
            expect(result.pagination.hasNext).toBe(false);
        });

        it('should apply custom sort function', () => {
            const options: PaginationOptions = { page: 1, limit: 5 };
            const sortFunction = (a: typeof testData[0], b: typeof testData[0]) => b.value - a.value;
            const result = paginateArray(testData, options, sortFunction);

            expect(result.data[0].id).toBe(10); // Highest value first
            expect(result.data[0].value).toBe(100);
            expect(result.data[4].id).toBe(6);
        });

        it('should handle empty array', () => {
            const options: PaginationOptions = { page: 1, limit: 10 };
            const result = paginateArray([], options);

            expect(result.data.length).toBe(0);
            expect(result.pagination.total).toBe(0);
            expect(result.pagination.totalPages).toBe(0);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(false);
        });

        it('should handle single page of data', () => {
            const smallData = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const options: PaginationOptions = { page: 1, limit: 10 };
            const result = paginateArray(smallData, options);

            expect(result.data.length).toBe(3);
            expect(result.pagination.totalPages).toBe(1);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(false);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
