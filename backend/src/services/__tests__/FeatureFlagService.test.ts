// Mock dependencies BEFORE imports
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../websocket/controllers/featureFlagWebSocketController', () => ({
  notifyFeatureFlagChange: jest.fn().mockResolvedValue(undefined),
}));

import { Repository } from 'typeorm';
import { FeatureFlag, FeatureFlagStatus, FeatureFlagScope } from '../../models/FeatureFlag';
import { FeatureFlagAuditLog, FeatureFlagAction } from '../../models/FeatureFlagAuditLog';
import { FeatureFlagService } from '../../services/admin/FeatureFlagService';
import { AppDataSource } from '../../data-source';
import logger from '../../utils/logger';

describe('FeatureFlagService', () => {
  let mockFlagRepo: jest.Mocked<Repository<FeatureFlag>>;
  let mockAuditRepo: jest.Mocked<Repository<FeatureFlagAuditLog>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset FeatureFlagService static properties
    (FeatureFlagService as any).flagRepository = undefined;
    (FeatureFlagService as any).auditRepository = undefined;

    // Mock logger methods
    (logger.debug as jest.Mock) = jest.fn();
    (logger.info as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();

    // Create mocked repositories
    mockFlagRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockAuditRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      createQueryBuilder: jest.fn(),
    } as any;

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === FeatureFlag) {
        return mockFlagRepo;
      }
      if (entity === FeatureFlagAuditLog) {
        return mockAuditRepo;
      }
      return {} as any;
    });
  });

  describe('isEnabled', () => {
    it('should return false for non-existent flag', async () => {
      mockFlagRepo.findOne.mockResolvedValue(null);

      const result = await FeatureFlagService.isEnabled('non-existent', 'user-123');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Feature flag not found', {
        featureId: 'non-existent',
      });
    });

    it('should return false for disabled flag', async () => {
      const mockFlag: Partial<FeatureFlag> = {
        id: 'test-flag',
        status: FeatureFlagStatus.DISABLED,
        scope: FeatureFlagScope.GLOBAL,
      };
      mockFlagRepo.findOne.mockResolvedValue(mockFlag as FeatureFlag);

      const result = await FeatureFlagService.isEnabled('test-flag', 'user-123');

      expect(result).toBe(false);
    });

    it('should return true for enabled flag', async () => {
      const mockFlag: Partial<FeatureFlag> = {
        id: 'test-flag',
        status: FeatureFlagStatus.ENABLED,
        scope: FeatureFlagScope.GLOBAL,
      };
      mockFlagRepo.findOne.mockResolvedValue(mockFlag as FeatureFlag);

      const result = await FeatureFlagService.isEnabled('test-flag', 'user-123');

      expect(result).toBe(true);
    });

    it('should handle percentage-based rollout deterministically', async () => {
      const mockFlag: Partial<FeatureFlag> = {
        id: 'percentage-flag',
        status: FeatureFlagStatus.PERCENTAGE,
        scope: FeatureFlagScope.GLOBAL,
        percentage: 50,
      };
      mockFlagRepo.findOne.mockResolvedValue(mockFlag as FeatureFlag);

      // Same user should always get same result
      const result1 = await FeatureFlagService.isEnabled('percentage-flag', 'user-123');
      const result2 = await FeatureFlagService.isEnabled('percentage-flag', 'user-123');

      expect(result1).toBe(result2);
    });

    it('should check organization scope correctly', async () => {
      const mockFlag: Partial<FeatureFlag> = {
        id: 'org-flag',
        status: FeatureFlagStatus.BETA,
        scope: FeatureFlagScope.ORGANIZATION,
        targetOrganizations: ['org-1', 'org-2'],
      };
      mockFlagRepo.findOne.mockResolvedValue(mockFlag as FeatureFlag);

      const result1 = await FeatureFlagService.isEnabled('org-flag', 'user-123', 'org-1');
      const result2 = await FeatureFlagService.isEnabled('org-flag', 'user-123', 'org-3');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should check user scope correctly', async () => {
      const mockFlag: Partial<FeatureFlag> = {
        id: 'user-flag',
        status: FeatureFlagStatus.BETA,
        scope: FeatureFlagScope.USER,
        targetUsers: ['user-1', 'user-2'],
      };
      mockFlagRepo.findOne.mockResolvedValue(mockFlag as FeatureFlag);

      const result1 = await FeatureFlagService.isEnabled('user-flag', 'user-1');
      const result2 = await FeatureFlagService.isEnabled('user-flag', 'user-3');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('getAllFlags', () => {
    it('should return all flags', async () => {
      const mockFlags: Partial<FeatureFlag>[] = [
        {
          id: 'flag-1',
          name: 'Flag 1',
          status: FeatureFlagStatus.ENABLED,
          scope: FeatureFlagScope.GLOBAL,
        },
        {
          id: 'flag-2',
          name: 'Flag 2',
          status: FeatureFlagStatus.DISABLED,
          scope: FeatureFlagScope.GLOBAL,
        },
      ];
      mockFlagRepo.find.mockResolvedValue(mockFlags as FeatureFlag[]);

      const result = await FeatureFlagService.getAllFlags();

      expect(result).toHaveLength(2);
      expect(mockFlagRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('createFlag', () => {
    it('should create a new flag and log audit', async () => {
      const newFlagData: Omit<FeatureFlag, 'createdAt' | 'updatedAt'> = {
        id: 'new-flag',
        name: 'New Flag',
        description: 'A new feature flag',
        status: FeatureFlagStatus.DISABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: 'admin-123',
      };

      const savedFlag = {
        ...newFlagData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as FeatureFlag;
      mockFlagRepo.create.mockReturnValue(savedFlag);
      mockFlagRepo.save.mockResolvedValue(savedFlag);
      mockAuditRepo.save.mockResolvedValue({} as any);

      const result = await FeatureFlagService.createFlag(newFlagData, 'admin-123');

      expect(result).toEqual(savedFlag);
      expect(mockFlagRepo.save).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          featureFlagId: 'new-flag',
          action: FeatureFlagAction.CREATED,
          userId: 'admin-123',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Feature flag created',
        expect.objectContaining({ flagId: 'new-flag' })
      );
    });
  });

  describe('updateFlag', () => {
    it('should update an existing flag', async () => {
      const existingFlag: FeatureFlag = {
        id: 'existing-flag',
        name: 'Existing Flag',
        description: 'Description',
        status: FeatureFlagStatus.DISABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updates = { status: FeatureFlagStatus.ENABLED };
      const updatedFlag = { ...existingFlag, ...updates };

      mockFlagRepo.findOne.mockResolvedValue(existingFlag);
      mockFlagRepo.save.mockResolvedValue(updatedFlag);
      mockAuditRepo.save.mockResolvedValue({} as any);

      const result = await FeatureFlagService.updateFlag('existing-flag', updates, 'admin-2');

      expect(result).toEqual(updatedFlag);
      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          featureFlagId: 'existing-flag',
          action: FeatureFlagAction.UPDATED,
        })
      );
    });

    it('should return null for non-existent flag', async () => {
      mockFlagRepo.findOne.mockResolvedValue(null);

      const result = await FeatureFlagService.updateFlag('non-existent', {}, 'admin-123');

      expect(result).toBeNull();
    });
  });

  describe('deleteFlag', () => {
    it('should delete a flag and log audit', async () => {
      const existingFlag: FeatureFlag = {
        id: 'flag-to-delete',
        name: 'Flag to Delete',
        description: 'Description',
        status: FeatureFlagStatus.DISABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFlagRepo.findOne.mockResolvedValue(existingFlag);
      mockFlagRepo.delete.mockResolvedValue({} as any);
      mockAuditRepo.save.mockResolvedValue({} as any);

      const result = await FeatureFlagService.deleteFlag('flag-to-delete', 'admin-2');

      expect(result).toBe(true);
      expect(mockFlagRepo.delete).toHaveBeenCalledWith('flag-to-delete');
      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          featureFlagId: 'flag-to-delete',
          action: FeatureFlagAction.DELETED,
        })
      );
    });

    it('should return false for non-existent flag', async () => {
      mockFlagRepo.findOne.mockResolvedValue(null);

      const result = await FeatureFlagService.deleteFlag('non-existent', 'admin-123');

      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      const mockFlags: Partial<FeatureFlag>[] = [
        { status: FeatureFlagStatus.ENABLED },
        { status: FeatureFlagStatus.ENABLED },
        { status: FeatureFlagStatus.DISABLED },
        { status: FeatureFlagStatus.BETA },
        { status: FeatureFlagStatus.PERCENTAGE },
      ];
      mockFlagRepo.find.mockResolvedValue(mockFlags as FeatureFlag[]);

      const stats = await FeatureFlagService.getStatistics();

      expect(stats).toEqual({
        total: 5,
        enabled: 2,
        disabled: 1,
        beta: 1,
        percentageRollout: 1,
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

