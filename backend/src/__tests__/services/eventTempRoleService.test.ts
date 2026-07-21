/**
 * EventTempRoleService Tests
 *
 * Tests for temporary Discord role lifecycle management tied to events.
 */

// Mock auditLogger, logger, and data-source before imports
jest.mock('../../utils/auditLogger', () => ({
  AuditEventType: { ACTIVITY_ACTION: 'ACTIVITY_ACTION' },
  logAuditEvent: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';
import { Activity, ActivityType } from '../../models/Activity';
import { EventTempRoleService } from '../../services/activity/EventTempRoleService';
import { logAuditEvent } from '../../utils/auditLogger';

const mockedAppDataSource = AppDataSource as unknown as { getRepository: jest.Mock };

function setMockedParticipants(rows: Array<{ userId: string }>): void {
  mockedAppDataSource.getRepository.mockReturnValue({
    find: jest.fn().mockResolvedValue(rows),
  });
}

// ── Discord.js mock helpers ─────────────────────────────────────────

function mockRole(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `📅 Test Event`,
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockMember(userId: string, roleIds: string[] = []) {
  const rolesCache = new Map(roleIds.map(r => [r, { id: r }]));
  return {
    id: userId,
    user: { id: userId },
    roles: {
      cache: { has: (id: string) => rolesCache.has(id), get: (id: string) => rolesCache.get(id) },
      add: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function mockGuild(
  id: string,
  members: ReturnType<typeof mockMember>[] = [],
  roles: ReturnType<typeof mockRole>[] = []
) {
  const membersMap = new Map(members.map(m => [m.id, m]));
  const rolesMap = new Map(roles.map(r => [r.id, r]));
  return {
    id,
    roles: {
      create: jest.fn().mockImplementation(async (opts: Record<string, unknown>) => {
        const role = mockRole('new-role-id', { name: opts.name });
        return role;
      }),
      cache: { get: (roleId: string) => rolesMap.get(roleId) },
    },
    members: {
      cache: { get: (userId: string) => membersMap.get(userId) },
      fetch: jest.fn().mockImplementation(async (userId: string) => {
        const m = membersMap.get(userId);
        if (!m) throw new Error('Unknown Member');
        return m;
      }),
    },
  } as any;
}

function mockActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    title: 'Mining Run',
    creatorId: 'creator-1',
    creatorName: 'TestCreator',
    participants: [],
    metadata: {},
    activityType: ActivityType.MISSION,
    ...overrides,
  } as Activity;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('EventTempRoleService', () => {
  let service: EventTempRoleService;

  beforeEach(() => {
    // Reset singleton
    (EventTempRoleService as any).instance = undefined;
    service = EventTempRoleService.getInstance();
    jest.clearAllMocks();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = EventTempRoleService.getInstance();
      const b = EventTempRoleService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ── createTempRole ───────────────────────────────────────────────

  describe('createTempRole', () => {
    it('should create a role and return its ID', async () => {
      const guild = mockGuild('g1');
      const activity = mockActivity();

      const roleId = await service.createTempRole(guild, activity);

      expect(roleId).toBe('new-role-id');
      expect(guild.roles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '📅 Mining Run',
          mentionable: false,
          hoist: false,
        })
      );
    });

    it('should use custom color when provided', async () => {
      const guild = mockGuild('g1');
      const activity = mockActivity();

      await service.createTempRole(guild, activity, 0xff0000);

      expect(guild.roles.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff0000 })
      );
    });

    it('should use default color when not provided', async () => {
      const guild = mockGuild('g1');
      const activity = mockActivity();

      await service.createTempRole(guild, activity);

      expect(guild.roles.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x3498db })
      );
    });

    it('should log an audit event on success', async () => {
      const guild = mockGuild('g1');
      const activity = mockActivity();

      await service.createTempRole(guild, activity);

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVENT_TEMP_ROLE_CREATED',
          userId: 'creator-1',
        })
      );
    });

    it('should return null when role creation fails', async () => {
      const guild = mockGuild('g1');
      guild.roles.create.mockRejectedValueOnce(new Error('Missing Permissions'));
      const activity = mockActivity();

      const result = await service.createTempRole(guild, activity);

      expect(result).toBeNull();
    });

    it('should truncate long event titles', async () => {
      const guild = mockGuild('g1');
      const longTitle = 'A'.repeat(200);
      const activity = mockActivity({ title: longTitle });

      await service.createTempRole(guild, activity);

      const calledName = guild.roles.create.mock.calls[0][0].name as string;
      expect(calledName.length).toBeLessThanOrEqual(100);
      expect(calledName.startsWith('📅 ')).toBe(true);
    });
  });

  // ── assignTempRole ──────────────────────────────────────────────

  describe('assignTempRole', () => {
    it('should add role to member', async () => {
      const member = mockMember('user-1');
      const guild = mockGuild('g1', [member]);

      const result = await service.assignTempRole(guild, 'user-1', 'role-1', 'act-1');

      expect(result).toBe(true);
      expect(member.roles.add).toHaveBeenCalledWith('role-1', expect.any(String));
    });

    it('should skip if member already has the role', async () => {
      const member = mockMember('user-1', ['role-1']);
      const guild = mockGuild('g1', [member]);

      const result = await service.assignTempRole(guild, 'user-1', 'role-1', 'act-1');

      expect(result).toBe(true);
      expect(member.roles.add).not.toHaveBeenCalled();
    });

    it('should return false if member not found', async () => {
      const guild = mockGuild('g1');
      guild.members.fetch.mockRejectedValueOnce(new Error('Unknown Member'));

      const result = await service.assignTempRole(guild, 'unknown', 'role-1', 'act-1');

      expect(result).toBe(false);
    });

    it('should return false when role add fails', async () => {
      const member = mockMember('user-1');
      member.roles.add.mockRejectedValueOnce(new Error('Missing Permissions'));
      const guild = mockGuild('g1', [member]);

      const result = await service.assignTempRole(guild, 'user-1', 'role-1', 'act-1');

      expect(result).toBe(false);
    });
  });

  // ── removeTempRole ──────────────────────────────────────────────

  describe('removeTempRole', () => {
    it('should remove role from member', async () => {
      const member = mockMember('user-1', ['role-1']);
      const guild = mockGuild('g1', [member]);

      const result = await service.removeTempRole(guild, 'user-1', 'role-1', 'act-1');

      expect(result).toBe(true);
      expect(member.roles.remove).toHaveBeenCalledWith('role-1', expect.any(String));
    });

    it('should skip if member does not have the role', async () => {
      const member = mockMember('user-1');
      const guild = mockGuild('g1', [member]);

      const result = await service.removeTempRole(guild, 'user-1', 'role-1', 'act-1');

      expect(result).toBe(true);
      expect(member.roles.remove).not.toHaveBeenCalled();
    });

    it('should return false if member not found', async () => {
      const guild = mockGuild('g1');
      guild.members.fetch.mockRejectedValueOnce(new Error('Unknown Member'));

      const result = await service.removeTempRole(guild, 'unknown', 'role-1', 'act-1');

      expect(result).toBe(false);
    });
  });

  // ── deleteTempRole ──────────────────────────────────────────────

  describe('deleteTempRole', () => {
    it('should delete the role and audit log it', async () => {
      const role = mockRole('role-1');
      const guild = mockGuild('g1', [], [role]);

      const result = await service.deleteTempRole(guild, 'role-1', 'act-1', 'event ended');

      expect(result).toBe(true);
      expect(role.delete).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EVENT_TEMP_ROLE_DELETED' })
      );
    });

    it('should return true if role already deleted', async () => {
      const guild = mockGuild('g1');

      const result = await service.deleteTempRole(guild, 'nonexistent', 'act-1', 'cancelled');

      expect(result).toBe(true);
    });

    it('should return false on unexpected error', async () => {
      const role = mockRole('role-1');
      role.delete.mockRejectedValueOnce(new Error('Boom'));
      const guild = mockGuild('g1', [], [role]);

      const result = await service.deleteTempRole(guild, 'role-1', 'act-1', 'error');

      expect(result).toBe(false);
    });
  });

  // ── syncTempRoleToParticipants ──────────────────────────────────

  describe('syncTempRoleToParticipants', () => {
    it('should assign role to all accepted participants', async () => {
      const m1 = mockMember('user-1');
      const m2 = mockMember('user-2');
      const guild = mockGuild('g1', [m1, m2]);
      // Repository returns only ACCEPTED participants (filter is applied in DB query)
      setMockedParticipants([{ userId: 'user-1' }, { userId: 'user-2' }]);
      const activity = mockActivity();

      const result = await service.syncTempRoleToParticipants(guild, activity, 'role-1');

      expect(result.assigned).toBe(2);
      expect(m1.roles.add).toHaveBeenCalled();
      expect(m2.roles.add).toHaveBeenCalled();
    });

    it('should count failures', async () => {
      const guild = mockGuild('g1');
      guild.members.fetch.mockRejectedValue(new Error('Unknown'));
      setMockedParticipants([{ userId: 'user-1' }]);
      const activity = mockActivity();

      const result = await service.syncTempRoleToParticipants(guild, activity, 'role-1');

      expect(result.assigned).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should handle empty participants', async () => {
      const guild = mockGuild('g1');
      setMockedParticipants([]);
      const activity = mockActivity();

      const result = await service.syncTempRoleToParticipants(guild, activity, 'role-1');

      expect(result.assigned).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle null participants', async () => {
      const guild = mockGuild('g1');
      // Repository returns empty when there are no accepted rows
      setMockedParticipants([]);
      const activity = mockActivity({ participants: null as any });

      const result = await service.syncTempRoleToParticipants(guild, activity, 'role-1');

      expect(result.assigned).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  // ── resolveGuild ────────────────────────────────────────────────

  describe('resolveGuild', () => {
    it('should return guild from cache', async () => {
      const guild = { id: 'g1' };
      const client = {
        guilds: {
          cache: { get: jest.fn().mockReturnValue(guild) },
          fetch: jest.fn(),
        },
      } as any;

      const result = await service.resolveGuild(client, 'g1');

      expect(result).toBe(guild);
      expect(client.guilds.fetch).not.toHaveBeenCalled();
    });

    it('should fetch guild when not in cache', async () => {
      const guild = { id: 'g1' };
      const client = {
        guilds: {
          cache: { get: jest.fn().mockReturnValue(undefined) },
          fetch: jest.fn().mockResolvedValue(guild),
        },
      } as any;

      const result = await service.resolveGuild(client, 'g1');

      expect(result).toBe(guild);
      expect(client.guilds.fetch).toHaveBeenCalledWith('g1');
    });

    it('should return null on error', async () => {
      const client = {
        guilds: {
          cache: { get: jest.fn().mockReturnValue(undefined) },
          fetch: jest.fn().mockRejectedValue(new Error('Forbidden')),
        },
      } as any;

      const result = await service.resolveGuild(client, 'unknown');

      expect(result).toBeNull();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
