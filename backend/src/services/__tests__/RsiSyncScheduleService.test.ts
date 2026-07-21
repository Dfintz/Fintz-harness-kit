import { Repository } from 'typeorm';

import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { RsiSyncScheduleService } from '../external/RsiSyncScheduleService';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';

describe('RsiSyncScheduleService', () => {
  let service: RsiSyncScheduleService;
  let mockScheduleRepo: jest.Mocked<Repository<RsiSyncSchedule>>;

  const testOrganizationId = 'org-123';
  const testRsiOrgSid = 'TESTORG';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository
    mockScheduleRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<RsiSyncSchedule>>;

    // Setup AppDataSource mock
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockScheduleRepo);

    // Create service instance
    service = new RsiSyncScheduleService();
  });

  describe('upsertSchedule', () => {
    it('should create a new schedule if none exists', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        isEnabled: true,
        intervalMinutes: 60,
        calculateNextSyncTime: () => new Date(),
        getIntervalDisplay: () => '1 hour',
      };

      mockScheduleRepo.findOne.mockResolvedValue(null);
      mockScheduleRepo.create.mockReturnValue(mockSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockResolvedValue(mockSchedule as RsiSyncSchedule);

      const result = await service.upsertSchedule({
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        isEnabled: true,
      });

      expect(result).toBeDefined();
      expect(result.rsiOrgSid).toBe(testRsiOrgSid);
      expect(mockScheduleRepo.create).toHaveBeenCalled();
      expect(mockScheduleRepo.save).toHaveBeenCalled();
    });

    it('should update existing schedule', async () => {
      const existingSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        rsiOrgSid: 'OLDORG',
        isEnabled: false,
        intervalMinutes: 360,
        calculateNextSyncTime: () => new Date(),
      };

      mockScheduleRepo.findOne.mockResolvedValue(existingSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockImplementation(entity =>
        Promise.resolve(entity as RsiSyncSchedule)
      );

      const result = await service.upsertSchedule({
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        intervalMinutes: 720,
      });

      expect(result.rsiOrgSid).toBe(testRsiOrgSid);
      expect(result.intervalMinutes).toBe(720);
    });

    it('should throw error for invalid interval', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.upsertSchedule({
          organizationId: testOrganizationId,
          rsiOrgSid: testRsiOrgSid,
          intervalMinutes: 5, // Too low
        })
      ).rejects.toThrow('Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)');
    });
  });

  describe('getSchedule', () => {
    it('should return schedule for organization', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        isEnabled: true,
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);

      const result = await service.getSchedule(testOrganizationId);

      expect(result).toBeDefined();
      expect(result?.organizationId).toBe(testOrganizationId);
    });

    it('should return null if no schedule exists', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      const result = await service.getSchedule(testOrganizationId);

      expect(result).toBeNull();
    });
  });

  describe('getSchedulesDueForSync', () => {
    it('should return schedules that are due', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const mockSchedules: Partial<RsiSyncSchedule>[] = [
        {
          id: 'schedule-1',
          organizationId: 'org-1',
          isEnabled: true,
          nextSyncAt: pastDate,
        },
        {
          id: 'schedule-2',
          organizationId: 'org-2',
          isEnabled: true,
          nextSyncAt: null, // Never synced
        },
      ];

      mockScheduleRepo.find.mockResolvedValue(mockSchedules as RsiSyncSchedule[]);

      const result = await service.getSchedulesDueForSync();

      expect(result).toHaveLength(2);
    });
  });

  describe('enableSchedule', () => {
    it('should enable a schedule and set next sync time', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        isEnabled: false,
        consecutiveFailures: 3,
        reEnable: jest.fn().mockImplementation(function (this: any) {
          this.isEnabled = true;
          this.consecutiveFailures = 0;
          this.nextSyncAt = new Date();
        }),
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockImplementation(entity =>
        Promise.resolve(entity as RsiSyncSchedule)
      );

      const result = await service.enableSchedule(testOrganizationId);

      expect(result).toBeDefined();
      expect(mockSchedule.reEnable).toHaveBeenCalled();
    });

    it('should return null if schedule not found', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      const result = await service.enableSchedule(testOrganizationId);

      expect(result).toBeNull();
    });
  });

  describe('disableSchedule', () => {
    it('should disable a schedule', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        isEnabled: true,
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockImplementation(entity =>
        Promise.resolve(entity as RsiSyncSchedule)
      );

      const result = await service.disableSchedule(testOrganizationId);

      expect(result).toBeDefined();
      expect(result?.isEnabled).toBe(false);
    });
  });

  describe('markSyncSuccess', () => {
    it('should mark sync as successful and update next sync time', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        consecutiveFailures: 2,
        markSyncSuccess: jest.fn().mockImplementation(function (this: any) {
          this.lastSyncAt = new Date();
          this.consecutiveFailures = 0;
          this.nextSyncAt = new Date(Date.now() + 3600000);
        }),
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockResolvedValue(mockSchedule as RsiSyncSchedule);

      await service.markSyncSuccess(testOrganizationId);

      expect(mockSchedule.markSyncSuccess).toHaveBeenCalled();
      expect(mockScheduleRepo.save).toHaveBeenCalled();
    });
  });

  describe('markSyncFailed', () => {
    it('should mark sync as failed and increment failure count', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        isEnabled: true,
        consecutiveFailures: 2,
        maxConsecutiveFailures: 5,
        markSyncFailed: jest.fn().mockImplementation(function (this: any, msg: string) {
          this.consecutiveFailures++;
          this.lastErrorMessage = msg;
        }),
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockResolvedValue(mockSchedule as RsiSyncSchedule);

      const result = await service.markSyncFailed(testOrganizationId, 'Test error');

      expect(mockSchedule.markSyncFailed).toHaveBeenCalledWith('Test error');
      expect(result.autoDisabled).toBe(false);
    });

    it('should auto-disable after max failures', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        isEnabled: true,
        consecutiveFailures: 4,
        maxConsecutiveFailures: 5,
        markSyncFailed: jest.fn().mockImplementation(function (this: any, msg: string) {
          this.consecutiveFailures++;
          this.lastErrorMessage = msg;
          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.isEnabled = false;
          }
        }),
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);
      mockScheduleRepo.save.mockResolvedValue(mockSchedule as RsiSyncSchedule);

      const result = await service.markSyncFailed(testOrganizationId, 'Test error');

      expect(mockSchedule.isEnabled).toBe(false);
      expect(result.autoDisabled).toBe(true);
    });
  });

  describe('getScheduleStatus', () => {
    it('should return status for existing schedule', async () => {
      const mockSchedule: Partial<RsiSyncSchedule> = {
        id: 'schedule-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        isEnabled: true,
        intervalMinutes: 60,
        lastSyncAt: new Date(),
        nextSyncAt: new Date(Date.now() + 3600000),
        consecutiveFailures: 0,
        isDueForSync: () => false,
        isAutoDisabled: () => false,
        getIntervalDisplay: () => '1 hour',
      };

      mockScheduleRepo.findOne.mockResolvedValue(mockSchedule as RsiSyncSchedule);

      const status = await service.getScheduleStatus(testOrganizationId);

      expect(status.exists).toBe(true);
      expect(status.enabled).toBe(true);
      expect(status.rsiOrgSid).toBe(testRsiOrgSid);
      expect(status.interval).toBe('1 hour');
    });

    it('should return default status if no schedule exists', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      const status = await service.getScheduleStatus(testOrganizationId);

      expect(status.exists).toBe(false);
      expect(status.enabled).toBe(false);
      expect(status.rsiOrgSid).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule for organization', async () => {
      mockScheduleRepo.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.deleteSchedule(testOrganizationId);

      expect(result).toBe(true);
      expect(mockScheduleRepo.delete).toHaveBeenCalledWith({ organizationId: testOrganizationId });
    });

    it('should return false if no schedule to delete', async () => {
      mockScheduleRepo.delete.mockResolvedValue({ affected: 0, raw: {} });

      const result = await service.deleteSchedule(testOrganizationId);

      expect(result).toBe(false);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

