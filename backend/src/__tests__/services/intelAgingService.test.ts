import { IntelClassification } from '../../models/IntelEntry';
import { IntelOfficerRank } from '../../models/IntelOfficer';
import {
  IntelAgingService,
  ScheduleDeclassificationInput,
  ScheduleReviewInput,
} from '../../services/intel/IntelAgingService';

// Create mock repositories with unique implementations per entity
const mockIntelEntryRepoFindOne = jest.fn();
const mockIntelEntryRepoFind = jest.fn();
const mockIntelEntryRepoSave = jest.fn();
const mockIntelEntryRepoCount = jest.fn();
const mockIntelEntryRepoCreateQueryBuilder = jest.fn();

const mockIntelOfficerRepoFindOne = jest.fn();

const mockAuditLogRepoCreate = jest.fn();
const mockAuditLogRepoSave = jest.fn();

const mockUserOrgRepoFindOne = jest.fn();

jest.mock('../../config/database', () => {
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'IntelEntry') {
          return {
            findOne: mockIntelEntryRepoFindOne,
            find: mockIntelEntryRepoFind,
            save: mockIntelEntryRepoSave,
            count: mockIntelEntryRepoCount,
            createQueryBuilder: mockIntelEntryRepoCreateQueryBuilder,
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
  }
}));

// Mock encryption service
jest.mock('../../services/intel/IntelEncryptionService', () => ({
  IntelEncryptionService: {
    encryptContent: jest.fn((content: string) => content),
    decryptContent: jest.fn((content: string) => content),
    encryptMetadata: jest.fn((metadata: unknown) => metadata),
    decryptMetadata: jest.fn((metadata: unknown) => metadata),
  },
}));

describe('IntelAgingService', () => {
  let service: IntelAgingService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set default implementations
    mockIntelEntryRepoFindOne.mockResolvedValue(null);
    mockIntelEntryRepoFind.mockResolvedValue([]);
    mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(data)
    );
    mockIntelEntryRepoCount.mockResolvedValue(0);

    mockIntelOfficerRepoFindOne.mockResolvedValue(null);

    mockAuditLogRepoCreate.mockImplementation((data: Record<string, unknown>) => data);
    mockAuditLogRepoSave.mockResolvedValue({});

    mockUserOrgRepoFindOne.mockResolvedValue(null);

    service = new IntelAgingService();
  });

  describe('canManageAging', () => {
    it('should return true for org owner', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });

      const result = await service.canManageAging('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return true for Chief Intel officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.CHIEF,
        isActive: true,
      });

      const result = await service.canManageAging('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return true for Lead Intel officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.LEAD,
        isActive: true,
      });

      const result = await service.canManageAging('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return true for Senior Intel officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.SENIOR,
        isActive: true,
      });

      const result = await service.canManageAging('user-123', 'org-456');

      expect(result).toBe(true);
    });

    it('should return false for regular officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue({
        rank: IntelOfficerRank.OFFICER,
        isActive: true,
      });

      const result = await service.canManageAging('user-123', 'org-456');

      expect(result).toBe(false);
    });

    it('should return false for non-officer', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue(null);

      const result = await service.canManageAging('user-123', 'org-456');

      expect(result).toBe(false);
    });
  });

  describe('scheduleDeclassification', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const validInput: ScheduleDeclassificationInput = {
      intelEntryId: 'intel-123',
      organizationId: 'org-456',
      declassificationDate: futureDate,
      targetClassification: IntelClassification.RESTRICTED,
      autoDeclassify: true,
      reason: 'Intel no longer sensitive',
    };

    it('should schedule declassification successfully', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
        content: 'Test content',
        metadata: {},
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.scheduleDeclassification(validInput, 'user-123');

      expect(result.declassificationDate).toEqual(futureDate);
      expect(result.targetClassification).toBe(IntelClassification.RESTRICTED);
      expect(result.autoDeclassify).toBe(true);
    });

    it('should throw error if user cannot manage aging', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepoFindOne.mockResolvedValue(null);

      await expect(service.scheduleDeclassification(validInput, 'user-123')).rejects.toThrow(
        'User does not have permission to schedule declassification'
      );
    });

    it('should throw error if intel entry not found', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue(null);

      await expect(service.scheduleDeclassification(validInput, 'user-123')).rejects.toThrow(
        'Intel entry not found'
      );
    });

    it('should throw error if target classification is not lower', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.RESTRICTED,
        title: 'Test Intel',
      });

      const invalidInput = {
        ...validInput,
        targetClassification: IntelClassification.SECRET, // Higher than current
      };

      await expect(service.scheduleDeclassification(invalidInput, 'user-123')).rejects.toThrow(
        'Target classification must be lower than current classification'
      );
    });

    it('should throw error if date is in the past', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
      });

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const invalidInput = {
        ...validInput,
        declassificationDate: pastDate,
      };

      await expect(service.scheduleDeclassification(invalidInput, 'user-123')).rejects.toThrow(
        'Declassification date must be in the future'
      );
    });
  });

  describe('cancelDeclassification', () => {
    it('should cancel scheduled declassification', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        declassificationDate: futureDate,
        targetClassification: IntelClassification.RESTRICTED,
        autoDeclassify: true,
        metadata: {},
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.cancelDeclassification(
        'intel-123',
        'org-456',
        'user-123',
        'No longer needed'
      );

      expect(result.declassificationDate).toBeUndefined();
      expect(result.targetClassification).toBeUndefined();
      expect(result.autoDeclassify).toBe(false);
    });

    it('should throw error if no declassification scheduled', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        declassificationDate: null, // No declassification scheduled
      });

      await expect(
        service.cancelDeclassification('intel-123', 'org-456', 'user-123')
      ).rejects.toThrow('No declassification scheduled for this entry');
    });
  });

  describe('executeDeclassification', () => {
    it('should execute immediate declassification', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
        content: 'Test content',
        metadata: {},
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.executeDeclassification(
        'intel-123',
        'org-456',
        IntelClassification.RESTRICTED,
        'user-123',
        'Intel no longer sensitive'
      );

      expect(result.classification).toBe(IntelClassification.RESTRICTED);
      expect(result.declassificationDate).toBeUndefined();
      expect(result.targetClassification).toBeUndefined();
    });

    it('should throw error if target is not lower classification', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.RESTRICTED,
        title: 'Test Intel',
      });

      await expect(
        service.executeDeclassification(
          'intel-123',
          'org-456',
          IntelClassification.SECRET, // Higher than current
          'user-123'
        )
      ).rejects.toThrow('Target classification must be lower than current classification');
    });
  });

  describe('scheduleReview', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    it('should schedule review successfully', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const input: ScheduleReviewInput = {
        intelEntryId: 'intel-123',
        organizationId: 'org-456',
        reviewDate: futureDate,
        reviewIntervalDays: 60,
      };

      const result = await service.scheduleReview(input, 'user-123');

      expect(result.reviewDate).toEqual(futureDate);
      expect(result.reviewIntervalDays).toBe(60);
    });

    it('should use default review interval based on classification', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const input: ScheduleReviewInput = {
        intelEntryId: 'intel-123',
        organizationId: 'org-456',
        reviewDate: futureDate,
        // No reviewIntervalDays specified
      };

      const result = await service.scheduleReview(input, 'user-123');

      expect(result.reviewDate).toEqual(futureDate);
      expect(result.reviewIntervalDays).toBe(60); // Default for SECRET
    });
  });

  describe('completeReview', () => {
    it('should complete review and schedule next', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
        reviewIntervalDays: 60,
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.completeReview(
        'intel-123',
        'org-456',
        'user-123',
        'All information still valid',
        true
      );

      expect(result.lastReviewedAt).toBeDefined();
      expect(result.lastReviewedBy).toBe('user-123');
      expect(result.reviewDate).toBeDefined(); // Next review scheduled
    });

    it('should complete review without scheduling next', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.SECRET,
        title: 'Test Intel',
        reviewIntervalDays: 60,
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.completeReview(
        'intel-123',
        'org-456',
        'user-123',
        'Final review',
        false // Don't schedule next
      );

      expect(result.lastReviewedAt).toBeDefined();
      expect(result.reviewDate).toBeUndefined();
    });
  });

  describe('setExpiration', () => {
    it('should set expiration date successfully', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.RESTRICTED,
        title: 'Test Intel',
      });
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const result = await service.setExpiration('intel-123', 'org-456', futureDate, 'user-123');

      expect(result.expirationDate).toEqual(futureDate);
    });

    it('should throw error if date is in the past', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoFindOne.mockResolvedValue({
        id: 'intel-123',
        organizationId: 'org-456',
        classification: IntelClassification.RESTRICTED,
        title: 'Test Intel',
      });

      await expect(
        service.setExpiration('intel-123', 'org-456', pastDate, 'user-123')
      ).rejects.toThrow('Expiration date must be in the future');
    });
  });

  describe('processAutoDeclassifications', () => {
    it('should process auto-declassifications successfully', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockIntelEntryRepoFind.mockResolvedValue([
        {
          id: 'intel-123',
          organizationId: 'org-456',
          classification: IntelClassification.SECRET,
          targetClassification: IntelClassification.RESTRICTED,
          declassificationDate: pastDate,
          autoDeclassify: true,
          isArchived: false,
          title: 'Test Intel 1',
          content: 'Content 1',
          metadata: {},
        },
        {
          id: 'intel-124',
          organizationId: 'org-456',
          classification: IntelClassification.CONFIDENTIAL,
          targetClassification: IntelClassification.PUBLIC,
          declassificationDate: pastDate,
          autoDeclassify: true,
          isArchived: false,
          title: 'Test Intel 2',
          content: 'Content 2',
          metadata: {},
        },
      ]);
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const results = await service.processAutoDeclassifications();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].previousClassification).toBe(IntelClassification.SECRET);
      expect(results[0].newClassification).toBe(IntelClassification.RESTRICTED);
      expect(results[1].success).toBe(true);
    });

    it('should return empty array when no entries to process', async () => {
      mockIntelEntryRepoFind.mockResolvedValue([]);

      const results = await service.processAutoDeclassifications();

      expect(results).toHaveLength(0);
    });
  });

  describe('processExpiredEntries', () => {
    it('should process expired entries', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockIntelEntryRepoFind.mockResolvedValue([
        {
          id: 'intel-123',
          organizationId: 'org-456',
          expirationDate: pastDate,
          isExpired: false,
          isArchived: false,
          title: 'Expired Intel',
        },
      ]);
      mockIntelEntryRepoSave.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(data)
      );

      const count = await service.processExpiredEntries();

      expect(count).toBe(1);
    });

    it('should return 0 when no entries to expire', async () => {
      mockIntelEntryRepoFind.mockResolvedValue([]);

      const count = await service.processExpiredEntries();

      expect(count).toBe(0);
    });
  });

  describe('getAgingStatistics', () => {
    it('should return aging statistics', async () => {
      mockUserOrgRepoFindOne.mockResolvedValue({ role: 'owner' });
      mockIntelEntryRepoCount.mockResolvedValue(100);

      mockIntelEntryRepoCreateQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { classification: 'public', count: '10' },
          { classification: 'restricted', count: '30' },
          { classification: 'confidential', count: '25' },
          { classification: 'secret', count: '20' },
          { classification: 'top_secret', count: '15' },
        ]),
      });

      const stats = await service.getAgingStatistics('org-456', 'user-123');

      expect(stats.totalEntries).toBe(100);
      expect(stats.byClassification).toBeDefined();
      expect(stats.byClassification[IntelClassification.PUBLIC]).toBe(10);
      expect(stats.byClassification[IntelClassification.RESTRICTED]).toBe(30);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
