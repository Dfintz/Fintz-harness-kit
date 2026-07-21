import { AppDataSource } from '../../../data-source';
import {
  ModerationIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../../../models/ModerationIncident';
import { MirrorAction, MirrorActionStatus, MirrorActionType } from '../../../models/MirrorAction';
import {
  BlacklistAnalyticsService,
  REPEAT_OFFENDER_THRESHOLDS,
} from '../BlacklistAnalyticsService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');

describe('BlacklistAnalyticsService', () => {
  let analyticsService: BlacklistAnalyticsService;
  let mockIncidentRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockMirrorRepository: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testOrgId = 'org-123';
  const targetDiscordId1 = '987654321098765432';
  const targetDiscordId2 = '123456789012345678';

  const createMockIncident = (overrides: Partial<ModerationIncident> = {}): ModerationIncident =>
    ({
      id: `incident-${Math.random().toString(36).substr(2, 9)}`,
      organizationId: testOrgId,
      guildId: '123456789012345678',
      guildName: 'Test Guild',
      targetDiscordId: targetDiscordId1,
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
      sharedWithOrgs: [],
      isActive: jest.fn(() => true),
      isExpired: jest.fn(() => false),
      getSeverityLabel: jest.fn(() => 'Warning'),
      getSeverityEmoji: jest.fn(() => '⚠️'),
      isSharedWith: jest.fn(),
      canAccessFromOrg: jest.fn(),
      addSharedOrg: jest.fn(),
      removeSharedOrg: jest.fn(),
      isOwnedBy: jest.fn(),
      getAccessibleOrgs: jest.fn(),
      isSoftDeleted: jest.fn(),
      isNotDeleted: jest.fn(),
      ...overrides,
    }) as unknown as ModerationIncident;

  const createMockMirrorAction = (overrides: Partial<MirrorAction> = {}): MirrorAction =>
    ({
      id: `mirror-${Math.random().toString(36).substr(2, 9)}`,
      organizationId: testOrgId,
      sourceIncidentId: 'incident-123',
      sourceOrganizationId: 'org-456',
      sourceGuildId: '111111111111111111',
      sourceGuildName: 'Source Guild',
      targetDiscordId: targetDiscordId1,
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
      sharedWithOrgs: [],
      getSeverityEmoji: jest.fn(() => '⚠️'),
      ...overrides,
    }) as unknown as MirrorAction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock incident repository
    mockIncidentRepository = {
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(() => Promise.resolve([])),
      })),
      metadata: { name: 'ModerationIncident' },
    };

    // Mock mirror repository
    mockMirrorRepository = {
      find: jest.fn(() => Promise.resolve([])),
      metadata: { name: 'MirrorAction' },
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === ModerationIncident) {
        return mockIncidentRepository;
      }
      if (entity === MirrorAction) {
        return mockMirrorRepository;
      }
      return mockIncidentRepository;
    });

    // Create service instance
    analyticsService = new BlacklistAnalyticsService();
  });

  describe('getAnalytics', () => {
    it('should return comprehensive analytics with zero data', async () => {
      mockIncidentRepository.find.mockResolvedValue([]);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result).toBeDefined();
      expect(result.totalIncidents).toBe(0);
      expect(result.activeIncidents).toBe(0);
      expect(result.resolvedIncidents).toBe(0);
      expect(result.sharedIncidents).toBe(0);
      expect(result.autoDetectedIncidents).toBe(0);
      expect(result.uniqueTargets).toBe(0);
      expect(result.uniqueModerators).toBe(0);
      expect(result.averageSeverity).toBe(0);
      expect(result.repeatOffenderCount).toBe(0);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should calculate statistics correctly with incidents', async () => {
      const incidents = [
        createMockIncident({ status: IncidentStatus.ACTIVE, isShared: true }),
        createMockIncident({ status: IncidentStatus.REVOKED, isAutoDetected: true }),
        createMockIncident({ status: IncidentStatus.EXPIRED }),
        createMockIncident({
          status: IncidentStatus.ACTIVE,
          incidentType: IncidentType.BAN,
          severity: IncidentSeverity.BAN,
        }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.totalIncidents).toBe(4);
      expect(result.activeIncidents).toBe(2);
      expect(result.resolvedIncidents).toBe(2);
      expect(result.sharedIncidents).toBe(1);
      expect(result.autoDetectedIncidents).toBe(1);
    });

    it('should calculate unique targets and moderators correctly', async () => {
      const incidents = [
        createMockIncident({ targetDiscordId: targetDiscordId1, moderatorId: 'mod-1' }),
        createMockIncident({ targetDiscordId: targetDiscordId1, moderatorId: 'mod-2' }),
        createMockIncident({ targetDiscordId: targetDiscordId2, moderatorId: 'mod-1' }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.uniqueTargets).toBe(2);
      expect(result.uniqueModerators).toBe(2);
    });

    it('should calculate average severity correctly', async () => {
      const incidents = [
        createMockIncident({ severity: IncidentSeverity.WARNING }), // 1
        createMockIncident({ severity: IncidentSeverity.TIMEOUT }), // 2
        createMockIncident({ severity: IncidentSeverity.BAN }), // 5
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.averageSeverity).toBeCloseTo(2.67, 1);
    });

    it('should calculate mirror statistics correctly', async () => {
      const mirrors = [
        createMockMirrorAction({ status: MirrorActionStatus.CONFIRMED }),
        createMockMirrorAction({ status: MirrorActionStatus.PENDING }),
        createMockMirrorAction({ status: MirrorActionStatus.CANCELLED }),
        createMockMirrorAction({ status: MirrorActionStatus.FAILED }),
      ];
      mockIncidentRepository.find.mockResolvedValue([]);
      mockMirrorRepository.find.mockResolvedValue(mirrors);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.mirrorStats.totalMirrors).toBe(4);
      expect(result.mirrorStats.confirmedMirrors).toBe(1);
      expect(result.mirrorStats.pendingMirrors).toBe(1);
      expect(result.mirrorStats.cancelledMirrors).toBe(1);
      expect(result.mirrorStats.failedMirrors).toBe(1);
    });
  });

  describe('getRepeatOffenders', () => {
    it('should return empty array when no repeat offenders', async () => {
      // Only 1-2 incidents per user (below threshold)
      const incidents = [
        createMockIncident({ targetDiscordId: targetDiscordId1 }),
        createMockIncident({ targetDiscordId: targetDiscordId2 }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      const result = await analyticsService.getRepeatOffenders(testOrgId);

      expect(result).toEqual([]);
    });

    it('should identify repeat offenders correctly', async () => {
      // Create enough incidents for targetDiscordId1 to be a repeat offender
      const incidents = [
        createMockIncident({
          targetDiscordId: targetDiscordId1,
          severity: IncidentSeverity.TIMEOUT,
          createdAt: new Date(),
        }),
        createMockIncident({
          targetDiscordId: targetDiscordId1,
          severity: IncidentSeverity.KICK,
          createdAt: new Date(Date.now() - 1000),
        }),
        createMockIncident({
          targetDiscordId: targetDiscordId1,
          severity: IncidentSeverity.BAN,
          createdAt: new Date(Date.now() - 2000),
        }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      const result = await analyticsService.getRepeatOffenders(testOrgId);

      expect(result.length).toBe(1);
      expect(result[0].targetDiscordId).toBe(targetDiscordId1);
      expect(result[0].totalIncidents).toBe(3);
      expect(result[0].highestSeverity).toBe(IncidentSeverity.BAN);
    });

    it('should calculate risk score correctly', async () => {
      const incidents = [
        createMockIncident({
          targetDiscordId: targetDiscordId1,
          severity: IncidentSeverity.BAN,
          status: IncidentStatus.ACTIVE,
          createdAt: new Date(), // Recent
        }),
        createMockIncident({
          targetDiscordId: targetDiscordId1,
          severity: IncidentSeverity.KICK,
          status: IncidentStatus.ACTIVE,
          createdAt: new Date(),
        }),
        createMockIncident({
          targetDiscordId: targetDiscordId1,
          severity: IncidentSeverity.TIMEOUT,
          status: IncidentStatus.ACTIVE,
          createdAt: new Date(),
        }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      const result = await analyticsService.getRepeatOffenders(testOrgId);

      expect(result.length).toBe(1);
      expect(result[0].riskScore).toBeGreaterThan(0);
      expect(result[0].riskScore).toBeLessThanOrEqual(100);
    });

    it('should mark high-risk offenders correctly', async () => {
      // Many recent incidents with high severity
      const incidents = [];
      for (let i = 0; i < 10; i++) {
        incidents.push(
          createMockIncident({
            targetDiscordId: targetDiscordId1,
            severity: IncidentSeverity.BAN,
            status: IncidentStatus.ACTIVE,
            createdAt: new Date(),
          })
        );
      }
      mockIncidentRepository.find.mockResolvedValue(incidents);

      const result = await analyticsService.getRepeatOffenders(testOrgId);

      expect(result.length).toBe(1);
      expect(result[0].isHighRisk).toBe(true);
    });

    it('should sort by risk score descending', async () => {
      // Two repeat offenders with different risk levels
      const incidents = [
        // High risk user (more incidents, higher severity)
        ...Array(5)
          .fill(null)
          .map(() =>
            createMockIncident({
              targetDiscordId: targetDiscordId1,
              severity: IncidentSeverity.BAN,
              createdAt: new Date(),
            })
          ),
        // Lower risk user (fewer incidents, lower severity)
        ...Array(3)
          .fill(null)
          .map(() =>
            createMockIncident({
              targetDiscordId: targetDiscordId2,
              severity: IncidentSeverity.TIMEOUT,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // A week ago
            })
          ),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      const result = await analyticsService.getRepeatOffenders(testOrgId);

      expect(result.length).toBe(2);
      expect(result[0].riskScore).toBeGreaterThanOrEqual(result[1].riskScore);
    });
  });

  describe('isRepeatOffender', () => {
    it('should return false for non-repeat offender', async () => {
      mockIncidentRepository.find.mockResolvedValue([
        createMockIncident({ targetDiscordId: targetDiscordId1 }),
      ]);

      const result = await analyticsService.isRepeatOffender(testOrgId, targetDiscordId1);

      expect(result.isRepeatOffender).toBe(false);
      expect(result.details).toBeUndefined();
    });

    it('should return true with details for repeat offender', async () => {
      const incidents = Array(3)
        .fill(null)
        .map(() =>
          createMockIncident({
            targetDiscordId: targetDiscordId1,
            severity: IncidentSeverity.TIMEOUT,
          })
        );
      mockIncidentRepository.find.mockResolvedValue(incidents);

      const result = await analyticsService.isRepeatOffender(testOrgId, targetDiscordId1);

      expect(result.isRepeatOffender).toBe(true);
      expect(result.details).toBeDefined();
      expect(result.details?.targetDiscordId).toBe(targetDiscordId1);
    });
  });

  describe('byType breakdown', () => {
    it('should correctly count incidents by type', async () => {
      const incidents = [
        createMockIncident({ incidentType: IncidentType.WARNING }),
        createMockIncident({ incidentType: IncidentType.WARNING }),
        createMockIncident({ incidentType: IncidentType.TIMEOUT }),
        createMockIncident({ incidentType: IncidentType.BAN }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.byType[IncidentType.WARNING]).toBe(2);
      expect(result.byType[IncidentType.TIMEOUT]).toBe(1);
      expect(result.byType[IncidentType.BAN]).toBe(1);
      expect(result.byType[IncidentType.KICK]).toBe(0);
    });
  });

  describe('bySeverity breakdown', () => {
    it('should correctly count incidents by severity', async () => {
      const incidents = [
        createMockIncident({ severity: IncidentSeverity.WARNING }),
        createMockIncident({ severity: IncidentSeverity.WARNING }),
        createMockIncident({ severity: IncidentSeverity.TIMEOUT }),
        createMockIncident({ severity: IncidentSeverity.BAN }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.bySeverity[IncidentSeverity.WARNING]).toBe(2);
      expect(result.bySeverity[IncidentSeverity.TIMEOUT]).toBe(1);
      expect(result.bySeverity[IncidentSeverity.BAN]).toBe(1);
    });
  });

  describe('byStatus breakdown', () => {
    it('should correctly count incidents by status', async () => {
      const incidents = [
        createMockIncident({ status: IncidentStatus.ACTIVE }),
        createMockIncident({ status: IncidentStatus.ACTIVE }),
        createMockIncident({ status: IncidentStatus.REVOKED }),
        createMockIncident({ status: IncidentStatus.EXPIRED }),
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.byStatus[IncidentStatus.ACTIVE]).toBe(2);
      expect(result.byStatus[IncidentStatus.REVOKED]).toBe(1);
      expect(result.byStatus[IncidentStatus.EXPIRED]).toBe(1);
    });
  });

  describe('time-based metrics', () => {
    it('should calculate incidents in time ranges correctly', async () => {
      const now = new Date();
      const incidents = [
        createMockIncident({ createdAt: now }), // Last 24h
        createMockIncident({ createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) }), // Last 7 days
        createMockIncident({ createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }), // Last 30 days
        createMockIncident({ createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }), // Older than 30 days
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockMirrorRepository.find.mockResolvedValue([]);

      const result = await analyticsService.getAnalytics(testOrgId);

      expect(result.incidentsLast24Hours).toBe(1);
      expect(result.incidentsLast7Days).toBe(2);
      expect(result.incidentsLast30Days).toBe(3);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BlacklistAnalyticsService.getInstance();
      const instance2 = BlacklistAnalyticsService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

