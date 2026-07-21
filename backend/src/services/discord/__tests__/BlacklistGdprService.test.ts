import { AppDataSource } from '../../../data-source';
import {
  ModerationIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../../../models/ModerationIncident';
import { MirrorAction, MirrorActionStatus, MirrorActionType } from '../../../models/MirrorAction';
import { BlacklistSharingConfig } from '../../../models/BlacklistSharingConfig';
import {
  BlacklistGdprService,
  getBlacklistGdprService,
  BLACKLIST_RETENTION_PERIODS,
  GdprBlacklistAuditAction,
} from '../BlacklistGdprService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');

describe('BlacklistGdprService', () => {
  let gdprService: BlacklistGdprService;
  let mockIncidentRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockMirrorRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockSharingConfigRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockQueryRunner: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testDiscordUserId = '987654321098765432';
  const requestedBy = 'admin-123';
  const requestedByName = 'AdminUser';

  const createMockIncident = (overrides: Partial<ModerationIncident> = {}): ModerationIncident =>
    ({
      id: `incident-${Math.random().toString(36).substr(2, 9)}`,
      organizationId: 'org-123',
      guildId: '123456789012345678',
      guildName: 'Test Guild',
      targetDiscordId: testDiscordUserId,
      targetUsername: 'TestTarget',
      moderatorId: 'mod-123',
      moderatorDiscordId: 'mod-discord-123',
      moderatorUsername: 'TestMod',
      incidentType: IncidentType.WARNING,
      severity: IncidentSeverity.WARNING,
      status: IncidentStatus.ACTIVE,
      reason: 'Test reason',
      isShared: false,
      isAutoDetected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ModerationIncident;

  const createMockMirrorAction = (overrides: Partial<MirrorAction> = {}): MirrorAction =>
    ({
      id: `mirror-${Math.random().toString(36).substr(2, 9)}`,
      organizationId: 'org-123',
      sourceIncidentId: 'incident-123',
      sourceOrganizationId: 'org-456',
      sourceGuildId: '111111111111111111',
      sourceGuildName: 'Source Guild',
      targetDiscordId: testDiscordUserId,
      targetUsername: 'TestTarget',
      targetGuildId: '123456789012345678',
      targetGuildName: 'Target Guild',
      actionType: MirrorActionType.WARNING,
      severity: IncidentSeverity.WARNING,
      status: MirrorActionStatus.PENDING,
      reason: 'Mirror test',
      moderatorId: 'mod-123',
      moderatorDiscordId: 'mod-discord-123',
      moderatorUsername: 'TestMod',
      confirmationRequired: false,
      isBulkMirror: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as MirrorAction;

  const createMockSharingConfig = (): BlacklistSharingConfig =>
    ({
      id: 'config-123',
      organizationId: 'org-123',
      shareWarnings: false,
      shareTimeouts: true,
      shareKicks: true,
      shareBans: true,
      receiveAlerts: true,
      minAlertSeverity: 2,
      autoShareWithAllies: true,
      autoShareMinSeverity: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as unknown as BlacklistSharingConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock incident repository
    mockIncidentRepository = {
      find: jest.fn(() => Promise.resolve([])),
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 0 })),
      })),
    };

    // Mock mirror repository
    mockMirrorRepository = {
      find: jest.fn(() => Promise.resolve([])),
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 0 })),
      })),
    };

    // Mock sharing config repository
    mockSharingConfigRepository = {
      find: jest.fn(() => Promise.resolve([])),
    };

    // Mock query runner for transactions
    mockQueryRunner = {
      connect: jest.fn(() => Promise.resolve()),
      startTransaction: jest.fn(() => Promise.resolve()),
      commitTransaction: jest.fn(() => Promise.resolve()),
      rollbackTransaction: jest.fn(() => Promise.resolve()),
      release: jest.fn(() => Promise.resolve()),
      manager: {
        update: jest.fn(() => Promise.resolve({ affected: 0 })),
        delete: jest.fn(() => Promise.resolve({ affected: 0 })),
      },
    };

    // Mock AppDataSource
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === ModerationIncident) {
        return mockIncidentRepository;
      }
      if (entity === MirrorAction) {
        return mockMirrorRepository;
      }
      if (entity === BlacklistSharingConfig) {
        return mockSharingConfigRepository;
      }
      return mockIncidentRepository;
    });

    (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

    // Create service instance
    gdprService = new BlacklistGdprService();
  });

  describe('exportUserData', () => {
    it('should export all user data correctly', async () => {
      const incidentsAsTarget = [createMockIncident()];
      const incidentsAsModerator = [createMockIncident({ moderatorDiscordId: testDiscordUserId })];
      const mirrorActionsAsTarget = [createMockMirrorAction()];
      const mirrorActionsAsModerator = [
        createMockMirrorAction({ moderatorDiscordId: testDiscordUserId }),
      ];

      mockIncidentRepository.find.mockImplementation(opts => {
        if (opts?.where?.targetDiscordId === testDiscordUserId) {
          return Promise.resolve(incidentsAsTarget);
        }
        if (opts?.where?.moderatorDiscordId === testDiscordUserId) {
          return Promise.resolve(incidentsAsModerator);
        }
        return Promise.resolve([]);
      });

      mockMirrorRepository.find.mockImplementation(opts => {
        if (opts?.where?.targetDiscordId === testDiscordUserId) {
          return Promise.resolve(mirrorActionsAsTarget);
        }
        if (opts?.where?.moderatorDiscordId === testDiscordUserId) {
          return Promise.resolve(mirrorActionsAsModerator);
        }
        return Promise.resolve([]);
      });

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      expect(result).toBeDefined();
      expect(result.discordUserId).toBe(testDiscordUserId);
      expect(result.exportedAt).toBeInstanceOf(Date);
      expect(result.incidentsAsTarget.length).toBe(1);
      expect(result.incidentsAsModerator.length).toBe(1);
      expect(result.mirrorActionsAsTarget.length).toBe(1);
      expect(result.mirrorActionsAsModerator.length).toBe(1);
    });

    it('should calculate summary correctly', async () => {
      const oldDate = new Date('2023-01-01');
      const newDate = new Date();

      const incidentsAsTarget = [
        createMockIncident({ createdAt: oldDate }),
        createMockIncident({ createdAt: newDate }),
      ];

      mockIncidentRepository.find.mockImplementation(opts => {
        if (opts?.where?.targetDiscordId === testDiscordUserId) {
          return Promise.resolve(incidentsAsTarget);
        }
        return Promise.resolve([]);
      });
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      expect(result.summary.totalIncidentsAsTarget).toBe(2);
      expect(result.summary.totalIncidentsAsModerator).toBe(0);
      expect(result.summary.earliestRecord).toEqual(oldDate);
      expect(result.summary.latestRecord).toEqual(newDate);
    });

    it('should include admin data when requested', async () => {
      const sharingConfigs = [createMockSharingConfig()];
      mockSharingConfigRepository.find.mockResolvedValue(sharingConfigs);
      mockIncidentRepository.find.mockResolvedValue([]);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName,
        true // includeAdminData
      );

      expect(result.sharingConfigurations).toBeDefined();
      expect(result.sharingConfigurations?.length).toBe(1);
    });

    it('should not include admin data by default', async () => {
      mockIncidentRepository.find.mockResolvedValue([]);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      expect(result.sharingConfigurations).toBeUndefined();
    });

    it('should handle empty data gracefully', async () => {
      mockIncidentRepository.find.mockResolvedValue([]);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      expect(result.incidentsAsTarget).toEqual([]);
      expect(result.incidentsAsModerator).toEqual([]);
      expect(result.mirrorActionsAsTarget).toEqual([]);
      expect(result.mirrorActionsAsModerator).toEqual([]);
      expect(result.summary.earliestRecord).toBeNull();
      expect(result.summary.latestRecord).toBeNull();
    });
  });

  describe('deleteUserData', () => {
    it('should anonymize user data when anonymizeForAudit is true', async () => {
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 2 });

      const result = await gdprService.deleteUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName,
        true // anonymizeForAudit
      );

      expect(result.success).toBe(true);
      expect(result.discordUserId).toBe(testDiscordUserId);
      expect(result.anonymizedCounts.incidentsAnonymized).toBeGreaterThanOrEqual(0);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(mockQueryRunner.manager.update).toHaveBeenCalled();
    });

    it('should delete user data when anonymizeForAudit is false', async () => {
      mockQueryRunner.manager.delete.mockResolvedValue({ affected: 2 });
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      const result = await gdprService.deleteUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName,
        false // anonymizeForAudit
      );

      expect(result.success).toBe(true);
      expect(mockQueryRunner.manager.delete).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockQueryRunner.manager.update.mockRejectedValue(new Error('Database error'));

      const result = await gdprService.deleteUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should commit transaction on success', async () => {
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      await gdprService.deleteUserData(testDiscordUserId, requestedBy, requestedByName);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should always release query runner', async () => {
      mockQueryRunner.manager.update.mockRejectedValue(new Error('Database error'));

      await gdprService.deleteUserData(testDiscordUserId, requestedBy, requestedByName);

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('runRetentionCleanup', () => {
    it('should clean up expired incidents', async () => {
      mockIncidentRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 5 })),
      });

      const result = await gdprService.runRetentionCleanup();

      expect(result.length).toBeGreaterThan(0);
      const incidentResult = result.find(r => r.entity.includes('ModerationIncident'));
      expect(incidentResult).toBeDefined();
    });

    it('should clean up old mirror actions', async () => {
      mockMirrorRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 3 })),
      });

      const result = await gdprService.runRetentionCleanup();

      expect(result.length).toBeGreaterThan(0);
      const mirrorResult = result.find(r => r.entity === 'MirrorAction');
      expect(mirrorResult).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockIncidentRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.reject(new Error('Database error'))),
      });

      const result = await gdprService.runRetentionCleanup();

      const failedResult = result.find(r => !r.success);
      expect(failedResult).toBeDefined();
      expect(failedResult?.error).toBeDefined();
    });

    it('should report correct cutoff dates', async () => {
      mockIncidentRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 0 })),
      });
      mockMirrorRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 0 })),
      });

      const result = await gdprService.runRetentionCleanup();

      for (const cleanupResult of result) {
        expect(cleanupResult.cutoffDate).toBeInstanceOf(Date);
        expect(cleanupResult.retentionDays).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getRetentionConfig', () => {
    it('should return retention configuration', () => {
      const config = gdprService.getRetentionConfig();

      expect(config).toBeDefined();
      expect(config.activeIncidents).toBeDefined();
      expect(config.expiredIncidents).toBeDefined();
      expect(config.mirrorActions).toBeDefined();
      expect(config.sharingConfig).toBeDefined();
      expect(config.anonymizedData).toBeDefined();
    });

    it('should return a copy of the configuration', () => {
      const config1 = gdprService.getRetentionConfig();
      const config2 = gdprService.getRetentionConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance from getBlacklistGdprService', () => {
      const instance1 = getBlacklistGdprService();
      const instance2 = getBlacklistGdprService();

      expect(instance1).toBe(instance2);
    });
  });

  describe('export data format', () => {
    it('should map incident to export format correctly', async () => {
      const incident = createMockIncident({
        reason: 'Test reason',
        durationMinutes: 60,
        isShared: true,
        isAutoDetected: true,
        revokedAt: new Date(),
        revokeReason: 'False positive',
      });
      mockIncidentRepository.find.mockResolvedValue([incident]);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      const exported = result.incidentsAsTarget[0];
      expect(exported.id).toBe(incident.id);
      expect(exported.guildId).toBe(incident.guildId);
      expect(exported.incidentType).toBe(incident.incidentType);
      expect(exported.severity).toBe(incident.severity);
      expect(exported.status).toBe(incident.status);
      expect(exported.reason).toBe(incident.reason);
      expect(exported.durationMinutes).toBe(incident.durationMinutes);
      expect(exported.isShared).toBe(incident.isShared);
      expect(exported.isAutoDetected).toBe(incident.isAutoDetected);
    });

    it('should map mirror action to export format correctly', async () => {
      const mirror = createMockMirrorAction({
        confirmedAt: new Date(),
        executedAt: new Date(),
      });
      mockIncidentRepository.find.mockResolvedValue([]);
      mockMirrorRepository.find.mockResolvedValue([mirror]);

      const result = await gdprService.exportUserData(
        testDiscordUserId,
        requestedBy,
        requestedByName
      );

      const exported = result.mirrorActionsAsTarget[0];
      expect(exported.id).toBe(mirror.id);
      expect(exported.sourceGuildId).toBe(mirror.sourceGuildId);
      expect(exported.targetGuildId).toBe(mirror.targetGuildId);
      expect(exported.actionType).toBe(mirror.actionType);
      expect(exported.severity).toBe(mirror.severity);
      expect(exported.status).toBe(mirror.status);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

