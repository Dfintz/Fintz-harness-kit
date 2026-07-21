/**
 * OrgTrustScoreService tests — Sprint 21-A
 *
 * Verifies the composite trust score computation for organizations.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockMembershipFind = jest.fn();
const mockMembershipCount = jest.fn();
const mockOrgFindOne = jest.fn();
const mockRelationshipFind = jest.fn();
const mockRsiLinkFind = jest.fn();
const mockReputationFind = jest.fn();

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: { name: string }) => {
      switch (entity.name) {
        case 'OrganizationMembership':
          return {
            find: mockMembershipFind,
            count: mockMembershipCount,
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getQuery: jest.fn().mockReturnValue('(subquery)'),
            }),
          };
        case 'RsiUserLink':
          return { find: mockRsiLinkFind };
        case 'LFGUserReputation':
          return {
            find: mockReputationFind,
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              setParameter: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ avgScore: '70' }),
              getMany: jest.fn().mockImplementation(() => mockReputationFind()),
            }),
          };
        case 'OrganizationRelationship':
          return { find: mockRelationshipFind };
        case 'Organization':
          return { findOne: mockOrgFindOne };
        default:
          return {};
      }
    }),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  OrgTrustScore,
  OrgTrustScoreService,
} from '../../services/organization/OrgTrustScoreService';

describe('OrgTrustScoreService', () => {
  let service: OrgTrustScoreService;
  const ORG_ID = 'org-123';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrgTrustScoreService();
  });

  const setupDefaults = () => {
    mockMembershipCount.mockResolvedValue(3);
    mockMembershipFind.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]);
    mockOrgFindOne.mockResolvedValue({ id: ORG_ID, rsiVerified: true });
    mockRelationshipFind.mockResolvedValue([{ trustScore: 80 }, { trustScore: 60 }]);
    mockRsiLinkFind.mockResolvedValue([
      { isVerified: () => true },
      { isVerified: () => true },
      { isVerified: () => false },
    ]);
    mockReputationFind.mockResolvedValue([
      {
        overallScore: 75,
        categoryAverages: {
          communication: 4.0,
          teamwork: 3.5,
          skill: 4.0,
          reliability: 4.5,
          leadership: 3.0,
        },
      },
      {
        overallScore: 65,
        categoryAverages: {
          communication: 3.0,
          teamwork: 4.0,
          skill: 3.5,
          reliability: 3.5,
          leadership: 2.5,
        },
      },
    ]);
  };

  it('should compute a composite trust score with all components', async () => {
    setupDefaults();

    const result: OrgTrustScore = await service.getTrustScore(ORG_ID);

    expect(result.organizationId).toBe(ORG_ID);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.tier).toBeDefined();
    expect(result.computedAt).toBeDefined();

    // Breakdown assertions
    const b = result.breakdown;
    expect(b.totalMembers).toBe(3);
    expect(b.verifiedMemberCount).toBe(2);
    expect(b.verifiedMemberRate).toBeCloseTo(66.67, 0);
    expect(b.orgRsiVerified).toBe(true);
    expect(b.activeRelationships).toBe(2);
    expect(b.avgRelationshipTrust).toBe(70);
    expect(b.categoryAverages.communication).toBeCloseTo(3.5, 1);
    expect(b.categoryAverages.reliability).toBeCloseTo(4.0, 1);
  });

  it('should return neutral defaults when org has no members', async () => {
    mockMembershipCount.mockResolvedValue(0);
    mockMembershipFind.mockResolvedValue([]);
    mockOrgFindOne.mockResolvedValue({ id: ORG_ID, rsiVerified: false });
    mockRelationshipFind.mockResolvedValue([]);

    const result = await service.getTrustScore(ORG_ID);

    expect(result.breakdown.totalMembers).toBe(0);
    expect(result.breakdown.verifiedMemberCount).toBe(0);
    expect(result.breakdown.verifiedMemberRate).toBe(0);
    expect(result.breakdown.avgMemberReputation).toBe(50); // neutral
    expect(result.breakdown.avgRelationshipTrust).toBe(50); // neutral
    expect(result.breakdown.orgRsiVerified).toBe(false);
  });

  it('should give Platinum tier for very high scores', async () => {
    // All perfect: verified org, all members verified, high reputation, high trust
    mockMembershipCount.mockResolvedValue(1);
    mockMembershipFind.mockResolvedValue([{ userId: 'u1' }]);
    mockOrgFindOne.mockResolvedValue({ id: ORG_ID, rsiVerified: true });
    mockRelationshipFind.mockResolvedValue([{ trustScore: 95 }]);
    mockRsiLinkFind.mockResolvedValue([{ isVerified: () => true }]);
    mockReputationFind.mockResolvedValue([
      {
        overallScore: 95,
        categoryAverages: {
          communication: 5,
          teamwork: 5,
          skill: 5,
          reliability: 5,
          leadership: 5,
        },
      },
    ]);

    const result = await service.getTrustScore(ORG_ID);

    expect(result.tier).toBe('Platinum');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should give Unranked tier for very low scores', async () => {
    mockMembershipCount.mockResolvedValue(1);
    mockMembershipFind.mockResolvedValue([{ userId: 'u1' }]);
    mockOrgFindOne.mockResolvedValue({ id: ORG_ID, rsiVerified: false });
    mockRelationshipFind.mockResolvedValue([{ trustScore: 5 }]);
    mockRsiLinkFind.mockResolvedValue([{ isVerified: () => false }]);
    mockReputationFind.mockResolvedValue([
      {
        overallScore: 10,
        categoryAverages: {
          communication: 1,
          teamwork: 1,
          skill: 1,
          reliability: 1,
          leadership: 1,
        },
      },
    ]);

    const result = await service.getTrustScore(ORG_ID);

    expect(result.tier).toBe('Unranked');
    expect(result.score).toBeLessThan(40);
  });

  it('should cache results on subsequent calls', async () => {
    setupDefaults();

    const first = await service.getTrustScore(ORG_ID);
    const second = await service.getTrustScore(ORG_ID);

    expect(first.score).toBe(second.score);
    // Membership count should only be queried once (cache hit on second)
    expect(mockMembershipCount).toHaveBeenCalledTimes(1);
  });

  it('should handle null org gracefully', async () => {
    mockMembershipFind.mockResolvedValue([{ userId: 'u1' }]);
    mockOrgFindOne.mockResolvedValue(null);
    mockRelationshipFind.mockResolvedValue([]);
    mockRsiLinkFind.mockResolvedValue([]);
    mockReputationFind.mockResolvedValue([]);

    const result = await service.getTrustScore(ORG_ID);

    expect(result.breakdown.orgRsiVerified).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('should handle members with no categoryAverages', async () => {
    mockMembershipFind.mockResolvedValue([{ userId: 'u1' }]);
    mockOrgFindOne.mockResolvedValue({ id: ORG_ID, rsiVerified: false });
    mockRelationshipFind.mockResolvedValue([]);
    mockRsiLinkFind.mockResolvedValue([]);
    mockReputationFind.mockResolvedValue([{ overallScore: 60, categoryAverages: null }]);

    const result = await service.getTrustScore(ORG_ID);

    expect(result.breakdown.categoryAverages.communication).toBe(0);
    expect(result.breakdown.categoryAverages.teamwork).toBe(0);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
