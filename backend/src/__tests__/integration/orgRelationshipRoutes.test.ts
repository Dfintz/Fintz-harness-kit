// Import the mock BEFORE importing anything that uses AppDataSource
import { mockAppDataSource } from '../helpers/database-mock';

// Mock database config to use our global mock
jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock data-source as well
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

// NOW import other dependencies and routes
import { json } from 'body-parser';
import express from 'express';
import request from 'supertest';

import { generateToken } from '../../middleware/auth';
import orgRelationshipRoutes from '../../routes/orgRelationshipRoutes';

describe('Organization Relationship Routes Integration Tests', () => {
  let app: express.Application;
  let authToken: string;

  beforeAll(() => {
    app = express();
    app.use(json());
    app.use('/api', orgRelationshipRoutes);

    // Generate auth token for tests
    authToken = generateToken({ id: 'test-user', username: 'testuser', role: 'admin' });
  });

  describe('POST /api/orgs/relationships', () => {
    it('should create a new organization relationship', async () => {
      const newRelationship = {
        orgId: 'org-1',
        targetOrgId: 'org-2',
        relationship: 'allied',
      };

      const response = await request(app)
        .post('/api/orgs/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newRelationship)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Relationship updated successfully');
    });

    it('should update an existing relationship', async () => {
      const relationship = {
        orgId: 'org-1',
        targetOrgId: 'org-2',
        relationship: 'hostile',
      };

      const response = await request(app)
        .post('/api/orgs/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send(relationship)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Relationship updated successfully');
    });

    it('should return 400 for invalid input', async () => {
      const invalidRelationship = {
        orgId: 'org-1',
        // missing targetOrgId and relationship
      };

      const response = await request(app)
        .post('/api/orgs/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRelationship)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Validation error');
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/orgs/:orgId/relationships', () => {
    it('should retrieve relationships for an organization', async () => {
      // First create a relationship
      const newRelationship = {
        orgId: 'org-3',
        targetOrgId: 'org-4',
        relationship: 'neutral',
      };

      await request(app)
        .post('/api/orgs/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newRelationship);

      // Then retrieve it
      const response = await request(app)
        .get('/api/orgs/org-3/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('orgId', 'org-3');
    });

    it('should return empty array if no relationships exist', async () => {
      const response = await request(app)
        .get('/api/orgs/nonexistent/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
