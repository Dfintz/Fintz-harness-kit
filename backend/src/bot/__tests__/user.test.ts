const mockGetUserByDiscordId = jest.fn();
const mockGetUserShipSummary = jest.fn();
const mockGetUserShips = jest.fn();
const mockGetShipsNeedingInsurance = jest.fn();

jest.mock('../../data-source', () => ({
  AppDataSource: {
    isInitialized: true,
  },
}));

jest.mock('../../services/user/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    getUserByDiscordId: mockGetUserByDiscordId,
  })),
}));

jest.mock('../../services/ship', () => ({
  UserShipService: jest.fn().mockImplementation(() => ({
    getUserShipSummary: mockGetUserShipSummary,
    getUserShips: mockGetUserShips,
    getShipsNeedingInsurance: mockGetShipsNeedingInsurance,
  })),
}));

import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags } from 'discord.js';

import { AppDataSource } from '../../data-source';
import { user } from '../commands/user';

type ReplyPayload = {
  embeds?: unknown[];
  components?: unknown[];
  flags?: number;
};

type MockChatInteraction = {
  reply: jest.Mock<Promise<void>, [unknown]>;
};

type MockButtonInteraction = {
  customId: string;
  user: { id: string; username: string; displayName: string };
  client: { ws: { ping: number } };
  reply: jest.Mock<Promise<void>, [unknown]>;
  update: jest.Mock<Promise<void>, [unknown]>;
};

function createChatInteraction(): MockChatInteraction {
  return {
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

function createButtonInteraction(customId: string): MockButtonInteraction {
  return {
    customId,
    user: { id: 'discord-123', username: 'TestUser', displayName: 'Test User' },
    client: { ws: { ping: 42 } },
    reply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function resolveCustomId(component: unknown): string | undefined {
  const withData = component as { data?: { custom_id?: unknown }; customId?: unknown };
  if (typeof withData.customId === 'string') {
    return withData.customId;
  }

  const dataId = withData.data?.custom_id;
  if (typeof dataId === 'string') {
    return dataId;
  }

  return undefined;
}

function extractCustomIds(payload: unknown): string[] {
  const ids: string[] = [];
  const components = (payload as ReplyPayload).components;
  if (!Array.isArray(components)) {
    return ids;
  }

  for (const row of components) {
    const rowComponents = (row as { components?: unknown[] }).components;
    if (!Array.isArray(rowComponents)) {
      continue;
    }

    for (const component of rowComponents) {
      const id = resolveCustomId(component);
      if (id) {
        ids.push(id);
      }
    }
  }

  return ids;
}

function extractEmbedDescription(payload: unknown): string {
  const embeds = (payload as { embeds?: unknown[] }).embeds;
  if (!Array.isArray(embeds) || embeds.length === 0) {
    return '';
  }

  const embed = embeds[0] as { description?: string; data?: { description?: string } };
  if (typeof embed.description === 'string') {
    return embed.description;
  }

  return embed.data?.description ?? '';
}

function extractEmbedAuthor(payload: unknown): string {
  const embeds = (payload as { embeds?: unknown[] }).embeds;
  if (!Array.isArray(embeds) || embeds.length === 0) {
    return '';
  }

  const embed = embeds[0] as { data?: { author?: { name?: string } } };
  return embed.data?.author?.name ?? '';
}

describe('user command hub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppDataSource as { isInitialized: boolean }).isInitialized = true;
    mockGetUserByDiscordId.mockResolvedValue({
      id: 'user-1',
      username: 'TestUser',
      displayName: 'Test User',
      activeOrgId: 'org-1',
    });
    mockGetUserShipSummary.mockResolvedValue({
      totalShips: 4,
      byStatus: { owned: 3, loaned: 1 },
      byCondition: { excellent: 2, good: 2 },
      bySharingLevel: { public: 2, organization: 1, private: 1 },
      bySize: { medium: 2, large: 2 },
      byRole: { combat: 2, mining: 2 },
      byCareer: { bounty: 1, industry: 3 },
      byManufacturer: { aegis: 2, misc: 2 },
      totalValue: 510000,
      needsInsurance: 1,
    });
    mockGetUserShips.mockResolvedValue({
      data: [
        {
          shipName: 'Hammerhead',
          customName: 'Hammer Alpha',
          status: 'owned',
          loanedTo: null,
        },
        {
          shipName: 'Prospector',
          customName: '',
          status: 'loaned',
          loanedTo: 'Wingmate',
        },
      ],
      pagination: {
        total: 2,
        page: 1,
        limit: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    mockGetShipsNeedingInsurance.mockResolvedValue([]);
  });

  it('exposes requested root panel ids', async () => {
    const interaction = createChatInteraction();

    await user.execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toContain('user_panel_hangar');
    expect(customIds).toContain('user_panel_verify');
    expect(customIds).toContain('user_panel_notify');
    expect(customIds).toContain('user_panel_scstats');
    expect(customIds).toContain('user_panel_profile');
    expect(customIds).toContain('user_panel_security');
    expect(customIds).toContain('user_panel_privacy');
    expect(customIds).toContain('user_panel_account');
    expect(customIds).toContain('user_panel_help');
    expect(customIds).not.toContain('user_panel_verification');
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it('opens hangar subpanel with requested ids', async () => {
    const interaction = createButtonInteraction('user_panel_hangar');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    // Category subpanels now open in place (CMD-06), not as a new reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'user_hangar_panel_summary',
        'user_hangar_panel_my_ships',
        'user_hangar_panel_insurance',
        'user_hangar_panel_loans',
        'user_hangar_panel_sharing',
        'user_hangar_panel_open_web',
        'user_hangar_panel_post_public',
        'user_hangar_panel_add_ship',
        'user_hangar_panel_update_ship',
        'user_hangar_panel_delete_ship',
      ])
    );
    // Breadcrumb trail + Back button for in-place navigation.
    expect(customIds).toContain('user_panel_back');
    expect(extractEmbedAuthor(payload)).toContain('User Hub');
    expect(extractEmbedAuthor(payload)).toContain('Hangar');
  });

  it('hands off verify actions to verify command buttons', async () => {
    const interaction = createButtonInteraction('user_panel_verify');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'verify_panel_link',
        'verify_panel_check',
        'verify_panel_user',
        'verify_panel_unlink',
        'user_panel_back',
      ])
    );
  });

  it('opens scstats handoff buttons', async () => {
    const interaction = createButtonInteraction('user_panel_scstats');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'stats_panel_me',
        'stats_panel_invites',
        'stats_panel_leaderboard_msg',
        'stats_panel_leaderboard_voice',
        'user_panel_back',
      ])
    );
  });

  it('notify panel surfaces only personal preference actions (no guild controls)', async () => {
    const interaction = createButtonInteraction('user_panel_notify');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'notify_panel_my_status',
        'notify_panel_my_toggle',
        'user_panel_back',
      ])
    );
    // Guild-mutating / guild-status controls must NOT be reachable via the
    // ungated /user hub.
    expect(customIds).not.toContain('notify_panel_dm_toggle');
    expect(customIds).not.toContain('notify_panel_lfg_toggle');
    expect(customIds).not.toContain('notify_panel_lfg_config');
    expect(customIds).not.toContain('notify_panel_lfg_mention');
    expect(customIds).not.toContain('notify_panel_dm_status');
    expect(customIds).not.toContain('notify_panel_lfg_status');
  });

  it('opens help handoff buttons', async () => {
    const interaction = createButtonInteraction('user_panel_help');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'help_panel_wiki',
        'help_panel_faq',
        'help_panel_server_setup',
        'help_panel_more_features',
        'user_panel_back',
      ])
    );
  });

  it('responds to hangar open web action', async () => {
    const interaction = createButtonInteraction('user_hangar_panel_open_web');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    // Nested hangar leaves open in place (CMD-06 nested level), not as a reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    // 3-level breadcrumb + Back to the hangar category.
    expect(extractEmbedAuthor(payload)).toContain('User Hub');
    expect(extractEmbedAuthor(payload)).toContain('Hangar');
    expect(extractCustomIds(payload)).toContain('user_panel_hangar');
  });

  it('supports legacy user_* button ids for verification', async () => {
    const interaction = createButtonInteraction('user_verification');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'verify_panel_link',
        'verify_panel_check',
        'verify_panel_user',
        'verify_panel_unlink',
      ])
    );
  });

  it('returns to the root panel in place when Back is clicked', async () => {
    const interaction = createButtonInteraction('user_panel_back');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    // Back steps up in place (CMD-06) — no new reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    // The root panel category buttons are restored.
    expect(customIds).toEqual(
      expect.arrayContaining(['user_panel_hangar', 'user_panel_verify', 'user_panel_help'])
    );
    // The root panel has no Back button (it is the top of the hierarchy).
    expect(customIds).not.toContain('user_panel_back');
  });

  it('replies with refresh guidance for unknown user panel actions', async () => {
    const interaction = createButtonInteraction('user_unknown_legacy_action');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Run `/user` again to refresh'),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('shows hangar summary from live user ship data', async () => {
    const interaction = createButtonInteraction('user_hangar_panel_summary');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(mockGetUserByDiscordId).toHaveBeenCalledWith('discord-123');
    expect(mockGetUserShipSummary).toHaveBeenCalledWith('org-1', 'user-1');
    // Nested leaf renders in place with a 3-level breadcrumb + Back to hangar.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const description = extractEmbedDescription(payload);
    expect(description).toContain('Total ships: **4**');
    expect(description).toContain('Insurance due (30d): **1**');
    expect(extractEmbedAuthor(payload)).toBe('🧭 User Hub › Hangar › Hangar Summary');
    expect(extractCustomIds(payload)).toContain('user_panel_hangar');
  });

  it('posts hangar snapshot publicly to the current channel', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const interaction = {
      ...createButtonInteraction('user_hangar_panel_post_public'),
      channel: {
        isTextBased: () => true,
        send,
      },
    };

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      })
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Posted your hangar summary publicly'),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('returns temporary unavailable when hangar data source is offline', async () => {
    (AppDataSource as { isInitialized: boolean }).isInitialized = false;
    const interaction = createButtonInteraction('user_hangar_panel_summary');

    await user.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('temporarily unavailable'),
        flags: MessageFlags.Ephemeral,
      })
    );
    expect(mockGetUserByDiscordId).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
