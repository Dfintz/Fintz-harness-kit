import { AppDataSource } from '../../../data-source';
import { MirrorAction, MirrorActionType, MirrorActionStatus } from '../../../models/MirrorAction';
import {
  ModerationIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../../../models/ModerationIncident';
import { MirrorActionService, MirrorAuditAction } from '../MirrorActionService';
import { BlacklistSharingService } from '../BlacklistSharingService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');
jest.mock('../../../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
}));
jest.mock('../BlacklistSharingService');

import { emitToOrganization } from '../../../websocket/websocketServer';

describe('MirrorActionService', () => {
  let mirrorService: MirrorActionService;
  let mockMirrorRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockIncidentRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockSharingService: jest.Mocked<BlacklistSharingService>;

  // Test data
  const testOrgId = 'org-123';
  const allyOrgId = 'org-ally-456';
  const testUserId = 'user-123';
  const testUserName = 'TestModerator';
  const testGuildId = '123456789012345678';
  const testGuildName = 'Test Guild';
  const targetDiscordId = '987654321098765432';

  const mockIncident: ModerationIncident = {
    id: 'incident-123',
    organizationId: allyOrgId,
    guildId: '111111111111111111',
    guildName: 'Allied Guild',
    targetDiscordId,
    targetUsername: 'TestTarget',
    moderatorId: 'mod-123',
    moderatorDiscordId: 'mod-123',
    moderatorUsername: 'AllyMod',
    incidentType: IncidentType.BAN,
    severity: IncidentSeverity.BAN,
    status: IncidentStatus.ACTIVE,
    reason: 'Test ban reason',
    isShared: true,
    isAutoDetected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sharedWithOrgs: [],
    isActive: jest.fn(() => true),
    isExpired: jest.fn(() => false),
    getSeverityLabel: jest.fn(() => 'Ban'),
    getSeverityEmoji: jest.fn(() => '🔨'),
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
    addSharedOrg: jest.fn(),
    removeSharedOrg: jest.fn(),
    isOwnedBy: jest.fn(),
    getAccessibleOrgs: jest.fn(),
    isSoftDeleted: jest.fn(),
    isNotDeleted: jest.fn(),
  } as unknown as ModerationIncident;

  const mockMirrorAction: MirrorAction = {
    id: 'mirror-123',
    organizationId: testOrgId,
    sourceIncidentId: 'incident-123',
    sourceOrganizationId: allyOrgId,
    sourceGuildId: '111111111111111111',
    sourceGuildName: 'Allied Guild',
    targetDiscordId,
    targetUsername: 'TestTarget',
    targetGuildId: testGuildId,
    targetGuildName: testGuildName,
    actionType: MirrorActionType.BAN,
    severity: IncidentSeverity.BAN,
    status: MirrorActionStatus.PENDING,
    reason: 'Test ban reason',
    originalReason: 'Test ban reason',
    moderatorId: testUserId,
    moderatorDiscordId: testUserId,
    moderatorUsername: testUserName,
    confirmationRequired: true,
    isBulkMirror: false,
    createdAt: new Date(),
    sharedWithOrgs: [],
    needsConfirmation: jest.fn(() => true),
    isPending: jest.fn(() => true),
    isExecuted: jest.fn(() => false),
    isBan: jest.fn(() => true),
    getSeverityEmoji: jest.fn(() => '🔨'),
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
    addSharedOrg: jest.fn(),
    removeSharedOrg: jest.fn(),
    isOwnedBy: jest.fn(),
    getAccessibleOrgs: jest.fn(),
    isSoftDeleted: jest.fn(),
    isNotDeleted: jest.fn(),
  } as unknown as MirrorAction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock mirror repository
    mockMirrorRepository = {
      create: jest.fn(data => ({ ...mockMirrorAction, ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn(() => Promise.resolve(1)),
        getMany: jest.fn(() => Promise.resolve([mockMirrorAction])),
      })),
      metadata: { name: 'MirrorAction' },
    };

    // Mock incident repository
    mockIncidentRepository = {
      find: jest.fn(() => Promise.resolve([mockIncident])),
      findOne: jest.fn(() => Promise.resolve(mockIncident)),
    };

    // Mock sharing service
    mockSharingService = {
      checkUserAcrossAllies: jest.fn(() =>
        Promise.resolve({
          ownIncidents: [],
          alliedIncidents: [
            {
              incident: mockIncident,
              sourceOrganizationId: allyOrgId,
              isFromAlly: true,
            },
          ],
          totalIncidents: 1,
          highestSeverity: IncidentSeverity.BAN,
          hasActiveIncident: true,
        })
      ),
    } as unknown as jest.Mocked<BlacklistSharingService>;

    // Mock BlacklistSharingService.getInstance
    (BlacklistSharingService.getInstance as jest.Mock).mockReturnValue(mockSharingService);

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === MirrorAction) {
        return mockMirrorRepository;
      }
      if (entity === ModerationIncident) {
        return mockIncidentRepository;
      }
      return mockMirrorRepository;
    });

    // Create service instance
    mirrorService = new MirrorActionService();
  });

  describe('createMirrorAction', () => {
    it('should create a mirror action for a ban with confirmation required', async () => {
      mockMirrorRepository.findOne.mockResolvedValue(null); // No existing mirror

      const result = await mirrorService.createMirrorAction(testOrgId, {
        sourceIncidentId: 'incident-123',
        sourceOrganizationId: allyOrgId,
        sourceGuildId: '111111111111111111',
        sourceGuildName: 'Allied Guild',
        targetDiscordId,
        targetUsername: 'TestTarget',
        targetGuildId: testGuildId,
        targetGuildName: testGuildName,
        actionType: MirrorActionType.BAN,
        severity: IncidentSeverity.BAN,
        reason: 'Test ban reason',
        originalReason: 'Test ban reason',
        moderatorId: testUserId,
        moderatorDiscordId: testUserId,
        moderatorUsername: testUserName,
      });

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(mockMirrorRepository.create).toHaveBeenCalled();
      expect(mockMirrorRepository.save).toHaveBeenCalled();
      expect(emitToOrganization).toHaveBeenCalled();
    });

    it('should create a mirror action for a warning without confirmation required', async () => {
      mockMirrorRepository.findOne.mockResolvedValue(null);

      const result = await mirrorService.createMirrorAction(testOrgId, {
        sourceIncidentId: 'incident-456',
        sourceOrganizationId: allyOrgId,
        sourceGuildId: '111111111111111111',
        sourceGuildName: 'Allied Guild',
        targetDiscordId,
        targetUsername: 'TestTarget',
        targetGuildId: testGuildId,
        targetGuildName: testGuildName,
        actionType: MirrorActionType.WARNING,
        severity: IncidentSeverity.WARNING,
        reason: 'Test warning reason',
        originalReason: 'Test warning reason',
        moderatorId: testUserId,
        moderatorDiscordId: testUserId,
        moderatorUsername: testUserName,
      });

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should return error if incident already mirrored', async () => {
      mockMirrorRepository.findOne.mockResolvedValue(mockMirrorAction);

      const result = await mirrorService.createMirrorAction(testOrgId, {
        sourceIncidentId: 'incident-123',
        sourceOrganizationId: allyOrgId,
        targetDiscordId,
        targetGuildId: testGuildId,
        actionType: MirrorActionType.BAN,
        severity: IncidentSeverity.BAN,
        moderatorId: testUserId,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already been mirrored');
    });
  });

  describe('createBulkMirror', () => {
    it('should create bulk mirror actions for all allied incidents', async () => {
      mockMirrorRepository.findOne.mockResolvedValue(null);

      const summary = await mirrorService.createBulkMirror(
        testOrgId,
        targetDiscordId,
        testGuildId,
        testGuildName,
        testUserId,
        testUserId,
        testUserName
      );

      expect(summary.bulkMirrorId).toBeDefined();
      expect(summary.targetDiscordId).toBe(targetDiscordId);
      expect(mockSharingService.checkUserAcrossAllies).toHaveBeenCalledWith(
        testOrgId,
        targetDiscordId
      );
    });

    it('should return empty summary when no allied incidents found', async () => {
      mockSharingService.checkUserAcrossAllies = jest.fn().mockResolvedValue({
        ownIncidents: [],
        alliedIncidents: [],
        totalIncidents: 0,
        highestSeverity: IncidentSeverity.WARNING,
        hasActiveIncident: false,
      });

      const summary = await mirrorService.createBulkMirror(
        testOrgId,
        targetDiscordId,
        testGuildId,
        testGuildName,
        testUserId,
        testUserId,
        testUserName
      );

      expect(summary.totalIncidents).toBe(0);
      expect(summary.mirroredCount).toBe(0);
    });
  });

  describe('confirmMirrorAction', () => {
    it('should confirm a pending ban mirror action', async () => {
      const pendingAction = { ...mockMirrorAction, status: MirrorActionStatus.PENDING };
      mockMirrorRepository.findOne.mockResolvedValue(pendingAction);

      const result = await mirrorService.confirmMirrorAction(
        testOrgId,
        'mirror-123',
        testUserId,
        testUserName
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(MirrorActionStatus.CONFIRMED);
    });

    it('should throw error when confirming non-pending action', async () => {
      const confirmedAction = { ...mockMirrorAction, status: MirrorActionStatus.CONFIRMED };
      mockMirrorRepository.findOne.mockResolvedValue(confirmedAction);

      await expect(
        mirrorService.confirmMirrorAction(testOrgId, 'mirror-123', testUserId, testUserName)
      ).rejects.toThrow('Only pending actions can be confirmed');
    });

    it('should throw error when action does not require confirmation', async () => {
      const noConfirmAction = { ...mockMirrorAction, confirmationRequired: false };
      mockMirrorRepository.findOne.mockResolvedValue(noConfirmAction);

      await expect(
        mirrorService.confirmMirrorAction(testOrgId, 'mirror-123', testUserId, testUserName)
      ).rejects.toThrow('This action does not require confirmation');
    });

    it('should throw error when action not found', async () => {
      mockMirrorRepository.findOne.mockResolvedValue(null);

      await expect(
        mirrorService.confirmMirrorAction(testOrgId, 'non-existent', testUserId, testUserName)
      ).rejects.toThrow('Mirror action not found');
    });
  });

  describe('cancelMirrorAction', () => {
    it('should cancel a pending mirror action', async () => {
      const pendingAction = { ...mockMirrorAction, status: MirrorActionStatus.PENDING };
      mockMirrorRepository.findOne.mockResolvedValue(pendingAction);

      const result = await mirrorService.cancelMirrorAction(
        testOrgId,
        'mirror-123',
        testUserId,
        testUserName
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(MirrorActionStatus.CANCELLED);
    });

    it('should throw error when cancelling non-pending action', async () => {
      const confirmedAction = { ...mockMirrorAction, status: MirrorActionStatus.CONFIRMED };
      mockMirrorRepository.findOne.mockResolvedValue(confirmedAction);

      await expect(
        mirrorService.cancelMirrorAction(testOrgId, 'mirror-123', testUserId, testUserName)
      ).rejects.toThrow('Only pending actions can be cancelled');
    });
  });

  describe('markAsExecuted', () => {
    it('should mark a confirmed action as executed', async () => {
      const confirmedAction = {
        ...mockMirrorAction,
        status: MirrorActionStatus.CONFIRMED,
        confirmationRequired: true,
      };
      mockMirrorRepository.findOne.mockResolvedValue(confirmedAction);

      const result = await mirrorService.markAsExecuted(testOrgId, 'mirror-123');

      expect(result).toBeDefined();
      expect(result?.executedAt).toBeDefined();
    });

    it('should throw error for unconfirmed ban action', async () => {
      const pendingBan = {
        ...mockMirrorAction,
        status: MirrorActionStatus.PENDING,
        confirmationRequired: true,
      };
      mockMirrorRepository.findOne.mockResolvedValue(pendingBan);

      await expect(mirrorService.markAsExecuted(testOrgId, 'mirror-123')).rejects.toThrow(
        'Ban actions must be confirmed before execution'
      );
    });
  });

  describe('markAsFailed', () => {
    it('should mark action as failed with error message', async () => {
      mockMirrorRepository.findOne.mockResolvedValue(mockMirrorAction);

      const result = await mirrorService.markAsFailed(
        testOrgId,
        'mirror-123',
        'User not found in server'
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(MirrorActionStatus.FAILED);
      expect(result?.errorMessage).toBe('User not found in server');
    });
  });

  describe('getMirrorActionHistory', () => {
    it('should return paginated mirror action history', async () => {
      const result = await mirrorService.getMirrorActionHistory(testOrgId, {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.actions).toBeDefined();
    });

    it('should filter by target Discord ID', async () => {
      const result = await mirrorService.getMirrorActionHistory(testOrgId, {
        targetDiscordId,
        page: 1,
      });

      expect(result).toBeDefined();
    });

    it('should filter by status', async () => {
      const result = await mirrorService.getMirrorActionHistory(testOrgId, {
        status: MirrorActionStatus.PENDING,
        page: 1,
      });

      expect(result).toBeDefined();
    });
  });

  describe('getPendingMirrorActions', () => {
    it('should return pending mirror actions', async () => {
      const result = await mirrorService.getPendingMirrorActions(testOrgId, 1, 20);

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
    });
  });

  describe('getMirrorStatistics', () => {
    it('should return mirror action statistics', async () => {
      mockMirrorRepository.find.mockResolvedValue([
        { ...mockMirrorAction, status: MirrorActionStatus.CONFIRMED },
        { ...mockMirrorAction, id: 'mirror-2', status: MirrorActionStatus.PENDING },
        { ...mockMirrorAction, id: 'mirror-3', status: MirrorActionStatus.CANCELLED },
      ]);

      const stats = await mirrorService.getMirrorStatistics(testOrgId);

      expect(stats.totalMirrors).toBe(3);
      expect(stats.confirmedMirrors).toBe(1);
      expect(stats.pendingMirrors).toBe(1);
      expect(stats.cancelledMirrors).toBe(1);
    });
  });

  describe('MirrorAction model methods', () => {
    it('actionTypeFromIncidentType should return correct action types', () => {
      expect(MirrorAction.actionTypeFromIncidentType(IncidentType.WARNING)).toBe(
        MirrorActionType.WARNING
      );
      expect(MirrorAction.actionTypeFromIncidentType(IncidentType.TIMEOUT)).toBe(
        MirrorActionType.TIMEOUT
      );
      expect(MirrorAction.actionTypeFromIncidentType(IncidentType.LONG_TIMEOUT)).toBe(
        MirrorActionType.TIMEOUT
      );
      expect(MirrorAction.actionTypeFromIncidentType(IncidentType.KICK)).toBe(
        MirrorActionType.KICK
      );
      expect(MirrorAction.actionTypeFromIncidentType(IncidentType.BAN)).toBe(MirrorActionType.BAN);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

