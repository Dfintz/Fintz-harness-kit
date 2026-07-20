/**
 * Base Service Tests
 * Tests for the abstract BaseService class and helper functions
 */

import { ApiClientError } from '@/services/apiClient';
import { BaseService, extractData, extractPaginatedData } from '@/services/baseService';

// Concrete implementation for testing
class TestService extends BaseService {
  protected basePath = '/api/v2/test';

  // Expose protected methods for testing
  public testBuildUrl(path: string, params?: Record<string, string | number>): string {
    return this.buildUrl(path, params);
  }

  public testBuildQueryString(params?: Record<string, any>): string {
    return this.buildQueryString(params);
  }

  public testGetPaginationParams(params?: any) {
    return this.getPaginationParams(params);
  }

  public testHandleError(error: any, context: string): never {
    return this.handleError(error, context);
  }

  public testLog(action: string, data?: any): void {
    return this.log(action, data);
  }
}

describe('BaseService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildUrl', () => {
    it('should return path as-is when no params provided', () => {
      const result = service.testBuildUrl('/api/v2/users');
      expect(result).toBe('/api/v2/users');
    });

    it('should replace single path parameter', () => {
      const result = service.testBuildUrl('/api/v2/users/:id', { id: 123 });
      expect(result).toBe('/api/v2/users/123');
    });

    it('should replace multiple path parameters', () => {
      const result = service.testBuildUrl('/api/v2/orgs/:orgId/users/:userId', {
        orgId: 'org1',
        userId: 'user1',
      });
      expect(result).toBe('/api/v2/orgs/org1/users/user1');
    });

    it('should handle numeric parameters', () => {
      const result = service.testBuildUrl('/api/v2/items/:id', { id: 456 });
      expect(result).toBe('/api/v2/items/456');
    });

    it('should handle mixed string and numeric parameters', () => {
      const result = service.testBuildUrl('/api/v2/:type/:id', {
        type: 'fleet',
        id: 789,
      });
      expect(result).toBe('/api/v2/fleet/789');
    });

    it('should not replace parameters that do not match', () => {
      const result = service.testBuildUrl('/api/v2/users/:id', { name: 'test' });
      expect(result).toBe('/api/v2/users/:id');
    });
  });

  describe('buildQueryString', () => {
    it('should return empty string when no params provided', () => {
      const result = service.testBuildQueryString();
      expect(result).toBe('');
    });

    it('should return empty string for empty params object', () => {
      const result = service.testBuildQueryString({});
      expect(result).toBe('');
    });

    it('should build query string with single parameter', () => {
      const result = service.testBuildQueryString({ name: 'test' });
      expect(result).toBe('?name=test');
    });

    it('should build query string with multiple parameters', () => {
      const result = service.testBuildQueryString({
        name: 'test',
        page: 1,
        limit: 20,
      });
      expect(result).toBe('?name=test&page=1&limit=20');
    });

    it('should skip undefined values', () => {
      const result = service.testBuildQueryString({
        name: 'test',
        age: undefined,
        city: 'NYC',
      });
      expect(result).toBe('?name=test&city=NYC');
    });

    it('should skip null values', () => {
      const result = service.testBuildQueryString({
        name: 'test',
        age: null,
        city: 'NYC',
      });
      expect(result).toBe('?name=test&city=NYC');
    });

    it('should include zero values', () => {
      const result = service.testBuildQueryString({
        count: 0,
        active: true,
      });
      expect(result).toContain('count=0');
      expect(result).toContain('active=true');
    });

    it('should URL encode special characters', () => {
      const result = service.testBuildQueryString({
        search: 'hello world',
        filter: 'type=test',
      });
      expect(result).toContain('hello+world');
    });

    it('should handle boolean values', () => {
      const result = service.testBuildQueryString({
        active: true,
        deleted: false,
      });
      expect(result).toContain('active=true');
      expect(result).toContain('deleted=false');
    });

    it('should convert numbers to strings', () => {
      const result = service.testBuildQueryString({
        page: 5,
        limit: 100,
      });
      expect(result).toContain('page=5');
      expect(result).toContain('limit=100');
    });
  });

  describe('getPaginationParams', () => {
    it('should return defaults when no params provided', () => {
      const result = service.testGetPaginationParams();
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should return defaults for empty params object', () => {
      const result = service.testGetPaginationParams({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should use provided page', () => {
      const result = service.testGetPaginationParams({ page: 3 });
      expect(result).toEqual({ page: 3, limit: 20 });
    });

    it('should use provided limit', () => {
      const result = service.testGetPaginationParams({ limit: 50 });
      expect(result).toEqual({ page: 1, limit: 50 });
    });

    it('should use both provided page and limit', () => {
      const result = service.testGetPaginationParams({ page: 5, limit: 100 });
      expect(result).toEqual({ page: 5, limit: 100 });
    });

    it('should ignore other parameters', () => {
      const result = service.testGetPaginationParams({
        page: 2,
        limit: 30,
        sort: 'name',
        filter: 'active',
      });
      expect(result).toEqual({ page: 2, limit: 30 });
    });
  });

  describe('handleError', () => {
    it('should log and rethrow ApiClientError', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const apiError = new ApiClientError('Resource not found', 'NOT_FOUND', 404, 'req-123', {
        resource: 'user',
      });

      expect(() => {
        service.testHandleError(apiError, 'TestContext');
      }).toThrow(apiError);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('TestContext');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('API Error');

      consoleErrorSpy.mockRestore();
    });

    it('should handle generic Error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Something went wrong');

      expect(() => {
        service.testHandleError(error, 'TestContext');
      }).toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('TestContext');

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error objects', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = { message: 'Unknown error' };

      expect(() => {
        service.testHandleError(error, 'TestContext');
      }).toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('TestContext');

      consoleErrorSpy.mockRestore();
    });

    it('should include context in error log', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');

      try {
        service.testHandleError(error, 'CustomContext');
      } catch (e) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('CustomContext');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('log', () => {
    it('should log in development mode', () => {
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      service.testLog('TestAction', { id: 123 });

      // Only check if DEV is explicitly true (Jest may not set this)
      if (import.meta.env.DEV === true) {
        expect(consoleDebugSpy).toHaveBeenCalled();
      } else {
        // In non-DEV mode, should not log
        expect(consoleDebugSpy).not.toHaveBeenCalled();
      }

      consoleDebugSpy.mockRestore();
    });

    it('should log action without data', () => {
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      service.testLog('TestAction');

      if (import.meta.env.DEV === true) {
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining('[TestService] TestAction'),
          ''
        );
      } else {
        expect(consoleDebugSpy).not.toHaveBeenCalled();
      }

      consoleDebugSpy.mockRestore();
    });

    it('should include service name in log', () => {
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      service.testLog('FetchUsers', { count: 10 });

      if (import.meta.env.DEV === true) {
        expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('TestService'), {
          count: 10,
        });
      } else {
        expect(consoleDebugSpy).not.toHaveBeenCalled();
      }

      consoleDebugSpy.mockRestore();
    });
  });
});

describe('Helper Functions', () => {
  describe('extractData', () => {
    it('should extract data from response', () => {
      const response = {
        data: { id: 1, name: 'Test' },
      };

      const result = extractData(response);

      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should handle array data', () => {
      const response = {
        data: [1, 2, 3, 4, 5],
      };

      const result = extractData(response);

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle primitive data', () => {
      const response = {
        data: 'success',
      };

      const result = extractData(response);

      expect(result).toBe('success');
    });

    it('should handle null data', () => {
      const response = {
        data: null,
      };

      const result = extractData(response);

      expect(result).toBeNull();
    });
  });

  describe('extractPaginatedData', () => {
    it('should extract items and pagination', () => {
      const response = {
        data: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 100,
            totalPages: 5,
            hasNext: true,
            hasPrevious: false,
          },
        },
      };

      const result = extractPaginatedData(response);

      expect(result).toEqual({
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrevious: false,
        },
      });
    });

    it('should handle empty items', () => {
      const response = {
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        },
      };

      const result = extractPaginatedData(response);

      expect(result).toEqual({
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });
    });

    it('should preserve all pagination metadata', () => {
      const response = {
        data: [{ id: 1 }],
        meta: {
          pagination: {
            page: 2,
            limit: 50,
            total: 250,
            totalPages: 5,
            hasNext: true,
            hasPrevious: true,
          },
        },
      };

      const result = extractPaginatedData(response);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 50,
        total: 250,
        totalPages: 5,
        hasNext: true,
        hasPrevious: true,
      });
    });
  });
});
