import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { Activity } from '../../../models/Activity';
import {
    AllianceDiplomacy,
    AllianceType,
    DiplomacyStatus,
} from '../../../models/AllianceDiplomacy';
import { Organization } from '../../../models/Organization';
import {
    OrganizationRelationship,
    RelationshipStatus,
    RelationshipType,
} from '../../../models/OrganizationRelationship';
import { AllianceService } from '../AllianceService';

// Mock AppDataSource
jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('AllianceService', () => {
  let allianceService: AllianceService;
  let mockRelationshipRepository: jest.Mocked<Repository<OrganizationRelationship>>;
  let mockDiplomacyRepository: jest.Mocked<Repository<AllianceDiplomacy>>;
  let mockActivityRepository: jest.Mocked<Repository<Activity>>;
  let mockOrganizationRepository: jest.Mocked<Repository<Organization>>;

  beforeEach(() => {
    // Create mock repositories
    mockRelationshipRepository = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockDiplomacyRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    mockActivityRepository = {
      createQueryBuilder: jest.fn(),
    } as any;

    mockOrganizationRepository = {
      find: jest.fn(),
    } as any;

    // Setup AppDataSource mock
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === OrganizationRelationship) {
        return mockRelationshipRepository;
      }
      if (entity === AllianceDiplomacy) {
        return mockDiplomacyRepository;
      }
      if (entity === Activity) {
        return mockActivityRepository;
      }
      if (entity === Organization) {
        return mockOrganizationRepository;
      }
      return {} as any;
    });

    allianceService = new AllianceService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllianceCount', () => {
    it('should return count of active alliances', async () => {
      const orgId = 'org-123';
      mockRelationshipRepository.count.mockResolvedValue(3);

      const count = await allianceService.getAllianceCount(orgId);

      expect(count).toBe(3);
      expect(mockRelationshipRepository.count).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
        },
      });
    });

    it('should return 0 when no alliances exist', async () => {
      const orgId = 'org-456';
      mockRelationshipRepository.count.mockResolvedValue(0);

      const count = await allianceService.getAllianceCount(orgId);

      expect(count).toBe(0);
    });
  });

  describe('getAlliances', () => {
    it('should return list of active alliances', async () => {
      const orgId = 'org-123';
      const mockAlliances = [
        {
          id: 'rel-1',
          organizationId: orgId,
          targetOrganizationId: 'org-999',
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
          trustScore: 80,
          relationshipStrength: 75,
          establishedDate: new Date(),
        },
        {
          id: 'rel-2',
          organizationId: orgId,
          targetOrganizationId: 'org-888',
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
          trustScore: 90,
          relationshipStrength: 85,
          establishedDate: new Date(),
        },
      ];

      mockRelationshipRepository.find.mockResolvedValue(mockAlliances as any);

      const alliances = await allianceService.getAlliances(orgId);

      expect(alliances).toHaveLength(2);
      expect(mockRelationshipRepository.find).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
        },
        order: {
          establishedDate: 'DESC',
        },
      });
    });
  });

  describe('getAllianceStatistics', () => {
    it('should calculate alliance statistics correctly', async () => {
      const orgId = 'org-123';
      const mockAlliances = [
        {
          id: 'rel-1',
          organizationId: orgId,
          targetOrganizationId: 'org-999',
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
          trustScore: 85,
          relationshipStrength: 80,
          isMutual: true,
          calculateHealthScore: jest.fn().mockReturnValue(85),
          needsReview: jest.fn().mockReturnValue(false),
        },
        {
          id: 'rel-2',
          organizationId: orgId,
          targetOrganizationId: 'org-888',
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
          trustScore: 95,
          relationshipStrength: 90,
          isMutual: true,
          calculateHealthScore: jest.fn().mockReturnValue(92),
          needsReview: jest.fn().mockReturnValue(false),
        },
        {
          id: 'rel-3',
          organizationId: orgId,
          targetOrganizationId: 'org-777',
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
          trustScore: 60,
          relationshipStrength: 65,
          isMutual: false,
          calculateHealthScore: jest.fn().mockReturnValue(62),
          needsReview: jest.fn().mockReturnValue(true),
        },
      ];

      mockRelationshipRepository.find.mockResolvedValue(mockAlliances as any);

      const stats = await allianceService.getAllianceStatistics(orgId);

      expect(stats.total).toBe(3);
      expect(stats.averageHealth).toBe(80); // (85 + 92 + 62) / 3 = 79.67 rounded to 80
      expect(stats.strong).toBe(2); // Health >= 80
      expect(stats.needingReview).toBe(1);
      expect(stats.mutual).toBe(2);
      expect(stats.mutualPercentage).toBe(67); // 2/3 = 66.67 rounded to 67
    });

    it('should handle zero alliances correctly', async () => {
      const orgId = 'org-456';
      mockRelationshipRepository.find.mockResolvedValue([]);

      const stats = await allianceService.getAllianceStatistics(orgId);

      expect(stats.total).toBe(0);
      expect(stats.averageHealth).toBe(0);
      expect(stats.strong).toBe(0);
      expect(stats.mutualPercentage).toBe(0);
    });
  });

  describe('getSharedActivities', () => {
    it('should return shared activities with allied organizations', async () => {
      const orgId = 'org-123';
      const mockAlliances = [
        {
          targetOrganizationId: 'org-999',
        },
        {
          targetOrganizationId: 'org-888',
        },
      ];

      const mockActivities = [
        { id: 'act-1', title: 'Activity 1', organizationId: orgId },
        { id: 'act-2', title: 'Activity 2', organizationId: 'org-999' },
        { id: 'act-3', title: 'Activity 3', organizationId: 'org-888' },
      ];

      mockRelationshipRepository.find.mockResolvedValue(mockAlliances as any);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(3),
        getMany: jest.fn().mockResolvedValue(mockActivities),
      };

      mockActivityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await allianceService.getSharedActivities(orgId);

      expect(result.activities).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('should return empty array when no alliances exist', async () => {
      const orgId = 'org-456';
      mockRelationshipRepository.find.mockResolvedValue([]);

      const result = await allianceService.getSharedActivities(orgId);

      expect(result.activities).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('areAllied', () => {
    it('should return true when organizations are allied', async () => {
      const org1Id = 'org-123';
      const org2Id = 'org-456';

      mockRelationshipRepository.findOne.mockResolvedValue({
        id: 'rel-1',
        organizationId: org1Id,
        targetOrganizationId: org2Id,
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      } as any);

      const areAllied = await allianceService.areAllied(org1Id, org2Id);

      expect(areAllied).toBe(true);
    });

    it('should return false when organizations are not allied', async () => {
      const org1Id = 'org-123';
      const org2Id = 'org-789';

      mockRelationshipRepository.findOne.mockResolvedValue(null);

      const areAllied = await allianceService.areAllied(org1Id, org2Id);

      expect(areAllied).toBe(false);
    });
  });

  describe('getAllianceDetails', () => {
    it('should return alliance details with diplomacy information', async () => {
      const orgId = 'org-123';
      const mockAlliances = [
        {
          id: 'rel-1',
          organizationId: orgId,
          targetOrganizationId: 'org-999',
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
          calculateHealthScore: jest.fn().mockReturnValue(85),
          getTrustLevel: jest.fn().mockReturnValue('High Trust'),
        },
      ];

      const mockDiplomacy = {
        id: 'dip-1',
        orgId1: orgId,
        orgId2: 'org-999',
        status: DiplomacyStatus.ACTIVE,
        allianceType: AllianceType.FULL_ALLIANCE,
      };

      mockRelationshipRepository.find.mockResolvedValue(mockAlliances as any);
      mockDiplomacyRepository.find.mockResolvedValue([mockDiplomacy] as any);
      mockOrganizationRepository.find.mockResolvedValue([
        { id: 'org-999', name: 'Test Allied Org' },
      ] as any);

      const details = await allianceService.getAllianceDetails(orgId);

      expect(details).toHaveLength(1);
      expect(details[0].relationship).toBeDefined();
      expect(details[0].diplomacy).toBeDefined();
      expect(details[0].healthScore).toBe(85);
      expect(details[0].trustLevel).toBe('High Trust');
      expect(details[0].targetOrganizationName).toBe('Test Allied Org');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

