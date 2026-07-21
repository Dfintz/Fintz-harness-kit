import type { Client } from 'discord.js';

import { BotIPCService, type IPCHandler, type IPCMessage } from '../BotIPCService';
import { initializeMirrorSyncHandler } from '../mirrorSync';
import { MIRROR_RSVP_SYNC_ACTION } from '../mirrorSyncPublisher';

const getActivityByIdMock = jest.fn();
const findRelatedMirrorsMock = jest.fn();

jest.mock('../../services/activity', () => ({
  ActivityService: jest.fn().mockImplementation(() => ({
    getActivityById: getActivityByIdMock,
  })),
  EventMirrorService: {
    getInstance: () => ({
      findRelatedMirrors: findRelatedMirrorsMock,
      recordSync: jest.fn(),
    }),
  },
}));

type HandlerMap = Map<string, IPCHandler>;

function createIpcHarness(): { ipcService: BotIPCService; handlers: HandlerMap } {
  const handlers: HandlerMap = new Map();
  const ipcService = {
    isAvailable: jest.fn().mockReturnValue(true),
    registerHandler: jest.fn((action: string, handler: IPCHandler) => {
      handlers.set(action, handler);
    }),
    onEvent: jest.fn(),
  } as unknown as BotIPCService;

  return { ipcService, handlers };
}

function createClientWithGuild(guildId: string | null): Client {
  return {
    guilds: {
      cache: {
        has: (id: string) => guildId === id,
      },
    },
  } as unknown as Client;
}

function createMessage(data: Record<string, unknown>): IPCMessage {
  return {
    correlationId: 'corr-1',
    action: MIRROR_RSVP_SYNC_ACTION,
    data,
    timestamp: Date.now(),
  };
}

describe('mirrorSyncHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActivityByIdMock.mockReset();
    findRelatedMirrorsMock.mockReset();
  });

  it('marks payload validation failures as definitive handled errors', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeMirrorSyncHandler(ipcService, createClientWithGuild(null));

    const handler = handlers.get(MIRROR_RSVP_SYNC_ACTION);
    const response = await handler?.(createMessage({ activityId: 'act-1' }));

    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
  });

  it('returns definitive handled when the activity no longer exists', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeMirrorSyncHandler(ipcService, createClientWithGuild(null));

    getActivityByIdMock.mockResolvedValue(null);
    findRelatedMirrorsMock.mockResolvedValue([]);

    const handler = handlers.get(MIRROR_RSVP_SYNC_ACTION);
    const response = await handler?.(
      createMessage({
        activityId: 'act-1',
        userId: 'user-1',
        action: 'refresh',
        currentParticipants: 0,
      })
    );

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'handled',
        definitive: true,
      })
    );
  });

  it('returns non-definitive not_handled when this shard owns no relevant guilds', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeMirrorSyncHandler(ipcService, createClientWithGuild(null));

    getActivityByIdMock.mockResolvedValue({
      id: 'act-1',
      metadata: { discordServerId: 'guild-source' },
    });
    findRelatedMirrorsMock.mockResolvedValue([
      {
        id: 'mirror-1',
        mirrorGuildId: 'guild-mirror',
        mirrorMessageId: 'msg-1',
        canSync: () => true,
      },
    ]);

    const handler = handlers.get(MIRROR_RSVP_SYNC_ACTION);
    const response = await handler?.(
      createMessage({
        activityId: 'act-1',
        userId: 'user-1',
        action: 'join',
        currentParticipants: 3,
      })
    );

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'not_handled',
        definitive: false,
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
