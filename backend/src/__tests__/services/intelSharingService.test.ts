import { IntelClassification } from '../../models/IntelEntry';
import { IntelOfficerRank } from '../../models/IntelOfficer';
import { IntelSharePermission, IntelShareStatus } from '../../models/IntelShare';
import { RelationshipStatus, RelationshipType } from '../../models/OrganizationRelationship';
import { CreateShareInput, IntelSharingService } from '../../services/intel/IntelSharingService';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';

// Create mock repositories with unique implementations per entity
const mockShareRepoFindOne = jest.fn();
const mockShareRepoSave = jest.fn();
const mockShareRepoCreate = jest.fn();
const mockShareRepoCount = jest.fn();
const mockShareRepoCreateQueryBuilder = jest.fn();

const mockIntelEntryRepoFindOne = jest.fn();
const mockIntelEntryRepoUpdate = jest.fn();

const mockIntelOfficerRepoFindOne = jest.fn();

const mockAuditLogRepoCreate = jest.fn();
const mockAuditLogRepoSave = jest.fn();

const mockUserOrgRepoFindOne = jest.fn();

const mockRelationshipRepoFindOne = jest.fn();

jest.mock('../../config/database', () => {
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'IntelShare') {
          return {
            findOne: mockShareRepoFindOne,
            save: mockShareRepoSave,
            create: mockShareRepoCreate,
            count: mockShareRepoCount,
            createQueryBuilder: mockShareRepoCreateQueryBuilder,
          };
        }
        if (entity.name === 'IntelEntry') {
          return {
            findOne: mockIntelEntryRepoFindOne,
            update: mockIntelEntryRepoUpdate,
          };
        }
        if (entity.name === 'IntelOfficer') {
          return {
            findOne: mockIntelOfficerRepoFindOne,
          };
        }
        if (entity.name === 'IntelAuditLog') {
          return {
            create: mockAuditLogRepoCreate,
            save: mockAuditLogRepoSave,
          };
        }
        if (entity.name === 'OrganizationMembership') {
          return {
            findOne: mockUserOrgRepoFindOne,
          };
        }
        if (entity.name === 'OrganizationRelationship') {
          return {
            findOne: mockRelationshipRepoFindOne,
          };
        }
        // Default mock
        return {
          findOne: jest.fn().mockResolvedValue(null),
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn(),
          create: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        };
      }),
    },
  };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('IntelSharingService', () => {
  let service: IntelSharingService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set default implementations
    mockShareRepoCreate.mockImplementation((data: Record<string, unknown>) => data);
    mockShareRepoSave.mockImplementation((data: Record<string, unknown>) => Promise.resolve(data));
    mockShareRepoFindOne.mockResolvedValue(null);
    mockShareRepoCount.mockResolvedValue(0);

    mockIntelEntryRepoFindOne.mockResolvedValue(null);
    mockIntelEntryRepoUpdate.mockResolvedValue({ affected: 1 });

    mockIntelOfficerRepoFindOne.mockResolvedValue(null);

    mockAuditLogRepoCreate.mockImplementation((data: Record<string, unknown>) => data);
    mockAuditLogRepoSave.mockResolvedValue({});

    mockUserOrgRepoFindOne.mockResolvedValue(null);

    mockRelationshipRepoFindOne.mockResolvedValue(null);

    service = new IntelSharingService();
  });

  describe('canShareIntel', () => {
    it('should return true for org owner', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });

      const result = await service.canShareIntel('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return true for Chief Intel officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.CHIEF,
        isActive: true,
      });

      const result = await service.canShareIntel('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return true for Lead Intel officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.LEAD,
        isActive: true,
      });

      const result = await service.canShareIntel('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return false for regular officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.OFFICER,
        isActive: true,
      });

      const result = await service.canShareIntel('user-123', 'org-456');

      expect(result).toBe(false);
    });

    it('should return false for non-member', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue(null);

      const result = await service.canShareIntel('user-123', 'org-456');

      expect(result).toBe(false);
    });
  });

  describe('areOrganizationsAllied', () => {
    it('should return true for allied organizations', async () => {
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      });

      const result = await service.areOrganizationsAllied('org-1', 'org-2');

      expect(result).toBe(true);
    });

    it('should return true for partnership organizations', async () => {
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.PARTNERSHIP,
        status: RelationshipStatus.ACTIVE,
      });

      const result = await service.areOrganizationsAllied('org-1', 'org-2');

      expect(result).toBe(true);
    });

    it('should return true for cooperative organizations', async () => {
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.COOPERATIVE,
        status: RelationshipStatus.ACTIVE,
      });

      const result = await service.areOrganizationsAllied('org-1', 'org-2');

      expect(result).toBe(true);
    });

    it('should return false for neutral organizations', async () => {
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.NEUTRAL,
        status: RelationshipStatus.ACTIVE,
      });

      const result = await service.areOrganizationsAllied('org-1', 'org-2');

      expect(result).toBe(false);
    });

    it('should return false for hostile organizations', async () => {
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.HOSTILE,
        status: RelationshipStatus.ACTIVE,
      });

      const result = await service.areOrganizationsAllied('org-1', 'org-2');

      expect(result).toBe(false);
    });

    it('should return false for no relationship', async () => {
      mockRelationshipRepoFindOne.mockResolvedValue(null);

      const result = await service.areOrganizationsAllied('org-1', 'org-2');

      expect(result).toBe(false);
    });
  });

  describe('createShare', () => {
    const validInput: CreateShareInput = {
      intelEntryId: 'intel-123',
      sourceOrganizationId: 'org-source',
      targetOrganizationId: 'org-target',
      permission: IntelSharePermission.VIEW,
      maxClassification: IntelClassification.CONFIDENTIAL,
      shareReason: 'Alliance cooperation',
    };

    it('should create a share successfully', async () => {
      // Mock user can share
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });

      // Mock organizations are allied
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      });

      // Mock intel entry exists
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-source',
        classification: IntelClassification.RESTRICTED,
        title: 'Test Intel',
      });

      // Mock no existing share
      mockShareRepoFindOne.mockResolvedValue(null);

      // Mock save
      mockShareRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({
          ...data,
          id: 'share-123',
        })
      );

      const result = await service.createShare(validInput, 'user-123');

      expect(result).toBeDefined();
      expect(result.intelEntryId).toBe('intel-123');
      expect(result.sourceOrganizationId).toBe('org-source');
      expect(result.targetOrganizationId).toBe('org-target');
      expect(result.permission).toBe(IntelSharePermission.VIEW);
      expect(result.status).toBe(IntelShareStatus.PENDING);
    });

    it('should throw error if user cannot share', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue(null);

      await expect(service.createShare(validInput, 'user-123')).rejects.toThrow(
        'User does not have permission to share Intel'
      );
    });

    it('should throw error if organizations are not allied', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockRelationshipRepoFindOne.mockResolvedValue(null);

      await expect(service.createShare(validInput, 'user-123')).rejects.toThrow(
        'Intel can only be shared with allied organizations'
      );
    });

    it('should throw error if intel entry not found', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      });
      mockIntelEntryRepoFindOne.mockResolvedValue(null);

      await expect(service.createShare(validInput, 'user-123')).rejects.toThrow(
        'Intel entry not found'
      );
    });

    it('should throw error if already shared', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-source',
        classification: IntelClassification.RESTRICTED,
      });
      mockShareRepoFindOne.mockResolvedValue({ status: IntelShareStatus.ACTIVE });

      await expect(service.createShare(validInput, 'user-123')).rejects.toThrow(
        'Intel is already shared with this organization'
      );
    });
  });

  describe('acceptShare', () => {
    it('should accept a pending share', async () => {
      const mockShare = {
        id: 'share-123',
        intelEntryId: 'intel-123',
        sourceOrganizationId: 'org-source',
        targetOrganizationId: 'org-target',
        status: IntelShareStatus.PENDING,
        sharedBy: 'user-source',
      };

      mockShareRepoFindOne.mockResolvedValue(mockShare);
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockShareRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.acceptShare('share-123', 'user-target', 'org-target');

      expect(result.status).toBe(IntelShareStatus.ACTIVE);
      expect(result.acceptedBy).toBe('user-target');
    });

    it('should throw error if share not found', async () => {
      mockShareRepoFindOne.mockResolvedValue(null);

      await expect(service.acceptShare('share-123', 'user-target', 'org-target')).rejects.toThrow(
        'Share not found'
      );
    });

    it('should throw error if share is not pending', async () => {
      mockShareRepoFindOne.mockResolvedValue({
        status: IntelShareStatus.ACTIVE,
      });

      await expect(service.acceptShare('share-123', 'user-target', 'org-target')).rejects.toThrow(
        'Cannot accept share with status: active'
      );
    });
  });

  describe('revokeShare', () => {
    it('should revoke an active share', async () => {
      const mockShare = {
        id: 'share-123',
        intelEntryId: 'intel-123',
        sourceOrganizationId: 'org-source',
        targetOrganizationId: 'org-target',
        status: IntelShareStatus.ACTIVE,
        sharedBy: 'user-source',
      };

      mockShareRepoFindOne.mockResolvedValue(mockShare);
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockShareRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );
      mockShareRepoCount.mockResolvedValue(0);

      const result = await service.revokeShare(
        'share-123',
        'user-source',
        'org-source',
        'No longer needed'
      );

      expect(result.status).toBe(IntelShareStatus.REVOKED);
      expect(result.revokedBy).toBe('user-source');
      expect(result.revokeReason).toBe('No longer needed');
    });

    it('should throw error if share not found', async () => {
      mockShareRepoFindOne.mockResolvedValue(null);

      await expect(service.revokeShare('share-123', 'user-source', 'org-source')).rejects.toThrow(
        'Share not found'
      );
    });

    it('should throw error if share already revoked', async () => {
      mockShareRepoFindOne.mockResolvedValue({
        status: IntelShareStatus.REVOKED,
      });

      await expect(service.revokeShare('share-123', 'user-source', 'org-source')).rejects.toThrow(
        'Share is already revoked'
      );
    });
  });

  describe('expireOldShares', () => {
    it('should return count of expired shares', async () => {
      mockShareRepoCreateQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      });

      const result = await service.expireOldShares();

      expect(result).toBe(5);
    });

    it('should return 0 when no shares to expire', async () => {
      mockShareRepoCreateQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });

      const result = await service.expireOldShares();

      expect(result).toBe(0);
    });
  });

  describe('typed error normalization', () => {
    const sharingInput: CreateShareInput = {
      intelEntryId: 'intel-123',
      sourceOrganizationId: 'org-source',
      targetOrganizationId: 'org-target',
      permission: IntelSharePermission.VIEW,
      maxClassification: IntelClassification.CONFIDENTIAL,
      shareReason: 'Alliance cooperation',
    };

    const allowSharing = (): void => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockRelationshipRepoFindOne.mockResolvedValue({
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      });
    };

    it('createShare throws ForbiddenError (403) when user cannot share', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue(null);

      const error = await service.createShare(sharingInput, 'user-123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
    });

    it('createShare throws NotFoundError (404) when intel entry is missing', async () => {
      allowSharing();
      mockIntelEntryRepoFindOne.mockResolvedValue(null);

      const error = await service.createShare(sharingInput, 'user-123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('createShare throws ValidationError (400) when classification exceeds the max allowed', async () => {
      allowSharing();
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-source',
        classification: IntelClassification.SECRET,
      });

      const error = await service.createShare(sharingInput, 'user-123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('createShare throws ConflictError (409) when intel is already shared', async () => {
      allowSharing();
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-source',
        classification: IntelClassification.RESTRICTED,
      });
      mockShareRepoFindOne.mockResolvedValue({ status: IntelShareStatus.ACTIVE });

      const error = await service.createShare(sharingInput, 'user-123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('acceptShare throws ConflictError (409) for a non-pending share', async () => {
      mockShareRepoFindOne.mockResolvedValue({ status: IntelShareStatus.ACTIVE });

      const error = await service
        .acceptShare('share-123', 'user-target', 'org-target')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('acceptShare throws ForbiddenError (403) when user lacks accept permission', async () => {
      mockShareRepoFindOne.mockResolvedValue({ status: IntelShareStatus.PENDING });
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue(null);

      const error = await service
        .acceptShare('share-123', 'user-target', 'org-target')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
    });

    it('revokeShare throws ConflictError (409) when the share is already revoked', async () => {
      mockShareRepoFindOne.mockResolvedValue({ status: IntelShareStatus.REVOKED });

      const error = await service
        .revokeShare('share-123', 'user-source', 'org-source')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
