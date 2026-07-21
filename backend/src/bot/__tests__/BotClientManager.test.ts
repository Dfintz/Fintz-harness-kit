/**
 * Tests for BotClientManager — Singleton Discord.js client manager.
 * Wave 1.9 — Bot Architecture Hardening
 */

// Mock discord.js before importing BotClientManager
jest.mock('discord.js', () => {
  const mockClient = {
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue('mock-token'),
    isReady: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
    removeAllListeners: jest.fn(),
    user: { tag: 'TestBot#1234' },
    // REST manager emitter — BotClientManager wires a rate-limit observer onto it
    // (registerRestRateLimitObserver(this.client.rest)).
    rest: { on: jest.fn() },
  };

  return {
    Client: jest.fn(() => mockClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      GuildVoiceStates: 8,
      GuildModeration: 16,
      GuildMembers: 32,
    },
    Partials: {
      Message: 0,
      Channel: 1,
      Reaction: 2,
      GuildMember: 3,
    },
    Options: {
      cacheWithLimits: jest.fn().mockReturnValue({}),
      DefaultMakeCacheSettings: {},
    },
    RESTEvents: {
      RateLimited: 'rateLimited',
      InvalidRequestWarning: 'invalidRequestWarning',
    },
  };
});

import { BotClientManager } from '../BotClientManager';

describe('BotClientManager', () => {
  beforeEach(() => {
    // Reset singleton between tests
    BotClientManager.resetInstance();
  });

  afterAll(() => {
    BotClientManager.resetInstance();
  });

  it('should be a singleton', () => {
    const instance1 = BotClientManager.getInstance();
    const instance2 = BotClientManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should return a Client instance', () => {
    const manager = BotClientManager.getInstance();
    const client = manager.getClient();
    expect(client).toBeDefined();
    expect(client.on).toBeDefined();
  });

  it('should login successfully', async () => {
    const manager = BotClientManager.getInstance();
    const client = manager.getClient();

    await manager.login('test-token');

    expect(client.login).toHaveBeenCalledWith('test-token');
    expect(manager.isReady()).toBe(true);
  });

  it('should only login once even if called multiple times', async () => {
    const manager = BotClientManager.getInstance();
    const client = manager.getClient();

    // Clear any previous calls from other tests
    (client.login as jest.Mock).mockClear();

    await manager.login('test-token');
    await manager.login('test-token-again');

    // Should only be called once
    expect(client.login).toHaveBeenCalledTimes(1);
  });

  it('should report not ready before login', () => {
    const manager = BotClientManager.getInstance();
    expect(manager.isReady()).toBe(false);
  });

  it('should destroy the client', async () => {
    const manager = BotClientManager.getInstance();
    const client = manager.getClient();

    await manager.login('test-token');
    await manager.destroy();

    expect(client.destroy).toHaveBeenCalled();
    expect(manager.isReady()).toBe(false);
  });

  it('should reset the singleton instance', () => {
    const instance1 = BotClientManager.getInstance();
    BotClientManager.resetInstance();
    const instance2 = BotClientManager.getInstance();

    expect(instance1).not.toBe(instance2);
  });
});
