/**
 * EncryptionControllerV2 — Phase 3 & 4 (Hybrid Encryption) Controller Tests
 *
 * Tests the HTTP layer for hybrid-encrypted data storage/retrieval and
 * flat-to-hybrid migration endpoints.
 */
import { Request, Response } from 'express';

// ── Service mock ─────────────────────────────────────────────────────────────
const mockStoreHybridEncryptedData = jest.fn();
const mockGetHybridEncryptedData = jest.fn();
const mockListHybridEncryptedData = jest.fn();
const mockInitiateMigration = jest.fn();
const mockGetMigrationCandidates = jest.fn();
const mockCompleteMigrationItem = jest.fn();
const mockGetMigrationProgress = jest.fn();

jest.mock('../../../services/encryption/OrganizationEncryptionService', () => ({
  OrganizationEncryptionService: jest.fn().mockImplementation(() => ({
    storeHybridEncryptedData: mockStoreHybridEncryptedData,
    getHybridEncryptedData: mockGetHybridEncryptedData,
    listHybridEncryptedData: mockListHybridEncryptedData,
    initiateMigration: mockInitiateMigration,
    getMigrationCandidates: mockGetMigrationCandidates,
    completeMigrationItem: mockCompleteMigrationItem,
    getMigrationProgress: mockGetMigrationProgress,
  })),
}));

// ── Database mocks ───────────────────────────────────────────────────────────
const mockFindOneMembership = jest.fn();
const mockFindOneUser = jest.fn();

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation((entity: { name: string }) => {
      if (entity.name === 'OrganizationMembership') {
        return { findOne: mockFindOneMembership };
      }
      if (entity.name === 'User') {
        return { findOne: mockFindOneUser };
      }
      return { findOne: jest.fn() };
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn().mockReturnValue('user-1'),
}));

jest.mock('../../../utils/roleUtils', () => ({
  getRoleName: jest.fn().mockReturnValue('admin'),
  isOwnerOrAdminRole: jest.fn((role: unknown) => {
    const name = typeof role === 'string' ? role : ((role as Record<string, string>)?.name ?? '');
    return ['owner', 'founder', 'admin'].includes(name.toLowerCase());
  }),
}));

// ── SUT ──────────────────────────────────────────────────────────────────────
import { EncryptionControllerV2 } from '../../../controllers/v2/encryptionController';
import { getRoleName } from '../../../utils/roleUtils';

describe('EncryptionControllerV2 — Phase 3 & 4', () => {
  let controller: EncryptionControllerV2;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';
  const DATA_ID = 'data-123';
  const DEK_ID = 'dek-abc';

  const activeMembership = {
    organizationId: ORG_ID,
    userId: USER_ID,
    role: 3, // admin
    isActive: true,
    securityLevel: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EncryptionControllerV2();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockFindOneMembership.mockResolvedValue(activeMembership);
    (getRoleName as jest.Mock).mockReturnValue('admin');
  });

  // ==========================================================================
  // Phase 3: Hybrid-mode data endpoints
  // ==========================================================================

  describe('storeHybridEncryptedData', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID },
        body: {
          dekId: DEK_ID,
          dataType: 'document',
          resourceId: 'res-1',
          encryptedData: 'base64-blob',
          encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'aes-256-gcm' },
          minSecurityLevel: 1,
          allowedRoles: ['admin'],
        },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should store hybrid-encrypted data and return 201', async () => {
      const savedItem = {
        id: DATA_ID,
        dekId: DEK_ID,
        dataType: 'document',
        encryptionMode: 'hybrid',
        createdAt: new Date('2026-01-01'),
      };
      mockStoreHybridEncryptedData.mockResolvedValue(savedItem);

      await controller.storeHybridEncryptedData(mockReq as Request, mockRes as Response);

      expect(mockStoreHybridEncryptedData).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        dekId: DEK_ID,
        dataType: 'document',
        resourceId: 'res-1',
        encryptedData: 'base64-blob',
        encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'aes-256-gcm' },
        createdBy: USER_ID,
        minSecurityLevel: 1,
        allowedRoles: ['admin'],
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: DATA_ID,
          dekId: DEK_ID,
          dataType: 'document',
          encryptionMode: 'hybrid',
          createdAt: savedItem.createdAt,
        },
      });
    });

    it('should propagate service errors', async () => {
      const { ApiError } = jest.requireActual('../../../middleware/errorHandlerV2');
      mockStoreHybridEncryptedData.mockRejectedValue(
        new ApiError('NOT_FOUND', 'DEK not found', 404)
      );

      await expect(
        controller.storeHybridEncryptedData(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('DEK not found');
    });
  });

  describe('getHybridEncryptedData', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID, dataId: DATA_ID },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should return hybrid data with wrapped DEK', async () => {
      const result = {
        data: {
          id: DATA_ID,
          dataType: 'document',
          resourceId: 'res-1',
          encryptedData: 'base64-blob',
          encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'aes-256-gcm' },
          encryptionMode: 'hybrid',
          createdAt: new Date('2026-01-01'),
        },
        dekId: DEK_ID,
        wrappedKey: 'wrapped-key-base64',
      };
      mockGetHybridEncryptedData.mockResolvedValue(result);

      await controller.getHybridEncryptedData(mockReq as Request, mockRes as Response);

      expect(mockGetHybridEncryptedData).toHaveBeenCalledWith(ORG_ID, DATA_ID, USER_ID, 2, 'admin');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: DATA_ID,
          dekId: DEK_ID,
          wrappedKey: 'wrapped-key-base64',
          dataType: 'document',
          resourceId: 'res-1',
          encryptedData: 'base64-blob',
          encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'aes-256-gcm' },
          encryptionMode: 'hybrid',
          createdAt: new Date('2026-01-01'),
        },
      });
    });

    it('should reject non-members', async () => {
      mockFindOneMembership.mockResolvedValue(null);

      await expect(
        controller.getHybridEncryptedData(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('You are not a member of this organization');
    });
  });

  describe('listHybridEncryptedData', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID },
        query: { dataType: 'document', limit: '10', offset: '0' },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should return list with total', async () => {
      const items = [
        {
          id: DATA_ID,
          dekId: DEK_ID,
          dataType: 'document',
          resourceId: 'res-1',
          encryptionMode: 'hybrid',
          createdAt: new Date('2026-01-01'),
          createdBy: USER_ID,
        },
      ];
      mockListHybridEncryptedData.mockResolvedValue({ items, total: 1 });

      await controller.listHybridEncryptedData(mockReq as Request, mockRes as Response);

      expect(mockListHybridEncryptedData).toHaveBeenCalledWith(ORG_ID, USER_ID, {
        dataType: 'document',
        resourceId: undefined,
        limit: 10,
        offset: 0,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: DATA_ID,
            dekId: DEK_ID,
            dataType: 'document',
            resourceId: 'res-1',
            encryptionMode: 'hybrid',
            createdAt: new Date('2026-01-01'),
            createdBy: USER_ID,
          },
        ],
        total: 1,
      });
    });
  });

  // ==========================================================================
  // Phase 4: Migration endpoints
  // ==========================================================================

  describe('initiateMigration', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should initiate migration for admin', async () => {
      mockInitiateMigration.mockResolvedValue({ totalPending: 5 });

      await controller.initiateMigration(mockReq as Request, mockRes as Response);

      expect(mockInitiateMigration).toHaveBeenCalledWith(ORG_ID, USER_ID);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { totalPending: 5 },
      });
    });

    it('should reject non-admin/owner', async () => {
      (getRoleName as jest.Mock).mockReturnValue('member');

      await expect(
        controller.initiateMigration(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('Only organization owners and admins can initiate migration');
    });

    it('should reject non-members', async () => {
      mockFindOneMembership.mockResolvedValue(null);

      await expect(
        controller.initiateMigration(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('You are not a member of this organization');
    });
  });

  describe('getMigrationCandidates', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID },
        query: { limit: '20', offset: '0' },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should return candidates with total', async () => {
      const items = [
        {
          id: DATA_ID,
          keyId: 'old-key',
          dataType: 'document',
          resourceId: 'res-1',
          encryptedData: 'blob',
          encryptionMetadata: { iv: 'iv', authTag: 'tag', algorithm: 'aes-256-gcm' },
          encryptionMode: 'flat',
          migrationStatus: 'pending',
        },
      ];
      mockGetMigrationCandidates.mockResolvedValue({ items, total: 1 });

      await controller.getMigrationCandidates(mockReq as Request, mockRes as Response);

      expect(mockGetMigrationCandidates).toHaveBeenCalledWith(ORG_ID, USER_ID, 20, 0);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: DATA_ID,
            keyId: 'old-key',
            dataType: 'document',
            resourceId: 'res-1',
            encryptedData: 'blob',
            encryptionMetadata: { iv: 'iv', authTag: 'tag', algorithm: 'aes-256-gcm' },
            encryptionMode: 'flat',
            migrationStatus: 'pending',
          },
        ],
        total: 1,
      });
    });
  });

  describe('completeMigrationItem', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID, dataId: DATA_ID },
        body: {
          dekId: DEK_ID,
          encryptedData: 're-encrypted-blob',
          encryptionMetadata: { iv: 'new-iv', authTag: 'new-tag', algorithm: 'aes-256-gcm' },
        },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should complete migration item', async () => {
      const saved = {
        id: DATA_ID,
        dekId: DEK_ID,
        dataType: 'document',
        encryptionMode: 'hybrid',
        migrationStatus: 'migrated',
      };
      mockCompleteMigrationItem.mockResolvedValue(saved);

      await controller.completeMigrationItem(mockReq as Request, mockRes as Response);

      expect(mockCompleteMigrationItem).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        dataId: DATA_ID,
        dekId: DEK_ID,
        encryptedData: 're-encrypted-blob',
        encryptionMetadata: { iv: 'new-iv', authTag: 'new-tag', algorithm: 'aes-256-gcm' },
        migratedBy: USER_ID,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: DATA_ID,
          dekId: DEK_ID,
          dataType: 'document',
          encryptionMode: 'hybrid',
          migrationStatus: 'migrated',
        },
      });
    });
  });

  describe('getMigrationProgress', () => {
    beforeEach(() => {
      mockReq = {
        params: { organizationId: ORG_ID },
        user: { id: USER_ID },
      } as unknown as Request;
    });

    it('should return progress stats', async () => {
      const progress = {
        totalItems: 10,
        pendingItems: 3,
        migratedItems: 7,
        flatItems: 0,
        percentComplete: 70,
      };
      mockGetMigrationProgress.mockResolvedValue(progress);

      await controller.getMigrationProgress(mockReq as Request, mockRes as Response);

      expect(mockGetMigrationProgress).toHaveBeenCalledWith(ORG_ID);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: progress,
      });
    });

    it('should reject non-members', async () => {
      mockFindOneMembership.mockResolvedValue(null);

      await expect(
        controller.getMigrationProgress(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('You are not a member of this organization');
    });
  });
});
