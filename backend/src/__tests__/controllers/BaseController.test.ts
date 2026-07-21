import { Request, Response } from 'express';

import { BaseController } from '../../controllers/BaseController';
import { AuthRequest } from '../../middleware/auth';
import { AssertionHelpers, MockRequest, MockResponse } from '../helpers/testHelpers.helper';

// Test controller extending BaseController
class TestController extends BaseController {
  public async testExecute(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      res.status(200).json({ message: 'success' });
    });
  }

  public async testExecuteAndReturn(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => ({ data: 'test data' }));
  }

  public async testExecuteWithError(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      throw new Error('Test error');
    });
  }

  public async testValidateRequired(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      this.validateRequired(req.body, 'field1', 'field2');
      res.status(200).json({ message: 'validated' });
    });
  }

  public async testGetAuthUser(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      res.status(200).json({ user });
    });
  }

  public async testRequireRole(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      this.requireRole(req, 'admin');
      res.status(200).json({ message: 'authorized' });
    });
  }

  public async testPagination(req: Request, res: Response): Promise<void> {
    await this.executeWithPagination(req, res, async (req, page, limit) => ({
      data: ['item1', 'item2'],
      total: 10,
      page,
      limit,
      totalPages: Math.ceil(10 / limit),
    }));
  }
}

describe('BaseController', () => {
  let controller: TestController;

  beforeEach(() => {
    controller = new TestController();
  });

  describe('execute', () => {
    it('should execute action successfully', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      await controller.testExecute(req, res);

      AssertionHelpers.assertResponse(res, 200, { message: 'success' });
    });

    it('should handle errors in action', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      await controller.testExecuteWithError(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.data).toHaveProperty('success', false);
      expect(res.data.error.message).toContain('Test error');
    });
  });

  describe('executeAndReturn', () => {
    it('should return data with 200 status', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      await controller.testExecuteAndReturn(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual({ data: 'test data' });
    });

    it('should handle errors', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      // Override to throw error
      const errorController = new (class extends BaseController {
        public async test(req: Request, res: Response): Promise<void> {
          await this.executeAndReturn(req, res, async () => {
            throw new Error('Execution failed');
          });
        }
      })();

      await errorController.test(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.data.error.message).toBe('Execution failed');
    });
  });

  describe('validateRequired', () => {
    it('should pass validation when all fields present', async () => {
      const req = MockRequest.create({
        body: { field1: 'value1', field2: 'value2' },
      });
      const res = MockResponse.create() as any;

      await controller.testValidateRequired(req, res);

      AssertionHelpers.assertResponse(res, 200, { message: 'validated' });
    });

    it('should throw ValidationError when fields missing', async () => {
      const req = MockRequest.create({
        body: { field1: 'value1' },
      });
      const res = MockResponse.create() as any;

      await controller.testValidateRequired(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error.message).toContain('field2');
    });
  });

  describe('getAuthUser', () => {
    it('should return authenticated user', async () => {
      const req = MockRequest.createAuth();
      const res = MockResponse.create() as any;

      await controller.testGetAuthUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.user).toHaveProperty('id');
      expect(res.data.user.id).toBe('test-user-id');
    });

    it('should throw UnauthorizedError when no user', async () => {
      const req = MockRequest.create() as AuthRequest;
      const res = MockResponse.create() as any;

      await controller.testGetAuthUser(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error.message).toContain('User not authenticated');
    });
  });

  describe('requireRole', () => {
    it('should pass when user has required role', async () => {
      const req = MockRequest.createAdmin();
      const res = MockResponse.create() as any;

      await controller.testRequireRole(req, res);

      AssertionHelpers.assertResponse(res, 200, { message: 'authorized' });
    });

    it('should throw ForbiddenError when user lacks role', async () => {
      const req = MockRequest.createAuth(); // Regular user
      const res = MockResponse.create() as any;

      await controller.testRequireRole(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error.message).toContain('Insufficient permissions');
    });
  });

  describe('getPaginationParams', () => {
    it('should parse pagination from query', async () => {
      const req = MockRequest.create({
        query: { page: '2', limit: '50' },
      });
      const res = MockResponse.create() as any;

      await controller.testPagination(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.meta.page).toBe(2);
      expect(res.data.meta.limit).toBe(50);
    });

    it('should use defaults when no query params', async () => {
      const req = MockRequest.create({
        query: {},
      });
      const res = MockResponse.create() as any;

      await controller.testPagination(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.meta.page).toBe(1);
      expect(res.data.meta.limit).toBe(20);
    });

    it('should enforce max limit of 100', async () => {
      const req = MockRequest.create({
        query: { page: '1', limit: '500' },
      });
      const res = MockResponse.create() as any;

      await controller.testPagination(req, res);

      expect(res.data.meta.limit).toBe(100);
    });
  });

  describe('handleError', () => {
    it('should handle ValidationError', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      const errorController = new (class extends BaseController {
        public async test(req: Request, res: Response): Promise<void> {
          await this.execute(req, res, async () => {
            const error: any = new Error('Invalid input');
            error.name = 'ValidationError';
            throw error;
          });
        }
      })();

      await errorController.test(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error.message).toBe('Invalid input');
    });

    it('should handle UnauthorizedError', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      const errorController = new (class extends BaseController {
        public async test(req: Request, res: Response): Promise<void> {
          await this.execute(req, res, async () => {
            const error: any = new Error('Not authorized');
            error.name = 'UnauthorizedError';
            throw error;
          });
        }
      })();

      await errorController.test(req, res);

      expect(res.statusCode).toBe(401);
    });

    it('should handle NotFoundError', async () => {
      const req = MockRequest.create();
      const res = MockResponse.create() as any;

      const errorController = new (class extends BaseController {
        public async test(req: Request, res: Response): Promise<void> {
          await this.execute(req, res, async () => {
            const error: any = new Error('Resource not found');
            error.name = 'NotFoundError';
            throw error;
          });
        }
      })();

      await errorController.test(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create properly formatted paginated response', async () => {
      const req = MockRequest.create({
        query: { page: '2', limit: '10' },
      });
      const res = MockResponse.create() as any;

      await controller.testPagination(req, res);

      expect(res.data).toHaveProperty('success', true);
      expect(res.data).toHaveProperty('data');
      expect(res.data).toHaveProperty('meta');
      expect(res.data.meta).toHaveProperty('total');
      expect(res.data.meta).toHaveProperty('page');
      expect(res.data.meta).toHaveProperty('limit');
      expect(res.data.meta).toHaveProperty('totalPages');
      expect(res.data.meta.total).toBe(10);
      expect(res.data.meta.page).toBe(2);
      expect(res.data.meta.totalPages).toBe(1);
    });
  });
});
