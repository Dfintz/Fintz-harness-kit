import { AppDataSource } from '../../config/database';
import { EncryptedData } from '../../models/EncryptedData';
import { EncryptionAuditLog, EncryptionEventType } from '../../models/EncryptionAuditLog';
import { OrganizationEncryptionKey } from '../../models/OrganizationEncryptionKey';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  InitializeEncryptionInput,
  OrganizationEncryptionService,
  ShareKeyInput,
  StoreEncryptedDataInput,
} from '../encryption/OrganizationEncryptionService';

// Mock dependencies
jest.mock('../../config/database');

describe('OrganizationEncryptionService', () => {
  let service: OrganizationEncryptionService;
  let mockKeyRepo: any;
  let mockDataRepo: any;
  let mockAuditRepo: any;
  let mockMembershipRepo: any;

  const orgId = 'org-123';
  const userId = 'user-456';
  const keyId = 'key-789';

  const mockActiveKey = {
    id: 'pk-1',
    organizationId: orgId,
    keyId,
    algorithm: 'AES-256-GCM',
    keyWrappers: { [userId]: 'encrypted-wrapper-1' },
    recoveryHint: 'test hint',
    requiresRecoveryPhrase: true,
    createdBy: userId,
    version: 1,
    isActive: true,
    usageCount: 5,
    lastUsedAt: new Date(),
    createdAt: new Date('2025-01-01'),
    getKeyWrapperForUser: jest.fn((uid: string) => {
      const wrappers: Record<string, string> = { [userId]: 'encrypted-wrapper-1' };
      return wrappers[uid] || null;
    }),
    addKeyWrapperForUser: jest.fn(),
    removeKeyWrapperForUser: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
    getCount: jest.fn(() => Promise.resolve(0)),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockKeyRepo = {
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      findOne: jest.fn(() => Promise.resolve(null)),
      find: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
    };

    mockDataRepo = {
      create: jest.fn((data: any) => ({ id: 'data-1', ...data })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      findOne: jest.fn(() => Promise.resolve(null)),
      find: jest.fn(() => Promise.resolve([])),
      findAndCount: jest.fn(() => Promise.resolve([[], 0])),
      count: jest.fn(() => Promise.resolve(0)),
      createQueryBuilder: jest.fn(() => ({ ...mockQueryBuilder })),
    };

    mockAuditRepo = {
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(() => ({ ...mockQueryBuilder })),
    };

    mockMembershipRepo = {
      findOne: jest.fn(() => Promise.resolve(null)),
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity: any) => {
      if (entity === OrganizationEncryptionKey) return mockKeyRepo;
      if (entity === EncryptedData) return mockDataRepo;
      if (entity === EncryptionAuditLog) return mockAuditRepo;
      if (entity === OrganizationMembership) return mockMembershipRepo;
      return {};
    });

    service = new OrganizationEncryptionService();
  });

  describe('initializeEncryption', () => {
    const input: InitializeEncryptionInput = {
      organizationId: orgId,
      keyId,
      algorithm: 'AES-256-GCM',
      wrappedKeys: { [userId]: 'wrapped-key-data' },
      recoveryHint: 'test hint',
      createdBy: userId,
      ipAddress: '127.0.0.1',
    };

    it('should initialize encryption for an organization', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.initializeEncryption(input);

      expect(result.organizationId).toBe(orgId);
      expect(result.keyId).toBe(keyId);
      expect(result.algorithm).toBe('AES-256-GCM');
      expect(result.isActive).toBe(true);
      expect(result.version).toBe(1);
      expect(mockKeyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          keyId,
          algorithm: 'AES-256-GCM',
          isActive: true,
        })
      );
      expect(mockKeyRepo.save).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('should throw if encryption already enabled', async () => {
      mockKeyRepo.findOne.mockResolvedValue(mockActiveKey);

      await expect(service.initializeEncryption(input)).rejects.toThrow(
        'Encryption already enabled for this organization'
      );
    });

    it('should create audit log entry on initialization', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      await service.initializeEncryption(input);

      expect(mockAuditRepo.create).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });
  });

  describe('getEncryptionStatus', () => {
    it('should return disabled status when no active key', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.getEncryptionStatus(orgId);

      expect(result.enabled).toBe(false);
      expect(result.keyId).toBeUndefined();
    });

    it('should return enabled status with key details', async () => {
      mockKeyRepo.findOne.mockResolvedValue(mockActiveKey);

      const result = await service.getEncryptionStatus(orgId);

      expect(result.enabled).toBe(true);
      expect(result.keyId).toBe(keyId);
      expect(result.algorithm).toBe('AES-256-GCM');
      expect(result.version).toBe(1);
      expect(result.numKeyHolders).toBe(1);
    });
  });

  describe('getKeyWrapperForUser', () => {
    it('should return null when no active key', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.getKeyWrapperForUser(orgId, userId);

      expect(result).toBeNull();
    });

    it('should return null when user has no wrapper', async () => {
      mockActiveKey.getKeyWrapperForUser.mockReturnValue(null);
      mockKeyRepo.findOne.mockResolvedValue(mockActiveKey);

      const result = await service.getKeyWrapperForUser(orgId, 'unknown-user');

      expect(result).toBeNull();
    });

    it('should return wrapped key for authorized user', async () => {
      mockActiveKey.getKeyWrapperForUser.mockReturnValue('encrypted-wrapper-1');
      mockKeyRepo.findOne.mockResolvedValue(mockActiveKey);

      const result = await service.getKeyWrapperForUser(orgId, userId);

      expect(result).not.toBeNull();
      expect(result!.keyId).toBe(keyId);
      expect(result!.wrappedKey).toBe('encrypted-wrapper-1');
      expect(result!.algorithm).toBe('AES-256-GCM');
    });
  });

  describe('shareKey', () => {
    const shareInput: ShareKeyInput = {
      organizationId: orgId,
      keyId,
      userId: 'target-user',
      wrappedKey: 'new-user-wrapped-key',
      sharedBy: userId,
    };

    it('should share key with a member', async () => {
      mockKeyRepo.findOne.mockResolvedValue({ ...mockActiveKey });
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'target-user',
        organizationId: orgId,
        isActive: true,
      });

      await service.shareKey(shareInput);

      expect(mockActiveKey.addKeyWrapperForUser).toHaveBeenCalledWith(
        'target-user',
        'new-user-wrapped-key'
      );
      expect(mockKeyRepo.save).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('should throw if key not found', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      await expect(service.shareKey(shareInput)).rejects.toThrow('Encryption key not found');
    });

    it('should throw if target user is not a member', async () => {
      mockKeyRepo.findOne.mockResolvedValue({ ...mockActiveKey });
      mockMembershipRepo.findOne.mockResolvedValue(null);

      await expect(service.shareKey(shareInput)).rejects.toThrow(
        'User is not a member of this organization'
      );
    });
  });

  describe('revokeKeyAccess', () => {
    it('should revoke key access and log event', async () => {
      mockKeyRepo.findOne.mockResolvedValue({ ...mockActiveKey });

      await service.revokeKeyAccess(orgId, keyId, 'target-user', userId);

      expect(mockActiveKey.removeKeyWrapperForUser).toHaveBeenCalledWith('target-user');
      expect(mockKeyRepo.save).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('should throw if key not found', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      await expect(service.revokeKeyAccess(orgId, keyId, 'target-user', userId)).rejects.toThrow(
        'Encryption key not found'
      );
    });
  });

  describe('storeEncryptedData', () => {
    const storeInput: StoreEncryptedDataInput = {
      organizationId: orgId,
      keyId,
      dataType: 'fleet-config',
      resourceId: 'fleet-1',
      encryptedData: 'base64-encrypted-blob',
      encryptionMetadata: {
        iv: 'random-iv',
        algorithm: 'AES-256-GCM',
        authTag: 'auth-tag',
      } as any,
      createdBy: userId,
      minSecurityLevel: 3,
      allowedRoles: ['admin', 'officer'],
    };

    it('should store encrypted data and update key usage', async () => {
      const keyWithUsage = { ...mockActiveKey, usageCount: 5 };
      mockKeyRepo.findOne.mockResolvedValue(keyWithUsage);

      const result = await service.storeEncryptedData(storeInput);

      expect(result.organizationId).toBe(orgId);
      expect(result.keyId).toBe(keyId);
      expect(result.dataType).toBe('fleet-config');
      expect(mockDataRepo.create).toHaveBeenCalled();
      expect(mockDataRepo.save).toHaveBeenCalled();
      expect(mockKeyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ usageCount: 6 }));
    });

    it('should throw if key not found or inactive', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      await expect(service.storeEncryptedData(storeInput)).rejects.toThrow(
        'Active encryption key not found'
      );
    });
  });

  describe('getEncryptedData', () => {
    const mockData = {
      id: 'data-1',
      organizationId: orgId,
      keyId,
      dataType: 'fleet-config',
      encryptedData: 'blob',
      isDeleted: false,
      minSecurityLevel: 3,
      allowedRoles: ['admin'],
      meetsSecurityLevel: jest.fn(() => true),
      isRoleAllowed: jest.fn(() => true),
      incrementAccessCount: jest.fn(),
    };

    it('should return encrypted data for authorized user', async () => {
      mockDataRepo.findOne.mockResolvedValue(mockData);

      const result = await service.getEncryptedData(orgId, 'data-1', userId, 5, 'admin');

      expect(result).toBe(mockData);
      expect(mockData.incrementAccessCount).toHaveBeenCalled();
      expect(mockDataRepo.save).toHaveBeenCalled();
    });

    it('should throw if data not found', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(service.getEncryptedData(orgId, 'data-1', userId, 5, 'admin')).rejects.toThrow(
        'Encrypted data not found'
      );
    });

    it('should deny access for insufficient security level', async () => {
      mockData.meetsSecurityLevel.mockReturnValue(false);
      mockDataRepo.findOne.mockResolvedValue(mockData);

      await expect(service.getEncryptedData(orgId, 'data-1', userId, 1, 'admin')).rejects.toThrow(
        'Insufficient security level to access this data'
      );

      // Should log ACCESS_DENIED event
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', async () => {
      mockData.meetsSecurityLevel.mockReturnValue(true);
      mockData.isRoleAllowed.mockReturnValue(false);
      mockDataRepo.findOne.mockResolvedValue(mockData);

      await expect(service.getEncryptedData(orgId, 'data-1', userId, 5, 'member')).rejects.toThrow(
        'Your role is not allowed to access this data'
      );

      expect(mockAuditRepo.save).toHaveBeenCalled();
    });
  });

  describe('deleteEncryptedData', () => {
    const mockData = {
      id: 'data-1',
      organizationId: orgId,
      dataType: 'fleet-config',
      softDelete: jest.fn(),
    };

    it('should soft delete encrypted data', async () => {
      mockDataRepo.findOne.mockResolvedValue(mockData);

      await service.deleteEncryptedData(orgId, 'data-1', userId);

      expect(mockData.softDelete).toHaveBeenCalledWith(userId);
      expect(mockDataRepo.save).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('should throw if data not found', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteEncryptedData(orgId, 'data-1', userId)).rejects.toThrow(
        'Encrypted data not found'
      );
    });

    it('should deny cross-tenant deletion by organization scope', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteEncryptedData('other-org', 'data-1', userId)).rejects.toThrow(
        'Encrypted data not found'
      );
      expect(mockDataRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'other-org', id: 'data-1', isDeleted: false },
      });
    });
  });

  describe('getAuditLog', () => {
    it('should return audit logs with pagination', async () => {
      const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
      const qb = { ...mockQueryBuilder };
      qb.getManyAndCount.mockResolvedValue([mockLogs, 2]);
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAuditLog(orgId, {
        limit: 10,
        offset: 0,
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by event type and userId', async () => {
      const qb = { ...mockQueryBuilder };
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getAuditLog(orgId, {
        eventType: EncryptionEventType.DATA_ENCRYPTED,
        userId,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('rotateKey', () => {
    it('should deactivate old key and create new one', async () => {
      const currentKey = { ...mockActiveKey, version: 1 };
      mockKeyRepo.findOne.mockResolvedValue(currentKey);

      const newWrappedKeys = { [userId]: 'new-wrapped-key' };
      const result = await service.rotateKey(orgId, 'new-key-id', newWrappedKeys, userId);

      expect(result.keyId).toBe('new-key-id');
      expect(result.version).toBe(2);
      expect(result.isActive).toBe(true);
      // Old key deactivated
      expect(mockKeyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it('should throw if no active key found', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      await expect(service.rotateKey(orgId, 'new-key-id', {}, userId)).rejects.toThrow(
        'Active encryption key not found'
      );
    });
  });

  describe('getReEncryptionProgress', () => {
    it('should return 100% when no active key', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.getReEncryptionProgress(orgId);

      expect(result.percentComplete).toBe(100);
      expect(result.totalItems).toBe(0);
    });

    it('should calculate progress correctly', async () => {
      mockKeyRepo.findOne.mockResolvedValue(mockActiveKey);
      mockDataRepo.count
        .mockResolvedValueOnce(10) // totalItems
        .mockResolvedValueOnce(7); // reEncryptedItems

      const result = await service.getReEncryptionProgress(orgId);

      expect(result.totalItems).toBe(10);
      expect(result.reEncryptedItems).toBe(7);
      expect(result.pendingItems).toBe(3);
      expect(result.percentComplete).toBe(70);
    });
  });

  describe('updateReEncryptedData', () => {
    it('should update data with new key', async () => {
      const mockData = {
        id: 'data-1',
        organizationId: orgId,
        keyId: 'old-key',
        dataType: 'fleet-config',
        isDeleted: false,
      };
      const newKey = { ...mockActiveKey, keyId: 'new-key', usageCount: 0 };

      mockDataRepo.findOne.mockResolvedValue(mockData);
      mockKeyRepo.findOne.mockResolvedValue(newKey);

      const result = await service.updateReEncryptedData(
        orgId,
        'data-1',
        'new-key',
        'new-encrypted-blob',
        { iv: 'new-iv', algorithm: 'AES-256-GCM', authTag: 'new-tag' } as any,
        userId
      );

      expect(result.keyId).toBe('new-key');
      expect(result.encryptedData).toBe('new-encrypted-blob');
    });

    it('should throw if data not found', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReEncryptedData(orgId, 'nonexistent', 'new-key', 'blob', {} as any, userId)
      ).rejects.toThrow('Encrypted data not found');
    });

    it('should throw if new key not active', async () => {
      mockDataRepo.findOne.mockResolvedValue({
        id: 'data-1',
        organizationId: orgId,
        isDeleted: false,
      });
      mockKeyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReEncryptedData(orgId, 'data-1', 'bad-key', 'blob', {} as any, userId)
      ).rejects.toThrow('New encryption key not found');
    });

    it('should deny cross-tenant update by organization scope', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReEncryptedData(
          'other-org',
          'data-1',
          'new-key',
          'new-encrypted-blob',
          { iv: 'new-iv', algorithm: 'AES-256-GCM', authTag: 'new-tag' } as any,
          userId
        )
      ).rejects.toThrow('Encrypted data not found');
      expect(mockDataRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'other-org', id: 'data-1', isDeleted: false },
      });
    });
  });

  describe('cross-tenant guards', () => {
    it('should deny cross-tenant read by organization scope', async () => {
      mockDataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getEncryptedData('other-org', 'data-1', userId, 5, 'admin')
      ).rejects.toThrow('Encrypted data not found');
      expect(mockDataRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'other-org', id: 'data-1', isDeleted: false },
      });
    });
  });

  describe('getInactiveKeyWrapper', () => {
    it('should return wrapper for inactive key', async () => {
      const inactiveKey = {
        ...mockActiveKey,
        isActive: false,
        getKeyWrapperForUser: jest.fn(() => 'old-wrapped-key'),
      };
      mockKeyRepo.findOne.mockResolvedValue(inactiveKey);

      const result = await service.getInactiveKeyWrapper(orgId, 'old-key', userId);

      expect(result).not.toBeNull();
      expect(result!.wrappedKey).toBe('old-wrapped-key');
    });

    it('should return null if key not found', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.getInactiveKeyWrapper(orgId, 'no-key', userId);

      expect(result).toBeNull();
    });
  });

  describe('disableEncryption', () => {
    it('should deactivate key and log event', async () => {
      mockKeyRepo.findOne.mockResolvedValue({ ...mockActiveKey });

      await service.disableEncryption(orgId, userId);

      expect(mockKeyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('should throw if encryption not enabled', async () => {
      mockKeyRepo.findOne.mockResolvedValue(null);

      await expect(service.disableEncryption(orgId, userId)).rejects.toThrow(
        'Encryption not enabled for this organization'
      );
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
