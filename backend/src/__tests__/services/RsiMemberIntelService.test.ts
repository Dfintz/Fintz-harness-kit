/**
 * RsiMemberIntelService Tests
 * Wave 3.3: RSI Sync Enhancements
 */

import crypto from 'crypto';

import { MemberFlagType } from '@sc-fleet-manager/shared-types';

/** Mirror the deterministic UUID generation used by the service for unlinked members. */
function generateHandleUuid(handle: string): string {
  const hash = crypto.createHash('sha256').update(`unlinked:${handle.toLowerCase()}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ─── Mocks ──────────────────────────────────────────────────────────────

// Use `var` so jest.mock factory (hoisted above imports) can reference them
/* eslint-disable no-var */
var mockFind: jest.Mock;
var mockFindOne: jest.Mock;
var mockUpsert: jest.Mock;
var mockSave: jest.Mock;
var mockCreate: jest.Mock;
var mockCreateQueryBuilder: jest.Mock;
var mockRemove: jest.Mock;
var mockDelete: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      find: mockFind,
      findOne: mockFindOne,
      upsert: mockUpsert,
      save: mockSave,
      create: mockCreate,
      createQueryBuilder: mockCreateQueryBuilder,
      remove: mockRemove,
      delete: mockDelete,
    })),
  },
}));

jest.mock('../../services/discord/DiscordService', () => ({
  getDiscordService: jest.fn(() => ({
    getUserRoles: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Officer' }]),
  })),
  isDiscordServiceInitialized: jest.fn(() => false),
}));

jest.mock('../../services/intel/MemberAuditService', () => ({
  MemberAuditService: jest.fn().mockImplementation(() => ({
    createFlag: jest.fn().mockResolvedValue({ id: 'flag-1' }),
  })),
}));

jest.mock('../../services/external/RsiCrawlerService', () => ({
  RsiCrawlerService: jest.fn().mockImplementation(() => ({
    crawlUserMemberships: jest
      .fn()
      .mockResolvedValue([
        { sid: 'TEST', name: 'Test Org', rank: 'Member', stars: 3, isMain: true },
      ]),
  })),
}));

// BotClientManager mock — default: not ready (no Discord guild matching)
const mockBotClient = {
  guilds: {
    cache: {
      get: jest.fn().mockReturnValue(null),
    },
  },
};

jest.mock('../../bot/BotClientManager', () => ({
  BotClientManager: {
    getInstance: jest.fn(() => ({
      isReady: jest.fn(() => false),
      getClient: jest.fn(() => mockBotClient),
    })),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import AFTER mocks are set up
import { RsiMemberIntelService } from '../../services/external/RsiMemberIntelService';

// ─── Tests ──────────────────────────────────────────────────────────────

describe('RsiMemberIntelService', () => {
  let service: RsiMemberIntelService;

  beforeEach(() => {
    mockFind = jest.fn();
    mockFindOne = jest.fn();
    mockUpsert = jest.fn();
    mockSave = jest.fn();
    mockCreate = jest.fn();
    mockCreateQueryBuilder = jest.fn();
    mockRemove = jest.fn();
    mockDelete = jest.fn();
    service = new RsiMemberIntelService();
  });

  describe('getMemberList', () => {
    it('should return empty array when no org SID found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.getMemberList('org-1');

      expect(result.members).toEqual([]);
      expect(result.status).toBe('no_schedule');
    });

    it('should return member summaries for crawled members', async () => {
      // Schedule lookup
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });

      // crawledMembers, links, flagCounts in parallel
      mockFind
        .mockResolvedValueOnce([
          {
            handle: 'TestUser',
            displayName: 'Test',
            rank: 'Officer',
            isMain: true,
            isAffiliate: false,
            isHidden: false,
            isRedacted: false,
            stars: 3,
          },
        ])
        .mockResolvedValueOnce([]);

      // Flag counts query builder + auto-link query builder (both use createQueryBuilder)
      const chainable = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockCreateQueryBuilder.mockReturnValue(chainable);

      // guildId lookup
      mockFindOne.mockResolvedValueOnce(null);

      const result = await service.getMemberList('org-1');

      expect(result.members).toHaveLength(1);
      expect(result.members[0].rsiHandle).toBe('TestUser');
      expect(result.members[0].isMainOrg).toBe(true);
      expect(result.members[0].isLinked).toBe(false);
      expect(result.status).toBe('ok');
    });

    it('should auto-link via Discord guild name match when rsiHandle/username match fails', async () => {
      // Enable BotClientManager for this test
      const { BotClientManager } = jest.requireMock('../../bot/BotClientManager');
      BotClientManager.getInstance.mockReturnValue({
        isReady: jest.fn(() => true),
        getClient: jest.fn(() => ({
          guilds: {
            cache: {
              get: jest.fn().mockReturnValue({
                members: {
                  fetch: jest.fn().mockResolvedValue(
                    new Map([
                      [
                        'discord-111',
                        {
                          nickname: 'DiscordPlayer',
                          displayName: 'DiscordPlayer',
                          user: {
                            id: 'discord-111',
                            username: 'discordplayer',
                            displayName: 'DiscordPlayer',
                            globalName: 'DiscordPlayer',
                          },
                        },
                      ],
                    ])
                  ),
                },
              }),
            },
          },
        })),
      });

      // Schedule lookup
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });

      // crawledMembers (RSI handle = 'DiscordPlayer'), links (none)
      mockFind
        .mockResolvedValueOnce([
          {
            handle: 'DiscordPlayer',
            displayName: 'Discord Player',
            rank: 'Member',
            isMain: true,
            isAffiliate: false,
            isHidden: false,
            isRedacted: false,
            stars: 2,
          },
        ])
        .mockResolvedValueOnce([]); // no existing links

      // Flag counts + auto-link query builder (rsiHandle/username match returns nothing)
      const chainable = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockCreateQueryBuilder.mockReturnValue(chainable);

      // resolveGuildId for Discord name matching (returns a guild ID)
      mockFindOne.mockResolvedValueOnce({ guildId: 'guild-123' });

      // Discord name match: find platform user by discordId
      mockFindOne.mockResolvedValueOnce({
        id: 'user-42',
        discordId: 'discord-111',
        rsiHandle: null,
        username: 'completely_different_name',
      });

      // Verify user is active org member
      mockFindOne.mockResolvedValueOnce({ id: 'membership-1' });

      // No existing link for this user
      mockFindOne.mockResolvedValueOnce(null);

      // create + save the new link
      mockCreate.mockImplementation((data: unknown) => ({
        ...(data as Record<string, unknown>),
        markNeedsReview: jest.fn(),
      }));
      mockSave.mockImplementation((data: unknown) => ({
        ...(data as Record<string, unknown>),
        id: 'link-discord-1',
      }));

      // Final guildId lookup for Discord status check (no guild)
      mockFindOne.mockResolvedValueOnce(null);

      const result = await service.getMemberList('org-1');

      expect(result.members).toHaveLength(1);
      expect(result.members[0].rsiHandle).toBe('DiscordPlayer');
      // The member should be linked via Discord guild name match
      expect(result.members[0].isLinked).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('getMemberCard', () => {
    it('should return null if crawled member not found', async () => {
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' }); // schedule
      mockFindOne.mockResolvedValueOnce(null); // crawledMember
      mockFind.mockResolvedValue([]); // citizenOrgs, roleMappings
      mockFindOne.mockResolvedValueOnce(null); // link

      const result = await service.getMemberCard('org-1', 'UnknownUser');

      expect(result).toBeNull();
    });
  });

  describe('enrichMember', () => {
    it('should call crawler and upsert citizen orgs', async () => {
      mockUpsert.mockResolvedValue({});

      const result = await service.enrichMember('org-1', 'TestUser');

      expect(result.success).toBe(true);
      expect(result.orgsFound).toBe(1);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should return error result on crawler failure', async () => {
      const { RsiCrawlerService } = jest.requireMock('../../services/external/RsiCrawlerService');
      RsiCrawlerService.mockImplementationOnce(() => ({
        crawlUserMemberships: jest.fn().mockRejectedValue(new Error('Rate limited')),
      }));

      const service2 = new RsiMemberIntelService();
      const result = await service2.enrichMember('org-1', 'TestUser');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limited');
    });
  });

  describe('runMemberAudit', () => {
    it('should return error when no org SID configured', async () => {
      mockFindOne.mockResolvedValue(null); // schedule

      const result = await service.runMemberAudit('org-1');

      expect(result.errors).toContain('No RSI org SID configured for this organization');
    });

    it('should create MISSING_FROM_WEB_APP flags for unlinked members', async () => {
      // Schedule
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' }).mockResolvedValueOnce(null); // guildId

      // Parallel fetches: crawled, links, memberships, mappings, flags
      mockFind
        .mockResolvedValueOnce([
          {
            handle: 'UnlinkedUser',
            rank: 'Member',
            isMain: true,
            isAffiliate: false,
            isHidden: false,
          },
        ])
        .mockResolvedValueOnce([]) // no links
        .mockResolvedValueOnce([]) // memberships
        .mockResolvedValueOnce([]) // mappings
        .mockResolvedValueOnce([]); // existing flags

      mockCreate.mockImplementation(data => data);
      mockSave.mockImplementation(data => ({ ...data, id: 'flag-new' }));

      const result = await service.runMemberAudit('org-1');

      expect(result.totalChecked).toBe(1);
      expect(result.flagsCreated).toBeGreaterThanOrEqual(1);
      expect(result.flagsByType[MemberFlagType.MISSING_FROM_WEB_APP]).toBe(1);
    });

    it('should skip creating duplicate flags', async () => {
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' }).mockResolvedValueOnce(null);

      mockFind
        .mockResolvedValueOnce([
          {
            handle: 'UnlinkedUser',
            rank: 'Member',
            isMain: true,
            isAffiliate: false,
            isHidden: false,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            userId: generateHandleUuid('UnlinkedUser'),
            flagType: MemberFlagType.MISSING_FROM_WEB_APP,
          },
        ]);

      const result = await service.runMemberAudit('org-1');

      expect(result.flagsCreated).toBe(0);
      expect(result.flagsSkipped).toBe(1);
    });
  });

  describe('validateRoleMappings', () => {
    it('should return empty result when no org SID', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.validateRoleMappings('org-1');

      expect(result.totalMembers).toBe(0);
    });

    it('should detect unmapped ranks', async () => {
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' }).mockResolvedValueOnce(null);

      mockFind
        .mockResolvedValueOnce([{ handle: 'User1', rank: 'CustomRank', isMain: true }])
        .mockResolvedValueOnce([]) // links
        .mockResolvedValueOnce([]) // memberships
        .mockResolvedValueOnce([]); // no mappings

      const result = await service.validateRoleMappings('org-1');

      expect(result.unmappedRanks).toContain('CustomRank');
      expect(result.summary.noMappingDefined).toBe(1);
    });
  });

  describe('suggestLinkCandidates', () => {
    it('should return org members with link status', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { userId: 'user-1', user: { username: 'TestPlayer', discordId: '123456789' } },
          { userId: 'user-2', user: { username: 'OtherPlayer', discordId: '987654321' } },
        ]),
      };
      mockCreateQueryBuilder.mockReturnValue(mockQb);

      // Existing links query (for user-2 only)
      mockCreateQueryBuilder.mockReturnValueOnce(mockQb).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ userId: 'user-2', rsiHandle: 'ExistingHandle' }]),
      });

      const result = await service.suggestLinkCandidates('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('TestPlayer');
      expect(result[0].isAlreadyLinked).toBe(false);
      expect(result[1].username).toBe('OtherPlayer');
      expect(result[1].isAlreadyLinked).toBe(true);
      expect(result[1].existingRsiHandle).toBe('ExistingHandle');
    });
  });

  describe('manualLink', () => {
    it('should create a verified link for valid input', async () => {
      // resolveOrgSid
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });
      // crawledMember exists
      mockFindOne.mockResolvedValueOnce({ handle: 'TestUser', rank: 'Officer' });
      // membership exists
      mockFindOne.mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
      });
      // no existing user link
      mockFindOne.mockResolvedValueOnce(null);
      // no existing handle link
      mockFindOne.mockResolvedValueOnce(null);
      // user lookup for discord
      mockFindOne.mockResolvedValueOnce({ id: 'user-1', discordId: '123456789' });

      mockCreate.mockImplementation((data: unknown) => data);
      mockSave.mockImplementation((data: unknown) => ({
        ...(data as Record<string, unknown>),
        id: 'link-1',
      }));

      const result = await service.manualLink('org-1', 'TestUser', { userId: 'user-1' }, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.linkId).toBe('link-1');
      expect(result.rsiHandle).toBe('TestUser');
      expect(result.userId).toBe('user-1');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          rsiHandle: 'TestUser',
          verificationMethod: 'manual',
          syncStatus: 'synced',
        })
      );
    });

    it('should reject when user already has a link', async () => {
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });
      mockFindOne.mockResolvedValueOnce({ handle: 'TestUser' });
      mockFindOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true });
      // Existing link found
      mockFindOne.mockResolvedValueOnce({ userId: 'user-1', rsiHandle: 'OldHandle' });

      await expect(
        service.manualLink('org-1', 'TestUser', { userId: 'user-1' }, 'admin-1')
      ).rejects.toThrow('already linked');
    });

    it('should reject when RSI handle already linked to another user', async () => {
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });
      mockFindOne.mockResolvedValueOnce({ handle: 'TestUser' });
      mockFindOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true });
      mockFindOne.mockResolvedValueOnce(null); // no user link
      // Handle already linked to user-2
      mockFindOne.mockResolvedValueOnce({ userId: 'user-2', rsiHandle: 'TestUser' });

      await expect(
        service.manualLink('org-1', 'TestUser', { userId: 'user-1' }, 'admin-1')
      ).rejects.toThrow('already linked to another user');
    });

    it('should reject when user is not an active org member', async () => {
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });
      mockFindOne.mockResolvedValueOnce({ handle: 'TestUser' });
      // No active membership
      mockFindOne.mockResolvedValueOnce(null);

      await expect(
        service.manualLink('org-1', 'TestUser', { userId: 'user-1' }, 'admin-1')
      ).rejects.toThrow('not an active member');
    });
  });

  describe('unlinkMember', () => {
    it('should remove existing link', async () => {
      mockFindOne.mockResolvedValueOnce({ id: 'link-1', userId: 'user-1', rsiHandle: 'TestUser' });
      mockRemove.mockResolvedValue({});

      const result = await service.unlinkMember('org-1', 'TestUser', 'admin-1');

      expect(result.success).toBe(true);
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should throw when no link exists', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      await expect(service.unlinkMember('org-1', 'UnknownHandle', 'admin-1')).rejects.toThrow(
        'No link found'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data for an organization', async () => {
      // resolveOrgSid
      mockFindOne.mockResolvedValueOnce({ rsiOrgSid: 'TESTORG' });
      // delete crawled members
      mockDelete.mockResolvedValueOnce({ affected: 15 });
      // find user links (for citizen org cleanup)
      mockFind.mockResolvedValueOnce([{ rsiHandle: 'User1' }, { rsiHandle: 'User2' }]);
      // delete citizen orgs for User1 and User2
      mockDelete.mockResolvedValueOnce({ affected: 3 });
      mockDelete.mockResolvedValueOnce({ affected: 2 });
      // delete member cache
      mockDelete.mockResolvedValueOnce({ affected: 10 });

      const result = await service.clearCache('org-1', 'admin-1');

      expect(result.crawledMembers).toBe(15);
      expect(result.citizenOrgs).toBe(5);
      expect(result.memberCache).toBe(10);
    });

    it('should handle no org SID gracefully', async () => {
      // No schedule = no orgSid
      mockFindOne.mockResolvedValueOnce(null);
      // delete member cache still works
      mockDelete.mockResolvedValueOnce({ affected: 0 });

      const result = await service.clearCache('org-1', 'admin-1');

      expect(result.crawledMembers).toBe(0);
      expect(result.citizenOrgs).toBe(0);
      expect(result.memberCache).toBe(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
