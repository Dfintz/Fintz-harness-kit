/**
 * FleetTenantController Tests
 *
 * Tests for the decorator-based fleet tenant controller
 */

import { json } from 'body-parser';
import express, { Express } from 'express';
import 'reflect-metadata';
import request from 'supertest';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { FleetTenantController } from '../../controllers/FleetTenantController';
import { registerControllers } from '../../routing';
import { FleetService } from '../../services/fleet/FleetService';

// Mock FleetService module
jest.mock('../../services/fleet/FleetService');

const MockedFleetService = FleetService as jest.MockedClass<typeof FleetService>;

// Mock middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user-123', username: 'testuser', role: 'admin' };
    next();
  }),
}));

jest.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: jest.fn((req, res, next) => {
    req.tenantContext = {
      organizationId: 'org-123',
      userId: 'user-123',
      userRole: 'admin',
    };
    next();
  }),
  requireTenantContext: jest.fn((req, res, next) => {
    if (!req.tenantContext?.organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }
    next();
  }),
}));

describe('FleetTenantController', () => {
  let app: Express;
  let mockFleetService: jest.Mocked<FleetService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock FleetService methods
    mockFleetService = {
      getAllFleets: jest.fn(),
      getSharedFleets: jest.fn(),
      getSharedFleetsPaginated: jest.fn(),
      getFleetStatistics: jest.fn(),
      searchFleetsByName: jest.fn(),
      getFleetById: jest.fn(),
      createFleet: jest.fn(),
      updateFleet: jest.fn(),
      deleteFleet: jest.fn(),
      shareFleetWith: jest.fn(),
      shareFleetWithMany: jest.fn(),
      unshareFleetWith: jest.fn(),
      unshareFleetWithMany: jest.fn(),
    } as any;

    // Mock the FleetService constructor to return our mock
    MockedFleetService.mockImplementation(() => mockFleetService as unknown as FleetService);

    // Create Express app
    app = express();
    app.use(json());

    // Register the controller
    registerControllers(app, [FleetTenantController], {
      prefix: '/api',
      debug: false,
    });
  });

  describe('GET /api/fleets', () => {
    it('should list all fleets for organization', async () => {
      const mockFleets = [
        { id: 'fleet-1', name: 'Alpha Fleet', organizationId: 'org-123' },
        { id: 'fleet-2', name: 'Beta Fleet', organizationId: 'org-123' },
      ];

      mockFleetService.getAllFleets.mockResolvedValue(mockFleets as any);

      const response = await request(app).get('/api/fleets').expect(200);

      expect(response.body).toEqual(mockFleets);
      expect(mockFleetService.getAllFleets).toHaveBeenCalledWith('org-123', {
        order: { name: 'ASC' },
      });
    });
  });

  describe('GET /api/fleets/shared', () => {
    it('should list shared fleets', async () => {
      const paginated = {
        data: [{ id: 'fleet-3', name: 'Gamma Fleet', organizationId: 'org-456' }],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      mockFleetService.getSharedFleetsPaginated.mockResolvedValue(paginated as any);

      const response = await request(app).get('/api/fleets/shared').expect(200);

      expect(response.body).toEqual(paginated);
      expect(mockFleetService.getSharedFleetsPaginated).toHaveBeenCalledWith('org-123', {
        limit: 20,
        offset: 0,
      });
      expect(mockFleetService.getSharedFleets).not.toHaveBeenCalled();
    });

    it('should return paginated shared fleets when limit and offset are provided', async () => {
      const paginated = {
        data: [{ id: 'fleet-3', name: 'Gamma Fleet', organizationId: 'org-456' }],
        pagination: {
          total: 2,
          limit: 1,
          offset: 0,
          hasMore: true,
        },
      };

      mockFleetService.getSharedFleetsPaginated.mockResolvedValue(paginated as any);

      const response = await request(app)
        .get('/api/fleets/shared')
        .query({ limit: '1', offset: '0' })
        .expect(200);

      expect(response.body).toEqual(paginated);
      expect(mockFleetService.getSharedFleetsPaginated).toHaveBeenCalledWith('org-123', {
        limit: 1,
        offset: 0,
      });
      expect(mockFleetService.getSharedFleets).not.toHaveBeenCalled();
    });

    it('should clamp invalid shared-fleet pagination values', async () => {
      const paginated = {
        data: [],
        pagination: {
          total: 0,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      mockFleetService.getSharedFleetsPaginated.mockResolvedValue(paginated as any);

      await request(app)
        .get('/api/fleets/shared')
        .query({ limit: '9999', offset: '-10' })
        .expect(200);

      expect(mockFleetService.getSharedFleetsPaginated).toHaveBeenCalledWith('org-123', {
        limit: 100,
        offset: 0,
      });
    });
  });

  describe('GET /api/fleets/statistics', () => {
    it('should return fleet statistics', async () => {
      const mockStats = {
        totalFleets: 5,
        totalShips: 120,
        totalCrew: 250,
      };

      mockFleetService.getFleetStatistics.mockResolvedValue(mockStats as any);

      const response = await request(app).get('/api/fleets/statistics').expect(200);

      expect(response.body).toEqual(mockStats);
      expect(mockFleetService.getFleetStatistics).toHaveBeenCalledWith('org-123');
    });
  });

  describe('GET /api/fleets/search', () => {
    it('should search fleets by name', async () => {
      const mockResults = [{ id: 'fleet-1', name: 'Alpha Fleet', organizationId: 'org-123' }];

      mockFleetService.searchFleetsByName.mockResolvedValue(mockResults as any);

      const response = await request(app)
        .get('/api/fleets/search')
        .query({ q: 'alpha' })
        .expect(200);

      expect(response.body).toEqual(mockResults);
      expect(mockFleetService.searchFleetsByName).toHaveBeenCalledWith('org-123', 'alpha');
    });

    it('should return error if search term is missing', async () => {
      const response = await request(app).get('/api/fleets/search').expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/fleets/:id', () => {
    it('should get fleet by ID', async () => {
      const mockFleet = {
        id: 'fleet-1',
        name: 'Alpha Fleet',
        organizationId: 'org-123',
      };

      mockFleetService.getFleetById.mockResolvedValue(mockFleet as any);

      const response = await request(app).get('/api/fleets/fleet-1').expect(200);

      expect(response.body).toEqual(mockFleet);
      expect(mockFleetService.getFleetById).toHaveBeenCalledWith('org-123', 'fleet-1');
    });

    it('should return 404 for not found fleet', async () => {
      mockFleetService.getFleetById.mockResolvedValue(null);

      await request(app).get('/api/fleets/nonexistent').expect(404); // BaseController recognizes "not found" and returns 404
    });
  });

  describe('POST /api/fleets', () => {
    it('should create a new fleet', async () => {
      const fleetData = {
        name: 'Delta Fleet',
        description: 'New fleet',
      };

      const mockNewFleet = {
        id: 'fleet-new',
        ...fleetData,
        organizationId: 'org-123',
      };

      mockFleetService.createFleet.mockResolvedValue(mockNewFleet as any);

      const response = await request(app).post('/api/fleets').send(fleetData).expect(201);

      expect(response.body).toEqual(mockNewFleet);
      expect(mockFleetService.createFleet).toHaveBeenCalledWith('org-123', fleetData);
    });
  });

  describe('PUT /api/fleets/:id', () => {
    it('should update fleet', async () => {
      const updates = {
        name: 'Updated Fleet Name',
      };

      const mockUpdatedFleet = {
        id: 'fleet-1',
        name: 'Updated Fleet Name',
        organizationId: 'org-123',
      };

      mockFleetService.updateFleet.mockResolvedValue(mockUpdatedFleet as any);

      const response = await request(app).put('/api/fleets/fleet-1').send(updates).expect(200);

      expect(response.body).toEqual(mockUpdatedFleet);
      expect(mockFleetService.updateFleet).toHaveBeenCalledWith('org-123', 'fleet-1', updates);
    });
  });

  describe('DELETE /api/fleets/:id', () => {
    it('should delete fleet', async () => {
      const mockFleet = {
        id: 'fleet-1',
        name: 'Alpha Fleet',
        organizationId: 'org-123',
      };

      mockFleetService.getFleetById.mockResolvedValue(mockFleet as any);
      mockFleetService.deleteFleet.mockResolvedValue(undefined as any);

      await request(app).delete('/api/fleets/fleet-1').expect(204);

      expect(mockFleetService.deleteFleet).toHaveBeenCalledWith('org-123', 'fleet-1');
    });

    it('should return 404 if fleet not found', async () => {
      mockFleetService.getFleetById.mockResolvedValue(null);

      await request(app).delete('/api/fleets/nonexistent').expect(404); // BaseController recognizes "not found" and returns 404

      // Verify we attempted to get the fleet
      expect(mockFleetService.getFleetById).toHaveBeenCalledWith('org-123', 'nonexistent');
    });
  });

  describe('POST /api/fleets/:id/share', () => {
    it('should share fleet with target organizations', async () => {
      const mockFleet = {
        id: 'fleet-1',
        name: 'Alpha Fleet',
        organizationId: 'org-123',
      };

      const mockUpdatedFleet = {
        ...mockFleet,
        sharedWith: ['org-456', 'org-789'],
      };

      // First call returns original fleet, second call returns updated fleet
      mockFleetService.getFleetById.mockResolvedValueOnce(mockFleet as any);
      mockFleetService.shareFleetWithMany.mockResolvedValue(mockUpdatedFleet as any);

      const response = await request(app)
        .post('/api/fleets/fleet-1/share')
        .send({ targetOrganizationIds: ['org-456', 'org-789'] })
        .expect(200);

      expect(response.body).toEqual(mockUpdatedFleet);
      expect(mockFleetService.shareFleetWithMany).toHaveBeenCalledWith('org-123', 'fleet-1', [
        'org-456',
        'org-789',
      ]);
    });
  });

  describe('POST /api/fleets/:id/unshare', () => {
    it('should unshare fleet from target organizations', async () => {
      const mockFleet = {
        id: 'fleet-1',
        name: 'Alpha Fleet',
        organizationId: 'org-123',
        sharedWith: ['org-456', 'org-789'],
      };

      const mockUpdatedFleet = {
        ...mockFleet,
        sharedWith: [],
      };

      // First call returns original fleet, second call returns updated fleet
      mockFleetService.getFleetById.mockResolvedValueOnce(mockFleet as any);
      mockFleetService.unshareFleetWithMany.mockResolvedValue(mockUpdatedFleet as any);

      const response = await request(app)
        .post('/api/fleets/fleet-1/unshare')
        .send({ targetOrganizationIds: ['org-456', 'org-789'] })
        .expect(200);

      expect(response.body).toEqual(mockUpdatedFleet);
      expect(mockFleetService.unshareFleetWithMany).toHaveBeenCalledWith('org-123', 'fleet-1', [
        'org-456',
        'org-789',
      ]);
    });
  });
});
