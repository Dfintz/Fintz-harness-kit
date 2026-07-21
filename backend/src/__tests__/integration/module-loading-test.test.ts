// Test to see if route modules load correctly
import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock auth middleware to avoid AuthenticationService instantiation during import
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

describe('Route Module Loading', () => {
  it('should load organizationRouter without errors', async () => {
    const organizationRouter = await import('../../routes/organizationRoutes');
    expect(organizationRouter.default).toBeDefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
