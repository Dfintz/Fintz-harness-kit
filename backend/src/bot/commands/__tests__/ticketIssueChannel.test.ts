jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: { getSettingsByGuildId: jest.fn() },
}));
jest.mock('../../utils/issueChannel', () => ({
  createIssueChannel: jest.fn(),
  deleteIssueChannel: jest.fn(),
  sanitizeChannelName: jest.fn((s: string) => s),
}));
jest.mock('../../../utils/redis', () => ({
  redisClient: { getClient: jest.fn() },
}));
jest.mock('../../utils/botApiClient', () => ({
  botApiClient: { get: jest.fn() },
}));

import type { DiscordGuildSettings } from '../../../models/DiscordGuildSettings';
import { discordSettingsService } from '../../../services/discord/DiscordSettingsService';
import { redisClient } from '../../../utils/redis';
import { botApiClient } from '../../utils/botApiClient';
import { createIssueChannel, deleteIssueChannel } from '../../utils/issueChannel';
import {
  closeTicketChannel,
  openTicketChannel,
  resolveTicketChannelConfig,
} from '../ticketIssueChannel';

const mockedGetSettings = discordSettingsService.getSettingsByGuildId as jest.Mock;
const mockedCreate = createIssueChannel as jest.Mock;
const mockedDelete = deleteIssueChannel as jest.Mock;
const mockedGetClient = redisClient.getClient as jest.Mock;
const mockedBotApiGet = botApiClient.get as jest.Mock;

function row(ts: Record<string, unknown> | undefined): DiscordGuildSettings {
  return { ticketSettings: ts } as unknown as DiscordGuildSettings;
}

const fullyConfigured = {
  ticketChannelEnabled: true,
  ticketChannelCategoryId: 'cat-1',
  supportRoleId: 'role-1',
};

// ── resolveTicketChannelConfig (org safety) ─────────────────────────────

describe('resolveTicketChannelConfig (org safety)', () => {
  it('returns null for empty / nullish settings', () => {
    expect(resolveTicketChannelConfig([])).toBeNull();
    expect(resolveTicketChannelConfig(null)).toBeNull();
    expect(resolveTicketChannelConfig(undefined)).toBeNull();
  });

  it('returns config for exactly one fully-configured row', () => {
    expect(resolveTicketChannelConfig([row(fullyConfigured)])).toEqual({
      categoryId: 'cat-1',
      roleId: 'role-1',
      transcriptChannelId: undefined,
      channelNameTemplate: undefined,
    });
  });

  it('falls back to legacy enabled/defaultCategoryId fields', () => {
    expect(
      resolveTicketChannelConfig([
        row({ enabled: true, defaultCategoryId: 'cat-legacy', supportRoleId: 'role-1' }),
      ])
    ).toEqual({
      categoryId: 'cat-legacy',
      roleId: 'role-1',
      transcriptChannelId: undefined,
      channelNameTemplate: undefined,
    });
  });

  it('prefers canonical ticketChannelCategoryId over legacy defaultCategoryId', () => {
    expect(
      resolveTicketChannelConfig([
        row({
          enabled: true,
          defaultCategoryId: 'cat-legacy',
          ticketChannelEnabled: true,
          ticketChannelCategoryId: 'cat-canonical',
          supportRoleId: 'role-1',
        }),
      ])
    ).toEqual({
      categoryId: 'cat-canonical',
      roleId: 'role-1',
      transcriptChannelId: undefined,
      channelNameTemplate: undefined,
    });
  });

  it('includes transcriptChannelId and channelNameTemplate when present', () => {
    const result = resolveTicketChannelConfig([
      row({ ...fullyConfigured, transcriptChannelId: 'tc-1', channelNameTemplate: 'tkt-{number}' }),
    ]);
    expect(result).toEqual({
      categoryId: 'cat-1',
      roleId: 'role-1',
      transcriptChannelId: 'tc-1',
      channelNameTemplate: 'tkt-{number}',
    });
  });

  it('ignores a row missing ticketChannelCategoryId', () => {
    expect(
      resolveTicketChannelConfig([row({ ticketChannelEnabled: true, supportRoleId: 'role-1' })])
    ).toBeNull();
  });

  it('ignores a row missing supportRoleId', () => {
    expect(
      resolveTicketChannelConfig([
        row({ ticketChannelEnabled: true, ticketChannelCategoryId: 'cat-1' }),
      ])
    ).toBeNull();
  });

  it('ignores a disabled row (ticketChannelEnabled: false)', () => {
    expect(
      resolveTicketChannelConfig([row({ ...fullyConfigured, ticketChannelEnabled: false })])
    ).toBeNull();
  });

  it('fails safe (null) when multiple rows are configured (multi-org guild)', () => {
    expect(
      resolveTicketChannelConfig([
        row(fullyConfigured),
        row({ ...fullyConfigured, ticketChannelCategoryId: 'cat-2', supportRoleId: 'role-2' }),
      ])
    ).toBeNull();
  });

  it('picks the only configured row even when other rows are unconfigured', () => {
    expect(
      resolveTicketChannelConfig([row(undefined), row(fullyConfigured), row({})])
    ).toMatchObject({ categoryId: 'cat-1', roleId: 'role-1' });
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────

function makeGuild(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'guild-1',
    channels: {
      cache: { find: jest.fn().mockReturnValue(undefined) },
      fetch: jest.fn().mockResolvedValue({ find: jest.fn().mockReturnValue(undefined) }),
    },
    members: { fetch: jest.fn().mockRejectedValue(new Error('no member')), me: null },
    roles: { cache: { get: jest.fn().mockReturnValue(null) } },
    ...overrides,
  };
}

const enabledRows = [
  {
    ticketSettings: {
      ticketChannelEnabled: true,
      ticketChannelCategoryId: 'cat-1',
      supportRoleId: 'role-1',
    },
  },
];

// ── openTicketChannel ────────────────────────────────────────────────────

describe('openTicketChannel', () => {
  let hset: jest.Mock;
  let hget: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    hset = jest.fn().mockResolvedValue(1);
    hget = jest.fn().mockResolvedValue(null);
    mockedGetClient.mockReturnValue({ hset, hget, hdel: jest.fn() });
    mockedGetSettings.mockResolvedValue(enabledRows);
    mockedBotApiGet.mockResolvedValue({
      data: {
        data: {
          ticketNumber: 'T-1',
          subject: 'Subject',
          description: 'Description',
          priority: 'medium',
          status: 'open',
          category: 'hr',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });
  });

  it('creates a private channel and tracks it when configured', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedCreate.mockResolvedValue({ id: 'chan-1', send });
    const guild = makeGuild();

    await openTicketChannel(guild as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr');

    expect(mockedCreate).toHaveBeenCalledWith(
      guild,
      expect.objectContaining({
        initiatorId: 'user-1',
        roleId: 'role-1',
        categoryId: 'cat-1',
      })
    );
    expect(mockedBotApiGet).toHaveBeenCalledWith('/v2/tickets/by-number/T-1', {
      headers: {
        'X-Discord-Guild-Id': 'guild-1',
        'X-Discord-User-Id': 'user-1',
      },
    });
    expect(hset).toHaveBeenCalledWith('tickets:issueChannels', 'ticket-uuid-1', expect.any(String));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('maps lowercase priority/status to expected embed style and labels', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedCreate.mockResolvedValue({ id: 'chan-1', send });

    await openTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr');

    const messagePayload = send.mock.calls[0][0] as {
      embeds: Array<{
        color: number;
        fields: Array<{ name: string; value: string }>;
      }>;
    };
    expect(messagePayload.embeds[0].color).toBe(0x00d9ff);
    const priorityField = messagePayload.embeds[0].fields.find(field => field.name === 'Priority');
    const statusField = messagePayload.embeds[0].fields.find(field => field.name === 'Status');
    expect(priorityField?.value).toBe('🟡 MEDIUM');
    expect(statusField?.value).toBe('`OPEN`');
  });

  it('uses hint subject/description in fallback embed when details lookup fails', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedCreate.mockResolvedValue({ id: 'chan-1', send });
    mockedBotApiGet.mockRejectedValueOnce(new Error('lookup failed'));

    await openTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr', {
      subject: 'Cannot access fleet dashboard',
      description: 'Clicking dashboard fails with 403 after login.',
      category: 'hr',
    });

    const payload = send.mock.calls[0][0] as {
      embeds: Array<{ title: string; description: string }>;
    };
    expect(payload.embeds[0].title).toContain('Cannot access fleet dashboard');
    expect(payload.embeds[0].description).toContain('**Category:** HR');
    expect(payload.embeds[0].description).toContain(
      'Clicking dashboard fails with 403 after login.'
    );
  });

  it('does nothing when settings are not configured', async () => {
    mockedGetSettings.mockResolvedValue([]);

    await openTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr');

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(hset).not.toHaveBeenCalled();
  });

  it('does nothing when createIssueChannel returns null (e.g. missing perms)', async () => {
    mockedCreate.mockResolvedValue(null);

    await openTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr');

    expect(hset).not.toHaveBeenCalled();
  });

  it('is idempotent — skips if already tracked in Redis', async () => {
    hget.mockResolvedValue(JSON.stringify({ channelId: 'chan-existing', guildId: 'guild-1' }));

    await openTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr');

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('is idempotent — skips when durable topic lookup finds existing channel', async () => {
    const guild = makeGuild({
      channels: {
        cache: { find: jest.fn().mockReturnValue(undefined) },
        fetch: jest
          .fn()
          .mockResolvedValue({ find: jest.fn().mockReturnValue({ id: 'chan-by-topic' }) }),
      },
    });

    await openTicketChannel(guild as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr');

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('does not throw on unexpected errors — wraps and warns', async () => {
    mockedGetSettings.mockRejectedValue(new Error('DB error'));

    await expect(
      openTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1', 'user-1', 'hr')
    ).resolves.toBeUndefined();
  });
});

// ── closeTicketChannel ───────────────────────────────────────────────────

describe('closeTicketChannel', () => {
  let hdel: jest.Mock;
  let hget: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    hdel = jest.fn().mockResolvedValue(1);
    hget = jest.fn().mockResolvedValue(null);
    mockedGetClient.mockReturnValue({ hget, hdel });
  });

  it('deletes the tracked channel and clears Redis', async () => {
    hget.mockResolvedValue(JSON.stringify({ channelId: 'chan-1', guildId: 'guild-1' }));
    const guild = makeGuild();

    await closeTicketChannel(guild as never, 'ticket-uuid-1', 'T-1');

    expect(mockedDelete).toHaveBeenCalledWith(guild, 'chan-1', 'Ticket T-1 closed');
    expect(hdel).toHaveBeenCalledWith('tickets:issueChannels', 'ticket-uuid-1');
  });

  it('clears Redis even when no channel was tracked', async () => {
    await closeTicketChannel(makeGuild() as never, 'ticket-uuid-no-chan', 'T-99');

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(hdel).toHaveBeenCalledWith('tickets:issueChannels', 'ticket-uuid-no-chan');
  });

  it('does not throw on unexpected errors — wraps and warns', async () => {
    hget.mockRejectedValue(new Error('Redis down'));

    await expect(
      closeTicketChannel(makeGuild() as never, 'ticket-uuid-1', 'T-1')
    ).resolves.toBeUndefined();
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
