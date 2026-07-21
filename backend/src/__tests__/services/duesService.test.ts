/**
 * DuesService Tests
 *
 * Tests for dues schedule management and the isDueToday logic.
 */

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    createQueryRunner: jest.fn(),
  },
}));
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../utils/auditLogger', () => ({
  AuditEventType: { SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS' },
  logAuditEvent: jest.fn(),
}));
jest.mock('../../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
  emitToUser: jest.fn(),
}));

// Mock TreasuryService dependency
const mockEarnCredits = jest.fn();
jest.mock('../../services/treasury/TreasuryService', () => ({
  getTreasuryService: jest.fn(() => ({
    earnCredits: (...args: unknown[]) => mockEarnCredits(...args),
  })),
  TreasuryService: jest.fn(),
}));

import { AppDataSource } from '../../data-source';
import { DuesFrequency, OrgDues } from '../../models/OrgDues';
import { DuesCollectionOrchestratorService } from '../../services/treasury/DuesCollectionOrchestratorService';
import { DuesService } from '../../services/treasury/DuesService';

describe('DuesService', () => {
  let service: DuesService;
  let orchestrator: DuesCollectionOrchestratorService;
  const orgId = 'org-123';
  const userId = 'user-456';

  const mockRepository = {
    metadata: { name: 'OrgDues' },
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockCollectionQueries = ({
    locked = true,
    acquiredRun = true,
    expectFailureUpdate = false,
  } = {}) => {
    mockQueryRunner.query
      .mockResolvedValueOnce([{ locked }])
      .mockResolvedValueOnce(acquiredRun ? [{ id: 'run-1' }] : []);

    if (acquiredRun) {
      mockQueryRunner.query.mockResolvedValueOnce([]);
      if (expectFailureUpdate) {
        mockQueryRunner.query.mockResolvedValueOnce([]);
      }
    }

    mockQueryRunner.query.mockResolvedValue([]);
  };

  const mockDuesLookup = (dues: OrgDues | null) => {
    const duesLookupBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(dues),
    };

    mockRepository.createQueryBuilder.mockReturnValue(duesLookupBuilder);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
    (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

    mockRepository.createQueryBuilder.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    }));

    // Re-wire getTreasuryService after clearAllMocks
    const { getTreasuryService } = jest.requireMock('../../services/treasury/TreasuryService');
    (getTreasuryService as jest.Mock).mockReturnValue({
      earnCredits: mockEarnCredits,
    });

    service = new DuesService();
    // Also directly set the treasury service to ensure mock is wired
    (service as unknown as { treasuryService: unknown }).treasuryService = {
      earnCredits: mockEarnCredits,
    };
    orchestrator = new DuesCollectionOrchestratorService(service, mockRepository as never);
  });

  // ==================== CRUD ====================

  describe('createDues', () => {
    it('should create a dues schedule with defaults', async () => {
      const dues = {
        id: 'dues-1',
        organizationId: orgId,
        name: 'Monthly tax',
        amount: 500,
        frequency: DuesFrequency.MONTHLY,
        dueDay: 1,
        gracePeriodDays: 7,
        isActive: true,
        createdBy: userId,
      };
      mockRepository.create.mockReturnValue(dues);
      mockRepository.save.mockResolvedValue(dues);

      const result = await service.createDues(orgId, userId, {
        name: 'Monthly tax',
        amount: 500,
        frequency: DuesFrequency.MONTHLY,
      });

      expect(result.name).toBe('Monthly tax');
      expect(result.amount).toBe(500);
    });
  });

  describe('updateDues', () => {
    it('should update dues fields', async () => {
      const existing = {
        id: 'dues-1',
        organizationId: orgId,
        name: 'Old',
        amount: 100,
        frequency: DuesFrequency.MONTHLY,
        isActive: true,
        dueDay: 1,
        gracePeriodDays: 7,
      };
      mockDuesLookup({ ...existing } as OrgDues);
      mockRepository.save.mockImplementation((d: OrgDues) => Promise.resolve(d));

      const result = await service.updateDues(orgId, 'dues-1', {
        name: 'Updated',
        amount: 200,
        isActive: false,
      });

      expect(result.name).toBe('Updated');
      expect(result.amount).toBe(200);
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundError when dues not found', async () => {
      mockDuesLookup(null);

      await expect(service.updateDues(orgId, 'bad-id', { name: 'test' })).rejects.toThrow();
    });
  });

  // ==================== isDueToday ====================

  describe('isDueToday (via collectAllDues)', () => {
    // We test isDueToday indirectly through collectAllDues

    it('should collect monthly dues on matching day', async () => {
      const today = new Date();
      const dayOfMonth = today.getUTCDate();

      const dues = {
        id: 'dues-1',
        organizationId: orgId,
        name: 'Monthly',
        amount: 100,
        frequency: DuesFrequency.MONTHLY,
        dueDay: dayOfMonth,
        gracePeriodDays: 7,
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      mockCollectionQueries();
      mockEarnCredits.mockResolvedValue({});

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(1);
      expect(mockEarnCredits).toHaveBeenCalledWith(
        orgId,
        'system',
        expect.objectContaining({
          amount: 100,
          category: 'dues',
        })
      );
    });

    it('should NOT collect monthly dues on wrong day', async () => {
      const today = new Date();
      const wrongDay = today.getUTCDate() === 15 ? 16 : 15;

      const dues = {
        id: 'dues-1',
        organizationId: orgId,
        name: 'Monthly',
        amount: 100,
        frequency: DuesFrequency.MONTHLY,
        dueDay: wrongDay,
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(0);
      expect(mockEarnCredits).not.toHaveBeenCalled();
    });

    it('should collect weekly dues on matching day of week', async () => {
      const today = new Date();
      const dayOfWeek = today.getUTCDay();

      const dues = {
        id: 'dues-2',
        organizationId: orgId,
        name: 'Weekly',
        amount: 50,
        frequency: DuesFrequency.WEEKLY,
        dueDay: dayOfWeek,
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      mockCollectionQueries();
      mockEarnCredits.mockResolvedValue({});

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(1);
    });

    it('should handle biweekly with dueDay clamped to end of month', async () => {
      // Test that dueDay=20, secondDay=min(20+14=34, daysInMonth) clamps correctly
      const today = new Date();
      const dayOfMonth = today.getUTCDate();
      const daysInMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
      ).getUTCDate();
      const secondDay = Math.min(20 + 14, daysInMonth);

      const shouldMatch = dayOfMonth === 20 || dayOfMonth === secondDay;

      const dues = {
        id: 'dues-3',
        organizationId: orgId,
        name: 'Biweekly',
        amount: 75,
        frequency: DuesFrequency.BIWEEKLY,
        dueDay: 20,
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      if (shouldMatch) {
        mockCollectionQueries();
      }
      mockEarnCredits.mockResolvedValue({});

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(shouldMatch ? 1 : 0);
    });

    it('should collect quarterly dues only in quarter months', async () => {
      const today = new Date();
      const month = today.getUTCMonth();
      const dayOfMonth = today.getUTCDate();
      const isQuarterMonth = month % 3 === 0;

      const dues = {
        id: 'dues-4',
        organizationId: orgId,
        name: 'Quarterly',
        amount: 1000,
        frequency: DuesFrequency.QUARTERLY,
        dueDay: dayOfMonth,
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      if (isQuarterMonth) {
        mockCollectionQueries();
      }
      mockEarnCredits.mockResolvedValue({});

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(isQuarterMonth ? 1 : 0);
    });

    it('should count errors when earnCredits fails', async () => {
      const today = new Date();
      const dayOfMonth = today.getUTCDate();

      const dues = {
        id: 'dues-err',
        organizationId: orgId,
        name: 'Failing',
        amount: 100,
        frequency: DuesFrequency.MONTHLY,
        dueDay: dayOfMonth,
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      mockCollectionQueries({ expectFailureUpdate: true });
      mockEarnCredits.mockRejectedValue(new Error('DB error'));

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('should skip collection when dues already collected for UTC date', async () => {
      const today = new Date();

      const dues = {
        id: 'dues-dup',
        organizationId: orgId,
        name: 'Duplicate guard',
        amount: 100,
        frequency: DuesFrequency.MONTHLY,
        dueDay: today.getUTCDate(),
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      mockCollectionQueries({ locked: true, acquiredRun: false });

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockEarnCredits).not.toHaveBeenCalled();
    });

    it('should skip collection when advisory lock is not acquired', async () => {
      const today = new Date();

      const dues = {
        id: 'dues-lock',
        organizationId: orgId,
        name: 'Lock guard',
        amount: 100,
        frequency: DuesFrequency.MONTHLY,
        dueDay: today.getUTCDate(),
        isActive: true,
      };

      mockRepository.find.mockResolvedValueOnce([dues]).mockResolvedValueOnce([]);
      mockCollectionQueries({ locked: false, acquiredRun: false });

      const result = await orchestrator.collectAllDues();

      expect(result.collected).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockEarnCredits).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
