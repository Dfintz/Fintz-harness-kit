/**
 * TreasuryService Tests
 *
 * Tests for credit pool management, transactions, and balance operations.
 */

// Mock dependencies before imports
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

import { AppDataSource } from '../../data-source';
import { CreditPool } from '../../models/CreditPool';
import { TransactionType } from '../../models/CreditTransaction';
import { TreasuryService } from '../../services/treasury/TreasuryService';

describe('TreasuryService', () => {
  let service: TreasuryService;
  const orgId = 'org-123';
  const userId = 'user-456';

  // Mock query runner for transaction tests
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
  };

  const mockRepository = {
    metadata: { name: 'CreditPool' },
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
    })),
  };

  const mockTransactionRepo = {
    metadata: { name: 'CreditTransaction' },
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === CreditPool) return mockRepository;
      return mockTransactionRepo;
    });

    (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

    service = new TreasuryService();
  });

  // ==================== getBalance ====================

  describe('getBalance', () => {
    it('should return existing pool balance', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'pool-1',
        organizationId: orgId,
        balance: 5000,
        currency: 'aUEC',
      });

      const result = await service.getBalance(orgId);

      expect(result.balance).toBe(5000);
      expect(result.currency).toBe('aUEC');
    });

    it('should create pool and return zero balance when none exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        organizationId: orgId,
        balance: 0,
        currency: 'aUEC',
      });
      mockRepository.save.mockResolvedValue({
        id: 'pool-new',
        organizationId: orgId,
        balance: 0,
        currency: 'aUEC',
      });

      const result = await service.getBalance(orgId);

      expect(result.balance).toBe(0);
      expect(result.currency).toBe('aUEC');
    });
  });

  // ==================== earnCredits ====================

  describe('earnCredits', () => {
    it('should create income transaction and update balance', async () => {
      const mockTxn = {
        id: 'txn-1',
        type: TransactionType.INCOME,
        amount: 1000,
        balance: 6000,
        description: 'Bounty reward',
      };

      // recordTransaction uses queryRunner internally
      mockQueryRunner.query
        // SELECT FOR UPDATE — return existing pool
        .mockResolvedValueOnce([{ id: 'pool-1', balance: 5000 }])
        // UPDATE pool balance
        .mockResolvedValueOnce(undefined)
        // INSERT transaction
        .mockResolvedValueOnce([mockTxn]);

      const result = await service.earnCredits(orgId, userId, {
        amount: 1000,
        source: 'Bounty reward',
        category: 'bounty',
      });

      expect(result.amount).toBe(1000);
      expect(result.balance).toBe(6000);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject non-positive amounts', async () => {
      await expect(
        service.earnCredits(orgId, userId, { amount: 0, source: 'test' })
      ).rejects.toThrow('Earn amount must be positive');

      await expect(
        service.earnCredits(orgId, userId, { amount: -100, source: 'test' })
      ).rejects.toThrow('Earn amount must be positive');
    });
  });

  // ==================== spendCredits ====================

  describe('spendCredits', () => {
    it('should create expense transaction and deduct balance', async () => {
      const mockTxn = {
        id: 'txn-2',
        type: TransactionType.EXPENSE,
        amount: -500,
        balance: 4500,
        description: 'Ship repair',
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ id: 'pool-1', balance: 5000 }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([mockTxn]);

      const result = await service.spendCredits(orgId, userId, {
        amount: 500,
        purpose: 'Ship repair',
      });

      expect(result.amount).toBe(-500);
      expect(result.balance).toBe(4500);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject insufficient balance', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ id: 'pool-1', balance: 100 }]);

      await expect(
        service.spendCredits(orgId, userId, { amount: 500, purpose: 'test' })
      ).rejects.toThrow('Insufficient balance');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject non-positive amounts', async () => {
      await expect(
        service.spendCredits(orgId, userId, { amount: 0, purpose: 'test' })
      ).rejects.toThrow('Spend amount must be positive');
    });
  });

  // ==================== transferCredits ====================

  describe('transferCredits', () => {
    it('should create transfer transaction', async () => {
      const mockTxn = {
        id: 'txn-3',
        type: TransactionType.TRANSFER,
        amount: -200,
        balance: 4800,
        description: 'Transfer to user-789',
        toUserId: 'user-789',
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ id: 'pool-1', balance: 5000 }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([mockTxn]);

      const result = await service.transferCredits(orgId, userId, {
        toUserId: 'user-789',
        amount: 200,
        note: 'Bonus',
      });

      expect(result.toUserId).toBe('user-789');
      expect(result.amount).toBe(-200);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // ==================== getOrCreatePool ====================

  describe('getOrCreatePool', () => {
    it('should return existing pool', async () => {
      const pool = { id: 'pool-1', organizationId: orgId, balance: 1000, currency: 'aUEC' };
      mockRepository.findOne.mockResolvedValue(pool);

      const result = await service.getOrCreatePool(orgId);

      expect(result).toEqual(pool);
    });

    it('should create new pool when none exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const newPool = { id: 'pool-new', organizationId: orgId, balance: 0, currency: 'aUEC' };
      mockRepository.create.mockReturnValue(newPool);
      mockRepository.save.mockResolvedValue(newPool);

      const result = await service.getOrCreatePool(orgId);

      expect(result.balance).toBe(0);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: orgId, balance: 0 })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
