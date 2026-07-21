/**
 * OrganizationEncryptionService – Phase 3 & 4 Tests
 *
 * Tests hybrid-encryption data storage/retrieval and flat→hybrid migration.
 */

import { DataEncryptionKey } from '../../models/DataEncryptionKey';
import { EncryptedData } from '../../models/EncryptedData';
import { OrganizationEncryptionService } from '../../services/encryption/OrganizationEncryptionService';

// ============================================================================
// Test fixtures
// ============================================================================

const ORG_ID = 'org-001';
const USER_ID = 'user-001';
const DEK_ID = 'dek-abc-123';
const DATA_ID = 'data-xyz-789';

const encryptionMetadata = {
  iv: 'base64-iv',
  authTag: 'base64-tag',
  algorithm: 'aes-256-gcm',
  version: 1,
};

function mockDEK(overrides?: Partial<DataEncryptionKey>) {
  return {
    id: 'uuid-dek',
    dekId: DEK_ID,
    organizationId: ORG_ID,
    dataType: 'document',
    resourceId: 'res-1',
    isActive: true,
    wrappedKeys: { [USER_ID]: 'wrapped-key-for-user' },
    hasUserAccess: jest.fn().mockReturnValue(true),
    getWrappedKeyForUser: jest.fn().mockReturnValue('wrapped-key-for-user'),
    ...overrides,
  } as unknown as DataEncryptionKey;
}

function mockEncryptedData(overrides?: Partial<EncryptedData>) {
  return {
    id: DATA_ID,
    organizationId: ORG_ID,
    keyId: DEK_ID,
    encryptionMode: 'hybrid',
    dekId: DEK_ID,
    dataType: 'document',
    resourceId: 'res-1',
    encryptedData: 'base64-blob',
    encryptionMetadata,
    createdBy: USER_ID,
    minSecurityLevel: 1,
    allowedRoles: null,
    isDeleted: false,
    accessedCount: 0,
    migrationStatus: 'none',
    meetsSecurityLevel: jest.fn().mockReturnValue(true),
    isRoleAllowed: jest.fn().mockReturnValue(true),
    incrementAccessCount: jest.fn(),
    ...overrides,
  } as unknown as EncryptedData;
}

// ============================================================================
// Repository mock helpers
// ============================================================================

const createMockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((data: unknown) => data),
  save: jest.fn().mockImplementation(async (data: unknown) => ({
    id: DATA_ID,
    ...(data as Record<string, unknown>),
  })),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn(),
});

// ============================================================================
// Mock AppDataSource
// ============================================================================

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
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

const { AppDataSource } = require('../../config/database');

// Create per-entity repos
const mockKeyRepo = createMockRepo();
const mockDataRepo = createMockRepo();
const mockAuditRepo = createMockRepo();
const mockMembershipRepo = createMockRepo();
const mockClaimRepo = createMockRepo();
const mockPublicKeyRepo = createMockRepo();
const mockDekRepo = createMockRepo();

function resolveRepoFor(entity: unknown) {
  const map = new Map<unknown, unknown>([
    [require('../../models/OrganizationEncryptionKey').OrganizationEncryptionKey, mockKeyRepo],
    [require('../../models/EncryptedData').EncryptedData, mockDataRepo],
    [require('../../models/EncryptionAuditLog').EncryptionAuditLog, mockAuditRepo],
    [require('../../models/OrganizationMembership').OrganizationMembership, mockMembershipRepo],
    [require('../../models/EncryptionKeyClaim').EncryptionKeyClaim, mockClaimRepo],
    [require('../../models/MemberPublicKey').MemberPublicKey, mockPublicKeyRepo],
    [require('../../models/DataEncryptionKey').DataEncryptionKey, mockDekRepo],
  ]);
  return map.get(entity) || createMockRepo();
}

(AppDataSource.getRepository as jest.Mock).mockImplementation(resolveRepoFor);

// ============================================================================
// Tests
// ============================================================================

describe('OrganizationEncryptionService – Phase 3 & 4', () => {
  let service: OrganizationEncryptionService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default membership check passes
    mockMembershipRepo.findOne.mockResolvedValue({ id: 'mem-1', userId: USER_ID, isActive: true });

    // Reset getRepository so the service re-reads repos
    (AppDataSource.getRepository as jest.Mock).mockImplementation(resolveRepoFor);

    service = new OrganizationEncryptionService();

    // Audit log always succeeds
    mockAuditRepo.create.mockImplementation((d: unknown) => d);
    mockAuditRepo.save.mockResolvedValue({ id: 'audit-1' });
  });

  // ==========================================================================
  // Phase 3: storeHybridEncryptedData
  // ==========================================================================

  describe('storeHybridEncryptedData', () => {
    it('should store encrypted data with hybrid mode and DEK reference', async () => {
      const dek = mockDEK();
      mockDekRepo.findOne.mockResolvedValue(dek);

      const input = {
        organizationId: ORG_ID,
        dekId: DEK_ID,
        dataType: 'document',
        resourceId: 'res-1',
        encryptedData: 'base64-blob',
        encryptionMetadata,
        createdBy: USER_ID,
      };

      const result = await service.storeHybridEncryptedData(input);

      expect(mockDekRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, dekId: DEK_ID, isActive: true },
      });
      expect(dek.hasUserAccess).toHaveBeenCalledWith(USER_ID);
      expect(mockDataRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          encryptionMode: 'hybrid',
          dekId: DEK_ID,
          dataType: 'document',
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw if DEK not found', async () => {
      mockDekRepo.findOne.mockResolvedValue(null);

      await expect(
        service.storeHybridEncryptedData({
          organizationId: ORG_ID,
          dekId: 'bad-dek',
          dataType: 'document',
          encryptedData: 'blob',
          encryptionMetadata,
          createdBy: USER_ID,
        })
      ).rejects.toThrow('Active data encryption key not found');
    });

    it('should throw if user has no DEK access', async () => {
      const dek = mockDEK();
      dek.hasUserAccess = jest.fn().mockReturnValue(false);
      mockDekRepo.findOne.mockResolvedValue(dek);

      await expect(
        service.storeHybridEncryptedData({
          organizationId: ORG_ID,
          dekId: DEK_ID,
          dataType: 'document',
          encryptedData: 'blob',
          encryptionMetadata,
          createdBy: USER_ID,
        })
      ).rejects.toThrow('You do not have access to this data encryption key');
    });
  });

  // ==========================================================================
  // Phase 3: getHybridEncryptedData
  // ==========================================================================

  describe('getHybridEncryptedData', () => {
    it('should return encrypted data with wrapped DEK', async () => {
      const data = mockEncryptedData();
      mockDataRepo.findOne.mockResolvedValue(data);

      const dek = mockDEK();
      mockDekRepo.findOne.mockResolvedValue(dek);

      const result = await service.getHybridEncryptedData(ORG_ID, DATA_ID, USER_ID, 3, 'admin');

      expect(result.data).toBeDefined();
      expect(result.wrappedKey).toBe('wrapped-key-for-user');
      expect(result.dekId).toBe(DEK_ID);
      expect(data.incrementAccessCount).toHaveBeenCalled();
    });

    it('should throw if data not found', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getHybridEncryptedData(ORG_ID, DATA_ID, USER_ID, 3, 'admin')
      ).rejects.toThrow('Hybrid encrypted data not found');
    });

    it('should throw if data has no dekId', async () => {
      const data = mockEncryptedData({ dekId: undefined });
      mockDataRepo.findOne.mockResolvedValue(data);

      await expect(
        service.getHybridEncryptedData(ORG_ID, DATA_ID, USER_ID, 3, 'admin')
      ).rejects.toThrow('Data is missing encryption key reference');
    });

    it('should throw if security level insufficient', async () => {
      const data = mockEncryptedData();
      data.meetsSecurityLevel = jest.fn().mockReturnValue(false);
      mockDataRepo.findOne.mockResolvedValue(data);

      await expect(
        service.getHybridEncryptedData(ORG_ID, DATA_ID, USER_ID, 1, 'member')
      ).rejects.toThrow('Insufficient security level to access this data');
    });

    it('should throw if role not allowed', async () => {
      const data = mockEncryptedData();
      data.isRoleAllowed = jest.fn().mockReturnValue(false);
      mockDataRepo.findOne.mockResolvedValue(data);

      await expect(
        service.getHybridEncryptedData(ORG_ID, DATA_ID, USER_ID, 5, 'viewer')
      ).rejects.toThrow('Your role is not allowed to access this data');
    });

    it('should throw if user has no wrapped key for the DEK', async () => {
      const data = mockEncryptedData();
      mockDataRepo.findOne.mockResolvedValue(data);

      const dek = mockDEK();
      dek.getWrappedKeyForUser = jest.fn().mockReturnValue(null);
      mockDekRepo.findOne.mockResolvedValue(dek);

      await expect(
        service.getHybridEncryptedData(ORG_ID, DATA_ID, USER_ID, 5, 'admin')
      ).rejects.toThrow('You do not have access to the encryption key for this data');
    });

    it('should deny cross-tenant hybrid read by organization scope', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getHybridEncryptedData('org-other', DATA_ID, USER_ID, 5, 'admin')
      ).rejects.toThrow('Hybrid encrypted data not found');
      expect(mockDataRepo.findOne).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-other',
          id: DATA_ID,
          isDeleted: false,
          encryptionMode: 'hybrid',
        },
      });
    });
  });

  // ==========================================================================
  // Phase 3: listHybridEncryptedData
  // ==========================================================================

  describe('listHybridEncryptedData', () => {
    it('should return paginated hybrid data for the org', async () => {
      const items = [mockEncryptedData()];
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([items, 1]),
      };
      mockDataRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listHybridEncryptedData(ORG_ID, USER_ID, {
        dataType: 'document',
        limit: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith('d.encryptionMode = :mode', { mode: 'hybrid' });
    });

    it('should throw if user is not a member', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      await expect(service.listHybridEncryptedData(ORG_ID, 'stranger', {})).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Phase 4: initiateMigration
  // ==========================================================================

  describe('initiateMigration', () => {
    it('should mark flat-mode items as pending and return count', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      mockDataRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.initiateMigration(ORG_ID, USER_ID);

      expect(result.totalPending).toBe(5);
      expect(qb.set).toHaveBeenCalledWith({ migrationStatus: 'pending' });
    });

    it('should throw if user is not a member', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      await expect(service.initiateMigration(ORG_ID, 'stranger')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Phase 4: getMigrationCandidates
  // ==========================================================================

  describe('getMigrationCandidates', () => {
    it('should return pending items ordered by creation date', async () => {
      const items = [mockEncryptedData({ migrationStatus: 'pending' as 'pending' })];
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([items, 1]),
      };
      mockDataRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMigrationCandidates(ORG_ID, USER_ID, 20, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith('d.migrationStatus = :status', {
        status: 'pending',
      });
    });
  });

  // ==========================================================================
  // Phase 4: completeMigrationItem
  // ==========================================================================

  describe('completeMigrationItem', () => {
    it('should update item to hybrid mode with new DEK', async () => {
      const data = mockEncryptedData({
        encryptionMode: 'flat' as 'flat',
        migrationStatus: 'pending' as 'pending',
        dekId: undefined,
      });
      mockDataRepo.findOne.mockResolvedValue(data);

      const dek = mockDEK();
      mockDekRepo.findOne.mockResolvedValue(dek);

      const result = await service.completeMigrationItem({
        organizationId: ORG_ID,
        dataId: DATA_ID,
        dekId: DEK_ID,
        encryptedData: 'new-encrypted-blob',
        encryptionMetadata,
        migratedBy: USER_ID,
      });

      // Verify the data object was mutated to hybrid mode
      expect(data.encryptionMode).toBe('hybrid');
      expect(data.dekId).toBe(DEK_ID);
      expect(data.migrationStatus).toBe('migrated');
      expect(data.encryptedData).toBe('new-encrypted-blob');
      expect(mockDataRepo.save).toHaveBeenCalledWith(data);
    });

    it('should throw if migration item not found', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.completeMigrationItem({
          organizationId: ORG_ID,
          dataId: 'nonexistent',
          dekId: DEK_ID,
          encryptedData: 'blob',
          encryptionMetadata,
          migratedBy: USER_ID,
        })
      ).rejects.toThrow('Migration item (not found or not pending) not found');
    });

    it('should throw if target DEK not found', async () => {
      const data = mockEncryptedData({ migrationStatus: 'pending' as 'pending' });
      mockDataRepo.findOne.mockResolvedValue(data);
      mockDekRepo.findOne.mockResolvedValue(null);

      await expect(
        service.completeMigrationItem({
          organizationId: ORG_ID,
          dataId: DATA_ID,
          dekId: 'bad-dek',
          encryptedData: 'blob',
          encryptionMetadata,
          migratedBy: USER_ID,
        })
      ).rejects.toThrow('Target data encryption key not found');
    });

    it('should throw if user has no access to target DEK', async () => {
      const data = mockEncryptedData({ migrationStatus: 'pending' as 'pending' });
      mockDataRepo.findOne.mockResolvedValue(data);

      const dek = mockDEK();
      dek.hasUserAccess = jest.fn().mockReturnValue(false);
      mockDekRepo.findOne.mockResolvedValue(dek);

      await expect(
        service.completeMigrationItem({
          organizationId: ORG_ID,
          dataId: DATA_ID,
          dekId: DEK_ID,
          encryptedData: 'blob',
          encryptionMetadata,
          migratedBy: USER_ID,
        })
      ).rejects.toThrow('You do not have access to the target encryption key');
    });
  });

  // ==========================================================================
  // Phase 4: getMigrationProgress
  // ==========================================================================

  describe('getMigrationProgress', () => {
    it('should return accurate counts and percentage', async () => {
      // Set up count mocks in sequence: totalItems, flatItems, pendingItems, migratedItems, hybridItems
      mockDataRepo.count
        .mockResolvedValueOnce(10) // totalItems
        .mockResolvedValueOnce(3) // flatItems
        .mockResolvedValueOnce(2) // pendingItems
        .mockResolvedValueOnce(5) // migratedItems
        .mockResolvedValueOnce(5); // hybridItems

      const result = await service.getMigrationProgress(ORG_ID);

      expect(result.totalItems).toBe(10);
      expect(result.flatItems).toBe(3);
      expect(result.pendingItems).toBe(2);
      expect(result.migratedItems).toBe(5);
      // percentComplete = migratedItems / (pendingItems + migratedItems) * 100
      // = 5 / (2 + 5) * 100 = 71
      expect(result.percentComplete).toBe(71);
    });

    it('should return 100% when no migratable items', async () => {
      mockDataRepo.count
        .mockResolvedValueOnce(0) // totalItems
        .mockResolvedValueOnce(0) // flatItems
        .mockResolvedValueOnce(0) // pendingItems
        .mockResolvedValueOnce(0) // migratedItems
        .mockResolvedValueOnce(0); // hybridItems

      const result = await service.getMigrationProgress(ORG_ID);

      expect(result.percentComplete).toBe(100);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
