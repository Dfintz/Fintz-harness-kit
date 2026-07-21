/**
 * TeamVoiceService Tests
 *
 * Tests for Discord team voice channel management:
 * - Channel creation lifecycle (category + text + voice + role)
 * - Domain event handling (team:created, team:deleted, member_added, member_removed)
 * - Permission builders (category vs voice channel)
 * - Member role assignment and removal
 * - Duplicate prevention
 * - Error handling (missing guild, missing Discord ID)
 */

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    isInitialized: true,
  },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../services/shared/DomainEventBus', () => ({
  domainEvents: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));
jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: jest.fn().mockReturnValue({
      getGuildsForOrganization: jest.fn().mockResolvedValue([]),
    }),
  },
}));
jest.mock('../../../services/discord/TeamVoiceAuditLogger', () => ({
  teamVoiceAuditLogger: {
    logChannelsCreated: jest.fn(),
    logChannelsDeleted: jest.fn(),
    logMemberAdded: jest.fn(),
    logMemberRemoved: jest.fn(),
  },
}));

import { GuildOrganizationService } from '../../../services/discord/GuildOrganizationService';
import { TeamVoiceService } from '../../../services/discord/TeamVoiceService';
import { domainEvents } from '../../../services/shared/DomainEventBus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockChannelRepo() {
  return {
    create: jest.fn().mockImplementation((d: unknown) => ({ ...d })),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    metadata: { name: 'TeamDiscordChannel' },
  };
}

function createMockSettingsRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    metadata: { name: 'DiscordGuildSettings' },
  };
}

function createMockUserRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    metadata: { name: 'User' },
  };
}

function createMockGuild() {
  const createdRole = { id: 'role-team-alpha', name: 'Team: Alpha' };
  const createdCategory = { id: 'cat-001', name: '🎮 Alpha' };
  const createdTextChannel = { id: 'text-001', name: 'alpha' };
  const createdVoiceChannel = {
    id: 'voice-001',
    name: 'Alpha',
    isVoiceBased: () => true,
    permissionOverwrites: {
      edit: jest.fn(),
      delete: jest.fn(),
    },
  };

  return {
    id: 'guild-001',
    name: 'Test Guild',
    roles: {
      create: jest.fn().mockResolvedValue(createdRole),
      cache: new Map([['role-team-alpha', createdRole]]),
    },
    channels: {
      create: jest
        .fn()
        .mockResolvedValueOnce(createdCategory) // category
        .mockResolvedValueOnce(createdTextChannel) // text
        .mockResolvedValueOnce(createdVoiceChannel), // voice
      cache: new Map([
        ['cat-001', { ...createdCategory, delete: jest.fn() }],
        ['text-001', { ...createdTextChannel, delete: jest.fn() }],
        ['voice-001', { ...createdVoiceChannel, delete: jest.fn() }],
      ]),
    },
    members: {
      fetch: jest.fn().mockResolvedValue({
        roles: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      }),
    },
  };
}

function createMockClient(guilds: Record<string, ReturnType<typeof createMockGuild>> = {}) {
  return {
    guilds: {
      cache: {
        get: jest.fn((id: string) => guilds[id] ?? undefined),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamVoiceService', () => {
  let service: TeamVoiceService;
  let mockChannelRepo: ReturnType<typeof createMockChannelRepo>;
  let mockSettingsRepo: ReturnType<typeof createMockSettingsRepo>;
  let mockUserRepo: ReturnType<typeof createMockUserRepo>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChannelRepo = createMockChannelRepo();
    mockSettingsRepo = createMockSettingsRepo();
    mockUserRepo = createMockUserRepo();

    const { AppDataSource } = require('../../../config/database');
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      const name = typeof entity === 'function' ? (entity as { name: string }).name : '';
      if (name === 'TeamDiscordChannel') return mockChannelRepo;
      if (name === 'DiscordGuildSettings') return mockSettingsRepo;
      if (name === 'User') return mockUserRepo;
      return mockChannelRepo;
    });

    // Reset singleton
    (TeamVoiceService as unknown as { instance: undefined }).instance = undefined;
    service = TeamVoiceService.getInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = TeamVoiceService.getInstance();
      const instance2 = TeamVoiceService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should register domain event listeners', () => {
      const mockClient = createMockClient();
      service.initialize(mockClient as never);

      expect(domainEvents.on).toHaveBeenCalledWith('team:created', expect.any(Function));
      expect(domainEvents.on).toHaveBeenCalledWith('team:deleted', expect.any(Function));
      expect(domainEvents.on).toHaveBeenCalledWith('team:member_added', expect.any(Function));
      expect(domainEvents.on).toHaveBeenCalledWith('team:member_removed', expect.any(Function));
    });

    it('should not register listeners twice', () => {
      const mockClient = createMockClient();
      service.initialize(mockClient as never);
      service.initialize(mockClient as never);

      // Should only be called 4 times total (once per event)
      expect(domainEvents.on).toHaveBeenCalledTimes(4);
    });
  });

  describe('shutdown', () => {
    it('should unregister all domain event listeners and reset runtime state', () => {
      const mockClient = createMockClient();
      service.initialize(mockClient as never);

      const onCalls = (domainEvents.on as jest.Mock).mock.calls;

      service.shutdown();

      expect(domainEvents.off).toHaveBeenCalledTimes(4);
      expect((domainEvents.off as jest.Mock).mock.calls).toEqual(onCalls);

      const internal = service as unknown as {
        initialized: boolean;
        client: unknown;
      };
      expect(internal.initialized).toBe(false);
      expect(internal.client).toBeNull();
    });

    it('should be a no-op when shutdown is called before initialize', () => {
      expect(() => service.shutdown()).not.toThrow();
      expect(domainEvents.off).not.toHaveBeenCalled();
    });
  });

  describe('createTeamChannels', () => {
    it('should create category, text, voice channels and role', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      // Settings must exist for channel creation
      mockSettingsRepo.findOne.mockResolvedValue({
        teamVoiceSettings: {
          enabled: true,
          autoCreateOnTeamCreate: true,
          allowBaseVisibility: false,
          allowListenIn: false,
          enforcePushToTalk: false,
          enablePrioritySpeaker: false,
        },
      });

      const result = await service.createTeamChannels(
        'org-001',
        'team-alpha',
        'guild-001',
        'Alpha Squadron',
        'user-001'
      );

      expect(result).not.toBeNull();
      // Role creation
      expect(mockGuild.roles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Team: Alpha Squadron',
        })
      );
      // 3 channel creates: category, text, voice
      expect(mockGuild.channels.create).toHaveBeenCalledTimes(3);

      // Persisted to DB
      expect(mockChannelRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-001',
          teamId: 'team-alpha',
          guildId: 'guild-001',
          syncStatus: 'synced',
        })
      );
    });

    it('should skip if channels already exist for the team', async () => {
      mockChannelRepo.findOne.mockResolvedValueOnce({
        id: 'existing-mapping',
        organizationId: 'org-001',
        teamId: 'team-alpha',
      });

      const mockClient = createMockClient({ 'guild-001': createMockGuild() });
      service.initialize(mockClient as never);

      const result = await service.createTeamChannels(
        'org-001',
        'team-alpha',
        'guild-001',
        'Alpha',
        'user-001'
      );

      expect(result).toEqual(expect.objectContaining({ id: 'existing-mapping' }));
      // No Discord API calls
      expect(createMockGuild().roles.create).not.toHaveBeenCalled();
    });

    it('should return null if guild is not in cache', async () => {
      const mockClient = createMockClient(); // empty guilds
      service.initialize(mockClient as never);

      const result = await service.createTeamChannels(
        'org-001',
        'team-alpha',
        'guild-missing',
        'Alpha',
        'user-001'
      );

      expect(result).toBeNull();
    });

    it('should return null and not persist error row on Discord API failure', async () => {
      const mockGuild = createMockGuild();
      mockGuild.roles.create.mockRejectedValueOnce(new Error('Missing permissions'));

      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      // Settings must exist
      mockSettingsRepo.findOne.mockResolvedValue({
        teamVoiceSettings: {
          enabled: true,
          autoCreateOnTeamCreate: true,
        },
      });

      const result = await service.createTeamChannels(
        'org-001',
        'team-alpha',
        'guild-001',
        'Alpha',
        'user-001'
      );

      expect(result).toBeNull();
      // Should NOT persist an error-state row with empty IDs
      expect(mockChannelRepo.save).not.toHaveBeenCalled();
    });

    it('should rollback created resources on partial failure', async () => {
      const roleToDelete = {
        id: 'role-team-alpha',
        name: 'Team: Alpha',
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const createdCategory = {
        id: 'cat-001',
        name: '🎮 Alpha',
        delete: jest.fn().mockResolvedValue(undefined),
      };

      const mockGuild = {
        id: 'guild-001',
        name: 'Test Guild',
        roles: {
          create: jest.fn().mockResolvedValue(roleToDelete),
          cache: new Map(),
        },
        channels: {
          create: jest
            .fn()
            .mockResolvedValueOnce(createdCategory) // category succeeds
            .mockRejectedValueOnce(new Error('Rate limited')), // text fails
          cache: new Map([['cat-001', createdCategory]]),
        },
        members: { fetch: jest.fn() },
      };

      const mockClient = createMockClient({ 'guild-001': mockGuild as never });
      service.initialize(mockClient as never);

      mockSettingsRepo.findOne.mockResolvedValue({
        teamVoiceSettings: { enabled: true },
      });

      const result = await service.createTeamChannels(
        'org-001',
        'team-alpha',
        'guild-001',
        'Alpha',
        'user-001'
      );

      expect(result).toBeNull();
      // Category should have been cleaned up
      expect(createdCategory.delete).toHaveBeenCalled();
      // Role should have been cleaned up
      expect(roleToDelete.delete).toHaveBeenCalled();
    });
  });

  describe('deleteTeamChannels', () => {
    it('should delete Discord resources and DB records', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      const mapping = {
        id: 'mapping-001',
        organizationId: 'org-001',
        teamId: 'team-alpha',
        guildId: 'guild-001',
        categoryId: 'cat-001',
        textChannelId: 'text-001',
        voiceChannelId: 'voice-001',
        teamRoleId: 'role-team-alpha',
      };
      mockChannelRepo.find.mockResolvedValueOnce([mapping]);

      await service.deleteTeamChannels('org-001', 'team-alpha');

      // Should attempt to delete 3 channels + 1 role
      const voiceChannel = mockGuild.channels.cache.get('voice-001');
      const textChannel = mockGuild.channels.cache.get('text-001');
      const catChannel = mockGuild.channels.cache.get('cat-001');
      expect(voiceChannel?.delete).toHaveBeenCalled();
      expect(textChannel?.delete).toHaveBeenCalled();
      expect(catChannel?.delete).toHaveBeenCalled();

      // DB record removed
      expect(mockChannelRepo.remove).toHaveBeenCalledWith(mapping);
    });
  });

  describe('addMemberToTeamChannels', () => {
    it('should assign team role to member', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      // Team channel mapping exists
      mockChannelRepo.findOne.mockResolvedValueOnce({
        id: 'mapping-001',
        organizationId: 'org-001',
        teamId: 'team-alpha',
        guildId: 'guild-001',
        teamRoleId: 'role-team-alpha',
        voiceChannelId: 'voice-001',
        syncStatus: 'synced',
      });

      // User has a Discord ID
      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 'user-001',
        discordId: 'discord-user-001',
      });

      // Settings — no priority speaker
      mockSettingsRepo.findOne.mockResolvedValueOnce({
        teamVoiceSettings: {
          enabled: true,
          enablePrioritySpeaker: false,
        },
      });

      await service.addMemberToTeamChannels('org-001', 'team-alpha', 'user-001', 'member');

      const member = await mockGuild.members.fetch('discord-user-001');
      expect(member.roles.add).toHaveBeenCalledWith('role-team-alpha', 'Added to team');
    });

    it('should add priority speaker for leaders when enabled', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      mockChannelRepo.findOne.mockResolvedValueOnce({
        id: 'mapping-001',
        organizationId: 'org-001',
        teamId: 'team-alpha',
        guildId: 'guild-001',
        teamRoleId: 'role-team-alpha',
        voiceChannelId: 'voice-001',
        syncStatus: 'synced',
      });

      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 'user-001',
        discordId: 'discord-user-001',
      });

      mockSettingsRepo.findOne.mockResolvedValueOnce({
        teamVoiceSettings: {
          enabled: true,
          enablePrioritySpeaker: true,
        },
      });

      // Put voice channel in guild cache
      const voiceChannel = mockGuild.channels.cache.get('voice-001')!;

      await service.addMemberToTeamChannels('org-001', 'team-alpha', 'user-001', 'leader');

      expect(voiceChannel.permissionOverwrites.edit).toHaveBeenCalledWith('discord-user-001', {
        PrioritySpeaker: true,
      });
    });

    it('should skip when user has no Discord ID', async () => {
      const mockClient = createMockClient({ 'guild-001': createMockGuild() });
      service.initialize(mockClient as never);

      mockChannelRepo.findOne.mockResolvedValueOnce({
        id: 'mapping-001',
        organizationId: 'org-001',
        teamId: 'team-alpha',
        guildId: 'guild-001',
        teamRoleId: 'role-team-alpha',
        syncStatus: 'synced',
      });

      // User has NO Discord ID
      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 'user-001',
        discordId: null,
      });

      await service.addMemberToTeamChannels('org-001', 'team-alpha', 'user-001', 'member');

      // No guild member fetch should happen
      expect(createMockGuild().members.fetch).not.toHaveBeenCalled();
    });
  });

  describe('removeMemberFromTeamChannels', () => {
    it('should remove team role and per-user overrides', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      mockChannelRepo.findOne.mockResolvedValueOnce({
        id: 'mapping-001',
        organizationId: 'org-001',
        teamId: 'team-alpha',
        guildId: 'guild-001',
        teamRoleId: 'role-team-alpha',
        voiceChannelId: 'voice-001',
        syncStatus: 'synced',
      });

      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 'user-001',
        discordId: 'discord-user-001',
      });

      await service.removeMemberFromTeamChannels('org-001', 'team-alpha', 'user-001');

      const member = await mockGuild.members.fetch('discord-user-001');
      expect(member.roles.remove).toHaveBeenCalledWith('role-team-alpha', 'Removed from team');

      const voiceChannel = mockGuild.channels.cache.get('voice-001')!;
      expect(voiceChannel.permissionOverwrites.delete).toHaveBeenCalledWith(
        'discord-user-001',
        expect.any(String)
      );
    });
  });

  describe('getTeamChannelsByOrg', () => {
    it('should return all team channels for an organization', async () => {
      const mappings = [
        { id: 'm1', organizationId: 'org-001', teamId: 'team-a' },
        { id: 'm2', organizationId: 'org-001', teamId: 'team-b' },
      ];
      mockChannelRepo.find.mockResolvedValueOnce(mappings);

      const mockClient = createMockClient();
      service.initialize(mockClient as never);

      const result = await service.getTeamChannelsByOrg('org-001');

      expect(result).toHaveLength(2);
      expect(mockChannelRepo.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-001' },
      });
    });
  });

  describe('domain event handlers', () => {
    it('should create channels in all guilds when team:created fires', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      // Get the registered event handler
      const onTeamCreated = (domainEvents.on as jest.Mock).mock.calls.find(
        (c: [string, unknown]) => c[0] === 'team:created'
      )![1] as (payload: Record<string, unknown>) => Promise<void>;

      // GuildOrganizationService returns one guild
      (GuildOrganizationService.getInstance as jest.Mock).mockReturnValue({
        getGuildsForOrganization: jest
          .fn()
          .mockResolvedValue([{ guildId: 'guild-001', organizationId: 'org-001' }]),
      });

      // Settings enabled with auto-create
      mockSettingsRepo.findOne.mockResolvedValue({
        teamVoiceSettings: {
          enabled: true,
          autoCreateOnTeamCreate: true,
          allowBaseVisibility: false,
          allowListenIn: false,
        },
      });

      await onTeamCreated({
        teamId: 'team-alpha',
        organizationId: 'org-001',
        teamName: 'Alpha Squadron',
        teamType: 'squadron',
        createdBy: 'user-001',
      });

      // Should have created channels (role + 3 channels)
      expect(mockGuild.roles.create).toHaveBeenCalled();
      expect(mockGuild.channels.create).toHaveBeenCalledTimes(3);
    });

    it('should skip when team:created fires but settings disabled', async () => {
      const mockGuild = createMockGuild();
      const mockClient = createMockClient({ 'guild-001': mockGuild });
      service.initialize(mockClient as never);

      const onTeamCreated = (domainEvents.on as jest.Mock).mock.calls.find(
        (c: [string, unknown]) => c[0] === 'team:created'
      )![1] as (payload: Record<string, unknown>) => Promise<void>;

      (GuildOrganizationService.getInstance as jest.Mock).mockReturnValue({
        getGuildsForOrganization: jest
          .fn()
          .mockResolvedValue([{ guildId: 'guild-001', organizationId: 'org-001' }]),
      });

      // Settings disabled
      mockSettingsRepo.findOne.mockResolvedValue({
        teamVoiceSettings: {
          enabled: false,
        },
      });

      await onTeamCreated({
        teamId: 'team-alpha',
        organizationId: 'org-001',
        teamName: 'Alpha',
        teamType: 'squadron',
        createdBy: 'user-001',
      });

      expect(mockGuild.roles.create).not.toHaveBeenCalled();
    });

    it('should call addMemberToTeamChannels when team:member_added fires', async () => {
      const mockClient = createMockClient();
      service.initialize(mockClient as never);

      const onMemberAdded = (domainEvents.on as jest.Mock).mock.calls.find(
        (c: [string, unknown]) => c[0] === 'team:member_added'
      )![1] as (payload: Record<string, unknown>) => Promise<void>;

      // No channel mapping exists — should return early gracefully
      mockChannelRepo.findOne.mockResolvedValueOnce(null);

      await onMemberAdded({
        teamId: 'team-alpha',
        organizationId: 'org-001',
        userId: 'user-001',
        role: 'member',
        teamName: 'Alpha',
      });

      // Should not throw — graceful no-op when mapping doesn't exist
      expect(mockChannelRepo.findOne).toHaveBeenCalled();
    });
  });
});
