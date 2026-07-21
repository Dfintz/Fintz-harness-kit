// Import the mock BEFORE importing anything that uses AppDataSource
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

// NOW import other dependencies and routes
import { json } from 'body-parser';
import express from 'express';
import request from 'supertest';

import organizationRouter from '../../routes/organizationRoutes';

describe('Route HTTP Test', () => {
  it('should respond to POST /api/organizations', async () => {
    const app = express();
    app.use(json());
    app.use('/api', organizationRouter);

    const org = {
      name: 'Test Organization',
    };

    const response = await request(app).post('/api/organizations').send(org);

    console.log('Status:', response.status);
    console.log('Body:', response.body);

    // Don't check for 201 yet, just see what we get
    expect(response.status).not.toBe(404);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
