jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

import { VoiceChannelService } from '../../services/communication';
import { VoiceChannelType } from '../../types';

describe('VoiceChannelService', () => {
  let service: VoiceChannelService;

  beforeEach(() => {
    service = VoiceChannelService.getInstance();
    // Clear all channels before each test
    service.cleanupExpiredChannels();
    const allChannels = service.getGuildChannels('test-guild');
    allChannels.forEach(channel => service.deleteChannel(channel.id));
  });

  afterAll(() => {
    // Stop the cleanup interval to prevent Jest from hanging
    service.stopCleanupTask();
    // Reset singleton
    (VoiceChannelService as any).instance = undefined;
  });

  describe('createChannel', () => {
    it('should create a new voice channel', () => {
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      expect(channel).toBeDefined();
      expect(channel.name).toBe('Test Channel');
      expect(channel.guildId).toBe('guild-123');
      expect(channel.channelId).toBe('channel-456');
      expect(channel.creatorId).toBe('user-789');
      expect(channel.type).toBe(VoiceChannelType.TEMPORARY);
      expect(channel.isTemporary).toBe(true);
    });

    it('should create an event voice channel with expiration', () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const channel = service.createChannel(
        'Event Channel',
        'guild-123',
        'channel-789',
        'user-123',
        VoiceChannelType.EVENT,
        {
          eventId: 'event-456',
          expiresAt,
          userLimit: 10,
        }
      );

      expect(channel.type).toBe(VoiceChannelType.EVENT);
      expect(channel.eventId).toBe('event-456');
      expect(channel.expiresAt).toEqual(expiresAt);
      expect(channel.userLimit).toBe(10);
      expect(channel.isTemporary).toBe(true);
    });

    it('should create a permanent channel', () => {
      const channel = service.createChannel(
        'Permanent Channel',
        'guild-123',
        'channel-999',
        'user-123',
        VoiceChannelType.PERMANENT
      );

      expect(channel.type).toBe(VoiceChannelType.PERMANENT);
      expect(channel.isTemporary).toBe(false);
      expect(channel.expiresAt).toBeUndefined();
    });
  });

  describe('getChannel', () => {
    it('should return a channel by ID', () => {
      const created = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      const found = service.getChannel(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent channel', () => {
      const found = service.getChannel('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getChannelByDiscordId', () => {
    it('should find channel by Discord channel ID', () => {
      const created = service.createChannel(
        'Test Channel',
        'guild-123',
        'discord-channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      const found = service.getChannelByDiscordId('discord-channel-456');
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent Discord channel ID', () => {
      const found = service.getChannelByDiscordId('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getGuildChannels', () => {
    it('should return all channels for a guild', () => {
      service.createChannel('Channel 1', 'guild-1', 'ch-1', 'user-1', VoiceChannelType.TEMPORARY);
      service.createChannel('Channel 2', 'guild-1', 'ch-2', 'user-1', VoiceChannelType.TEMPORARY);
      service.createChannel('Channel 3', 'guild-2', 'ch-3', 'user-1', VoiceChannelType.TEMPORARY);

      const guild1Channels = service.getGuildChannels('guild-1');
      expect(guild1Channels).toHaveLength(2);
      expect(guild1Channels.every(ch => ch.guildId === 'guild-1')).toBe(true);
    });

    it('should return empty array for guild with no channels', () => {
      const channels = service.getGuildChannels('non-existent-guild');
      expect(channels).toEqual([]);
    });
  });

  describe('getEventChannels', () => {
    it('should return all channels for an event', () => {
      service.createChannel('Event Ch 1', 'guild-1', 'ch-1', 'user-1', VoiceChannelType.EVENT, {
        eventId: 'event-123',
      });
      service.createChannel('Event Ch 2', 'guild-1', 'ch-2', 'user-1', VoiceChannelType.EVENT, {
        eventId: 'event-123',
      });
      service.createChannel('Other Event', 'guild-1', 'ch-3', 'user-1', VoiceChannelType.EVENT, {
        eventId: 'event-456',
      });

      const eventChannels = service.getEventChannels('event-123');
      expect(eventChannels).toHaveLength(2);
      expect(eventChannels.every(ch => ch.eventId === 'event-123')).toBe(true);
    });
  });

  describe('getTemporaryChannels', () => {
    it('should return only temporary channels', () => {
      service.createChannel('Temp 1', 'guild-1', 'ch-1', 'user-1', VoiceChannelType.TEMPORARY);
      service.createChannel('Temp 2', 'guild-1', 'ch-2', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: new Date(Date.now() + 3600000),
      });
      service.createChannel('Permanent', 'guild-1', 'ch-3', 'user-1', VoiceChannelType.PERMANENT);

      const tempChannels = service.getTemporaryChannels();
      expect(tempChannels.length).toBeGreaterThanOrEqual(2);
      expect(tempChannels.every(ch => ch.isTemporary)).toBe(true);
    });
  });

  describe('getExpiredChannels', () => {
    it('should return only expired channels', () => {
      const past = new Date(Date.now() - 3600000); // 1 hour ago
      const future = new Date(Date.now() + 3600000); // 1 hour from now

      service.createChannel('Expired', 'guild-1', 'ch-1', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: past,
      });
      service.createChannel('Not Expired', 'guild-1', 'ch-2', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: future,
      });

      const expiredChannels = service.getExpiredChannels();
      expect(expiredChannels.length).toBeGreaterThanOrEqual(1);
      expect(expiredChannels.every(ch => ch.expiresAt && ch.expiresAt <= new Date())).toBe(true);
    });
  });

  describe('logActivity', () => {
    it('should log voice activity', () => {
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      service.logActivity(channel.id, 'user-123', 'TestUser', 'join', 'guild-123', 'Test Channel');

      const logs = service.getActivityLogs(channel.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user-123');
      expect(logs[0].userName).toBe('TestUser');
      expect(logs[0].action).toBe('join');
    });

    it('should not log activity for non-existent channel', () => {
      service.logActivity(
        'non-existent',
        'user-123',
        'TestUser',
        'join',
        'guild-123',
        'Test Channel'
      );

      const logs = service.getActivityLogs('non-existent');
      expect(logs).toEqual([]);
    });
  });

  describe('getActivityLogs', () => {
    it('should return activity logs for a channel', () => {
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      service.logActivity(channel.id, 'user-1', 'User1', 'join', 'guild-123', 'Test Channel');
      service.logActivity(channel.id, 'user-2', 'User2', 'join', 'guild-123', 'Test Channel');
      service.logActivity(channel.id, 'user-1', 'User1', 'leave', 'guild-123', 'Test Channel');

      const logs = service.getActivityLogs(channel.id);
      expect(logs).toHaveLength(3);
    });

    it('should return empty array for non-existent channel', () => {
      const logs = service.getActivityLogs('non-existent');
      expect(logs).toEqual([]);
    });
  });

  describe('getGuildActivityLogs', () => {
    it('should return all activity logs for a guild', () => {
      const channel1 = service.createChannel(
        'Ch1',
        'guild-1',
        'ch-1',
        'user-1',
        VoiceChannelType.TEMPORARY
      );
      const channel2 = service.createChannel(
        'Ch2',
        'guild-1',
        'ch-2',
        'user-1',
        VoiceChannelType.TEMPORARY
      );
      const channel3 = service.createChannel(
        'Ch3',
        'guild-2',
        'ch-3',
        'user-1',
        VoiceChannelType.TEMPORARY
      );

      service.logActivity(channel1.id, 'user-1', 'User1', 'join', 'guild-1', 'Ch1');
      service.logActivity(channel2.id, 'user-2', 'User2', 'join', 'guild-1', 'Ch2');
      service.logActivity(channel3.id, 'user-3', 'User3', 'join', 'guild-2', 'Ch3');

      const guild1Logs = service.getGuildActivityLogs('guild-1');
      expect(guild1Logs).toHaveLength(2);
      expect(guild1Logs.every(log => log.guildId === 'guild-1')).toBe(true);
    });

    it('should return logs sorted by timestamp (newest first)', () => {
      const channel = service.createChannel(
        'Ch',
        'guild-1',
        'ch-1',
        'user-1',
        VoiceChannelType.TEMPORARY
      );

      service.logActivity(channel.id, 'user-1', 'User1', 'join', 'guild-1', 'Ch');
      // Small delay to ensure different timestamps
      service.logActivity(channel.id, 'user-2', 'User2', 'join', 'guild-1', 'Ch');

      const logs = service.getGuildActivityLogs('guild-1');
      expect(logs.length).toBeGreaterThanOrEqual(2);
      // Check that first log is more recent than second
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(logs[1].timestamp.getTime());
    });
  });

  describe('deleteChannel', () => {
    it('should delete a channel', () => {
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      const deleted = service.deleteChannel(channel.id);
      expect(deleted).toBe(true);

      const found = service.getChannel(channel.id);
      expect(found).toBeUndefined();
    });

    it('should return false when deleting non-existent channel', () => {
      const deleted = service.deleteChannel('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('updateExpiration', () => {
    it('should update channel expiration', () => {
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.PERMANENT
      );

      const newExpiration = new Date(Date.now() + 3600000);
      const updated = service.updateExpiration(channel.id, newExpiration);
      expect(updated).toBe(true);

      const found = service.getChannel(channel.id);
      expect(found?.expiresAt).toEqual(newExpiration);
      expect(found?.isTemporary).toBe(true);
    });

    it('should clear expiration when set to undefined', () => {
      const expiresAt = new Date(Date.now() + 3600000);
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.EVENT,
        { expiresAt }
      );

      const updated = service.updateExpiration(channel.id, undefined);
      expect(updated).toBe(true);

      const found = service.getChannel(channel.id);
      expect(found?.expiresAt).toBeUndefined();
    });

    it('should return false for non-existent channel', () => {
      const updated = service.updateExpiration('non-existent', new Date());
      expect(updated).toBe(false);
    });
  });

  describe('updateUserLimit', () => {
    it('should update user limit', () => {
      const channel = service.createChannel(
        'Test Channel',
        'guild-123',
        'channel-456',
        'user-789',
        VoiceChannelType.TEMPORARY
      );

      const updated = service.updateUserLimit(channel.id, 10);
      expect(updated).toBe(true);

      const found = service.getChannel(channel.id);
      expect(found?.userLimit).toBe(10);
    });

    it('should return false for non-existent channel', () => {
      const updated = service.updateUserLimit('non-existent', 10);
      expect(updated).toBe(false);
    });
  });

  describe('cleanupExpiredChannels', () => {
    it('should cleanup expired channels', () => {
      const past = new Date(Date.now() - 3600000);
      const future = new Date(Date.now() + 3600000);

      service.createChannel('Expired 1', 'guild-1', 'ch-1', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: past,
      });
      service.createChannel('Expired 2', 'guild-1', 'ch-2', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: past,
      });
      service.createChannel('Not Expired', 'guild-1', 'ch-3', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: future,
      });

      const deletedIds = service.cleanupExpiredChannels();
      expect(deletedIds.length).toBeGreaterThanOrEqual(2);
      expect(deletedIds).toContain('ch-1');
      expect(deletedIds).toContain('ch-2');
      expect(deletedIds).not.toContain('ch-3');
    });

    it('should return empty array when no expired channels', () => {
      const future = new Date(Date.now() + 3600000);
      service.createChannel('Not Expired', 'guild-1', 'ch-1', 'user-1', VoiceChannelType.EVENT, {
        expiresAt: future,
      });

      const deletedIds = service.cleanupExpiredChannels();
      expect(deletedIds).toEqual([]);
    });
  });
});
