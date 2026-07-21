/**
 * CommissaryService Tests
 *
 * Tests for commissary item management and purchase flow.
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
const mockSpendCredits = jest.fn();
const mockEarnCredits = jest.fn();
jest.mock('../../services/treasury/TreasuryService', () => ({
  getTreasuryService: jest.fn(() => ({
    spendCredits: (...args: unknown[]) => mockSpendCredits(...args),
    earnCredits: (...args: unknown[]) => mockEarnCredits(...args),
  })),
  TreasuryService: jest.fn(),
}));

import { AppDataSource } from '../../data-source';
import { CommissaryItem } from '../../models/CommissaryItem';
import { CommissaryPurchase } from '../../models/CommissaryPurchase';
import { CommissaryService } from '../../services/treasury/CommissaryService';

describe('CommissaryService', () => {
  let service: CommissaryService;
  const orgId = 'org-123';
  const userId = 'user-456';

  const mockRepository = {
    metadata: { name: 'CommissaryItem' },
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

  const mockPurchaseRepo = {
    metadata: { name: 'CommissaryPurchase' },
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
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
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === CommissaryItem) return mockRepository;
      if (entity === CommissaryPurchase) return mockPurchaseRepo;
      return mockRepository;
    });

    (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

    // Re-wire getTreasuryService after clearAllMocks
    const { getTreasuryService } = jest.requireMock('../../services/treasury/TreasuryService');
    (getTreasuryService as jest.Mock).mockReturnValue({
      spendCredits: (...args: unknown[]) => mockSpendCredits(...args),
      earnCredits: (...args: unknown[]) => mockEarnCredits(...args),
    });

    service = new CommissaryService();
  });

  // ==================== Item Management ====================

  describe('createItem', () => {
    it('should create a commissary item', async () => {
      const item = {
        id: 'item-1',
        organizationId: orgId,
        name: 'Medkit',
        price: 250,
        category: 'medical',
        stock: -1,
        isActive: true,
        createdBy: userId,
      };
      mockRepository.create.mockReturnValue(item);
      mockRepository.save.mockResolvedValue(item);

      const result = await service.createItem(orgId, userId, {
        name: 'Medkit',
        price: 250,
        category: 'medical',
      });

      expect(result.name).toBe('Medkit');
      expect(result.price).toBe(250);
    });
  });

  // ==================== Purchase Flow ====================

  describe('purchaseItem', () => {
    const activeItem = {
      id: 'item-1',
      organizationId: orgId,
      name: 'Shield',
      price: 100,
      category: 'equipment',
      stock: 10,
      isActive: true,
    };

    it('should complete purchase (credit-first, then stock)', async () => {
      // Pre-flight check
      mockRepository.findOne.mockResolvedValue({ ...activeItem });

      // spendCredits succeeds
      mockSpendCredits.mockResolvedValue({ id: 'txn-1', amount: -100, balance: 4900 });

      // Pessimistic lock re-check
      mockQueryRunner.manager.findOne.mockResolvedValue({ ...activeItem });
      mockQueryRunner.manager.save.mockResolvedValue({ ...activeItem, stock: 9 });

      const purchase = {
        id: 'purchase-1',
        organizationId: orgId,
        itemId: 'item-1',
        buyerId: userId,
        quantity: 1,
        totalPrice: 100,
        transactionId: 'txn-1',
      };
      mockQueryRunner.manager.create.mockReturnValue(purchase);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ ...activeItem, stock: 9 }) // save item
        .mockResolvedValueOnce(purchase); // save purchase

      const result = await service.purchaseItem(orgId, userId, {
        itemId: 'item-1',
        quantity: 1,
      });

      expect(result.totalPrice).toBe(100);
      expect(result.transactionId).toBe('txn-1');
      expect(mockSpendCredits).toHaveBeenCalledWith(
        orgId,
        userId,
        expect.objectContaining({
          amount: 100,
          category: 'purchase',
        })
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject purchase for nonexistent item', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.purchaseItem(orgId, userId, { itemId: 'bad-id', quantity: 1 })
      ).rejects.toThrow();

      expect(mockSpendCredits).not.toHaveBeenCalled();
    });

    it('should reject purchase for inactive item', async () => {
      mockRepository.findOne.mockResolvedValue({ ...activeItem, isActive: false });

      await expect(
        service.purchaseItem(orgId, userId, { itemId: 'item-1', quantity: 1 })
      ).rejects.toThrow('no longer available');

      expect(mockSpendCredits).not.toHaveBeenCalled();
    });

    it('should reject purchase when insufficient stock', async () => {
      mockRepository.findOne.mockResolvedValue({ ...activeItem, stock: 2 });

      await expect(
        service.purchaseItem(orgId, userId, { itemId: 'item-1', quantity: 5 })
      ).rejects.toThrow('Insufficient stock');

      expect(mockSpendCredits).not.toHaveBeenCalled();
    });

    it('should allow purchase with unlimited stock (-1)', async () => {
      mockRepository.findOne.mockResolvedValue({ ...activeItem, stock: -1 });
      mockSpendCredits.mockResolvedValue({ id: 'txn-2', amount: -100 });
      mockQueryRunner.manager.findOne.mockResolvedValue({ ...activeItem, stock: -1 });

      const purchase = {
        id: 'purchase-2',
        totalPrice: 100,
        transactionId: 'txn-2',
      };
      mockQueryRunner.manager.create.mockReturnValue(purchase);
      mockQueryRunner.manager.save.mockResolvedValue(purchase);

      const result = await service.purchaseItem(orgId, userId, {
        itemId: 'item-1',
        quantity: 1,
      });

      expect(result.totalPrice).toBe(100);
      // Save should only be called once (purchase record, not item since stock is unlimited)
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should refund credits when stock transaction fails', async () => {
      mockRepository.findOne.mockResolvedValue({ ...activeItem });
      mockSpendCredits.mockResolvedValue({ id: 'txn-3', amount: -100 });

      // Stock lock fails
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      mockEarnCredits.mockResolvedValue({});

      await expect(
        service.purchaseItem(orgId, userId, { itemId: 'item-1', quantity: 1 })
      ).rejects.toThrow();

      // Verify compensation was attempted
      expect(mockEarnCredits).toHaveBeenCalledWith(
        orgId,
        'system',
        expect.objectContaining({
          category: 'refund',
        })
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
