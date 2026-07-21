/**
 * DiscordSettingsService Tests
 *
 * Tests for Discord guild settings management:
 * - Get or create settings with defaults
 * - Update specific setting categories (event, voice, tunnel, etc.)
 * - Admin user management
 * - Server manager role management
 * - Sync status tracking
 * - Tenant isolation
 */

jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { DiscordSettingsService } from '../../../services/discord/DiscordSettingsService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSettingsRepo() {
  return {
    create: jest.fn().mockImplementation((d: any) => ({ ...d })),
    save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    metadata: { name: 'DiscordGuildSettings' },
  };
}

function buildMockSettings(overrides: Record<string, any> = {}) {
  return {
    id: 'org-stanton:guild-uee-001',
    organizationId: 'org-stanton',
    guildId: 'guild-uee-001',
    guildName: 'UEE Stanton Fleet',
    guildIconUrl: null,
    eventSettings: {
      autoDeleteEventMessages: false,
      eventMessageRetentionDays: 30,
      allowEventRsvp: true,
      remindersEnabled: true,
      reminderHoursBefore: [24, 1],
    },
    voiceChannelSettings: {
      autoCreateChannels: false,
      autoDeleteEmptyChannels: true,
      deleteEmptyChannelDelayMinutes: 5,
      maxActiveChannels: 50,
      userCanRename: true,
      templates: [],
    },
    tunnelSettings: {
      enabled: false,
      maxActiveTunnels: 10,
      tunnelDurationMinutes: 60,
      autoDeleteTunnel: true,
      allowNesting: false,
    },
    notificationPreferences: {
      memberJoinNotifications: false,
      memberLeaveNotifications: false,
      roleChangeNotifications: false,
      eventNotifications: true,
      enableMentionRolesToNotify: false,
      notificationMentionRoles: [],
    },
    roleSyncSettings: {
      enabled: false,
      syncRolesFromApi: true,
      syncRolesFromSheet: false,
      autoRoleManagement: false,
      removeRolesOnLeave: true,
      syncIntervalMinutes: 60,
      syncOnBotJoin: true,
      requireManualApproval: false,
      roleMappings: {},
    },
    crossModerationSettings: {
      enabled: false,
      sharedBanListEnabled: true,
      sharedMuteListEnabled: false,
      autoBanOnSharedList: false,
      propagateTimeouts: false,
      forwardModerationAlerts: true,
      notifyOnSharedAction: true,
      allowedGuildIds: [],
    },
    ticketSettings: {
      enabled: false,
      autoCloseHours: 72,
      maxOpenTicketsPerUser: 2,
      mentionSupportRoleOnCreate: true,
      notifyOnClose: true,
      allowMemberClose: true,
    },
    adminUserIds: [],
    serverManagerRoleIds: [],
    starCommsManagerRoleIds: [],
    lastModifiedBy: null,
    lastSyncedAt: null,
    syncErrorCount: 0,
    lastSyncError: undefined,
    ...overrides,
  };
}

describe('DiscordSettingsService', () => {
  let service: DiscordSettingsService;
  let mockRepo: ReturnType<typeof createMockSettingsRepo>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepo = createMockSettingsRepo();
    const { AppDataSource } = require('../../../config/database');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

    service = new DiscordSettingsService();
  });

  // ==================== GET OR CREATE ====================

  describe('getOrCreateSettings', () => {
    it('should return existing settings when found', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.getOrCreateSettings('org-stanton', 'guild-uee-001');

      expect(result).toEqual(existing);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should create new settings with defaults when not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await service.getOrCreateSettings(
        'org-pyro-corp',
        'guild-pyro-001',
        'Pyro Mining Corp',
        'https://cdn.example.com/icon.png'
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'org-pyro-corp:guild-pyro-001',
          organizationId: 'org-pyro-corp',
          guildId: 'guild-pyro-001',
          guildName: 'Pyro Mining Corp',
          guildIconUrl: 'https://cdn.example.com/icon.png',
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should set default event settings on creation', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await service.getOrCreateSettings('org-1', 'guild-1');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventSettings: expect.objectContaining({
            allowEventRsvp: true,
            remindersEnabled: true,
          }),
        })
      );
    });

    it('should set default voice channel settings on creation', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await service.getOrCreateSettings('org-1', 'guild-1');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceChannelSettings: expect.objectContaining({
            autoDeleteEmptyChannels: true,
            maxActiveChannels: 50,
          }),
        })
      );
    });
  });

  // ==================== GET SETTINGS ====================

  describe('getSettings', () => {
    it('should return settings for org and guild', async () => {
      const settings = buildMockSettings();
      mockRepo.findOne.mockResolvedValueOnce(settings);

      const result = await service.getSettings('org-stanton', 'guild-uee-001');

      expect(result).toEqual(settings);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'org-stanton', guildId: 'guild-uee-001' },
      });
    });

    it('should return null when settings not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.getSettings('org-missing', 'guild-missing');

      expect(result).toBeNull();
    });
  });

  // ==================== REQUIRE GUILD ACCESS (multi-tenant guard) ====================

  describe('requireGuildAccess', () => {
    it('returns the settings row when org owns the guild', async () => {
      const settings = buildMockSettings();
      mockRepo.findOne.mockResolvedValueOnce(settings);

      const result = await service.requireGuildAccess('org-stanton', 'guild-uee-001');

      expect(result).toEqual(settings);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'org-stanton', guildId: 'guild-uee-001' },
      });
    });

    it('throws ForbiddenError when no link exists between org and guild', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      const { ForbiddenError } = require('../../../utils/apiErrors');

      await expect(
        service.requireGuildAccess('org-attacker', 'guild-victim')
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when organizationId is missing (no tenant context)', async () => {
      const { ForbiddenError } = require('../../../utils/apiErrors');

      await expect(service.requireGuildAccess(undefined, 'guild-uee-001')).rejects.toBeInstanceOf(
        ForbiddenError
      );
      // Must NOT query the database without an organization scope.
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when organizationId is null', async () => {
      const { ForbiddenError } = require('../../../utils/apiErrors');

      await expect(service.requireGuildAccess(null, 'guild-uee-001')).rejects.toBeInstanceOf(
        ForbiddenError
      );
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ==================== GET ORGANIZATION SETTINGS ====================

  describe('getOrganizationSettings', () => {
    it('should return all settings for an organization', async () => {
      const settingsArray = [
        buildMockSettings({ guildId: 'guild-1', guildName: 'Alpha Squadron' }),
        buildMockSettings({ guildId: 'guild-2', guildName: 'Bravo Squadron' }),
      ];
      mockRepo.find.mockResolvedValueOnce(settingsArray);

      const result = await service.getOrganizationSettings('org-stanton');

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-stanton' },
        order: { guildName: 'ASC' },
      });
    });
  });

  // ==================== UPDATE EVENT SETTINGS ====================

  describe('updateEventSettings', () => {
    it('should merge event settings with existing', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateEventSettings(
        'org-stanton',
        'guild-uee-001',
        { autoDeleteEventMessages: true, reminderHoursBefore: [48, 12, 1] },
        'admin-commander'
      );

      expect(result.eventSettings.autoDeleteEventMessages).toBe(true);
      expect(result.eventSettings.reminderHoursBefore).toEqual([48, 12, 1]);
      expect(result.lastModifiedBy).toBe('admin-commander');
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  // ==================== UPDATE VOICE CHANNEL SETTINGS ====================

  describe('updateVoiceChannelSettings', () => {
    it('should update voice settings', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateVoiceChannelSettings(
        'org-stanton',
        'guild-uee-001',
        { maxActiveChannels: 100, autoCreateChannels: true },
        'voice-admin'
      );

      expect(result.voiceChannelSettings.maxActiveChannels).toBe(100);
      expect(result.voiceChannelSettings.autoCreateChannels).toBe(true);
      expect(result.lastModifiedBy).toBe('voice-admin');
    });
  });

  describe('updateLfgSettings', () => {
    it('should persist lfg voice category in lfgSettings without disturbing network settings', async () => {
      const existing = buildMockSettings({
        lfgSettings: { defaultGame: 'Star Citizen' },
        lfgNetworkSettings: { lfgChannelId: 'channel-1', autoPostEnabled: true },
        smartLfgPingSettings: { enabled: true, cooldownHours: 4 },
      });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateLfgSettings(
        'org-stanton',
        'guild-uee-001',
        { lfgVoiceCategoryId: 'category-42' },
        'lfg-admin'
      );

      expect(result.lfgSettings).toEqual(
        expect.objectContaining({
          defaultGame: 'Star Citizen',
          lfgVoiceCategoryId: 'category-42',
        })
      );
      expect(result.lfgNetworkSettings).toEqual(
        expect.objectContaining({
          lfgChannelId: 'channel-1',
          autoPostEnabled: true,
        })
      );
      expect(result.lastModifiedBy).toBe('lfg-admin');
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  // ==================== UPDATE TUNNEL SETTINGS ====================

  describe('updateTunnelSettings', () => {
    it('should update tunnel settings', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateTunnelSettings(
        'org-stanton',
        'guild-uee-001',
        { enabled: true, maxActiveTunnels: 20 },
        'tunnel-admin'
      );

      expect(result.tunnelSettings.enabled).toBe(true);
      expect(result.tunnelSettings.maxActiveTunnels).toBe(20);
    });
  });

  // ==================== UPDATE NOTIFICATION PREFERENCES ====================

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateNotificationPreferences(
        'org-stanton',
        'guild-uee-001',
        { memberJoinNotifications: true, memberLeaveNotifications: true },
        'notif-admin'
      );

      expect(result.notificationPreferences.memberJoinNotifications).toBe(true);
      expect(result.notificationPreferences.memberLeaveNotifications).toBe(true);
    });
  });

  // ==================== UPDATE ROLE SYNC SETTINGS ====================

  describe('updateRoleSyncSettings', () => {
    it('should update role sync settings', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateRoleSyncSettings(
        'org-stanton',
        'guild-uee-001',
        { enabled: true, syncIntervalMinutes: 30 },
        'role-admin'
      );

      expect(result.roleSyncSettings.enabled).toBe(true);
      expect(result.roleSyncSettings.syncIntervalMinutes).toBe(30);
    });
  });

  // ==================== UPDATE CROSS MODERATION SETTINGS ====================

  describe('updateCrossModerationSettings', () => {
    it('should update cross moderation settings', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateCrossModerationSettings(
        'org-stanton',
        'guild-uee-001',
        { enabled: true, autoBanOnSharedList: true },
        'mod-admin'
      );

      expect(result.crossModerationSettings.enabled).toBe(true);
      expect(result.crossModerationSettings.autoBanOnSharedList).toBe(true);
    });
  });

  // ==================== UPDATE TICKET SETTINGS ====================

  describe('updateTicketSettings', () => {
    it('should update ticket settings', async () => {
      const existing = buildMockSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateTicketSettings(
        'org-stanton',
        'guild-uee-001',
        { enabled: true, maxOpenTicketsPerUser: 5, autoCloseHours: 48 },
        'ticket-admin'
      );

      expect(result.ticketSettings.enabled).toBe(true);
      expect(result.ticketSettings.maxOpenTicketsPerUser).toBe(5);
      expect(result.ticketSettings.autoCloseHours).toBe(48);
    });
  });

  // ==================== MARK SYNCED ====================

  describe('markSynced', () => {
    it('should mark successful sync and reset error count', async () => {
      const existing = buildMockSettings({ syncErrorCount: 3, lastSyncError: 'Previous error' });
      mockRepo.findOne.mockResolvedValueOnce(existing);

      await service.markSynced('org-stanton', 'guild-uee-001');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSyncedAt: expect.any(Date),
          syncErrorCount: 0,
          lastSyncError: undefined,
        })
      );
    });

    it('should increment error count on sync failure', async () => {
      const existing = buildMockSettings({ syncErrorCount: 2 });
      mockRepo.findOne.mockResolvedValueOnce(existing);

      await service.markSynced('org-stanton', 'guild-uee-001', 'Rate limited by Discord');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          syncErrorCount: 3,
          lastSyncError: 'Rate limited by Discord',
        })
      );
    });

    it('should do nothing when settings not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await service.markSynced('org-missing', 'guild-missing');

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  // ==================== ADMIN USER MANAGEMENT ====================

  describe('addAdminUser', () => {
    it('should add admin user to the list', async () => {
      const existing = buildMockSettings({ adminUserIds: ['admin-1'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addAdminUser(
        'org-stanton',
        'guild-uee-001',
        'admin-2',
        'super-admin'
      );

      expect(result.adminUserIds).toContain('admin-2');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should not duplicate existing admin users', async () => {
      const existing = buildMockSettings({ adminUserIds: ['admin-1'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addAdminUser(
        'org-stanton',
        'guild-uee-001',
        'admin-1',
        'super-admin'
      );

      expect(result.adminUserIds.filter((id: string) => id === 'admin-1')).toHaveLength(1);
    });

    it('should initialize adminUserIds array if null', async () => {
      const existing = buildMockSettings({ adminUserIds: null });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addAdminUser(
        'org-stanton',
        'guild-uee-001',
        'new-admin',
        'super-admin'
      );

      expect(result.adminUserIds).toContain('new-admin');
    });
  });

  describe('removeAdminUser', () => {
    it('should remove admin user from the list', async () => {
      const existing = buildMockSettings({ adminUserIds: ['admin-1', 'admin-2', 'admin-3'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.removeAdminUser(
        'org-stanton',
        'guild-uee-001',
        'admin-2',
        'super-admin'
      );

      expect(result.adminUserIds).not.toContain('admin-2');
      expect(result.adminUserIds).toHaveLength(2);
    });
  });

  // ==================== SERVER MANAGER ROLE MANAGEMENT ====================

  describe('addServerManagerRole', () => {
    it('should add a server manager role', async () => {
      const existing = buildMockSettings({ serverManagerRoleIds: [] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addServerManagerRole(
        'org-stanton',
        'guild-uee-001',
        'role-fleet-commander',
        'admin-1'
      );

      expect(result.serverManagerRoleIds).toContain('role-fleet-commander');
    });

    it('should not duplicate existing roles', async () => {
      const existing = buildMockSettings({ serverManagerRoleIds: ['role-existing'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addServerManagerRole(
        'org-stanton',
        'guild-uee-001',
        'role-existing',
        'admin-1'
      );

      expect(result.serverManagerRoleIds).toHaveLength(1);
    });
  });

  describe('removeServerManagerRole', () => {
    it('should remove a server manager role', async () => {
      const existing = buildMockSettings({ serverManagerRoleIds: ['role-a', 'role-b'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.removeServerManagerRole(
        'org-stanton',
        'guild-uee-001',
        'role-a',
        'admin-1'
      );

      expect(result.serverManagerRoleIds).not.toContain('role-a');
      expect(result.serverManagerRoleIds).toContain('role-b');
    });
  });

  // ==================== STARCOMMS MANAGER ROLE MANAGEMENT ====================

  describe('addStarCommsManagerRole', () => {
    it('should add a StarComms manager role', async () => {
      const existing = buildMockSettings({ starCommsManagerRoleIds: [] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addStarCommsManagerRole(
        'org-stanton',
        'guild-uee-001',
        'role-starcomms-admin',
        'admin-1'
      );

      expect(result.starCommsManagerRoleIds).toContain('role-starcomms-admin');
    });

    it('should not duplicate existing StarComms manager roles', async () => {
      const existing = buildMockSettings({ starCommsManagerRoleIds: ['role-existing'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.addStarCommsManagerRole(
        'org-stanton',
        'guild-uee-001',
        'role-existing',
        'admin-1'
      );

      expect(result.starCommsManagerRoleIds).toHaveLength(1);
    });
  });

  describe('removeStarCommsManagerRole', () => {
    it('should remove a StarComms manager role', async () => {
      const existing = buildMockSettings({ starCommsManagerRoleIds: ['role-a', 'role-b'] });
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.removeStarCommsManagerRole(
        'org-stanton',
        'guild-uee-001',
        'role-a',
        'admin-1'
      );

      expect(result.starCommsManagerRoleIds).not.toContain('role-a');
      expect(result.starCommsManagerRoleIds).toContain('role-b');
    });
  });
});
