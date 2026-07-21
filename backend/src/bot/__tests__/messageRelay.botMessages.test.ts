import type { Client } from 'discord.js';
import { MessageType } from 'discord.js';

import type { TunnelService } from '../../services/discord/TunnelService';
import { MessageRelay } from '../messageRelay';

interface MockMessage {
  id: string;
  author: {
    id: string;
    bot: boolean;
  };
  content: string;
  attachments: { size: number };
  stickers: { size: number };
  type: MessageType;
  channel: { id: string };
  webhookId: string | null;
}

function createMessage(overrides?: Partial<MockMessage>): MockMessage {
  return {
    id: 'msg-1',
    author: {
      id: 'user-1',
      bot: false,
    },
    content: 'relay me',
    attachments: { size: 0 },
    stickers: { size: 0 },
    type: MessageType.Default,
    channel: { id: 'channel-1' },
    webhookId: null,
    ...overrides,
  };
}

describe('MessageRelay bot relay gating', () => {
  let setIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    setIntervalSpy = jest
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(1 as unknown as ReturnType<typeof setInterval>);
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    jest.restoreAllMocks();
  });

  function createRelay(allowBotMessages: boolean): {
    relay: MessageRelay;
    findTunnelByChannelAsync: jest.Mock;
    getRelayedMessageIds: jest.Mock;
  } {
    const findTunnelByChannelAsync = jest.fn().mockResolvedValue({
      id: 'tunnel-1',
      allowBotMessages,
      contentFilterEnabled: false,
      rateLimitConfig: undefined,
    });

    // No prior relay by default — the idempotency guard is a no-op.
    const getRelayedMessageIds = jest.fn().mockResolvedValue(null);

    const tunnelService = {
      findTunnelByChannelAsync,
      getRelayedMessageIds,
    } as unknown as TunnelService;

    const client = {
      user: { id: 'relay-bot' },
    } as unknown as Client;

    const relay = new MessageRelay(client, tunnelService);

    (relay as unknown as { rateLimiter: unknown }).rateLimiter = {
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true }),
      recordMessage: jest.fn(),
      setTunnelConfig: jest.fn(),
    };

    return { relay, findTunnelByChannelAsync, getRelayedMessageIds };
  }

  it('relays bot-authored messages when tunnel allows bot messages', async () => {
    const { relay } = createRelay(true);
    const relayAndPersistSpy = jest
      .spyOn(
        relay as unknown as { relayAndPersist: (...args: unknown[]) => Promise<void> },
        'relayAndPersist'
      )
      .mockResolvedValue(undefined);

    await (
      relay as unknown as { handleMessage: (message: MockMessage) => Promise<void> }
    ).handleMessage(createMessage({ author: { id: 'other-bot', bot: true } }));

    expect(relayAndPersistSpy).toHaveBeenCalledTimes(1);
  });

  it('skips a message that was already relayed (B7 idempotency against duplicate delivery)', async () => {
    const { relay, getRelayedMessageIds } = createRelay(true);
    // Simulate a prior successful relay: the mapping already exists in Redis.
    getRelayedMessageIds.mockResolvedValue({ 'channel-2': 'relayed-msg-99' });
    const relayAndPersistSpy = jest
      .spyOn(
        relay as unknown as { relayAndPersist: (...args: unknown[]) => Promise<void> },
        'relayAndPersist'
      )
      .mockResolvedValue(undefined);

    await (
      relay as unknown as { handleMessage: (message: MockMessage) => Promise<void> }
    ).handleMessage(createMessage({ id: 'dup-msg' }));

    expect(getRelayedMessageIds).toHaveBeenCalledWith('dup-msg');
    expect(relayAndPersistSpy).not.toHaveBeenCalled();
  });

  it('drops bot-authored messages when tunnel disallows bot messages', async () => {
    const { relay } = createRelay(false);
    const relayAndPersistSpy = jest
      .spyOn(
        relay as unknown as { relayAndPersist: (...args: unknown[]) => Promise<void> },
        'relayAndPersist'
      )
      .mockResolvedValue(undefined);

    await (
      relay as unknown as { handleMessage: (message: MockMessage) => Promise<void> }
    ).handleMessage(createMessage({ author: { id: 'other-bot', bot: true } }));

    expect(relayAndPersistSpy).not.toHaveBeenCalled();
  });

  it('drops webhook-origin messages to prevent relay loops', async () => {
    const { relay } = createRelay(true);
    const relayAndPersistSpy = jest
      .spyOn(
        relay as unknown as { relayAndPersist: (...args: unknown[]) => Promise<void> },
        'relayAndPersist'
      )
      .mockResolvedValue(undefined);

    await (
      relay as unknown as { handleMessage: (message: MockMessage) => Promise<void> }
    ).handleMessage(
      createMessage({
        author: { id: 'other-bot', bot: true },
        webhookId: 'wh_123',
      })
    );

    expect(relayAndPersistSpy).not.toHaveBeenCalled();
  });

  it('initializes listeners once and disposes cleanly', () => {
    const on = jest.fn();
    const off = jest.fn();
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

    const client = {
      user: { id: 'relay-bot' },
      on,
      off,
    } as unknown as Client;

    const tunnelService = {
      findTunnelByChannelAsync: jest.fn(),
    } as unknown as TunnelService;

    const relay = new MessageRelay(client, tunnelService);

    expect(setIntervalSpy).not.toHaveBeenCalled();

    relay.initialize();
    relay.initialize();

    expect(on).toHaveBeenCalledTimes(4);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    relay.dispose();
    relay.dispose();

    expect(off).toHaveBeenCalledTimes(4);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
