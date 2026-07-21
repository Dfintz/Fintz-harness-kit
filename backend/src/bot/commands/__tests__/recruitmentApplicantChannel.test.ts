jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: { getSettingsByGuildId: jest.fn() },
}));
jest.mock('../../utils/issueChannel', () => ({
  createIssueChannel: jest.fn(),
  deleteIssueChannel: jest.fn(),
}));
jest.mock('../../../utils/redis', () => ({
  redisClient: { getClient: jest.fn() },
}));

import type { DiscordGuildSettings } from '../../../models/DiscordGuildSettings';
import { discordSettingsService } from '../../../services/discord/DiscordSettingsService';
import { redisClient } from '../../../utils/redis';
import { createIssueChannel, deleteIssueChannel } from '../../utils/issueChannel';
import {
  closeApplicantChannel,
  openApplicantChannel,
  resolveApplicantChannelConfig,
} from '../recruitmentApplicantChannel';

const mockedGetSettings = discordSettingsService.getSettingsByGuildId as jest.Mock;
const mockedCreate = createIssueChannel as jest.Mock;
const mockedDelete = deleteIssueChannel as jest.Mock;
const mockedGetClient = redisClient.getClient as jest.Mock;

function row(rs: Record<string, unknown> | undefined): DiscordGuildSettings {
  return { recruitmentSettings: rs } as unknown as DiscordGuildSettings;
}

const fullyConfigured = {
  applicantChannelEnabled: true,
  applicantChannelCategoryId: 'cat-1',
  staffPingRoleId: 'role-1',
};

describe('resolveApplicantChannelConfig (org safety)', () => {
  it('returns null for empty / nullish settings', () => {
    expect(resolveApplicantChannelConfig([])).toBeNull();
    expect(resolveApplicantChannelConfig(null)).toBeNull();
    expect(resolveApplicantChannelConfig(undefined)).toBeNull();
  });

  it('returns config for exactly one fully-configured row', () => {
    expect(resolveApplicantChannelConfig([row(fullyConfigured)])).toEqual({
      categoryId: 'cat-1',
      roleId: 'role-1',
    });
  });

  it('falls back to pendingRoleId when staffPingRoleId is unset', () => {
    expect(
      resolveApplicantChannelConfig([
        row({
          applicantChannelEnabled: true,
          applicantChannelCategoryId: 'cat-1',
          pendingRoleId: 'role-pending',
        }),
      ])
    ).toEqual({
      categoryId: 'cat-1',
      roleId: 'role-pending',
    });
  });

  it('prefers staffPingRoleId over pendingRoleId and acceptRoleId', () => {
    expect(
      resolveApplicantChannelConfig([
        row({
          applicantChannelEnabled: true,
          applicantChannelCategoryId: 'cat-1',
          staffPingRoleId: 'role-staff',
          pendingRoleId: 'role-pending',
          acceptRoleId: 'role-accepted',
        }),
      ])
    ).toEqual({
      categoryId: 'cat-1',
      roleId: 'role-staff',
    });
  });

  it('ignores a row missing the category', () => {
    expect(
      resolveApplicantChannelConfig([
        row({ applicantChannelEnabled: true, staffPingRoleId: 'role-1' }),
      ])
    ).toBeNull();
  });

  it('ignores a row missing the staff role', () => {
    expect(
      resolveApplicantChannelConfig([
        row({ applicantChannelEnabled: true, applicantChannelCategoryId: 'cat-1' }),
      ])
    ).toBeNull();
  });

  it('does not count a disabled row', () => {
    expect(
      resolveApplicantChannelConfig([row({ ...fullyConfigured, applicantChannelEnabled: false })])
    ).toBeNull();
  });

  it('fails safe (null) when multiple rows are configured (multi-org guild)', () => {
    expect(
      resolveApplicantChannelConfig([
        row(fullyConfigured),
        row({ ...fullyConfigured, applicantChannelCategoryId: 'cat-2', staffPingRoleId: 'role-2' }),
      ])
    ).toBeNull();
  });

  it('picks the only configured row even when other rows are unconfigured', () => {
    expect(resolveApplicantChannelConfig([row(undefined), row(fullyConfigured), row({})])).toEqual({
      categoryId: 'cat-1',
      roleId: 'role-1',
    });
  });
});

function makeGuild() {
  return {
    id: 'guild-1',
    channels: { cache: { find: jest.fn().mockReturnValue(undefined) }, fetch: jest.fn() },
  };
}

function makeInteraction(guild: unknown) {
  return { user: { id: 'user-1' }, guild } as never;
}

const enabledRows = [
  {
    recruitmentSettings: {
      applicantChannelEnabled: true,
      applicantChannelCategoryId: 'cat-1',
      staffPingRoleId: 'role-1',
    },
  },
];

describe('openApplicantChannel', () => {
  let hset: jest.Mock;
  let hget: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    hset = jest.fn().mockResolvedValue(1);
    hget = jest.fn().mockResolvedValue(null);
    mockedGetClient.mockReturnValue({ hset, hget, hdel: jest.fn() });
    mockedGetSettings.mockResolvedValue(enabledRows);
  });

  it('creates a private channel and tracks it when configured', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedCreate.mockResolvedValue({ id: 'chan-1', send });
    const guild = makeGuild();

    await openApplicantChannel(makeInteraction(guild), 'rec-1', { applicationId: 'app-123456' });

    expect(mockedCreate).toHaveBeenCalledWith(
      guild,
      expect.objectContaining({ initiatorId: 'user-1', roleId: 'role-1', categoryId: 'cat-1' })
    );
    expect(hset).toHaveBeenCalledWith(
      'recruitment:applicantChannels',
      'app-123456',
      expect.stringContaining('chan-1')
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@&role-1>',
        embeds: expect.any(Array),
      })
    );
    expect((send.mock.calls[0]?.[0] as { embeds?: unknown[] }).embeds).toHaveLength(1);
  });

  it('skips when the feature is not configured', async () => {
    mockedGetSettings.mockResolvedValue([
      { recruitmentSettings: { applicantChannelEnabled: false } },
    ]);
    await openApplicantChannel(makeInteraction(makeGuild()), 'rec-1', { applicationId: 'app-1' });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('is idempotent when a channel is already tracked', async () => {
    hget.mockResolvedValue(JSON.stringify({ channelId: 'chan-existing', guildId: 'guild-1' }));
    await openApplicantChannel(makeInteraction(makeGuild()), 'rec-1', { applicationId: 'app-1' });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('never throws (non-fatal) when the settings lookup fails', async () => {
    mockedGetSettings.mockRejectedValue(new Error('db down'));
    await expect(
      openApplicantChannel(makeInteraction(makeGuild()), 'rec-1', { applicationId: 'app-1' })
    ).resolves.toBeUndefined();
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe('closeApplicantChannel', () => {
  let hdel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    hdel = jest.fn().mockResolvedValue(1);
    mockedGetClient.mockReturnValue({
      hget: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ channelId: 'chan-1', guildId: 'guild-1' })),
      hdel,
      hset: jest.fn(),
    });
  });

  it('deletes the tracked channel and clears the mapping', async () => {
    const guild = makeGuild();
    await closeApplicantChannel(guild as never, 'app-1', 'Application accepted');
    expect(mockedDelete).toHaveBeenCalledWith(guild, 'chan-1', 'Application accepted');
    expect(hdel).toHaveBeenCalledWith('recruitment:applicantChannels', 'app-1');
  });

  it('is a no-op without a guild', async () => {
    await closeApplicantChannel(null, 'app-1', 'x');
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
