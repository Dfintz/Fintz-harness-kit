import type { Client } from 'discord.js';

import { OrganizationMembership } from '../../models/OrganizationMembership';
import { RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';
import { rsiRoleMutationAuthorizationService } from '../../services/external/RsiRoleMutationAuthorizationService';
import { BotIPCService, type IPCHandler, type IPCMessage } from '../BotIPCService';
import { buildSignedRoleIpcPayload, clearRoleIpcReplayCacheForTests } from '../roleIpcAuth';
import {
  initializeRoleIpcHandler,
  ROLE_ASSIGN_ACTION,
  ROLE_REMOVE_ACTION,
} from '../roleIpcHandler';

const assignRoleMock = jest.fn<Promise<string>, [string, string, string]>();
const removeRoleMock = jest.fn<Promise<string>, [string, string, string]>();
const getRepositoryMock = jest.fn();

const scheduleRepo = { createQueryBuilder: jest.fn() };
const roleMappingRepo = { exist: jest.fn() };
const userLinkRepo = { createQueryBuilder: jest.fn() };
const membershipRepo = { exist: jest.fn() };

let currentSchedule: {
  organizationId: string;
  guildId?: string;
  affiliateRoleId?: string;
};
let currentUserLink: {
  userId: string;
  verifiedAt: Date;
  syncStatus: SyncStatus;
};

const ORIGINAL_ROLE_IPC_SECRET = process.env.BOT_IPC_ROLE_SIGNING_SECRET;

jest.mock('../../data-source', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: (...args: unknown[]) => getRepositoryMock(...args),
  },
}));

jest.mock('../../services/discord/DiscordService', () => ({
  getDiscordService: () => ({
    assignRole: assignRoleMock,
    removeRole: removeRoleMock,
  }),
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

function createMessage(action: string, data: Record<string, unknown>): IPCMessage {
  return {
    correlationId: 'corr-1',
    action,
    data,
    timestamp: Date.now(),
  };
}

function createSignedMessage(
  action: string,
  overrides?: Partial<
    Parameters<typeof buildSignedRoleIpcPayload>[1] & {
      issuedAt: number;
      signature: string;
    }
  >
): IPCMessage {
  const issuedAt = overrides?.issuedAt ?? Date.now();
  const payload = buildSignedRoleIpcPayload(
    action,
    {
      organizationId: overrides?.organizationId ?? 'org-1',
      guildId: overrides?.guildId ?? 'guild-1',
      userId: overrides?.userId ?? 'discord-1',
      roleId: overrides?.roleId ?? 'role-1',
    },
    issuedAt
  );

  const mergedPayload = {
    ...payload,
    ...overrides,
  };

  return createMessage(action, mergedPayload);
}

describe('roleIpcHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BOT_IPC_ROLE_SIGNING_SECRET = 'test-role-ipc-secret';
    clearRoleIpcReplayCacheForTests();
    rsiRoleMutationAuthorizationService.clearCachesForTests();

    currentSchedule = {
      organizationId: 'org-1',
      guildId: 'guild-1',
      affiliateRoleId: 'affiliate-role',
    };
    currentUserLink = {
      userId: 'platform-user-1',
      verifiedAt: new Date(),
      syncStatus: SyncStatus.SYNCED,
    };

    scheduleRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(async () => currentSchedule),
    });

    userLinkRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(async () => currentUserLink),
    });

    getRepositoryMock.mockImplementation(entity => {
      if (entity === RsiSyncSchedule) {
        return scheduleRepo;
      }
      if (entity === RsiRoleMapping) {
        return roleMappingRepo;
      }
      if (entity === RsiUserLink) {
        return userLinkRepo;
      }
      if (entity === OrganizationMembership) {
        return membershipRepo;
      }
      throw new Error(`Unexpected repository: ${String((entity as { name?: string }).name)}`);
    });

    roleMappingRepo.exist.mockResolvedValue(true);
    membershipRepo.exist.mockResolvedValue(true);

    assignRoleMock.mockResolvedValue('assigned');
    removeRoleMock.mockResolvedValue('removed');
  });

  afterAll(() => {
    process.env.BOT_IPC_ROLE_SIGNING_SECRET = ORIGINAL_ROLE_IPC_SECRET;
  });

  it('returns non-definitive not_handled when shard does not own guild for assign', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild(null));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const response = await handler?.(createSignedMessage(ROLE_ASSIGN_ACTION));

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'not_handled',
        definitive: false,
      })
    );
    expect(assignRoleMock).not.toHaveBeenCalled();
  });

  it('returns definitive handled response when assign is processed on owning shard', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const response = await handler?.(createSignedMessage(ROLE_ASSIGN_ACTION));

    expect(assignRoleMock).toHaveBeenCalledWith('guild-1', 'discord-1', 'role-1');
    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'handled',
        definitive: true,
      })
    );
  });

  it('marks payload validation failures as definitive handled errors', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const response = await handler?.(createMessage(ROLE_ASSIGN_ACTION, { guildId: 'guild-1' }));

    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
  });

  it('rejects forged signatures for role assignment payloads', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const response = await handler?.(
      createSignedMessage(ROLE_ASSIGN_ACTION, {
        signature: 'a'.repeat(64),
      })
    );

    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
    expect(response?.error).toMatch(/signature/i);
    expect(assignRoleMock).not.toHaveBeenCalled();
  });

  it('rejects expired role assignment payload timestamps', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const response = await handler?.(
      createSignedMessage(ROLE_ASSIGN_ACTION, {
        issuedAt: Date.now() - 6 * 60 * 1000,
      })
    );

    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
    expect(response?.error).toMatch(/expired/i);
    expect(assignRoleMock).not.toHaveBeenCalled();
  });

  it('rejects replayed signed role assignment payloads', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const message = createSignedMessage(ROLE_ASSIGN_ACTION);

    const firstResponse = await handler?.(message);
    const replayResponse = await handler?.(message);

    expect(firstResponse).toEqual(
      expect.objectContaining({
        success: true,
        status: 'handled',
        definitive: true,
      })
    );
    expect(replayResponse).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
    expect(replayResponse?.error).toMatch(/replay/i);
    expect(assignRoleMock).toHaveBeenCalledTimes(1);
  });

  it('rejects role mutations when role is not allowed for organization', async () => {
    roleMappingRepo.exist.mockResolvedValue(false);
    currentSchedule = {
      organizationId: 'org-1',
      guildId: 'guild-1',
      affiliateRoleId: undefined,
    };

    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild('guild-1'));

    const handler = handlers.get(ROLE_ASSIGN_ACTION);
    const response = await handler?.(
      createSignedMessage(ROLE_ASSIGN_ACTION, {
        roleId: 'unmapped-role',
      })
    );

    expect(response).toEqual(
      expect.objectContaining({
        success: false,
        status: 'handled',
        definitive: true,
      })
    );
    expect(response?.error).toMatch(/not allowed/i);
    expect(assignRoleMock).not.toHaveBeenCalled();
  });

  it('returns non-definitive not_handled when shard does not own guild for remove', async () => {
    const { ipcService, handlers } = createIpcHarness();
    initializeRoleIpcHandler(ipcService, createClientWithGuild(null));

    const handler = handlers.get(ROLE_REMOVE_ACTION);
    const response = await handler?.(createSignedMessage(ROLE_REMOVE_ACTION));

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        status: 'not_handled',
        definitive: false,
      })
    );
    expect(removeRoleMock).not.toHaveBeenCalled();
  });
});
