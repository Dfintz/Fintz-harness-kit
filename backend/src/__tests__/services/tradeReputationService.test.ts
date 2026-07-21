import { TradeTransaction, TradeTransactionStatus } from '../../models/TradeTransaction';
import { TradeUserReputation } from '../../models/TradeUserReputation';
import { TradeReputationService } from '../../services/trade/trading/TradeReputationService';

// ── Mocks ─────────────────────────────────────────────────────────
jest.mock('../../data-source', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

jest.mock('../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();

jest.mock('../../utils/redis', () => ({
  cache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
    del: (...args: unknown[]) => mockCacheDel(...args),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────
function makeTxn(overrides: Partial<TradeTransaction> = {}): TradeTransaction {
  const txn = new TradeTransaction();
  txn.id = overrides.id ?? 'txn-1';
  txn.routeId = overrides.routeId ?? 'route-1';
  txn.userId = overrides.userId ?? 'user-1';
  txn.organizationId = overrides.organizationId ?? 'org-1';
  txn.successStatus = overrides.successStatus ?? TradeTransactionStatus.COMPLETED;
  txn.estimatedProfit = overrides.estimatedProfit ?? 1000;
  txn.actualProfit = overrides.actualProfit ?? 1200;
  txn.durationMinutes = overrides.durationMinutes ?? 30;
  txn.executedAt = overrides.executedAt ?? new Date();
  txn.completedAt = overrides.completedAt ?? new Date();
  return txn;
}

function makeReputation(overrides: Partial<TradeUserReputation> = {}): TradeUserReputation {
  const rep = new TradeUserReputation();
  rep.id = overrides.id ?? 'rep-1';
  rep.userId = overrides.userId ?? 'user-1';
  rep.totalRuns = overrides.totalRuns ?? 0;
  rep.successfulRuns = overrides.successfulRuns ?? 0;
  rep.failedRuns = overrides.failedRuns ?? 0;
  rep.abortedRuns = overrides.abortedRuns ?? 0;
  rep.successRate = overrides.successRate ?? 0;
  rep.totalProfitGenerated = overrides.totalProfitGenerated ?? 0;
  rep.avgProfitPerRun = overrides.avgProfitPerRun ?? 0;
  rep.avgEstimateAccuracy = overrides.avgEstimateAccuracy ?? 0;
  rep.profitConsistency = overrides.profitConsistency ?? 50;
  rep.currentSuccessStreak = overrides.currentSuccessStreak ?? 0;
  rep.longestSuccessStreak = overrides.longestSuccessStreak ?? 0;
  rep.overallScore = overrides.overallScore ?? 50;
  rep.createdAt = overrides.createdAt ?? new Date();
  rep.updatedAt = overrides.updatedAt ?? new Date();
  return rep;
}

// ── Test Suite ────────────────────────────────────────────────────
describe('TradeReputationService', () => {
  let service: TradeReputationService;
  let mockTxnRepo: Record<string, jest.Mock>;
  let mockRepRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDel.mockResolvedValue(undefined);

    mockTxnRepo = {
      create: jest.fn(d => Object.assign(new TradeTransaction(), d)),
      save: jest.fn(d => Promise.resolve({ id: 'txn-new', ...d })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockRepRepo = {
      create: jest.fn(d => Object.assign(new TradeUserReputation(), d)),
      save: jest.fn(d => Promise.resolve(d)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = new TradeReputationService(mockTxnRepo as any, mockRepRepo as any);
  });

  // ── recordTransaction ────────────────────────────────────────
  describe('recordTransaction', () => {
    it('should create a transaction and return it', async () => {
      const result = await service.recordTransaction({
        routeId: 'route-1',
        userId: 'user-1',
        organizationId: 'org-1',
        estimatedProfit: 1000,
        actualProfit: 1200,
        durationMinutes: 30,
      });

      expect(mockTxnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: 'route-1',
          userId: 'user-1',
          organizationId: 'org-1',
          estimatedProfit: 1000,
          actualProfit: 1200,
          durationMinutes: 30,
          successStatus: 'completed',
        })
      );
      expect(mockTxnRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should default successStatus to completed', async () => {
      await service.recordTransaction({
        routeId: 'r',
        userId: 'u',
        organizationId: 'o',
        estimatedProfit: 0,
        actualProfit: 0,
        durationMinutes: 0,
      });

      expect(mockTxnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ successStatus: 'completed' })
      );
    });

    it('should accept an explicit successStatus', async () => {
      await service.recordTransaction({
        routeId: 'r',
        userId: 'u',
        organizationId: 'o',
        estimatedProfit: 0,
        actualProfit: 0,
        durationMinutes: 0,
        successStatus: TradeTransactionStatus.FAILED,
      });

      expect(mockTxnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ successStatus: 'failed' })
      );
    });

    it('should invalidate reputation cache after recording', async () => {
      await service.recordTransaction({
        routeId: 'r',
        userId: 'user-42',
        organizationId: 'o',
        estimatedProfit: 0,
        actualProfit: 0,
        durationMinutes: 0,
      });

      expect(mockCacheDel).toHaveBeenCalledWith('trade-rep:user-42');
    });

    it('should set completedAt for completed transactions', async () => {
      await service.recordTransaction({
        routeId: 'r',
        userId: 'u',
        organizationId: 'o',
        estimatedProfit: 0,
        actualProfit: 0,
        durationMinutes: 0,
        successStatus: TradeTransactionStatus.COMPLETED,
      });

      expect(mockTxnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ completedAt: expect.any(Date) })
      );
    });

    it('should not set completedAt for failed transactions', async () => {
      await service.recordTransaction({
        routeId: 'r',
        userId: 'u',
        organizationId: 'o',
        estimatedProfit: 0,
        actualProfit: 0,
        durationMinutes: 0,
        successStatus: TradeTransactionStatus.FAILED,
      });

      expect(mockTxnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ completedAt: undefined })
      );
    });
  });

  // ── getUserTransactions ──────────────────────────────────────
  describe('getUserTransactions', () => {
    it('should query by userId and organizationId', async () => {
      await service.getUserTransactions('u-1', 'o-1', 10);

      expect(mockTxnRepo.find).toHaveBeenCalledWith({
        where: { userId: 'u-1', organizationId: 'o-1' },
        order: { executedAt: 'DESC' },
        take: 10,
      });
    });

    it('should default limit to 50', async () => {
      await service.getUserTransactions('u-1', 'o-1');

      expect(mockTxnRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });
  });

  // ── getRouteTransactions ─────────────────────────────────────
  describe('getRouteTransactions', () => {
    it('should query by routeId and organizationId', async () => {
      await service.getRouteTransactions('r-1', 'o-1', 5);

      expect(mockTxnRepo.find).toHaveBeenCalledWith({
        where: { routeId: 'r-1', organizationId: 'o-1' },
        order: { executedAt: 'DESC' },
        take: 5,
      });
    });
  });

  // ── getUserReputation ────────────────────────────────────────
  describe('getUserReputation', () => {
    it('should return cached reputation if available', async () => {
      const cached = makeReputation({ userId: 'u-1' });
      mockCacheGet.mockResolvedValueOnce(cached);

      const result = await service.getUserReputation('u-1');

      expect(result.userId).toBe('u-1');
      expect(mockRepRepo.findOne).not.toHaveBeenCalled();
    });

    it('should restore prototype methods on cached objects', async () => {
      const cached = makeReputation({ userId: 'u-1', overallScore: 85 });
      mockCacheGet.mockResolvedValueOnce(cached);

      const result = await service.getUserReputation('u-1');

      // Should have prototype methods (getSummary, getReputationTier, etc.)
      expect(typeof result.getSummary).toBe('function');
      expect(typeof result.getReputationTier).toBe('function');
    });

    it('should fetch from DB when cache misses', async () => {
      const dbRep = makeReputation({ userId: 'u-2' });
      mockRepRepo.findOne.mockResolvedValueOnce(dbRep);

      const result = await service.getUserReputation('u-2');

      expect(mockRepRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u-2' },
      });
      expect(result.userId).toBe('u-2');
      expect(mockCacheSet).toHaveBeenCalledWith('trade-rep:u-2', dbRep, 300);
    });

    it('should create new reputation if none exists', async () => {
      mockRepRepo.findOne.mockResolvedValueOnce(null);
      const created = makeReputation({ userId: 'u-3' });
      mockRepRepo.save.mockResolvedValueOnce(created);

      const result = await service.getUserReputation('u-3');

      expect(mockRepRepo.create).toHaveBeenCalledWith({ userId: 'u-3' });
      expect(mockRepRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe('u-3');
    });
  });

  // ── updateUserReputation ─────────────────────────────────────
  describe('updateUserReputation', () => {
    it('should return unchanged reputation if no transactions exist', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);
      mockTxnRepo.find.mockResolvedValueOnce([]);

      const result = await service.updateUserReputation('u-1');

      expect(result.totalRuns).toBe(0);
    });

    it('should calculate run counts correctly', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);

      const txns = [
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }),
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }),
        makeTxn({ successStatus: TradeTransactionStatus.FAILED }),
        makeTxn({ successStatus: TradeTransactionStatus.ABORTED }),
      ];
      mockTxnRepo.find.mockResolvedValueOnce(txns);

      const result = await service.updateUserReputation('u-1');

      expect(result.totalRuns).toBe(4);
      expect(result.successfulRuns).toBe(2);
      expect(result.failedRuns).toBe(1);
      expect(result.abortedRuns).toBe(1);
      expect(result.successRate).toBe(50);
    });

    it('should calculate profit stats from completed runs only', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);

      const txns = [
        makeTxn({
          actualProfit: 1000,
          estimatedProfit: 1000,
          successStatus: TradeTransactionStatus.COMPLETED,
        }),
        makeTxn({
          actualProfit: 2000,
          estimatedProfit: 2000,
          successStatus: TradeTransactionStatus.COMPLETED,
        }),
        makeTxn({
          actualProfit: 0,
          estimatedProfit: 5000,
          successStatus: TradeTransactionStatus.FAILED,
        }),
      ];
      mockTxnRepo.find.mockResolvedValueOnce(txns);

      const result = await service.updateUserReputation('u-1');

      expect(result.totalProfitGenerated).toBe(3000);
      expect(result.avgProfitPerRun).toBe(1500);
    });

    it('should calculate success streaks (most-recent first)', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);

      const txns = [
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }), // most recent
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }),
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }),
        makeTxn({ successStatus: TradeTransactionStatus.FAILED }), // streak broken
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }),
      ];
      mockTxnRepo.find.mockResolvedValueOnce(txns);

      const result = await service.updateUserReputation('u-1');

      expect(result.currentSuccessStreak).toBe(3);
      expect(result.longestSuccessStreak).toBe(3);
    });

    it('should populate per-route stats', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);

      const txns = [
        makeTxn({
          routeId: 'r-A',
          actualProfit: 100,
          successStatus: TradeTransactionStatus.COMPLETED,
        }),
        makeTxn({
          routeId: 'r-A',
          actualProfit: 200,
          successStatus: TradeTransactionStatus.COMPLETED,
        }),
        makeTxn({ routeId: 'r-B', actualProfit: 0, successStatus: TradeTransactionStatus.FAILED }),
      ];
      mockTxnRepo.find.mockResolvedValueOnce(txns);

      const result = await service.updateUserReputation('u-1');

      expect(result.routeStats?.['r-A']).toEqual({
        runs: 2,
        successful: 2,
        totalProfit: 300,
      });
      expect(result.routeStats?.['r-B']).toEqual({
        runs: 1,
        successful: 0,
        totalProfit: 0,
      });
    });

    it('should update lastRunAt to most recent transaction', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);

      const recentDate = new Date('2026-06-01');
      const txns = [makeTxn({ executedAt: recentDate })];
      mockTxnRepo.find.mockResolvedValueOnce(txns);

      const result = await service.updateUserReputation('u-1');

      expect(result.lastRunAt).toBe(recentDate);
    });

    it('should save and cache updated reputation', async () => {
      const rep = makeReputation({ userId: 'u-1' });
      mockRepRepo.findOne.mockResolvedValueOnce(rep);
      mockTxnRepo.find.mockResolvedValueOnce([
        makeTxn({ successStatus: TradeTransactionStatus.COMPLETED }),
      ]);

      await service.updateUserReputation('u-1');

      expect(mockRepRepo.save).toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledWith('trade-rep:u-1', expect.anything(), 300);
    });
  });

  // ── getLeaderboard ───────────────────────────────────────────
  describe('getLeaderboard', () => {
    it('should return cached leaderboard if available', async () => {
      const cached = [{ userId: 'u-1', overallScore: 90 }];
      mockCacheGet.mockResolvedValueOnce(cached);

      const result = await service.getLeaderboard();

      expect(result).toEqual(cached);
      expect(mockRepRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache when cache misses', async () => {
      const rep = makeReputation({
        userId: 'u-1',
        overallScore: 85,
        totalRuns: 10,
        successRate: 90,
        avgProfitPerRun: 1500,
      });
      mockRepRepo.find.mockResolvedValueOnce([rep]);

      const result = await service.getLeaderboard(5);

      expect(mockRepRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { overallScore: 'DESC' },
        take: 5,
      });
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('u-1');
      expect(mockCacheSet).toHaveBeenCalledWith('trade-rep:leaderboard', expect.any(Array), 300);
    });

    it('should default to 20 entries', async () => {
      mockRepRepo.find.mockResolvedValueOnce([]);

      await service.getLeaderboard();

      expect(mockRepRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    });
  });
});

// ── Model Unit Tests ──────────────────────────────────────────────
describe('TradeTransaction model', () => {
  describe('getEstimateAccuracy', () => {
    it('should return 100 when actual matches estimated', () => {
      const txn = makeTxn({ estimatedProfit: 1000, actualProfit: 1000 });
      expect(txn.getEstimateAccuracy()).toBe(100);
    });

    it('should return 0 when estimated is 0', () => {
      const txn = makeTxn({ estimatedProfit: 0, actualProfit: 500 });
      expect(txn.getEstimateAccuracy()).toBe(0);
    });

    it('should decrease as actual diverges from estimated', () => {
      const txn = makeTxn({ estimatedProfit: 1000, actualProfit: 500 });
      const accuracy = txn.getEstimateAccuracy();
      expect(accuracy).toBe(50);
    });

    it('should handle over-performance (actual > estimated)', () => {
      const txn = makeTxn({ estimatedProfit: 1000, actualProfit: 1200 });
      const accuracy = txn.getEstimateAccuracy();
      expect(accuracy).toBe(80);
    });

    it('should clamp to 0 for extreme divergence', () => {
      const txn = makeTxn({ estimatedProfit: 100, actualProfit: 500 });
      const accuracy = txn.getEstimateAccuracy();
      expect(accuracy).toBe(0);
    });
  });
});

describe('TradeUserReputation model', () => {
  describe('calculateOverallScore', () => {
    it('should return 0 for a new user with all zeros', () => {
      const rep = makeReputation({
        successRate: 0,
        avgEstimateAccuracy: 0,
        profitConsistency: 0,
        totalRuns: 0,
      });

      expect(rep.calculateOverallScore()).toBe(0);
    });

    it('should return max ~100 for perfect stats', () => {
      const rep = makeReputation({
        successRate: 100,
        avgEstimateAccuracy: 100,
        profitConsistency: 100,
        totalRuns: 100,
      });

      expect(rep.calculateOverallScore()).toBe(100);
    });

    it('should apply experience bonus capped at 100 runs', () => {
      const rep50 = makeReputation({
        successRate: 0,
        avgEstimateAccuracy: 0,
        profitConsistency: 0,
        totalRuns: 50,
      });
      const rep200 = makeReputation({
        successRate: 0,
        avgEstimateAccuracy: 0,
        profitConsistency: 0,
        totalRuns: 200,
      });

      expect(rep50.calculateOverallScore()).toBe(5); // 50/100 * 10 = 5
      expect(rep200.calculateOverallScore()).toBe(10); // capped at 10
    });
  });

  describe('getReputationTier', () => {
    it('should return Rookie for score 0', () => {
      const rep = makeReputation({ overallScore: 0 });
      expect(rep.getReputationTier().tier).toBe('Rookie');
    });

    it('should return Legendary for score 90+', () => {
      const rep = makeReputation({ overallScore: 95 });
      expect(rep.getReputationTier().tier).toBe('Legendary');
    });

    it('should return Reliable for score 50', () => {
      const rep = makeReputation({ overallScore: 50 });
      expect(rep.getReputationTier().tier).toBe('Reliable');
    });
  });

  describe('getSummary', () => {
    it('should return formatted summary', () => {
      const rep = makeReputation({
        userId: 'u-42',
        overallScore: 75,
        totalRuns: 20,
        successRate: 90,
        avgProfitPerRun: 2500,
        currentSuccessStreak: 5,
      });

      const summary = rep.getSummary();

      expect(summary.userId).toBe('u-42');
      expect(summary.score).toBe(75);
      expect(summary.tier).toContain('Veteran');
      expect(summary.runs).toBe(20);
      expect(summary.successRate).toBe(90);
      expect(summary.avgProfit).toBe(2500);
      expect(summary.streak).toBe(5);
    });
  });

  describe('isExperienced', () => {
    it('should return false for < 10 runs', () => {
      const rep = makeReputation({ totalRuns: 5 });
      expect(rep.isExperienced()).toBe(false);
    });

    it('should return true for >= 10 runs', () => {
      const rep = makeReputation({ totalRuns: 10 });
      expect(rep.isExperienced()).toBe(true);
    });
  });

  describe('isHighPerformer', () => {
    it('should require 80%+ success rate AND 5+ runs', () => {
      expect(makeReputation({ successRate: 90, totalRuns: 3 }).isHighPerformer()).toBe(false);
      expect(makeReputation({ successRate: 70, totalRuns: 10 }).isHighPerformer()).toBe(false);
      expect(makeReputation({ successRate: 80, totalRuns: 5 }).isHighPerformer()).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
