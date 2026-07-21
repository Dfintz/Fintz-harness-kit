/**
 * Unit tests for DomainEventBus
 *
 * Validates:
 *  - Singleton lifecycle
 *  - Type-safe emit / on / once / off
 *  - Async error isolation (one bad listener doesn't break others)
 *  - removeAllListeners and introspection helpers
 */

import type {
  MemberDiscordLeftPayload,
  ModerationActionPayload,
  RsiOrgJoinedPayload,
} from '../../services/shared/DomainEventBus';
import { DomainEventBus, domainEvents } from '../../services/shared/DomainEventBus';

// Silence Winston during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DomainEventBus', () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    DomainEventBus.resetInstance();
    bus = DomainEventBus.getInstance();
  });

  afterEach(() => {
    DomainEventBus.resetInstance();
  });

  /* ------------------------------------------------------------------ */
  /*  Singleton                                                          */
  /* ------------------------------------------------------------------ */

  it('returns the same instance on repeated getInstance() calls', () => {
    const a = DomainEventBus.getInstance();
    const b = DomainEventBus.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance()', () => {
    const a = DomainEventBus.getInstance();
    DomainEventBus.resetInstance();
    const b = DomainEventBus.getInstance();
    expect(a).not.toBe(b);
  });

  it('exports a pre-instantiated domainEvents singleton', () => {
    // domainEvents was created before resetInstance(); just verify it exists
    expect(domainEvents).toBeDefined();
    expect(domainEvents).toBeInstanceOf(DomainEventBus);
  });

  /* ------------------------------------------------------------------ */
  /*  Basic pub/sub                                                      */
  /* ------------------------------------------------------------------ */

  it('delivers a payload to a synchronous listener', () => {
    const handler = jest.fn();
    bus.on('member:discord_left', handler);

    const payload: MemberDiscordLeftPayload = {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      discordId: 'd1',
      discordUsername: 'TestUser',
      guildId: 'g1',
      guildName: 'TestGuild',
      organizationId: 'org1',
      reason: 'leave',
    };

    bus.emit('member:discord_left', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('delivers a payload to an async listener', async () => {
    const received: ModerationActionPayload[] = [];

    bus.on('member:moderation_action', async p => {
      // Simulate async work
      await new Promise(r => setTimeout(r, 5));
      received.push(p);
    });

    const payload: ModerationActionPayload = {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      organizationId: 'org1',
      incidentId: 'inc1',
      incidentType: 'BAN',
      severity: 5,
      moderatorId: 'mod1',
      reason: 'spam',
      isShared: false,
    };

    bus.emit('member:moderation_action', payload);

    // Give async listener time to complete
    await new Promise(r => setTimeout(r, 20));
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload);
  });

  it('supports multiple listeners for the same event', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.on('member:rsi_org_joined', h1);
    bus.on('member:rsi_org_joined', h2);

    const payload: RsiOrgJoinedPayload = {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      organizationId: 'org1',
      rsiHandle: 'pilot1',
      rsiOrgSid: 'HOSTILESID',
      rsiOrgName: 'Hostile Org',
      isHostile: true,
      isRedacted: false,
    };

    bus.emit('member:rsi_org_joined', payload);

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  /* ------------------------------------------------------------------ */
  /*  once()                                                             */
  /* ------------------------------------------------------------------ */

  it('once() listener fires only on the first emit', () => {
    const handler = jest.fn();
    bus.once('member:platform_left', handler);

    const payload = {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      organizationId: 'org1',
      username: 'gone',
    };

    bus.emit('member:platform_left', payload);
    bus.emit('member:platform_left', payload);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  /* ------------------------------------------------------------------ */
  /*  off()                                                              */
  /* ------------------------------------------------------------------ */

  it('off() removes a specific listener', () => {
    const handler = jest.fn();
    bus.on('member:discord_left', handler);
    bus.off('member:discord_left', handler);

    bus.emit('member:discord_left', {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      discordId: 'd1',
      discordUsername: 'TestUser',
      guildId: 'g1',
      guildName: 'TestGuild',
      organizationId: 'org1',
      reason: 'leave',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ */
  /*  Error isolation                                                    */
  /* ------------------------------------------------------------------ */

  it('a throwing sync listener does not prevent other listeners from firing', () => {
    const badListener = jest.fn(() => {
      throw new Error('boom');
    });
    const goodListener = jest.fn();

    bus.on('member:discord_left', badListener);
    bus.on('member:discord_left', goodListener);

    const payload: MemberDiscordLeftPayload = {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      discordId: 'd1',
      discordUsername: 'TestUser',
      guildId: 'g1',
      guildName: 'TestGuild',
      organizationId: 'org1',
      reason: 'leave',
    };

    // Should NOT throw
    expect(() => bus.emit('member:discord_left', payload)).not.toThrow();

    expect(badListener).toHaveBeenCalledTimes(1);
    expect(goodListener).toHaveBeenCalledTimes(1);
  });

  it('an async listener rejection does not prevent other listeners', async () => {
    const results: string[] = [];

    bus.on('member:moderation_action', async () => {
      throw new Error('async boom');
    });
    bus.on('member:moderation_action', async p => {
      results.push(p.incidentId);
    });

    const payload: ModerationActionPayload = {
      timestamp: new Date().toISOString(),
      userId: 'u1',
      organizationId: 'org1',
      incidentId: 'inc42',
      incidentType: 'BAN',
      severity: 5,
      moderatorId: 'mod1',
      isShared: false,
    };

    bus.emit('member:moderation_action', payload);

    await new Promise(r => setTimeout(r, 20));
    expect(results).toEqual(['inc42']);
  });

  /* ------------------------------------------------------------------ */
  /*  Introspection                                                      */
  /* ------------------------------------------------------------------ */

  it('listenerCount returns correct count', () => {
    expect(bus.listenerCount('member:discord_left')).toBe(0);

    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.on('member:discord_left', h1);
    bus.on('member:discord_left', h2);

    expect(bus.listenerCount('member:discord_left')).toBe(2);
  });

  it('activeEvents returns events with listeners', () => {
    expect(bus.activeEvents()).toEqual([]);

    bus.on('member:discord_left', jest.fn());
    bus.on('member:moderation_action', jest.fn());

    const active = bus.activeEvents();
    expect(active).toContain('member:discord_left');
    expect(active).toContain('member:moderation_action');
    expect(active).toHaveLength(2);
  });

  /* ------------------------------------------------------------------ */
  /*  removeAllListeners                                                 */
  /* ------------------------------------------------------------------ */

  it('removeAllListeners(event) clears listeners for one event only', () => {
    bus.on('member:discord_left', jest.fn());
    bus.on('member:moderation_action', jest.fn());

    bus.removeAllListeners('member:discord_left');

    expect(bus.listenerCount('member:discord_left')).toBe(0);
    expect(bus.listenerCount('member:moderation_action')).toBe(1);
  });

  it('removeAllListeners() clears all listeners', () => {
    bus.on('member:discord_left', jest.fn());
    bus.on('member:moderation_action', jest.fn());
    bus.on('member:rsi_org_left', jest.fn());

    bus.removeAllListeners();

    expect(bus.activeEvents()).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /*  No listeners — emit is a no-op                                     */
  /* ------------------------------------------------------------------ */

  it('emitting with no listeners does not throw', () => {
    expect(() =>
      bus.emit('member:rsi_sync_failed', {
        timestamp: new Date().toISOString(),
        userId: 'u1',
        organizationId: 'org1',
        rsiHandle: 'pilot',
        failureReason: 'hidden profile',
        consecutiveFailures: 3,
      })
    ).not.toThrow();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
