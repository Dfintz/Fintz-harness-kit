import type { Client } from 'discord.js';

import { BotIPCService, type IPCHandler, type IPCMessage } from '../BotIPCService';
import { RSI_STATUS_IPC_ACTIONS } from '../rsiStatusIpc';
import { initializeRsiStatusIpcHandler } from '../rsiStatusIpcHandler';

const getPanelMock = jest.fn<Promise<{ channelId: string; messageId: string } | null>, [string]>();
const deployPanelMock = jest.fn<
  Promise<{ channelId: string; messageId: string }>,
  [string, string]
>();
const removePanelMock = jest.fn<Promise<boolean>, [string]>();

const getChannelsMock = jest.fn<Promise<Record<string, unknown> | null>, [string]>();
const createManagedChannelsMock = jest.fn<Promise<void>, [string]>();
const assignChannelMock = jest.fn<Promise<void>, [string, 'application' | 'server', string]>();
const removeChannelsMock = jest.fn<Promise<boolean>, [string]>();

jest.mock('../commands/rsistatus', () => ({
  getRsiStatusPanelForGuild: (guildId: string) => getPanelMock(guildId),
  deployRsiStatusPanelForGuild: (guildId: string, channelId: string) =>
    deployPanelMock(guildId, channelId),
  removeRsiStatusPanelForGuild: (guildId: string) => removePanelMock(guildId),
}));

jest.mock('../commands/rsiStatusChannels', () => ({
  getStatusChannelsForGuild: (guildId: string) => getChannelsMock(guildId),
  createManagedStatusChannelsForGuild: (guildId: string) => createManagedChannelsMock(guildId),
  assignStatusChannelForGuild: (
    guildId: string,
    role: 'application' | 'server',
    channelId: string
  ) => assignChannelMock(guildId, role, channelId),
  removeStatusChannelsForGuild: (guildId: string) => removeChannelsMock(guildId),
}));

type HandlerMap = Map<string, IPCHandler>;

function createIpcHarness(): { ipcService: BotIPCService; handlers: HandlerMap } {
  const handlers: HandlerMap = new Map();
  const ipcService = {
    isAvailable: jest.fn().mockReturnValue(true),
    registerHandler: jest.fn((action: string, handler: IPCHandler) => {
      handlers.set(action, handler);
    }),
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

function createMessage(
  action: string,
  data: Record<string, unknown>,
  routing?: { scope?: 'guild' | 'global'; guildId?: string }
): IPCMessage {
  return {
    correlationId: 'corr-1',
    action,
    data,
    routing,
    timestamp: Date.now(),
  };
}

describe('rsiStatusIpcHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPanelMock.mockResolvedValue({ channelId: 'chan-1', messageId: 'msg-1' });
    deployPanelMock.mockResolvedValue({ channelId: 'chan-1', messageId: 'msg-1' });
    removePanelMock.mockResolvedValue(true);
    getChannelsMock.mockResolvedValue({});
    createManagedChannelsMock.mockResolvedValue(undefined);
    assignChannelMock.mockResolvedValue(undefined);
    removeChannelsMock.mockResolvedValue(true);
  });

  it('returns non-definitive not_handled when routed guild is not cached on this shard', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRsiStatusIpcHandler(ipcService, createClientWithGuild(null));

    const handler = handlers.get(RSI_STATUS_IPC_ACTIONS.GET_PANEL);
    const response = await handler?.(
      createMessage(
        RSI_STATUS_IPC_ACTIONS.GET_PANEL,
        { guildId: 'guild-1' },
        { scope: 'guild', guildId: 'guild-1' }
      )
    );

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'not_handled',
        definitive: false,
      })
    );
    expect(getPanelMock).not.toHaveBeenCalled();
  });

  it('returns definitive handled response when owning shard processes action', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRsiStatusIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(RSI_STATUS_IPC_ACTIONS.GET_PANEL);
    const response = await handler?.(
      createMessage(RSI_STATUS_IPC_ACTIONS.GET_PANEL, { guildId: 'guild-1' })
    );

    expect(getPanelMock).toHaveBeenCalledWith('guild-1');
    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'handled',
        definitive: true,
      })
    );
  });

  it('marks payload validation errors as definitive handled failures', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRsiStatusIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(RSI_STATUS_IPC_ACTIONS.GET_PANEL);
    const response = await handler?.(createMessage(RSI_STATUS_IPC_ACTIONS.GET_PANEL, {}));

    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
