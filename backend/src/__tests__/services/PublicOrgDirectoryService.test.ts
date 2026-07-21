import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { ActivityLevel, OrgPrimaryFocus, PublicOrgProfile } from '../../models/PublicOrgProfile';
import {
  DirectoryFilterOptions,
  PublicOrgDirectoryService,
} from '../../services/organization/PublicOrgDirectoryService';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../config/database';

describe('PublicOrgDirectoryService', () => {
  let service: PublicOrgDirectoryService;
  let mockProfileRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  let mockOrgRepository: {
    findOne: jest.Mock;
  };
  let mockMembershipRepository: {
    createQueryBuilder: jest.Mock;
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    description: 'A test organization',
    logoUrl: 'https://example.com/logo.png',
    totalMembers: 50,
  } as Organization;

  const mockProfile = {
    id: 'profile-123',
    organizationId: 'org-123',
    organization: mockOrganization,
    isPublic: true,
    tagline: 'Test tagline',
    primaryFocus: OrgPrimaryFocus.MINING,
    secondaryFocus: [OrgPrimaryFocus.TRADING],
    memberCount: 50,
    activityLevel: ActivityLevel.HIGH,
    rsiUrl: 'https://rsi.com/org/test',
    discordInvite: 'discord.gg/test',
    languages: ['en', 'de'],
    timezone: 'UTC',
    isVerified: true,
    isRecruiting: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PublicOrgProfile;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProfileRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      count: jest.fn(),
    };

    mockOrgRepository = {
      findOne: jest.fn(),
    };

    const mockMembershipQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ orgId: 'org-123', cnt: '50' }]),
    };
    mockMembershipRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockMembershipQueryBuilder),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === PublicOrgProfile) {
        return mockProfileRepository;
      }
      if (entity === Organization) {
        return mockOrgRepository;
      }
      if (entity === OrganizationMembership) {
        return mockMembershipRepository;
      }
      return {};
    });

    service = new PublicOrgDirectoryService();
  });

  describe('getPublicDirectory', () => {
    it('should return paginated public organizations', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockProfile], 1]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getPublicDirectory();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].organizationId).toBe('org-123');
      expect(result.data[0].organizationName).toBe('Test Organization');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should apply filters correctly', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: DirectoryFilterOptions = {
        primaryFocus: OrgPrimaryFocus.MINING,
        activityLevel: ActivityLevel.HIGH,
        isRecruiting: true,
        isVerified: true,
        minMemberCount: 10,
        maxMemberCount: 100,
        searchTerm: 'test',
      };

      await service.getPublicDirectory(filters);

      // Verify filters were applied
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'profile.primaryFocus = :primaryFocus',
        { primaryFocus: OrgPrimaryFocus.MINING }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'profile.activityLevel = :activityLevel',
        { activityLevel: ActivityLevel.HIGH }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'profile.isRecruiting = :isRecruiting',
        { isRecruiting: true }
      );
    });

    it('should apply multi-select primary focus filter (Phase 2)', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: DirectoryFilterOptions = {
        primaryFocuses: [
          OrgPrimaryFocus.MINING,
          OrgPrimaryFocus.TRADING,
          OrgPrimaryFocus.EXPLORATION,
        ],
      };

      await service.getPublicDirectory(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'profile.primaryFocus IN (:...primaryFocuses)',
        {
          primaryFocuses: [
            OrgPrimaryFocus.MINING,
            OrgPrimaryFocus.TRADING,
            OrgPrimaryFocus.EXPLORATION,
          ],
        }
      );
    });

    it('should apply multi-select activity level filter (Phase 2)', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: DirectoryFilterOptions = {
        activityLevels: [ActivityLevel.HIGH, ActivityLevel.VERY_HIGH],
      };

      await service.getPublicDirectory(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'profile.activityLevel IN (:...activityLevels)',
        { activityLevels: [ActivityLevel.HIGH, ActivityLevel.VERY_HIGH] }
      );
    });

    it('should prioritize multi-select filters over single value (Phase 2)', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Both multi-select and single value provided, multi-select should win
      const filters: DirectoryFilterOptions = {
        primaryFocus: OrgPrimaryFocus.COMBAT,
        primaryFocuses: [OrgPrimaryFocus.MINING, OrgPrimaryFocus.TRADING],
      };

      await service.getPublicDirectory(filters);

      // Should use IN query for multi-select
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'profile.primaryFocus IN (:...primaryFocuses)',
        { primaryFocuses: [OrgPrimaryFocus.MINING, OrgPrimaryFocus.TRADING] }
      );
      // Should NOT use single value
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'profile.primaryFocus = :primaryFocus',
        { primaryFocus: OrgPrimaryFocus.COMBAT }
      );
    });

    it('should validate sortBy field for security (Phase 2)', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Use valid sort field
      await service.getPublicDirectory(
        {},
        { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'ASC' }
      );

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('profile.createdAt', 'ASC');
    });

    it('should fallback to memberCount for invalid sortBy (Phase 2)', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Use invalid sort field (SQL injection attempt)
      await service.getPublicDirectory(
        {},
        { page: 1, limit: 10, sortBy: 'id; DROP TABLE users;--', sortOrder: 'DESC' }
      );

      // Should fallback to memberCount instead of using the malicious value
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('profile.memberCount', 'DESC');
    });

    it('should apply pagination correctly', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 50]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getPublicDirectory({}, { page: 2, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  describe('getPublicProfile', () => {
    it('should return public profile when found by UUID', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockProfile);

      const result = await service.getPublicProfile('550e8400-e29b-41d4-a716-446655440000');

      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe('org-123');
      expect(result?.organizationName).toBe('Test Organization');
      expect(mockProfileRepository.findOne).toHaveBeenCalledWith({
        where: { organizationId: '550e8400-e29b-41d4-a716-446655440000', isPublic: true },
        relations: ['organization'],
      });
    });

    it('should return public profile when found by slug', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockProfile);

      const result = await service.getPublicProfile('test-organization');

      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe('org-123');
      expect(mockProfileRepository.findOne).toHaveBeenCalledWith({
        where: [
          { isPublic: true, organization: { rsiSid: 'TEST-ORGANIZATION' } },
          { isPublic: true, slug: 'test-organization' },
        ],
        relations: ['organization'],
      });
    });

    it('should prefer RSI SID lookup for non-UUID identifiers', async () => {
      mockProfileRepository.findOne.mockResolvedValue({
        ...mockProfile,
        organization: { ...mockProfile.organization, rsiSid: 'FRINGENAUTS' },
      });

      const result = await service.getPublicProfile('fringenauts');

      expect(result).not.toBeNull();
      expect(result?.rsiSid).toBe('FRINGENAUTS');
      expect(mockProfileRepository.findOne).toHaveBeenCalledWith({
        where: [
          { isPublic: true, organization: { rsiSid: 'FRINGENAUTS' } },
          { isPublic: true, slug: 'fringenauts' },
        ],
        relations: ['organization'],
      });
    });

    it('should return null when profile not found', async () => {
      mockProfileRepository.findOne.mockResolvedValue(null);

      const result = await service.getPublicProfile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOrCreateProfile', () => {
    it('should return existing profile if found', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockProfile);

      const result = await service.getOrCreateProfile('org-123');

      expect(result).toEqual(mockProfile);
      expect(mockProfileRepository.create).not.toHaveBeenCalled();
    });

    it('should create new profile if not found', async () => {
      mockProfileRepository.findOne.mockResolvedValue(null);
      mockOrgRepository.findOne.mockResolvedValue(mockOrganization);
      mockProfileRepository.create.mockReturnValue({
        organizationId: 'org-123',
        isPublic: false,
        primaryFocus: OrgPrimaryFocus.MIXED,
        memberCount: 50,
      });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.getOrCreateProfile('org-123');

      expect(result.organizationId).toBe('org-123');
      expect(result.isPublic).toBe(false);
      expect(mockProfileRepository.create).toHaveBeenCalled();
      expect(mockProfileRepository.save).toHaveBeenCalled();
    });

    it('should throw error if organization not found', async () => {
      mockProfileRepository.findOne.mockResolvedValue(null);
      mockOrgRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrCreateProfile('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', async () => {
      mockProfileRepository.findOne.mockResolvedValue({ ...mockProfile });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateProfile('org-123', {
        isPublic: true,
        tagline: 'New tagline',
        primaryFocus: OrgPrimaryFocus.COMBAT,
      });

      expect(result.tagline).toBe('New tagline');
      expect(result.primaryFocus).toBe(OrgPrimaryFocus.COMBAT);
      expect(mockProfileRepository.save).toHaveBeenCalled();
    });

    it('should only update provided fields', async () => {
      const existingProfile = { ...mockProfile };
      mockProfileRepository.findOne.mockResolvedValue(existingProfile);
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateProfile('org-123', {
        isRecruiting: false,
      });

      expect(result.isRecruiting).toBe(false);
      // Other fields should remain unchanged
      expect(result.tagline).toBe(mockProfile.tagline);
    });
  });

  describe('setVerificationStatus', () => {
    it('should set verification status', async () => {
      mockProfileRepository.findOne.mockResolvedValue({ ...mockProfile, isVerified: false });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.setVerificationStatus('org-123', true);

      expect(result.isVerified).toBe(true);
      expect(mockProfileRepository.save).toHaveBeenCalled();
    });
  });

  describe('deleteProfile', () => {
    it('should delete profile and return true', async () => {
      mockProfileRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteProfile('org-123');

      expect(result).toBe(true);
      expect(mockProfileRepository.delete).toHaveBeenCalledWith({ organizationId: 'org-123' });
    });

    it('should return false when no profile deleted', async () => {
      mockProfileRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteProfile('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getFocusOptions', () => {
    it('should return all focus options', () => {
      const options = service.getFocusOptions();

      expect(options).toContain(OrgPrimaryFocus.MINING);
      expect(options).toContain(OrgPrimaryFocus.TRADING);
      expect(options).toContain(OrgPrimaryFocus.COMBAT);
      expect(options.length).toBe(Object.values(OrgPrimaryFocus).length);
    });
  });

  describe('getActivityLevelOptions', () => {
    it('should return all activity level options', () => {
      const options = service.getActivityLevelOptions();

      expect(options).toContain(ActivityLevel.HIGH);
      expect(options).toContain(ActivityLevel.LOW);
      expect(options.length).toBe(Object.values(ActivityLevel).length);
    });
  });

  describe('getDirectoryStats', () => {
    it('should return directory statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 100, recruiting: 30, verified: 20 }),
        getRawMany: jest.fn().mockResolvedValue([
          { focus: 'mining', count: 10 },
          { focus: 'trading', count: 5 },
        ]),
      };

      mockProfileRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getDirectoryStats();

      expect(result.totalOrganizations).toBe(100);
      expect(result.recruitingOrganizations).toBe(30);
      expect(result.verifiedOrganizations).toBe(20);
      expect(result.byFocus.mining).toBe(10);
      expect(result.byFocus.trading).toBe(5);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
