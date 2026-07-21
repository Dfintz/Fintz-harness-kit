import { AppDataSource } from '../../../data-source';
import {
  ModerationIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../../../models/ModerationIncident';
import {
  ModerationIncidentService,
  CreateIncidentDTO,
  ModerationAuditAction,
} from '../ModerationIncidentService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');

describe('ModerationIncidentService', () => {
  let incidentService: ModerationIncidentService;
  let mockRepository: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testUserName = 'TestModerator';
  const testGuildId = '123456789012345678';
  const testTargetDiscordId = '987654321098765432';

  const mockIncident: ModerationIncident = {
    id: 'incident-123',
    organizationId: testOrgId,
    guildId: testGuildId,
    guildName: 'Test Guild',
    targetDiscordId: testTargetDiscordId,
    targetUsername: 'TestTarget',
    moderatorId: testUserId,
    moderatorDiscordId: testUserId,
    moderatorUsername: testUserName,
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
  } as unknown as ModerationIncident;

  const createIncidentDTO: CreateIncidentDTO = {
    guildId: testGuildId,
    guildName: 'Test Guild',
    targetDiscordId: testTargetDiscordId,
    targetUsername: 'TestTarget',
    moderatorDiscordId: testUserId,
    moderatorUsername: testUserName,
    incidentType: IncidentType.WARNING,
    reason: 'Test warning reason',
    isShared: false,
    isAutoDetected: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock repository methods
    mockRepository = {
      create: jest.fn(data => ({ ...mockIncident, ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn(() => Promise.resolve(1)),
        getMany: jest.fn(() => Promise.resolve([mockIncident])),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 1 })),
      })),
      count: jest.fn(() => Promise.resolve(0)),
      query: jest.fn(() => Promise.resolve([])),
      metadata: { name: 'ModerationIncident' },
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    // Create a new instance of the service
    incidentService = new ModerationIncidentService();
  });

  describe('createIncident', () => {
    it('should create a warning incident with correct severity', async () => {
      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        createIncidentDTO
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.severity).toBe(IncidentSeverity.WARNING);
    });

    it('should create a timeout incident with timeout severity', async () => {
      const timeoutDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        incidentType: IncidentType.TIMEOUT,
        durationMinutes: 30,
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        timeoutDTO
      );

      expect(result).toBeDefined();
      expect(result.severity).toBe(IncidentSeverity.TIMEOUT);
    });

    it('should create a long timeout incident for duration > 60 minutes', async () => {
      const longTimeoutDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        incidentType: IncidentType.TIMEOUT,
        durationMinutes: 120, // 2 hours
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        longTimeoutDTO
      );

      expect(result).toBeDefined();
      expect(result.severity).toBe(IncidentSeverity.LONG_TIMEOUT);
    });

    it('should create a kick incident with kick severity', async () => {
      const kickDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        incidentType: IncidentType.KICK,
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        kickDTO
      );

      expect(result).toBeDefined();
      expect(result.severity).toBe(IncidentSeverity.KICK);
    });

    it('should create a ban incident with highest severity', async () => {
      const banDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        incidentType: IncidentType.BAN,
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        banDTO
      );

      expect(result).toBeDefined();
      expect(result.severity).toBe(IncidentSeverity.BAN);
    });

    it('should set expiration for timeout incidents', async () => {
      const timeoutDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        incidentType: IncidentType.TIMEOUT,
        durationMinutes: 60,
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        timeoutDTO
      );

      expect(result).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should mark incident as auto-detected when flag is set', async () => {
      const autoDetectedDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        isAutoDetected: true,
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        autoDetectedDTO
      );

      expect(result).toBeDefined();
      expect(result.isAutoDetected).toBe(true);
    });

    it('should mark incident as shared when flag is set', async () => {
      const sharedDTO: CreateIncidentDTO = {
        ...createIncidentDTO,
        isShared: true,
      };

      const result = await incidentService.createIncident(
        testOrgId,
        testUserId,
        testUserName,
        sharedDTO
      );

      expect(result).toBeDefined();
      expect(result.isShared).toBe(true);
    });
  });

  describe('createFromDiscordEvent', () => {
    it('should create incident from Discord event with auto-detected flag', async () => {
      const result = await incidentService.createFromDiscordEvent(
        testOrgId,
        'system',
        testGuildId,
        'Test Guild',
        testTargetDiscordId,
        'TestTarget',
        testUserId,
        testUserName,
        IncidentType.BAN,
        'Violating rules',
        undefined,
        'audit-log-123'
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.isAutoDetected).toBe(true);
    });
  });

  describe('getIncidentById', () => {
    it('should return incident when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockIncident);

      const result = await incidentService.getIncidentById(testOrgId, 'incident-123');

      expect(result).toEqual(mockIncident);
    });

    it('should return null when incident not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await incidentService.getIncidentById(testOrgId, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('revokeIncident', () => {
    it('should revoke an active incident', async () => {
      const activeIncident = { ...mockIncident, status: IncidentStatus.ACTIVE };
      mockRepository.findOne.mockResolvedValue(activeIncident);

      const result = await incidentService.revokeIncident(
        testOrgId,
        'incident-123',
        testUserId,
        testUserName,
        'False positive'
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(IncidentStatus.REVOKED);
      expect(result?.revokeReason).toBe('False positive');
    });

    it('should throw error when revoking non-active incident', async () => {
      const revokedIncident = { ...mockIncident, status: IncidentStatus.REVOKED };
      mockRepository.findOne.mockResolvedValue(revokedIncident);

      await expect(
        incidentService.revokeIncident(testOrgId, 'incident-123', testUserId, testUserName)
      ).rejects.toThrow('Only active incidents can be revoked');
    });

    it('should throw error when incident not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        incidentService.revokeIncident(testOrgId, 'non-existent', testUserId, testUserName)
      ).rejects.toThrow('Incident not found');
    });
  });

  describe('shareIncident', () => {
    it('should share an unshared incident', async () => {
      const unsharedIncident = { ...mockIncident, isShared: false };
      mockRepository.findOne.mockResolvedValue(unsharedIncident);

      const result = await incidentService.shareIncident(
        testOrgId,
        'incident-123',
        testUserId,
        testUserName
      );

      expect(result).toBeDefined();
      expect(result?.isShared).toBe(true);
    });

    it('should return incident unchanged if already shared', async () => {
      const sharedIncident = { ...mockIncident, isShared: true };
      mockRepository.findOne.mockResolvedValue(sharedIncident);

      const result = await incidentService.shareIncident(
        testOrgId,
        'incident-123',
        testUserId,
        testUserName
      );

      expect(result).toEqual(sharedIncident);
    });
  });

  describe('lookupUser', () => {
    it('should return empty summary for user with no incidents', async () => {
      mockRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await incidentService.lookupUser(testOrgId, testTargetDiscordId);

      expect(result).toBeDefined();
      expect(result.targetDiscordId).toBe(testTargetDiscordId);
      expect(result.totalIncidents).toBe(0);
      expect(result.activeIncidents).toBe(0);
    });

    it('should return summary with incidents when found', async () => {
      const incidentWithMethods = {
        ...mockIncident,
        isActive: () => true,
        isShared: true,
      };

      mockRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([incidentWithMethods]),
      });

      const result = await incidentService.lookupUser(testOrgId, testTargetDiscordId);

      expect(result).toBeDefined();
      expect(result.targetDiscordId).toBe(testTargetDiscordId);
      expect(result.totalIncidents).toBe(1);
    });
  });

  describe('searchIncidents', () => {
    it('should return paginated incidents with filters', async () => {
      const result = await incidentService.searchIncidents(
        testOrgId,
        { incidentType: IncidentType.WARNING },
        1,
        10
      );

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.incidents).toBeDefined();
    });

    it('should filter by severity', async () => {
      const result = await incidentService.searchIncidents(
        testOrgId,
        { severity: IncidentSeverity.BAN },
        1,
        10
      );

      expect(result).toBeDefined();
    });

    it('should filter by status', async () => {
      const result = await incidentService.searchIncidents(
        testOrgId,
        { status: IncidentStatus.ACTIVE },
        1,
        10
      );

      expect(result).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for organization', async () => {
      const incidents = [
        { ...mockIncident, status: IncidentStatus.ACTIVE, isShared: true, isAutoDetected: false },
        {
          ...mockIncident,
          id: 'incident-2',
          status: IncidentStatus.REVOKED,
          isShared: false,
          isAutoDetected: true,
        },
      ];
      mockRepository.find.mockResolvedValue(incidents);

      const result = await incidentService.getStatistics(testOrgId);

      expect(result).toBeDefined();
      expect(result.totalIncidents).toBe(2);
      expect(result.activeIncidents).toBe(1);
      expect(result.revokedIncidents).toBe(1);
      expect(result.sharedIncidents).toBe(1);
      expect(result.autoDetectedIncidents).toBe(1);
    });

    it('should return zero statistics when no incidents', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await incidentService.getStatistics(testOrgId);

      expect(result).toBeDefined();
      expect(result.totalIncidents).toBe(0);
      expect(result.averageSeverity).toBe(0);
    });
  });

  describe('expireIncidents', () => {
    it('should expire incidents past their expiration date', async () => {
      mockRepository.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      });

      const result = await incidentService.expireIncidents();

      expect(result).toBe(3);
    });

    it('should return 0 when no incidents to expire', async () => {
      mockRepository.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });

      const result = await incidentService.expireIncidents();

      expect(result).toBe(0);
    });
  });

  describe('ModerationIncident.calculateSeverity', () => {
    it('should return WARNING severity for warning type', () => {
      const severity = ModerationIncident.calculateSeverity(IncidentType.WARNING);
      expect(severity).toBe(IncidentSeverity.WARNING);
    });

    it('should return TIMEOUT severity for short timeout', () => {
      const severity = ModerationIncident.calculateSeverity(IncidentType.TIMEOUT, 30);
      expect(severity).toBe(IncidentSeverity.TIMEOUT);
    });

    it('should return LONG_TIMEOUT severity for timeout > 60 minutes', () => {
      const severity = ModerationIncident.calculateSeverity(IncidentType.TIMEOUT, 120);
      expect(severity).toBe(IncidentSeverity.LONG_TIMEOUT);
    });

    it('should return KICK severity for kick type', () => {
      const severity = ModerationIncident.calculateSeverity(IncidentType.KICK);
      expect(severity).toBe(IncidentSeverity.KICK);
    });

    it('should return BAN severity for ban type', () => {
      const severity = ModerationIncident.calculateSeverity(IncidentType.BAN);
      expect(severity).toBe(IncidentSeverity.BAN);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

