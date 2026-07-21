import { AppDataSource } from '../../../data-source';
import { SCStatsOrgAnalyticsService } from '../SCStatsOrgAnalyticsService';

// Mock dependencies
jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/encryptionTransformer', () => ({
  encryptionTransformer: {
    to: jest.fn((v: string) => v),
    from: jest.fn((v: string) => v),
  },
}));

/**
 * Creates a chainable mock QueryBuilder that returns `result` from the terminal method.
 * `terminal` is either 'getRawOne' or 'getRawMany'.
 */
function createMockQueryBuilder(terminal: 'getRawOne' | 'getRawMany', result: unknown) {
  const qb: Record<string, jest.Mock> = {};
  const chainMethods = [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'setParameter',
    'orderBy',
    'limit',
    'from',
    'subQuery',
    'getQuery',
  ];
  for (const m of chainMethods) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  // subQuery returns a fresh builder whose getQuery returns a placeholder SQL string
  qb.subQuery = jest.fn().mockReturnValue(qb);
  qb.getQuery = jest.fn().mockReturnValue('(SELECT 1)');
  qb.getRawOne = jest.fn().mockResolvedValue(terminal === 'getRawOne' ? result : undefined);
  qb.getRawMany = jest.fn().mockResolvedValue(terminal === 'getRawMany' ? result : []);
  return qb;
}

describe('SCStatsOrgAnalyticsService', () => {
  let service: SCStatsOrgAnalyticsService;
  let mockMembershipRepo: Record<string, jest.Mock>;
  let mockPreferencesRepo: Record<string, jest.Mock>;
  let mockCsvImportRepo: Record<string, jest.Mock>;

  const ORG_ID = 'org-123';

  /** Mock CSV import records with hoursByCareer in summary */
  const mockCsvImports = [
    {
      userId: 'user-1',
      summary: {
        hoursByCareer: [
          { career: 'Combat', hours: 250, shipCount: 3 },
          { career: 'Medical', hours: 80, shipCount: 1 },
          { career: 'Capital Crew', hours: 100, shipCount: 1 },
        ],
      },
    },
    {
      userId: 'user-2',
      summary: {
        hoursByCareer: [
          { career: 'Mining', hours: 30, shipCount: 1 },
          { career: 'Salvaging', hours: 600, shipCount: 2 },
        ],
      },
    },
  ];

  /**
   * Configure mock repos for a standard org with 3 members and 2 verified.
   * The service now uses count(), createQueryBuilder().getRawOne/getRawMany,
   * and csvImportRepo.find().
   */
  function setupStandardOrg(opts?: {
    memberCount?: number;
    aggregates?: Record<string, unknown>;
    topPerformers?: Array<Record<string, unknown>>;
    memberIds?: Array<{ userId: string }>;
    csvImports?: unknown[];
  }) {
    const memberCount = opts?.memberCount ?? 3;
    const aggregates = opts?.aggregates ?? {
      verifiedCount: 2,
      averageKD: '2.0',
      averageTotalHours: '175',
      averageMissionsCompleted: '75',
    };
    const topPerformers = opts?.topPerformers ?? [
      { userId: 'user-1', kdRatio: '2.5', totalHours: '200' },
      { userId: 'user-2', kdRatio: '1.5', totalHours: '150' },
    ];
    const memberIds = opts?.memberIds ?? [
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ];

    mockMembershipRepo.count.mockResolvedValue(memberCount);

    // createQueryBuilder is called once for memberIds (getRawMany)
    const memberIdQb = createMockQueryBuilder('getRawMany', memberIds);
    mockMembershipRepo.createQueryBuilder.mockReturnValue(memberIdQb);

    // preferencesRepo.createQueryBuilder is called twice:
    //   1st: aggregation (getRawOne), 2nd: topPerformers (getRawMany)
    const aggregateQb = createMockQueryBuilder('getRawOne', aggregates);
    const topPerformerQb = createMockQueryBuilder('getRawMany', topPerformers);
    mockPreferencesRepo.createQueryBuilder
      .mockReturnValueOnce(aggregateQb)
      .mockReturnValueOnce(topPerformerQb);

    mockCsvImportRepo.find.mockResolvedValue(opts?.csvImports ?? mockCsvImports);
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockMembershipRepo = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockPreferencesRepo = {
      createQueryBuilder: jest.fn(),
    };

    mockCsvImportRepo = {
      find: jest.fn().mockResolvedValue(mockCsvImports),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      const entityName = typeof entity === 'function' ? (entity as { name: string }).name : '';
      if (entityName === 'OrganizationMembership') {
        return mockMembershipRepo;
      }
      if (entityName === 'UserGameplayPreferences') {
        return mockPreferencesRepo;
      }
      if (entityName === 'SCStatsCsvImport') {
        return mockCsvImportRepo;
      }
      return {};
    });

    service = new SCStatsOrgAnalyticsService();
  });

  describe('getOrgAnalytics', () => {
    it('should return analytics for an organization with verified members', async () => {
      setupStandardOrg();

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.memberCount).toBe(3);
      expect(result.verifiedCount).toBe(2);
      expect(result.verificationRate).toBeCloseTo(66.67, 1);
      expect(result.averageKD).toBeCloseTo(2, 1);
      expect(result.averageTotalHours).toBeCloseTo(175, 0);
      expect(result.averageMissionsCompleted).toBeCloseTo(75, 0);
    });

    it('should return top performers sorted by K/D', async () => {
      setupStandardOrg();

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.topPerformers).toHaveLength(2);
      expect(result.topPerformers[0].userId).toBe('user-1');
      expect(result.topPerformers[0].kdRatio).toBe(2.5);
      expect(result.topPerformers[1].userId).toBe('user-2');
    });

    it('should calculate skill distribution from CSV import data', async () => {
      setupStandardOrg();

      const result = await service.getOrgAnalytics(ORG_ID);

      // user-1: Combat 250h → high, Medical 80h → medium, Capital Crew 100h → medium
      // user-2: Mining 30h → low, Salvaging 600h → expert
      expect(result.skillDistribution.Combat).toBeDefined();
      expect(result.skillDistribution.Combat.high).toBe(1);
      expect(result.skillDistribution.Medical).toBeDefined();
      expect(result.skillDistribution.Medical.medium).toBe(1);
      expect(result.skillDistribution['Capital Crew']).toBeDefined();
      expect(result.skillDistribution['Capital Crew'].medium).toBe(1);
      expect(result.skillDistribution.Mining).toBeDefined();
      expect(result.skillDistribution.Mining.low).toBe(1);
      expect(result.skillDistribution.Salvaging).toBeDefined();
      expect(result.skillDistribution.Salvaging.expert).toBe(1);
    });

    it('should return career breakdown aggregated from CSV imports', async () => {
      setupStandardOrg();

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.careerBreakdown).toBeDefined();
      expect(result.careerBreakdown.length).toBe(5);
      // Sorted by hours descending
      expect(result.careerBreakdown[0].career).toBe('Salvaging');
      expect(result.careerBreakdown[0].hours).toBe(600);
      expect(result.careerBreakdown[0].shipCount).toBe(2);
      expect(result.careerBreakdown[1].career).toBe('Combat');
      expect(result.careerBreakdown[1].hours).toBe(250);
    });

    it('should return empty analytics for org with no members', async () => {
      mockMembershipRepo.count.mockResolvedValue(0);

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.memberCount).toBe(0);
      expect(result.verifiedCount).toBe(0);
      expect(result.averageKD).toBe(0);
      expect(result.topPerformers).toHaveLength(0);
      expect(result.skillDistribution).toEqual({});
      expect(result.careerBreakdown).toEqual([]);
    });

    it('should handle org with members but no verified SCStats', async () => {
      setupStandardOrg({
        aggregates: {
          verifiedCount: 0,
          averageKD: '0',
          averageTotalHours: '0',
          averageMissionsCompleted: '0',
        },
        topPerformers: [],
      });

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.memberCount).toBe(3);
      expect(result.verifiedCount).toBe(0);
      expect(result.verificationRate).toBe(0);
      expect(result.averageKD).toBe(0);
    });

    it('should return empty career data when no CSV imports exist', async () => {
      setupStandardOrg({ csvImports: [] });

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.skillDistribution).toEqual({});
    });

    it('should handle CSV imports with summary but no hoursByCareer', async () => {
      setupStandardOrg({
        csvImports: [
          { userId: 'user-1', summary: { totalPlaytimeHours: 100 } },
          { userId: 'user-2', summary: null },
        ],
      });

      const result = await service.getOrgAnalytics(ORG_ID);

      expect(result.skillDistribution).toEqual({});
      expect(result.careerBreakdown).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

