/**
 * Integration tests for public directory federations route
 * Tests GET /api/directory/federations endpoint
 */
import { json } from 'body-parser';
import express from 'express';
import request from 'supertest';

// Mock the OrganizationFederationService BEFORE importing routes
const mockGetPublicFederations = jest.fn();
const mockGetPublicFederation = jest.fn();
const mockGetPublicFederationStats = jest.fn();

jest.mock('../../services/organization/OrganizationFederationService', () => ({
  OrganizationFederationService: {
    getInstance: jest.fn(() => ({
      getPublicFederations: mockGetPublicFederations,
      getPublicFederation: mockGetPublicFederation,
      getPublicFederationStats: mockGetPublicFederationStats,
    })),
  },
}));

// Stub the data source so the controller's DB-backed collaborator services
// (PublicOrgDirectoryService, SeoService, ShipService/TenantService, etc.) can be
// constructed without an initialized connection. The federation endpoints only
// use the mocked OrganizationFederationService above. TenantService reads
// `repository.metadata.name` in its constructor, so the stub must expose it.
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      metadata: { name: 'MockEntity', columns: [], relations: [] },
      target: class MockEntity {},
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
    })),
    isInitialized: true,
  },
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

// Import the route AFTER mocking
import publicDirectoryRoutes from '../../routes/publicDirectoryRoutes';

describe('Public Directory Federations Route Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a minimal Express app with the route
    app = express();
    app.use(json());
    app.use('/api', publicDirectoryRoutes);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/directory/federations', () => {
    it('should return 200 with empty federations list', async () => {
      // Mock the service to return empty result
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app).get('/api/directory/federations').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 0);
    });

    it('should return 200 with federations data', async () => {
      const mockFederations = [
        {
          id: 'fed-1',
          name: 'Test Federation',
          description: 'A test federation',
          memberCount: 5,
          memberOrganizations: [
            {
              organizationId: 'org-1',
              organizationName: 'Test Org 1',
              role: 'founder',
            },
          ],
          tags: ['combat', 'trading'],
          createdAt: new Date('2024-01-01'),
          sharedResourceTypes: ['fleet', 'intel'],
          treatyCount: 2,
        },
      ];

      mockGetPublicFederations.mockResolvedValue({
        data: mockFederations,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app).get('/api/directory/federations').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('id', 'fed-1');
      expect(response.body.data[0]).toHaveProperty('name', 'Test Federation');
      expect(response.body.data[0]).toHaveProperty('memberCount', 5);
    });

    it('should accept pagination query parameters', async () => {
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 2,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrev: true,
        },
      });

      const response = await request(app)
        .get('/api/directory/federations')
        .query({ page: '2', limit: '10' });

      // Log error details if test fails
      if (response.status !== 200) {
        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(mockGetPublicFederations).toHaveBeenCalled();
    });

    it('should accept filter query parameters', async () => {
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app)
        .get('/api/directory/federations')
        .query({
          name: 'Test',
          tags: 'combat,trading',
          minMembers: '5',
          maxMembers: '50',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(mockGetPublicFederations).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          tags: expect.arrayContaining(['combat', 'trading']),
          minMembers: 5,
          maxMembers: 50,
        }),
        expect.anything()
      );
    });

    it('should accept sort query parameters', async () => {
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app)
        .get('/api/directory/federations')
        .query({ sortBy: 'memberCount', sortOrder: 'DESC' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(mockGetPublicFederations).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sortBy: 'memberCount',
          sortOrder: 'DESC',
        })
      );
    });

    it('should validate invalid sortBy values', async () => {
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app)
        .get('/api/directory/federations')
        .query({ sortBy: 'invalidField' });

      // Should return validation error (400) due to Joi schema validation
      expect(response.status).toBe(400);
    });

    it('should validate invalid sortOrder values', async () => {
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app)
        .get('/api/directory/federations')
        .query({ sortOrder: 'INVALID' });

      // Should return validation error (400) due to Joi schema validation
      expect(response.status).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      mockGetPublicFederations.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/directory/federations');

      // Should return 500 error
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('GET /api/directory/federations/stats', () => {
    it('should return 200 with federation statistics', async () => {
      const mockStats = {
        totalFederations: 10,
        totalMemberOrganizations: 50,
        averageMembersPerFederation: 5,
        byTag: {
          combat: 5,
          trading: 3,
          exploration: 2,
        },
      };

      mockGetPublicFederationStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/directory/federations/stats').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('GET /api/directory/federations/:federationId', () => {
    it('should return 200 with specific federation data', async () => {
      const mockFederation = {
        id: 'fed-1',
        name: 'Test Federation',
        description: 'A test federation',
        memberCount: 5,
        memberOrganizations: [],
        tags: ['combat'],
        createdAt: new Date('2024-01-01'),
        sharedResourceTypes: ['fleet'],
        treatyCount: 1,
      };

      mockGetPublicFederation.mockResolvedValue(mockFederation);

      const response = await request(app).get('/api/directory/federations/fed-1').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'fed-1');
      expect(response.body.data).toHaveProperty('name', 'Test Federation');
    });

    it('should return 404 when federation not found', async () => {
      mockGetPublicFederation.mockResolvedValue(null);

      const response = await request(app).get('/api/directory/federations/nonexistent').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('message');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
