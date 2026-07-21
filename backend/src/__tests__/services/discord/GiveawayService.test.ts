/**
 * GiveawayService Tests
 *
 * Tests for Giveaway Service:
 * - Creating giveaways
 * - Adding entries
 * - Ending and drawing winners
 * - Listing active giveaways
 * - Duplicate entry prevention
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

import { GiveawayService } from '../../../services/discord/GiveawayService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getService(): GiveawayService {
  (GiveawayService as any).instance = undefined;
  return GiveawayService.getInstance();
}

describe('GiveawayService', () => {
  let service: GiveawayService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = getService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = GiveawayService.getInstance();
      const b = GiveawayService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('createGiveaway', () => {
    it('should create a giveaway and return it', () => {
      const giveaway = service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'channel-1',
        hostId: 'host-1',
        hostName: 'HostUser',
        title: 'Test Prize',
        description: 'Win something cool',
        winners: 1,
        durationMinutes: 60,
      });

      expect(giveaway).toBeDefined();
      expect(typeof giveaway).not.toBe('string');
      if (typeof giveaway === 'string') return;
      expect(giveaway.title).toBe('Test Prize');
      expect(giveaway.description).toBe('Win something cool');
      expect(giveaway.winners).toBe(1);
      expect(giveaway.guildId).toBe('guild-1');
      expect(giveaway.channelId).toBe('channel-1');
      expect(giveaway.hostId).toBe('host-1');
      expect(giveaway.hostName).toBe('HostUser');
      expect(giveaway.entries).toEqual([]);
      expect(giveaway.ended).toBe(false);
    });
  });

  describe('addEntry', () => {
    it('should allow a user to enter', async () => {
      const giveaway = service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      }) as any;
      const result = await service.addEntry(giveaway.id, 'user-1', 'User1');
      expect(result).toBeNull(); // null means success
    });

    it('should prevent duplicate entries', async () => {
      const giveaway = service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      }) as any;
      await service.addEntry(giveaway.id, 'user-1', 'User1');
      const result = await service.addEntry(giveaway.id, 'user-1', 'User1');
      expect(result).toContain('already entered');
    });

    it('should fail for non-existent giveaway', async () => {
      const result = await service.addEntry('non-existent', 'user-1', 'User1');
      expect(result).toBe('Giveaway not found.');
    });
  });

  describe('endGiveaway', () => {
    it('should end a giveaway and pick winners', async () => {
      const giveaway = service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      }) as any;
      await service.addEntry(giveaway.id, 'user-1', 'User1');
      await service.addEntry(giveaway.id, 'user-2', 'User2');
      await service.addEntry(giveaway.id, 'user-3', 'User3');

      const winners = await service.endGiveaway(giveaway.id);
      expect(winners.length).toBe(1);
      expect(['user-1', 'user-2', 'user-3']).toContain(winners[0]);
    });

    it('should handle giveaway with no entries', async () => {
      const giveaway = service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      }) as any;
      const winners = await service.endGiveaway(giveaway.id);
      expect(winners).toHaveLength(0);
    });

    it('should return empty for already ended giveaway', async () => {
      const giveaway = service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      }) as any;
      await service.endGiveaway(giveaway.id);
      const winners = await service.endGiveaway(giveaway.id);
      expect(winners).toHaveLength(0);
    });
  });

  describe('listGiveaways', () => {
    it('should list only active giveaways for a guild', () => {
      service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize A',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      });
      service.createGiveaway({
        guildId: 'guild-1',
        channelId: 'ch-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'Prize B',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      });
      service.createGiveaway({
        guildId: 'guild-2',
        channelId: 'ch-2',
        hostId: 'host-2',
        hostName: 'Host2',
        title: 'Prize C',
        description: 'Desc',
        winners: 1,
        durationMinutes: 60,
      });

      const guild1 = service.listGiveaways('guild-1');
      expect(guild1).toHaveLength(2);

      const guild2 = service.listGiveaways('guild-2');
      expect(guild2).toHaveLength(1);
    });
  });

  describe('shutdown', () => {
    it('should clear active timers, in-memory state, and client reference', () => {
      const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');

      const mockClient = {
        channels: { fetch: jest.fn() },
      } as unknown as import('discord.js').Client;
      service.initialize(mockClient);

      const runtime = service as unknown as {
        timerIds: Map<string, NodeJS.Timeout>;
        cleanupTimers: Map<string, NodeJS.Timeout>;
        giveaways: Map<string, unknown>;
        client: unknown;
      };

      const activeTimer = setTimeout(() => {}, 1000);
      const cleanupTimer = setTimeout(() => {}, 2000);
      runtime.timerIds.set('active', activeTimer);
      runtime.cleanupTimers.set('cleanup', cleanupTimer);
      runtime.giveaways.set('g1', { id: 'g1' });

      service.shutdown();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(activeTimer);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(cleanupTimer);
      expect(runtime.timerIds.size).toBe(0);
      expect(runtime.cleanupTimers.size).toBe(0);
      expect(runtime.giveaways.size).toBe(0);
      expect(runtime.client).toBeNull();
    });

    it('should be safe to call shutdown multiple times', () => {
      service.shutdown();
      expect(() => service.shutdown()).not.toThrow();
    });
  });
});
