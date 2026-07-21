// Unit tests for LfgPresenceMonitor Redis-backed opt-in persistence (INT-06).
//
// Auto-LFG opt-ins were previously held only in an in-memory Map and lost on
// every bot restart/deploy. These tests pin the durable behaviour: opt-ins are
// written through to Redis, removed on opt-out, and restored on hydrate().

jest.mock('../../../utils/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../services/social', () => ({
  SocialGroupService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {},
}));

jest.mock('../../embeds/lfgEmbed', () => ({
  buildLfgButtons: jest.fn(),
  buildLfgEmbed: jest.fn(),
}));

import { cache } from '../../../utils/redis';
import { LfgPresenceMonitor } from '../lfgPresenceMonitor';

const mockedCache = jest.mocked(cache);

const KEY_PREFIX = 'bot:lfg:autopost:optin:';

describe('LfgPresenceMonitor opt-in persistence (INT-06)', () => {
  let monitor: LfgPresenceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCache.set.mockResolvedValue(true);
    mockedCache.del.mockResolvedValue(true);
    mockedCache.keys.mockResolvedValue([]);
    mockedCache.get.mockResolvedValue(null);

    monitor = LfgPresenceMonitor.getInstance();
    // Reset in-memory state between tests (singleton persists across the suite).
    monitor.shutdown();
  });

  afterAll(() => {
    LfgPresenceMonitor.getInstance().shutdown();
  });

  it('writes an opt-in through to Redis with a long TTL', () => {
    monitor.optIn('user-1', 'guild-1', { maxPlayers: 4 });

    expect(monitor.isOptedIn('user-1', 'guild-1')).toBe(true);
    expect(mockedCache.set).toHaveBeenCalledWith(
      `${KEY_PREFIX}user-1:guild-1`,
      { maxPlayers: 4 },
      expect.any(Number)
    );
    // Durable preference — not the 300s cache default.
    const ttl = mockedCache.set.mock.calls[0][2] as number;
    expect(ttl).toBeGreaterThan(24 * 60 * 60);
  });

  it('removes the persisted opt-in from Redis on opt-out', () => {
    monitor.optIn('user-2', 'guild-1', { maxPlayers: 4 });
    monitor.optOut('user-2', 'guild-1');

    expect(monitor.isOptedIn('user-2', 'guild-1')).toBe(false);
    expect(mockedCache.del).toHaveBeenCalledWith(`${KEY_PREFIX}user-2:guild-1`);
  });

  it('restores opt-ins from Redis on hydrate and refreshes their TTL', async () => {
    mockedCache.keys.mockResolvedValue([`${KEY_PREFIX}user-9:guild-9`]);
    mockedCache.get.mockResolvedValue({ maxPlayers: 6 });

    await monitor.hydrate();

    expect(mockedCache.keys).toHaveBeenCalledWith(`${KEY_PREFIX}*`);
    expect(monitor.isOptedIn('user-9', 'guild-9')).toBe(true);
    // Sliding-window refresh keeps an actively-running bot's opt-ins alive.
    expect(mockedCache.set).toHaveBeenCalledWith(
      `${KEY_PREFIX}user-9:guild-9`,
      { maxPlayers: 6 },
      expect.any(Number)
    );
  });

  it('skips Redis entries that have already expired/returned null on hydrate', async () => {
    mockedCache.keys.mockResolvedValue([`${KEY_PREFIX}stale:guild`]);
    mockedCache.get.mockResolvedValue(null);

    await monitor.hydrate();

    expect(monitor.isOptedIn('stale', 'guild')).toBe(false);
    expect(mockedCache.set).not.toHaveBeenCalled();
  });

  it('hydrate is non-fatal when Redis is unavailable', async () => {
    mockedCache.keys.mockRejectedValue(new Error('redis down'));

    await expect(monitor.hydrate()).resolves.toBeUndefined();
  });

  it('opt-in does not throw when the Redis write fails', async () => {
    mockedCache.set.mockRejectedValueOnce(new Error('redis down'));

    expect(() => monitor.optIn('user-x', 'guild-x', { maxPlayers: 4 })).not.toThrow();
    // In-memory opt-in still succeeds even if the durable mirror fails.
    expect(monitor.isOptedIn('user-x', 'guild-x')).toBe(true);
    await Promise.resolve();
  });
});
