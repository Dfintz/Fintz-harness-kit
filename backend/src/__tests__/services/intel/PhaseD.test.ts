/**
 * MemberProfileService — Phase D unit tests
 *
 * Wave 2.1 — Membership Audit & Intel
 */

/* ─── Mock AppDataSource ─────────────────────────────────────────── */

const mockRsiLinkRepo = {
  findOne: jest.fn(),
};
const mockRsiCacheRepo = {
  find: jest.fn().mockResolvedValue([]),
};
const mockMembershipRepo = {
  find: jest.fn().mockResolvedValue([]),
};

// MemberAuditService and OrgWatchlistService both call getRepository too:
const mockFlagRepo = {
  create: jest.fn((d: Record<string, unknown>) => d),
  save: jest.fn((e: Record<string, unknown>) => ({ ...e, id: 'flag-1' })),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
};
const mockWatchlistRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'RsiUserLink') return mockRsiLinkRepo;
      if (name === 'RsiMemberCache') return mockRsiCacheRepo;
      if (name === 'OrganizationMembership') return mockMembershipRepo;
      if (name === 'MemberAuditEvent') return mockFlagRepo;
      if (name === 'OrgWatchlistEntry') return mockWatchlistRepo;
      return mockFlagRepo;
    }),
  },
}));

/* ─── Mock ModerationIncidentService ─────────────────────────────── */

const mockLookupUser = jest.fn().mockResolvedValue({
  targetDiscordId: 'disc-123',
  totalIncidents: 0,
  activeIncidents: 0,
  highestSeverity: 1,
  incidentsByType: {},
  incidentsBySeverity: {},
  sharedIncidents: 0,
  incidents: [],
});

jest.mock('../../../services/discord/ModerationIncidentService', () => ({
  ModerationIncidentService: {
    getInstance: () => ({
      lookupUser: mockLookupUser,
    }),
  },
}));

/* ─── Import service under test ──────────────────────────────────── */

import { MemberProfileService } from '../../../services/intel/MemberProfileService';

/* ─── Constants ──────────────────────────────────────────────────── */

const ORG_ID = 'org-abc';
const USER_ID = 'user-42';

const makeRsiLink = (overrides?: Record<string, unknown>) => ({
  id: 'link-1',
  userId: USER_ID,
  organizationId: ORG_ID,
  rsiHandle: 'TestPilot',
  syncStatus: 'SYNCED',
  lastSyncedAt: new Date('2026-01-15T10:00:00Z'),
  lastKnownRank: 'Captain',
  isAffiliate: false,
  discordUserId: 'disc-123',
  ...overrides,
});

/* ================================================================= */

describe('MemberProfileService', () => {
  let service: MemberProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MemberProfileService();
  });

  /* ─── getProfile — basic assembly ──────────────────────────────── */

  describe('getProfile', () => {
    it('should return a complete profile when RSI link exists', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(makeRsiLink());
      mockRsiCacheRepo.find.mockResolvedValueOnce([
        {
          rsiOrgSid: 'TESTORG',
          displayName: 'Test Org',
          rsiRank: 'Captain',
          isAffiliate: false,
        },
      ]);

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.userId).toBe(USER_ID);
      expect(profile.organizationId).toBe(ORG_ID);
      expect(profile.rsi).not.toBeNull();
      expect(profile.rsi!.rsiHandle).toBe('TestPilot');
      expect(profile.rsi!.verificationStatus).toBe('verified');
      expect(profile.rsi!.rank).toBe('Captain');
      expect(profile.rsi!.otherRsiOrgs).toHaveLength(1);
      expect(profile.discord).toBeNull(); // Deferred to Phase F
      expect(profile.generatedAt).toBeDefined();
    });

    it('should return null RSI when no link found', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(null);

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.rsi).toBeNull();
      expect(profile.watchlistHits).toEqual([]);
    });

    it('should include active flags from audit service', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(null);

      const profile = await service.getProfile(ORG_ID, USER_ID);

      // The mock returns empty arrays, verifying integration
      expect(profile.activeFlags).toEqual([]);
      expect(profile.flagStats).toBeDefined();
    });

    it('should fetch platform memberships', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(null);
      mockMembershipRepo.find.mockResolvedValueOnce([
        {
          organizationId: ORG_ID,
          organization: { name: 'My Org' },
          role: 'officer',
          title: 'Intel Lead',
          isActive: true,
          joinedAt: new Date('2025-06-01T00:00:00Z'),
        },
      ]);

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.platformMemberships).toHaveLength(1);
      expect(profile.platformMemberships[0].role).toBe('officer');
      expect(profile.platformMemberships[0].organizationName).toBe('My Org');
      expect(typeof profile.platformMemberships[0].joinedAt).toBe('string');
    });
  });

  /* ─── RSI verification status mapping ──────────────────────────── */

  describe('RSI verification status mapping', () => {
    const testCases = [
      { syncStatus: 'SYNCED', expected: 'verified' },
      { syncStatus: 'PENDING', expected: 'pending' },
      { syncStatus: 'FAILED', expected: 'failed' },
      { syncStatus: 'NEEDS_REVIEW', expected: 'failed' },
      { syncStatus: 'REMOVED', expected: 'removed' },
      { syncStatus: 'UNKNOWN', expected: 'pending' },
    ];

    for (const { syncStatus, expected } of testCases) {
      it(`should map ${syncStatus} to ${expected}`, async () => {
        mockRsiLinkRepo.findOne.mockResolvedValueOnce(makeRsiLink({ syncStatus }));

        const profile = await service.getProfile(ORG_ID, USER_ID);
        expect(profile.rsi!.verificationStatus).toBe(expected);
      });
    }
  });

  /* ─── Moderation summary ───────────────────────────────────────── */

  describe('moderation summary', () => {
    it('should include moderation summary when discordUserId is available', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(makeRsiLink());
      mockLookupUser.mockResolvedValueOnce({
        targetDiscordId: 'disc-123',
        totalIncidents: 3,
        activeIncidents: 1,
        highestSeverity: 5,
        sharedIncidents: 1,
        lastIncident: new Date('2026-01-20T12:00:00Z'),
        incidents: [],
      });

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.moderation).not.toBeNull();
      expect(profile.moderation!.totalIncidents).toBe(3);
      expect(profile.moderation!.activeIncidents).toBe(1);
      expect(profile.moderation!.sharedIncidents).toBe(1);
      expect(profile.moderation!.lastIncidentAt).toBe('2026-01-20T12:00:00.000Z');
    });

    it('should return null moderation when no discordUserId', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(makeRsiLink({ discordUserId: null }));

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.moderation).toBeNull();
      expect(mockLookupUser).not.toHaveBeenCalled();
    });

    it('should handle ModerationIncidentService errors gracefully', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(makeRsiLink());
      mockLookupUser.mockRejectedValueOnce(new Error('Service unavailable'));

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.moderation).toBeNull();
    });
  });

  /* ─── Watchlist cross-reference ────────────────────────────────── */

  describe('watchlist cross-reference', () => {
    it('should return empty when no RSI orgs', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(null);

      const profile = await service.getProfile(ORG_ID, USER_ID);
      expect(profile.watchlistHits).toEqual([]);
    });

    it('should cross-reference RSI handle against citizen watchlist', async () => {
      mockRsiLinkRepo.findOne.mockResolvedValueOnce(makeRsiLink());
      mockRsiCacheRepo.find.mockResolvedValueOnce([]);
      // Mock watchlist find to return a match on the citizen handle
      mockWatchlistRepo.find.mockResolvedValueOnce([
        {
          id: 'w-1',
          organizationId: ORG_ID,
          rsiHandle: 'TEST_CITIZEN',
          citizenName: 'Test Citizen',
          reason: 'hostile',
          threatLevel: 'high',
          addedBy: 'officer-1',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]);

      const profile = await service.getProfile(ORG_ID, USER_ID);

      expect(profile.watchlistHits).toHaveLength(1);
      expect(profile.watchlistHits[0].rsiHandle).toBe('TEST_CITIZEN');
    });
  });
});
