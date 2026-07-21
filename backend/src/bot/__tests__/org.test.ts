const mockGetFleetSnapshot = jest.fn();
const mockBotApiGet = jest.fn();
const mockBotApiPost = jest.fn();
const mockFormatBotApiError = jest.fn();

jest.mock('../../bot/utils/guildContext', () => ({
  resolveGuildContext: jest.fn(),
}));

jest.mock('../../services/fleet/FleetService', () => ({
  FleetService: jest.fn().mockImplementation(() => ({
    getFleetSnapshot: mockGetFleetSnapshot,
  })),
}));

jest.mock('../../bot/utils/botApiClient', () => ({
  botApiClient: {
    get: (...args: unknown[]) => mockBotApiGet(...args),
    post: (...args: unknown[]) => mockBotApiPost(...args),
  },
  discordHeaders: jest.fn().mockReturnValue({
    'X-Discord-User-Id': 'discord-user-1',
    'X-Discord-Guild-Id': 'guild-123',
  }),
}));

jest.mock('../../bot/utils/botErrorFormat', () => ({
  formatBotApiError: (...args: unknown[]) => mockFormatBotApiError(...args),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    isInitialized: false,
    getRepository: jest.fn(),
  },
}));

import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags } from 'discord.js';

import { resolveGuildContext } from '../../bot/utils/guildContext';
import { org } from '../commands/org';

type ReplyPayload = {
  components?: unknown[];
  flags?: number;
};

type MockChatInteraction = {
  reply: jest.Mock<Promise<void>, [unknown]>;
};

type MockButtonInteraction = {
  customId: string;
  guildId: string;
  user: { id: string };
  reply: jest.Mock<Promise<void>, [unknown]>;
  update: jest.Mock<Promise<void>, [unknown]>;
  showModal: jest.Mock<Promise<void>, [unknown]>;
};

type MockModalInteraction = {
  customId: string;
  fields: {
    getTextInputValue: jest.Mock<string, [string]>;
  };
  deferReply: jest.Mock<Promise<void>, [unknown]>;
  editReply: jest.Mock<Promise<void>, [unknown]>;
  user: { id: string };
  guildId: string;
};

function createChatInteraction(): MockChatInteraction {
  return {
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

function createButtonInteraction(customId: string): MockButtonInteraction {
  return {
    customId,
    guildId: 'guild-123',
    user: { id: 'discord-user-1' },
    reply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
  };
}

function createModalInteraction(customId: string, inviteCode: string): MockModalInteraction {
  return {
    customId,
    fields: {
      getTextInputValue: jest.fn().mockReturnValue(inviteCode),
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    user: { id: 'discord-user-1' },
    guildId: 'guild-123',
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

describe('org command hub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveGuildContext as jest.Mock).mockResolvedValue({
      guildId: 'guild-123',
      organizationId: 'org-1',
    });
    mockGetFleetSnapshot.mockResolvedValue({ fleets: [], shipCounts: new Map() });
    mockBotApiGet.mockResolvedValue({ data: { success: true, data: [] } });
    mockBotApiPost.mockResolvedValue({ data: { success: true } });
    mockFormatBotApiError.mockReturnValue('Friendly error');
  });

  it('exposes requested org root panel ids', async () => {
    const interaction = createChatInteraction();

    await org.execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'org_panel_activities',
        'org_panel_missions',
        'org_panel_bounties',
        'org_panel_lfg',
        'org_panel_attendance',
        'org_panel_announcements',
        'org_panel_polls',
        'org_panel_recruitment',
        'org_panel_tickets',
        'org_panel_voice',
        'org_panel_rsi_status',
        'org_panel_guild',
        'org_panel_moderation',
        'org_panel_commlink',
        'org_panel_fleet',
        'org_panel_logistics_web',
        'org_panel_invitations',
      ])
    );
    expect(customIds.some(id => id.startsWith('admin_panel_'))).toBe(false);
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it('opens activities handoff buttons', async () => {
    const interaction = createButtonInteraction('org_panel_activities');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    // Subpanels now open in place (CMD-06), not as a new reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining(['event_panel_list', 'event_panel_create', 'event_panel_my'])
    );
    // Breadcrumb trail + Back button for in-place navigation.
    expect(customIds).toContain('org_panel_back');
    expect(extractEmbedAuthor(payload)).toContain('Org Hub');
    expect(extractEmbedAuthor(payload)).toContain('Activities');
  });

  it('opens poll handoff buttons', async () => {
    const interaction = createButtonInteraction('org_panel_polls');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'poll_panel_create',
        'poll_panel_list',
        'poll_panel_post',
        'poll_panel_results',
        'poll_panel_close',
        'org_panel_back',
      ])
    );
  });

  it('opens guild handoff buttons', async () => {
    const interaction = createButtonInteraction('org_panel_guild');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'guild_panel_status',
        'guild_panel_setup',
        'guild_panel_settings',
        'guild_panel_help_settings',
        'guild_panel_unlink',
        'org_panel_back',
      ])
    );
  });

  it('opens RSI status handoff buttons', async () => {
    const interaction = createButtonInteraction('org_panel_rsi_status');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'rsistatus_panel_check',
        'rsistatus_panel_deploy',
        'rsistatus_panel_channels',
        'rsistatus_panel_remove',
      ])
    );
  });

  it('opens announcement handoff buttons', async () => {
    const interaction = createButtonInteraction('org_panel_announcements');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'announce_panel_create',
        'announce_panel_list',
        'announce_panel_send',
        'announce_panel_schedule',
        'announce_panel_status',
        'org_panel_back',
      ])
    );
  });

  it('opens fleet subpanel buttons', async () => {
    const interaction = createButtonInteraction('org_panel_fleet');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'org_fleet_panel_summary',
        'org_fleet_panel_list',
        'org_fleet_panel_post_public',
        'org_fleet_panel_open_web',
        'org_panel_back',
      ])
    );
  });

  it('opens invitation subpanel and renders current invite code', async () => {
    mockBotApiGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            organizationName: 'Fringe Core',
            inviteCode: 'ABCD1234',
            status: 'approved',
          },
        ],
      },
    });
    const interaction = createButtonInteraction('org_panel_invitations');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(mockBotApiGet).toHaveBeenCalledWith(
      '/v2/users/me/invitations',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);
    const description = extractEmbedDescription(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'org_panel_invite_accept_code',
        'org_panel_invite_decline_code',
        'org_panel_back',
      ])
    );
    expect(description).toContain('ABCD1234');
    expect(description).toContain('Fringe Core');
    expect(description).toContain('ready to use');
  });

  it('shows accept invite code modal from invitation subpanel', async () => {
    const interaction = createButtonInteraction('org_panel_invite_accept_code');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    const modal = interaction.showModal.mock.calls[0][0] as { data?: { custom_id?: string } };
    expect(modal.data?.custom_id).toBe('org_invite_code_modal_accept');
  });

  it('accepts invitation by code from modal submit', async () => {
    const interaction = createModalInteraction('org_invite_code_modal_accept', 'abcd1234');

    await org.handleModal?.(interaction as unknown as import('discord.js').ModalSubmitInteraction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockBotApiPost).toHaveBeenCalledWith(
      '/v2/invitations/code/ABCD1234/accept',
      {},
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('accepted') })
    );
  });

  it('declines invitation by code from modal submit', async () => {
    const interaction = createModalInteraction('org_invite_code_modal_decline', 'ABCD1234');

    await org.handleModal?.(interaction as unknown as import('discord.js').ModalSubmitInteraction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockBotApiPost).toHaveBeenCalledWith(
      '/v2/invitations/code/ABCD1234/decline',
      {},
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('declined') })
    );
  });

  it('rejects invalid invite code format in modal submit', async () => {
    const interaction = createModalInteraction('org_invite_code_modal_accept', 'bad');

    await org.handleModal?.(interaction as unknown as import('discord.js').ModalSubmitInteraction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockBotApiPost).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Invalid invite code format') })
    );
  });

  it('surfaces formatted error when invite code API call fails', async () => {
    mockBotApiPost.mockRejectedValueOnce(new Error('boom'));
    mockFormatBotApiError.mockReturnValueOnce('Readable backend error');
    const interaction = createModalInteraction('org_invite_code_modal_accept', 'ABCD1234');

    await org.handleModal?.(interaction as unknown as import('discord.js').ModalSubmitInteraction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Readable backend error') })
    );
  });

  it('returns to the root panel in place when Back is clicked', async () => {
    const interaction = createButtonInteraction('org_panel_back');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    // Back steps up in place (CMD-06) — no new reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    // The root panel category buttons are restored.
    expect(customIds).toEqual(
      expect.arrayContaining([
        'org_panel_activities',
        'org_panel_fleet',
        'org_panel_rsi_status',
        'org_panel_logistics_web',
      ])
    );
    // The root panel has no Back button (it is the top of the hierarchy).
    expect(customIds).not.toContain('org_panel_back');
  });

  it('replies with refresh guidance for stale org panel actions', async () => {
    const interaction = createButtonInteraction('org_unknown_legacy_action');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Run `/org` again to refresh'),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('shows fleet summary from live org fleet data', async () => {
    const fleets = [
      {
        id: 'fleet-1',
        name: 'Hammerhead Wing',
        status: 'active',
        shipIds: ['ship-1', 'ship-2'],
        publicViewEnabled: true,
      },
      {
        id: 'fleet-2',
        name: 'Prospector Team',
        status: 'reserve',
        shipIds: ['ship-3'],
        visibility: 'private',
      },
    ];
    mockGetFleetSnapshot.mockResolvedValue({
      fleets,
      shipCounts: new Map([
        ['fleet-1', 2],
        ['fleet-2', 1],
      ]),
    });

    const interaction = createButtonInteraction('org_fleet_panel_summary');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(mockGetFleetSnapshot).toHaveBeenCalledWith('org-1');
    // Nested fleet leaf renders in place with a 3-level breadcrumb + Back to fleet.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const description = extractEmbedDescription(payload);
    expect(description).toContain('Fleets: **2**');
    expect(description).toContain('Ships assigned: **3**');
    expect(extractEmbedAuthor(payload)).toBe('🧭 Org Hub › Fleet › Fleet Summary');
    expect(extractCustomIds(payload)).toContain('org_panel_fleet');
  });

  it('shows fleet list preview from live org fleet data', async () => {
    const fleets = [
      {
        id: 'fleet-1',
        name: 'Hammerhead Wing',
        status: 'active',
        shipIds: ['ship-1', 'ship-2'],
      },
      {
        id: 'fleet-2',
        name: 'Prospector Team',
        status: 'reserve',
        shipIds: ['ship-3'],
      },
    ];
    mockGetFleetSnapshot.mockResolvedValue({
      fleets,
      shipCounts: new Map([
        ['fleet-1', 2],
        ['fleet-2', 1],
      ]),
    });

    const interaction = createButtonInteraction('org_fleet_panel_list');

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    // Nested fleet list renders in place with breadcrumb + Back.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const description = extractEmbedDescription(payload);
    expect(description).toContain('2 fleet(s):');
    expect(description).toContain('1. Hammerhead Wing');
    expect(extractEmbedAuthor(payload)).toBe('🧭 Org Hub › Fleet › Fleet List');
    // Single page → no pagination nav row, but the Back button is present.
    expect(extractCustomIds(payload)).toEqual(['org_panel_fleet']);
  });

  it('paginates the fleet list when there are more than one page', async () => {
    const fleets = Array.from({ length: 20 }, (_, i) => ({
      id: `fleet-${i + 1}`,
      name: `Fleet ${i + 1}`,
      status: 'active',
      shipIds: ['ship-a'],
    }));
    mockGetFleetSnapshot.mockResolvedValue({
      fleets,
      shipCounts: new Map(fleets.map(f => [f.id, 1])),
    });

    const interaction = createButtonInteraction('org_fleet_panel_list');
    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const description = extractEmbedDescription(payload);
    // 20 fleets / 8 per page = 3 pages; first page shows fleets 1..8.
    expect(description).toContain('Page 1 of 3 • 20 fleets:');
    expect(description).toContain('1. Fleet 1');
    expect(description).toContain('8. Fleet 8');
    expect(description).not.toContain('9. Fleet 9');

    // Pagination nav row (Prev disabled on page 0 / indicator / Next) + Back row.
    expect(extractCustomIds(payload)).toEqual([
      'org_fleet_listpage_-1',
      'pagination_indicator_noop',
      'org_fleet_listpage_1',
      'org_panel_fleet',
    ]);
  });

  it('updates the fleet list in place when paging to the next page', async () => {
    const fleets = Array.from({ length: 20 }, (_, i) => ({
      id: `fleet-${i + 1}`,
      name: `Fleet ${i + 1}`,
      status: 'active',
      shipIds: ['ship-a'],
    }));
    mockGetFleetSnapshot.mockResolvedValue({
      fleets,
      shipCounts: new Map(fleets.map(f => [f.id, 1])),
    });

    const interaction = createButtonInteraction('org_fleet_listpage_1');
    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    // Pages in place (no new reply).
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);

    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const description = extractEmbedDescription(payload);
    expect(description).toContain('Page 2 of 3 • 20 fleets:');
    expect(description).toContain('9. Fleet 9');
    expect(description).toContain('16. Fleet 16');

    // Both Prev (page 0) and Next (page 2) are live on the middle page, and the
    // breadcrumb's Back button survives paging.
    expect(extractCustomIds(payload)).toEqual([
      'org_fleet_listpage_0',
      'pagination_indicator_noop',
      'org_fleet_listpage_2',
      'org_panel_fleet',
    ]);
  });

  it('posts a public fleet snapshot to channel', async () => {
    const fleets = [
      {
        id: 'fleet-1',
        name: 'Hammerhead Wing',
        status: 'active',
        type: 'combat',
        shipIds: ['ship-1', 'ship-2'],
        publicViewEnabled: true,
      },
    ];
    mockGetFleetSnapshot.mockResolvedValue({
      fleets,
      shipCounts: new Map([['fleet-1', 2]]),
    });

    const send = jest.fn().mockResolvedValue(undefined);
    const interaction = {
      ...createButtonInteraction('org_fleet_panel_post_public'),
      channel: {
        isTextBased: () => true,
        send,
      },
      guild: { name: 'SC Test Org' },
    };

    await org.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      })
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Posted a public fleet snapshot'),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
