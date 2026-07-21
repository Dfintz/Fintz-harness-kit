/**
 * Integration tests for v2 public stats routes
 * Tests GET /api/v2/public/stats endpoint
 */
import { json } from 'body-parser';
import express from 'express';
import request from 'supertest';

import { AppDataSource } from '../../config/database';
import {
  PublicStatsController,
  clearPublicStatsCache,
} from '../../controllers/v2/publicStatsController';
import { errorHandlerV2 } from '../../middleware/errorHandlerV2';
import { requestIdMiddleware } from '../../middleware/requestId';
import { standardResponseMiddleware } from '../../middleware/standardResponse';
import { AllianceDiplomacy, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { Federation } from '../../models/Federation';
import { Fleet } from '../../models/Fleet';
import { PublicJobListing } from '../../models/PublicJobListing';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { User } from '../../models/User';
import { UserShip } from '../../models/UserShip';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('V2 Public Stats Routes Integration Tests', () => {
  let app: express.Application;
  let mockOrgProfileRepo: any;
  let mockAllianceRepo: any;
  let mockFederationRepo: any;
  let mockUserRepo: any;
  let mockJobListingRepo: any;
  let mockUserShipRepo: any;
  let mockFleetRepo: any;

  beforeEach(() => {
    // Clear all mocks first, before setting up new ones
    jest.clearAllMocks();

    // Clear the module-level cache before each test
    clearPublicStatsCache();

    // Create Express app with public stats routes and middleware
    app = express();
    app.use(json());
    app.use(requestIdMiddleware);
    app.use(standardResponseMiddleware);

    // Set up routes
    const controller = new PublicStatsController();
    app.get('/api/v2/public/stats', (req, res) => controller.getPublicStats(req, res));

    app.use(errorHandlerV2); // Add error handler last

    // Mock repositories
    mockOrgProfileRepo = {
      count: jest.fn().mockResolvedValue(42),
    };

    mockAllianceRepo = {
      count: jest.fn().mockResolvedValue(25),
    };

    mockFederationRepo = {
      count: jest.fn().mockResolvedValue(7),
    };

    mockUserRepo = {
      count: jest.fn().mockResolvedValue(150),
    };

    mockJobListingRepo = {
      count: jest.fn().mockResolvedValue(75),
    };

    mockUserShipRepo = {
      count: jest.fn().mockResolvedValue(500),
    };

    mockFleetRepo = {
      count: jest.fn().mockResolvedValue(30),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === PublicOrgProfile) return mockOrgProfileRepo;
      if (entity === AllianceDiplomacy) return mockAllianceRepo;
      if (entity === Federation) return mockFederationRepo;
      if (entity === User) return mockUserRepo;
      if (entity === PublicJobListing) return mockJobListingRepo;
      if (entity === UserShip) return mockUserShipRepo;
      if (entity === Fleet) return mockFleetRepo;
      return null;
    });
  });

  describe('GET /api/v2/public/stats', () => {
    it('should return 200 with v2 envelope (success: true, data, meta)', async () => {
      const response = await request(app).get('/api/v2/public/stats').expect(200);

      // Verify v2 envelope structure
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');

      // Verify meta fields
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.meta).toHaveProperty('requestId');

      // Verify data shape matches what frontend expects
      expect(response.body.data).toEqual({
        publicOrganizations: 42,
        publicAlliances: 32,
        publicFederations: 7,
        users: 150,
        publicJobListings: 75,
        shipsTracked: 500,
        fleetsTracked: 30,
      });
    });

    it('should count active public job listings', async () => {
      await request(app).get('/api/v2/public/stats').expect(200);

      // Verify that PublicJobListing.count was called with isActive filter
      expect(mockJobListingRepo.count).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
      });
    });

    it('should count public org profiles with isPublic = true', async () => {
      await request(app).get('/api/v2/public/stats').expect(200);

      // Verify count was called on PublicOrgProfile repository
      expect(mockOrgProfileRepo.count).toHaveBeenCalledWith({
        where: { isPublic: true },
      });
    });

    it('should query active alliances using DiplomacyStatus.ACTIVE', async () => {
      await request(app).get('/api/v2/public/stats').expect(200);

      // Verify alliance count was called with correct status filter
      expect(mockAllianceRepo.count).toHaveBeenCalledWith({
        where: { status: DiplomacyStatus.ACTIVE },
      });
    });

    it('should roll federations into publicAlliances while preserving publicFederations', async () => {
      mockAllianceRepo.count.mockResolvedValue(11);
      mockFederationRepo.count.mockResolvedValue(4);

      const response = await request(app).get('/api/v2/public/stats').expect(200);

      expect(response.body.data.publicAlliances).toBe(15);
      expect(response.body.data.publicFederations).toBe(4);
    });

    it('should return cached data on subsequent requests within cache window', async () => {
      // First request
      const firstResponse = await request(app).get('/api/v2/public/stats').expect(200);

      expect(firstResponse.body.data).toEqual({
        publicOrganizations: 42,
        publicAlliances: 32,
        publicFederations: 7,
        users: 150,
        publicJobListings: 75,
        shipsTracked: 500,
        fleetsTracked: 30,
      });

      // Clear mocks to verify cache hit
      jest.clearAllMocks();

      // Second request (should hit cache)
      const secondResponse = await request(app).get('/api/v2/public/stats').expect(200);

      // Verify no DB calls were made (cache hit)
      expect(mockOrgProfileRepo.count).not.toHaveBeenCalled();
      expect(mockAllianceRepo.count).not.toHaveBeenCalled();
      expect(mockFederationRepo.count).not.toHaveBeenCalled();
      expect(mockUserRepo.count).not.toHaveBeenCalled();
      expect(mockJobListingRepo.count).not.toHaveBeenCalled();
      expect(mockUserShipRepo.count).not.toHaveBeenCalled();
      expect(mockFleetRepo.count).not.toHaveBeenCalled();

      // Verify same data returned
      expect(secondResponse.body.data).toEqual(firstResponse.body.data);
    });

    it('should return 500 with v2 error envelope on database failure', async () => {
      // Mock database error on organization profile count
      mockOrgProfileRepo.count.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/v2/public/stats').expect(500);

      // Verify v2 error envelope structure
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');

      // Verify error fields
      expect(response.body.error).toHaveProperty('code', 'INTERNAL_ERROR');
      expect(response.body.error).toHaveProperty('message', 'Failed to fetch platform statistics');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('requestId');
    });

    it('should handle zero counts gracefully', async () => {
      // Mock zero values
      mockOrgProfileRepo.count.mockResolvedValue(0);
      mockAllianceRepo.count.mockResolvedValue(0);
      mockUserRepo.count.mockResolvedValue(0);
      mockJobListingRepo.count.mockResolvedValue(0);
      mockUserShipRepo.count.mockResolvedValue(0);
      mockFleetRepo.count.mockResolvedValue(0);
      mockFederationRepo.count.mockResolvedValue(0);

      const response = await request(app).get('/api/v2/public/stats').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        publicOrganizations: 0,
        publicAlliances: 0,
        publicFederations: 0,
        users: 0,
        publicJobListings: 0,
        shipsTracked: 0,
        fleetsTracked: 0,
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
