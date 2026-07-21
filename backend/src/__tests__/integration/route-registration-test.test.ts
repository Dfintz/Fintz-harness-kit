// Test to see if routes are registered on the router
import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', username: 'testuser', role: 'admin' };
    next();
  }),
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', username: 'testuser', role: 'admin' };
    next();
  }),
  generateToken: jest.fn(() => 'mock-jwt-token'),
}));

describe('Route Registration', () => {
  it('should have POST /organizations route registered', async () => {
    const organizationRouter = (await import('../../routes/organizationRoutes')).default;

    // Check if router has any stack
    expect(organizationRouter.stack).toBeDefined();
    expect(organizationRouter.stack.length).toBeGreaterThan(0);

    // Find POST /organizations route
    const postOrgRoute = organizationRouter.stack.find(
      (layer: any) => layer.route?.path === '/organizations' && layer.route.methods.post
    );

    expect(postOrgRoute).toBeDefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
