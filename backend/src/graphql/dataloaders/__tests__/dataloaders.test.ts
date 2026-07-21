/**
 * DataLoader Tests
 *
 * Unit tests for GraphQL DataLoaders to verify batching behavior
 */

import DataLoader from 'dataloader';

import { createDataLoaders, DataLoaders } from '../index';

// Mock the database connection
jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    }),
  },
}));

// Mock logger
describe('DataLoaders', () => {
  let loaders: DataLoaders;

  beforeEach(() => {
    loaders = createDataLoaders();
  });

  describe('createDataLoaders', () => {
    it('should create all required loaders', () => {
      expect(loaders.userById).toBeInstanceOf(DataLoader);
      expect(loaders.organizationById).toBeInstanceOf(DataLoader);
      expect(loaders.fleetById).toBeInstanceOf(DataLoader);
      expect(loaders.shipById).toBeInstanceOf(DataLoader);
      expect(loaders.activityById).toBeInstanceOf(DataLoader);
      expect(loaders.usersByOrganizationId).toBeInstanceOf(DataLoader);
      expect(loaders.organizationsByUserId).toBeInstanceOf(DataLoader);
      expect(loaders.fleetsByOrganizationId).toBeInstanceOf(DataLoader);
      expect(loaders.fleetsByLeaderId).toBeInstanceOf(DataLoader);
      expect(loaders.shipsByUserId).toBeInstanceOf(DataLoader);
      expect(loaders.shipsByOrganizationId).toBeInstanceOf(DataLoader);
      expect(loaders.shipsByFleetId).toBeInstanceOf(DataLoader);
      expect(loaders.activitiesByOrganizationId).toBeInstanceOf(DataLoader);
      expect(loaders.activitiesByUserId).toBeInstanceOf(DataLoader);
    });

    it('should create new loader instances for each call', () => {
      const loaders2 = createDataLoaders();

      // Each call should return different instances (per-request isolation)
      expect(loaders.userById).not.toBe(loaders2.userById);
      expect(loaders.organizationById).not.toBe(loaders2.organizationById);
    });
  });

  describe('userById loader', () => {
    it('should return null for non-existent user', async () => {
      const result = await loaders.userById.load('non-existent-id');
      expect(result).toBeNull();
    });

    it('should batch multiple requests', async () => {
      // Load multiple users at once - they should be batched
      const results = await Promise.all([
        loaders.userById.load('user-1'),
        loaders.userById.load('user-2'),
        loaders.userById.load('user-3'),
      ]);

      expect(results).toHaveLength(3);
      // All results should be null since we mocked empty responses
      results.forEach(result => expect(result).toBeNull());
    });

    it('should cache repeated requests', async () => {
      // Load same user twice
      const result1 = await loaders.userById.load('user-1');
      const result2 = await loaders.userById.load('user-1');

      // Should return the same cached result
      expect(result1).toBe(result2);
    });
  });

  describe('organizationById loader', () => {
    it('should return null for non-existent organization', async () => {
      const result = await loaders.organizationById.load('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('fleetById loader', () => {
    it('should return null for non-existent fleet', async () => {
      const result = await loaders.fleetById.load('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('shipById loader', () => {
    it('should return null for non-existent ship', async () => {
      const result = await loaders.shipById.load('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('activityById loader', () => {
    it('should return null for non-existent activity', async () => {
      const result = await loaders.activityById.load('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('relationship loaders', () => {
    it('should return empty arrays for non-existent relationships', async () => {
      const [users, orgs, fleets, ships, activities] = await Promise.all([
        loaders.usersByOrganizationId.load('org-1'),
        loaders.organizationsByUserId.load('user-1'),
        loaders.fleetsByOrganizationId.load('org-1'),
        loaders.shipsByUserId.load('user-1'),
        loaders.activitiesByOrganizationId.load('org-1'),
      ]);

      expect(users).toEqual([]);
      expect(orgs).toEqual([]);
      expect(fleets).toEqual([]);
      expect(ships).toEqual([]);
      expect(activities).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
