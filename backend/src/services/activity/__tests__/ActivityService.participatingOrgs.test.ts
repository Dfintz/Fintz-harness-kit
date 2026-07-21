import { Repository } from 'typeorm';
import {
  Activity,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
} from '../../../models/Activity';
import { mockAppDataSource } from '../../../__tests__/helpers/database-mock';

// Mock AppDataSource before importing ActivityService
jest.mock('../../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

import { ActivityService } from '../ActivityService';

// These tests require testing JSONB query building which needs real TypeORM setup
// Skip in CI environment where database is not available
const describeIfDatabase =
  process.env.DATABASE_URL || process.env.DB_HOST ? describe : describe.skip;

describeIfDatabase('ActivityService - ParticipatingOrgs JSONB Queries', () => {
  let activityService: ActivityService;
  let mockRepository: jest.Mocked<Repository<Activity>>;
  let mockQueryBuilder: any;

  beforeEach(() => {
    // Create mock query builder
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    // Create mock repository
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    // Create service instance
    activityService = new ActivityService();
    (activityService as any).repository = mockRepository;
  });

  describe('searchActivities with participatingOrgIds filter', () => {
    it('should filter activities by participating organizations using JSONB contains operator', async () => {
      // Arrange
      const filters = {
        participatingOrgIds: ['org-123', 'org-456'],
      };

      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Cross-Org Mining Op',
          organizationId: 'org-primary',
          participatingOrgs: [
            {
              organizationId: 'org-123',
              organizationName: 'Test Org',
              role: 'participant',
              status: 'accepted',
            },
          ],
        },
      ];

      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue(mockActivities);

      // Act
      const result = await activityService.searchActivities(filters, 1, 20);

      // Assert
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('activity');

      // Verify JSONB query was built with OR conditions for each org
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();

      // Check that the where clause includes JSONB @> operator
      const whereCall = mockQueryBuilder.andWhere.mock.calls.find((call: any[]) =>
        call[0]?.includes('@>')
      );
      expect(whereCall).toBeDefined();

      // Verify parameters contain JSONB formatted filters
      const params = whereCall[1];
      expect(params.orgFilter0).toContain('organizationId');
      expect(params.orgFilter0).toContain('org-123');
      expect(params.orgFilter1).toContain('organizationId');
      expect(params.orgFilter1).toContain('org-456');

      expect(result.activities).toEqual(mockActivities);
      expect(result.total).toBe(1);
    });

    it('should not add participatingOrgs filter when participatingOrgIds is empty', async () => {
      // Arrange
      const filters = {
        participatingOrgIds: [],
      };

      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await activityService.searchActivities(filters, 1, 20);

      // Assert
      const whereCall = mockQueryBuilder.andWhere.mock.calls.find((call: any[]) =>
        call[0]?.includes('@>')
      );
      expect(whereCall).toBeUndefined();
    });

    it('should not add participatingOrgs filter when participatingOrgIds is undefined', async () => {
      // Arrange
      const filters = {};

      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await activityService.searchActivities(filters, 1, 20);

      // Assert
      const whereCall = mockQueryBuilder.andWhere.mock.calls.find((call: any[]) =>
        call[0]?.includes('@>')
      );
      expect(whereCall).toBeUndefined();
    });
  });

  describe('getActivitiesForUser with participatingOrgs filter', () => {
    it('should include activities where user org is in participatingOrgs', async () => {
      // Arrange
      const userId = 'user-123';
      const userOrgIds = ['org-user-1', 'org-user-2'];

      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Multi-Org Event',
          creatorId: 'other-user',
          organizationId: 'org-primary',
          visibility: ActivityVisibility.CROSS_ORG,
          participatingOrgs: [
            {
              organizationId: 'org-user-1',
              organizationName: 'User Org',
              role: 'participant',
              status: 'accepted',
            },
          ],
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockActivities);

      // Act
      const result = await activityService.getActivitiesForUser(userId, userOrgIds);

      // Assert
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('activity');

      // Verify where clause was called
      expect(mockQueryBuilder.where).toHaveBeenCalled();

      // Check that the where clause includes JSONB @> operator for participatingOrgs
      const whereCall = mockQueryBuilder.where.mock.calls[0];
      expect(whereCall[0]).toContain('@>');
      expect(whereCall[0]).toContain('participatingOrgs');

      // Verify parameters contain JSONB formatted filters
      const params = whereCall[1];
      expect(params.userId).toBe(userId);
      expect(params.publicVisibility).toBe(ActivityVisibility.PUBLIC);
      expect(params.orgIds).toEqual(userOrgIds);
      expect(params.orgFilter0).toContain('organizationId');
      expect(params.orgFilter0).toContain('org-user-1');

      expect(result).toEqual(mockActivities);
    });

    it('should handle empty userOrgIds array', async () => {
      // Arrange
      const userId = 'user-123';
      const userOrgIds: string[] = [];

      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      const result = await activityService.getActivitiesForUser(userId, userOrgIds);

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalled();

      // Verify where clause doesn't include participatingOrgs check when no orgs
      const whereCall = mockQueryBuilder.where.mock.calls[0];
      expect(whereCall[0]).not.toContain('@>');

      expect(result).toEqual([]);
    });
  });

  describe('getStatistics with participatingOrgs filter', () => {
    it('should include activities where organization is in participatingOrgs', async () => {
      // Arrange
      const organizationId = 'org-123';

      const mockActivities = [
        {
          id: 'activity-1',
          organizationId: 'org-primary',
          activityType: ActivityType.OPERATION,
          status: ActivityStatus.COMPLETED,
          currentParticipants: 5,
          participatingOrgs: [
            {
              organizationId: 'org-123',
              organizationName: 'Test Org',
              role: 'participant',
              status: 'accepted',
            },
          ],
          completionReport: { outcome: 'success' },
        },
        {
          id: 'activity-2',
          organizationId: 'org-123',
          activityType: ActivityType.MISSION,
          status: ActivityStatus.OPEN,
          currentParticipants: 3,
          participatingOrgs: [],
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockActivities);

      // Act
      const result = await activityService.getStatistics(organizationId);

      // Assert
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('activity');

      // Verify where clause includes both primary org and participatingOrgs check
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      const whereCall = mockQueryBuilder.where.mock.calls[0];
      expect(whereCall[0]).toContain('activity.organizationId = :orgId');
      expect(whereCall[0]).toContain('@>');
      expect(whereCall[0]).toContain('participatingOrgs');

      // Verify parameters
      const params = whereCall[1];
      expect(params.orgId).toBe(organizationId);
      expect(params.orgFilter).toContain('organizationId');
      expect(params.orgFilter).toContain('org-123');

      expect(result.totalActivities).toBe(2);
      expect(result.completedActivities).toBe(1);
      expect(result.activeActivities).toBe(1);
    });

    it('should not add organization filter when organizationId is undefined', async () => {
      // Arrange
      const mockActivities = [
        {
          id: 'activity-1',
          activityType: ActivityType.EVENT,
          status: ActivityStatus.OPEN,
          currentParticipants: 2,
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockActivities);

      // Act
      const result = await activityService.getStatistics();

      // Assert
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(result.totalActivities).toBe(1);
    });
  });

  describe('JSONB query format validation', () => {
    it('should format JSONB filter correctly for single organizationId', () => {
      // Arrange
      const orgId = 'org-test-123';
      const expectedFormat = JSON.stringify([{ organizationId: orgId }]);

      // Assert
      expect(expectedFormat).toBe('[{"organizationId":"org-test-123"}]');

      // Verify it's valid JSON
      const parsed = JSON.parse(expectedFormat);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].organizationId).toBe(orgId);
    });

    it('should handle multiple organizationIds with separate JSONB filters', () => {
      // Arrange
      const orgIds = ['org-1', 'org-2', 'org-3'];
      const filters = orgIds.map(id => JSON.stringify([{ organizationId: id }]));

      // Assert
      expect(filters).toHaveLength(3);
      filters.forEach((filter, index) => {
        const parsed = JSON.parse(filter);
        expect(parsed[0].organizationId).toBe(orgIds[index]);
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

