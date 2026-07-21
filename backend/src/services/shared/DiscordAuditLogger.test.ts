import { AuditCategory, auditService } from '../audit/AuditService';

import { DiscordAuditAction, DiscordAuditLogger } from './DiscordAuditLogger';

jest.mock('../audit/AuditService', () => {
  const actual = jest.requireActual('../audit/AuditService');
  return {
    ...actual,
    auditService: {
      log: jest.fn(),
    },
  };
});

describe('DiscordAuditLogger', () => {
  let logger: DiscordAuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton so we get a clean buffer per test
    (DiscordAuditLogger as unknown as { instance: DiscordAuditLogger | undefined }).instance =
      undefined;
    logger = DiscordAuditLogger.getInstance();
  });

  describe('logGuildLinked', () => {
    it('emits a GUILD_LINKED audit event with guild and primary metadata', () => {
      logger.logGuildLinked('org-1', 'guild-123', 'My Guild', 'user-9', true);

      expect(auditService.log).toHaveBeenCalledTimes(1);
      const call = (auditService.log as jest.Mock).mock.calls[0][0];
      expect(call).toMatchObject({
        category: AuditCategory.DISCORD,
        action: DiscordAuditAction.GUILD_LINKED,
        organizationId: 'org-1',
        userId: 'user-9',
        resource: 'discordGuild/guild-123',
        metadata: { guildId: 'guild-123', guildName: 'My Guild', isPrimary: true },
      });
      expect(call.message).toContain('My Guild');
    });
  });

  describe('logGuildUnlinked', () => {
    it('emits a GUILD_UNLINKED audit event with the actor performing removal', () => {
      logger.logGuildUnlinked('org-2', 'guild-456', 'Old Guild', 'user-7');

      expect(auditService.log).toHaveBeenCalledTimes(1);
      const call = (auditService.log as jest.Mock).mock.calls[0][0];
      expect(call).toMatchObject({
        category: AuditCategory.DISCORD,
        action: DiscordAuditAction.GUILD_UNLINKED,
        organizationId: 'org-2',
        userId: 'user-7',
        resource: 'discordGuild/guild-456',
        metadata: { guildId: 'guild-456', guildName: 'Old Guild' },
      });
    });
  });

  describe('buildResource', () => {
    it('falls back to org-scoped resource when no guild id is present', () => {
      logger.log({
        action: DiscordAuditAction.FEDERATION_DISCORD_CONFIGURED,
        organizationId: 'fed-1',
        details: {},
      });

      const call = (auditService.log as jest.Mock).mock.calls[0][0];
      expect(call.resource).toBe('discord/fed-1');
    });
  });

  describe('audit-emission failure isolation', () => {
    it('does not propagate errors from auditService.log to the caller', () => {
      (auditService.log as jest.Mock).mockImplementationOnce(() => {
        throw new Error('audit transport down');
      });

      expect(() => logger.logGuildLinked('org-3', 'guild-9', 'X', 'user-1', false)).not.toThrow();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

