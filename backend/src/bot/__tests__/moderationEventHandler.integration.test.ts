import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { ModerationIncidentService } from '../../services/discord/ModerationIncidentService';
import { GuildOrganization } from '../../models/GuildOrganization';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/discord/ModerationIncidentService');
jest.mock('../../services/discord/BlacklistSharingService');
jest.mock('../../services/caching/EnhancedCacheService');

describe('Moderation Event Handler - Organization Resolution', () => {
  let guildOrgService: GuildOrganizationService;
  let mockRepository: any;
  let mockCache: any;

  beforeEach(() => {
    // Reset singleton
    (GuildOrganizationService as any).instance = undefined;

    // Mock cache
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushAll: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        hits: 0,
        misses: 0,
        keys: 0,
        hitRate: 0,
      }),
    };

    // Mock EnhancedCacheService
    const { EnhancedCacheService } = require('../../services/caching/EnhancedCacheService');
    EnhancedCacheService.mockImplementation(() => mockCache);

    // Mock repository methods
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    const mockOrgRepository = {
      findOne: jest.fn(),
    };

    // Mock AppDataSource
    const { AppDataSource } = require('../../config/database');
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === GuildOrganization || entity?.name === 'GuildOrganization') {
        return mockRepository;
      }
      return mockOrgRepository;
    });

    guildOrgService = GuildOrganizationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Organization Resolution in Moderation Events', () => {
    it('should resolve organization ID from guild mapping', async () => {
      const guildId = '123456789';
      const organizationId = 'org-mapped-123';

      mockCache.get.mockReturnValue(undefined); // Cache miss
      mockRepository.findOne.mockResolvedValue({
        guildId,
        organizationId,
        isActive: true,
      } as GuildOrganization);

      const resolvedOrgId = await guildOrgService.resolveOrganization(guildId);

      expect(resolvedOrgId).toBe(organizationId);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { guildId, isActive: true },
      });
      expect(mockCache.set).toHaveBeenCalled(); // Should cache the result
    });

    it('should use cached organization ID on subsequent calls', async () => {
      const guildId = '123456789';
      const organizationId = 'org-mapped-123';

      mockCache.get.mockReturnValue(organizationId); // Cache hit

      const resolvedOrgId = await guildOrgService.resolveOrganization(guildId);

      expect(resolvedOrgId).toBe(organizationId);
      expect(mockRepository.findOne).not.toHaveBeenCalled(); // Should not query DB
    });

    it('should return null when no mapping exists', async () => {
      const guildId = '987654321';

      mockCache.get.mockReturnValue(undefined);
      mockRepository.findOne.mockResolvedValue(null);

      const resolvedOrgId = await guildOrgService.resolveOrganization(guildId);

      expect(resolvedOrgId).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { guildId, isActive: true },
      });
      expect(mockCache.set).toHaveBeenCalledWith(expect.stringContaining(guildId), null, {
        ttl: expect.any(Number),
      }); // Should cache null result
    });

    it('should fall back to guild ID when no mapping exists', async () => {
      const guildId = '987654321';

      mockCache.get.mockReturnValue(undefined);
      mockRepository.findOne.mockResolvedValue(null);

      const resolvedOrgId = await guildOrgService.resolveOrganizationWithFallback(guildId);

      expect(resolvedOrgId).toBe(guildId);
    });

    it('should use mapped organization with fallback when mapping exists', async () => {
      const guildId = '123456789';
      const mappedOrgId = 'org-mapped-123';

      mockCache.get.mockReturnValue(mappedOrgId); // Cache hit

      const resolvedOrgId = await guildOrgService.resolveOrganizationWithFallback(guildId);

      expect(resolvedOrgId).toBe(mappedOrgId);
    });

    it('should handle multi-guild organizations correctly', async () => {
      const organizationId = 'org-multi-123';
      const guild1Id = '111111111';
      const guild2Id = '222222222';

      const guilds = [
        {
          guildId: guild1Id,
          organizationId,
          isActive: true,
          isPrimary: true,
        },
        {
          guildId: guild2Id,
          organizationId,
          isActive: true,
          isPrimary: false,
        },
      ] as GuildOrganization[];

      mockRepository.find.mockResolvedValue(guilds);

      const organizationGuilds = await guildOrgService.getGuildsForOrganization(organizationId);

      expect(organizationGuilds).toHaveLength(2);
      expect(organizationGuilds[0].isPrimary).toBe(true);
      expect(organizationGuilds[0].guildId).toBe(guild1Id);
    });

    it('should only return active mappings by default', async () => {
      const organizationId = 'org-123';

      mockRepository.find.mockResolvedValue([]);

      await guildOrgService.getGuildsForOrganization(organizationId, true);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId, isActive: true },
        order: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      });
    });

    it('should return null when no active mapping exists for resolution', async () => {
      const guildId = '123456789';

      mockRepository.findOne.mockResolvedValue(null);

      const resolvedOrgId = await guildOrgService.resolveOrganization(guildId);

      expect(resolvedOrgId).toBeNull();
    });

    it('should maintain backward compatibility by falling back to guild ID', async () => {
      const guildId = '555555555';

      mockRepository.findOne.mockResolvedValue(null);

      const resolvedOrgId = await guildOrgService.resolveOrganizationWithFallback(guildId);

      expect(resolvedOrgId).toBe(guildId);
    });

    it('should support checking if a guild is mapped', async () => {
      const mappedGuildId = '123456789';
      const unmappedGuildId = '987654321';

      mockRepository.count
        .mockResolvedValueOnce(1) // mapped guild
        .mockResolvedValueOnce(0); // unmapped guild

      const isMapped1 = await guildOrgService.isMapped(mappedGuildId);
      const isMapped2 = await guildOrgService.isMapped(unmappedGuildId);

      expect(isMapped1).toBe(true);
      expect(isMapped2).toBe(false);
    });

    it('should get primary guild for an organization', async () => {
      const organizationId = 'org-123';
      const primaryGuildId = '111111111';

      mockRepository.findOne.mockResolvedValue({
        guildId: primaryGuildId,
        organizationId,
        isActive: true,
        isPrimary: true,
      } as GuildOrganization);

      const primaryGuild = await guildOrgService.getPrimaryGuildForOrganization(organizationId);

      expect(primaryGuild).toBeDefined();
      expect(primaryGuild?.guildId).toBe(primaryGuildId);
      expect(primaryGuild?.isPrimary).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
