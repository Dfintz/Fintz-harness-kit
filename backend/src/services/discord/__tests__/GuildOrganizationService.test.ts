import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { GuildOrganization } from '../../../models/GuildOrganization';
import { Organization } from '../../../models/Organization';
import { discordAuditLogger } from '../../shared/DiscordAuditLogger';
import { GuildOrganizationService } from '../GuildOrganizationService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../caching/EnhancedCacheService');
jest.mock('../../shared/DiscordAuditLogger', () => ({
  discordAuditLogger: {
    logGuildLinked: jest.fn(),
    logGuildUnlinked: jest.fn(),
  },
}));

describe('GuildOrganizationService', () => {
  let service: GuildOrganizationService;
  let mockRepository: jest.Mocked<Repository<GuildOrganization>>;
  let mockOrgRepository: jest.Mocked<Repository<Organization>>;
  let mockCache: any;

  beforeEach(() => {
    // Reset singleton instance
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
    const { EnhancedCacheService } = require('../../caching/EnhancedCacheService');
    EnhancedCacheService.mockImplementation(() => mockCache);

    // Mock repository
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    } as any;

    mockOrgRepository = {
      findOne: jest.fn(),
    } as any;

    // Mock AppDataSource
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === GuildOrganization) {
        return mockRepository;
      }
      if (entity === Organization) {
        return mockOrgRepository;
      }
      return mockRepository;
    });

    // Mock createQueryRunner for transaction support
    (AppDataSource.createQueryRunner as jest.Mock) = jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: mockRepository.findOne,
        find: mockRepository.find,
        create: mockRepository.create,
        save: mockRepository.save,
        update: mockRepository.update,
      },
    }));

    service = GuildOrganizationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdateMapping', () => {
    it('should create a new mapping when one does not exist', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';
      const guildName = 'Test Guild';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: true,
        isActive: true,
      } as GuildOrganization);
      mockRepository.save.mockResolvedValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: true,
        isActive: true,
      } as GuildOrganization);

      const result = await service.createOrUpdateMapping(guildId, organizationId, guildName);

      // Transaction-based: calls go through queryRunner.manager
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled(); // Cache should be invalidated
      expect(result.guildId).toBe(guildId);
      expect(result.organizationId).toBe(organizationId);
    });

    it('should update an existing mapping', async () => {
      const guildId = '123456789';
      const oldOrgId = 'org-old';
      const newOrgId = 'org-new';

      const existingMapping = {
        guildId,
        organizationId: oldOrgId,
        isActive: false,
        isPrimary: false,
      } as GuildOrganization;

      mockRepository.findOne.mockResolvedValue(existingMapping);
      mockRepository.save.mockResolvedValue({
        ...existingMapping,
        organizationId: newOrgId,
        isActive: true,
      } as GuildOrganization);

      const result = await service.createOrUpdateMapping(guildId, newOrgId, 'New Guild Name');

      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.organizationId).toBe(newOrgId);
    });

    it('should ensure only one primary guild per organization', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        guildId,
        organizationId,
        isPrimary: true,
        isActive: true,
      } as GuildOrganization);
      mockRepository.save.mockResolvedValue({
        guildId,
        organizationId,
        isPrimary: true,
      } as GuildOrganization);
      mockRepository.update.mockResolvedValue(undefined as any);

      await service.createOrUpdateMapping(guildId, organizationId, 'Guild', true);

      // Transaction-based: manager.update called with (Entity, where, values)
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('emits a GUILD_LINKED audit event after a successful save', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';
      const guildName = 'Audited Guild';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: true,
        isActive: true,
      } as GuildOrganization);
      mockRepository.save.mockResolvedValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: true,
        isActive: true,
      } as GuildOrganization);

      await service.createOrUpdateMapping(guildId, organizationId, guildName, true, 'user-42');

      expect(discordAuditLogger.logGuildLinked).toHaveBeenCalledWith(
        organizationId,
        guildId,
        guildName,
        'user-42',
        true
      );
    });
  });

  describe('resolveOrganization', () => {
    it('should return organization ID for mapped guild', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      mockCache.get.mockReturnValue(undefined); // Cache miss
      mockRepository.findOne.mockResolvedValue({
        guildId,
        organizationId,
        isActive: true,
      } as GuildOrganization);

      const result = await service.resolveOrganization(guildId);

      expect(result).toBe(organizationId);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { guildId, isActive: true },
      });
      expect(mockCache.set).toHaveBeenCalledWith(expect.stringContaining(guildId), organizationId, {
        ttl: expect.any(Number),
      });
    });

    it('should return cached organization ID without database query', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      mockCache.get.mockReturnValue(organizationId); // Cache hit

      const result = await service.resolveOrganization(guildId);

      expect(result).toBe(organizationId);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockRepository.findOne).not.toHaveBeenCalled(); // No DB query
    });

    it('should return null for unmapped guild and cache the result', async () => {
      const guildId = '123456789';

      mockCache.get.mockReturnValue(undefined); // Cache miss
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.resolveOrganization(guildId);

      expect(result).toBeNull();
      expect(mockCache.set).toHaveBeenCalledWith(expect.stringContaining(guildId), null, {
        ttl: expect.any(Number),
      });
    });

    it('should handle database errors gracefully', async () => {
      const guildId = '123456789';

      mockCache.get.mockReturnValue(undefined);
      mockRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.resolveOrganization(guildId);

      expect(result).toBeNull();
    });
  });

  describe('resolveOrganizationWithFallback', () => {
    it('should return mapped organization ID when mapping exists', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      mockCache.get.mockReturnValue(organizationId); // Cache hit

      const result = await service.resolveOrganizationWithFallback(guildId);

      expect(result).toBe(organizationId);
    });

    it('should fall back to guild ID when no mapping exists', async () => {
      const guildId = '123456789';

      mockCache.get.mockReturnValue(null); // Cached null result

      const result = await service.resolveOrganizationWithFallback(guildId);

      expect(result).toBe(guildId);
    });
  });

  describe('getGuildsForOrganization', () => {
    it('should return all active guilds for an organization', async () => {
      const organizationId = 'org-123';
      const guilds = [
        { guildId: '111', organizationId, isActive: true, isPrimary: true } as GuildOrganization,
        { guildId: '222', organizationId, isActive: true, isPrimary: false } as GuildOrganization,
      ];

      mockRepository.find.mockResolvedValue(guilds);

      const result = await service.getGuildsForOrganization(organizationId);

      expect(result).toEqual(guilds);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId, isActive: true },
        order: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      });
    });

    it('should return all guilds including inactive when activeOnly is false', async () => {
      const organizationId = 'org-123';

      mockRepository.find.mockResolvedValue([]);

      await service.getGuildsForOrganization(organizationId, false);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId },
        order: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      });
    });
  });

  describe('getPrimaryGuildForOrganization', () => {
    it('should return the primary guild', async () => {
      const organizationId = 'org-123';
      const primaryGuild = {
        guildId: '111',
        organizationId,
        isActive: true,
        isPrimary: true,
      } as GuildOrganization;

      mockRepository.findOne.mockResolvedValue(primaryGuild);

      const result = await service.getPrimaryGuildForOrganization(organizationId);

      expect(result).toEqual(primaryGuild);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId,
          isActive: true,
          isPrimary: true,
        },
      });
    });
  });

  describe('deactivateMapping', () => {
    it('should deactivate an existing mapping', async () => {
      const guildId = '123456789';
      const userId = 'user-123';
      const mapping = {
        guildId,
        isActive: true,
        deactivate: jest.fn(),
      } as unknown as GuildOrganization;

      mockRepository.findOne.mockResolvedValue(mapping);
      mockRepository.save.mockResolvedValue(mapping);

      const result = await service.deactivateMapping(guildId, userId);

      expect(result).toBe(true);
      expect(mapping.deactivate).toHaveBeenCalledWith(userId);
      expect(mockRepository.save).toHaveBeenCalledWith(mapping);
      expect(mockCache.del).toHaveBeenCalled(); // Cache should be invalidated
    });

    it('should return false when mapping does not exist', async () => {
      const guildId = '123456789';
      const userId = 'user-123';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.deactivateMapping(guildId, userId);

      expect(result).toBe(false);
    });

    it('emits a GUILD_UNLINKED audit event with the captured pre-delete org id', async () => {
      const guildId = '123456789';
      const userId = 'user-123';
      const mapping = {
        guildId,
        organizationId: 'org-pre-delete',
        guildName: 'Soon Gone',
        isActive: true,
        deactivate: jest.fn(),
      } as unknown as GuildOrganization;

      mockRepository.findOne.mockResolvedValue(mapping);
      mockRepository.save.mockResolvedValue(mapping);

      await service.deactivateMapping(guildId, userId);

      expect(discordAuditLogger.logGuildUnlinked).toHaveBeenCalledWith(
        'org-pre-delete',
        guildId,
        'Soon Gone',
        userId
      );
    });
  });

  describe('syncOnDiscordConnection', () => {
    it('should create mapping as primary when org has no guilds', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';
      const guildName = 'Test Guild';
      const userId = 'user-123';

      mockRepository.find.mockResolvedValue([]);
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: true,
      } as GuildOrganization);
      mockRepository.save.mockResolvedValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: true,
      } as GuildOrganization);

      const result = await service.syncOnDiscordConnection(
        guildId,
        organizationId,
        guildName,
        userId
      );

      expect(result.isPrimary).toBe(true);
    });

    it('should create mapping as non-primary when org has existing guilds', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';
      const guildName = 'Test Guild';
      const userId = 'user-123';

      const existingGuilds = [{ guildId: '111', organizationId } as GuildOrganization];

      mockRepository.find.mockResolvedValue(existingGuilds);
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: false,
      } as GuildOrganization);
      mockRepository.save.mockResolvedValue({
        guildId,
        organizationId,
        guildName,
        isPrimary: false,
      } as GuildOrganization);

      const result = await service.syncOnDiscordConnection(
        guildId,
        organizationId,
        guildName,
        userId
      );

      expect(result.isPrimary).toBe(false);
    });
  });

  describe('isMapped', () => {
    it('should return true when guild is mapped', async () => {
      const guildId = '123456789';

      mockRepository.count.mockResolvedValue(1);

      const result = await service.isMapped(guildId);

      expect(result).toBe(true);
    });

    it('should return false when guild is not mapped', async () => {
      const guildId = '123456789';

      mockRepository.count.mockResolvedValue(0);

      const result = await service.isMapped(guildId);

      expect(result).toBe(false);
    });
  });

  describe('getMapping', () => {
    it('should return mapping with organization relation', async () => {
      const guildId = '123456789';
      const mapping = {
        guildId,
        organizationId: 'org-123',
        organization: { id: 'org-123', name: 'Test Org' },
      } as GuildOrganization;

      mockRepository.findOne.mockResolvedValue(mapping);

      const result = await service.getMapping(guildId);

      expect(result).toEqual(mapping);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { guildId },
        relations: ['organization'],
      });
    });
  });

  describe('getOrganizationsForGuild', () => {
    it('should return organization IDs for guild', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      mockRepository.findOne.mockResolvedValue({
        guildId,
        organizationId,
        isActive: true,
      } as GuildOrganization);

      const result = await service.getOrganizationsForGuild(guildId);

      expect(result).toEqual([organizationId]);
    });

    it('should return empty array when guild is not mapped', async () => {
      const guildId = '123456789';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getOrganizationsForGuild(guildId);

      expect(result).toEqual([]);
    });
  });

  describe('Cache Management', () => {
    it('should clear all cache', () => {
      service.clearCache();

      expect(mockCache.flushAll).toHaveBeenCalled();
    });

    it('should return cache metrics', () => {
      const metrics = service.getCacheMetrics();

      expect(mockCache.getMetrics).toHaveBeenCalled();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
    });

    it('should invalidate cache on mapping creation', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        guildId,
        organizationId,
        isPrimary: true,
        isActive: true,
      } as GuildOrganization);
      mockRepository.save.mockResolvedValue({
        guildId,
        organizationId,
      } as GuildOrganization);

      await service.createOrUpdateMapping(guildId, organizationId);

      expect(mockCache.del).toHaveBeenCalledWith(expect.stringContaining(guildId));
    });

    it('should invalidate cache on mapping update', async () => {
      const guildId = '123456789';
      const oldOrgId = 'org-old';
      const newOrgId = 'org-new';

      const existingMapping = {
        guildId,
        organizationId: oldOrgId,
        isActive: false,
        isPrimary: false,
      } as GuildOrganization;

      mockRepository.findOne.mockResolvedValue(existingMapping);
      mockRepository.save.mockResolvedValue({
        ...existingMapping,
        organizationId: newOrgId,
        isActive: true,
      } as GuildOrganization);

      await service.createOrUpdateMapping(guildId, newOrgId);

      expect(mockCache.del).toHaveBeenCalled();
    });

    it('should use cached value on second call', async () => {
      const guildId = '123456789';
      const organizationId = 'org-123';

      // First call - cache miss
      mockCache.get.mockReturnValueOnce(undefined);
      mockRepository.findOne.mockResolvedValue({
        guildId,
        organizationId,
        isActive: true,
      } as GuildOrganization);

      const result1 = await service.resolveOrganization(guildId);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      mockCache.get.mockReturnValueOnce(organizationId);
      const result2 = await service.resolveOrganization(guildId);

      expect(result1).toBe(organizationId);
      expect(result2).toBe(organizationId);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1); // Should not query DB again
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

