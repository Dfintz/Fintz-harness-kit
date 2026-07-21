import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags } from 'discord.js';

import { federation } from '../commands/federation';

type ReplyPayload = {
  components?: unknown[];
  flags?: number;
  content?: string;
};

type MockChatInteraction = {
  guildId: string;
  reply: jest.Mock<Promise<void>, [unknown]>;
};

type MockButtonInteraction = {
  customId: string;
  guildId: string;
  reply: jest.Mock<Promise<void>, [unknown]>;
  update: jest.Mock<Promise<void>, [unknown]>;
};

function createChatInteraction(): MockChatInteraction {
  return {
    guildId: 'guild-1',
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

function createButtonInteraction(customId: string): MockButtonInteraction {
  return {
    customId,
    guildId: 'guild-1',
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

function extractEmbedAuthor(payload: unknown): string {
  const embeds = (payload as { embeds?: unknown[] }).embeds;
  if (!Array.isArray(embeds) || embeds.length === 0) {
    return '';
  }

  const embed = embeds[0] as { data?: { author?: { name?: string } } };
  return embed.data?.author?.name ?? '';
}

describe('federation command hub', () => {
  it('exposes requested root panel ids', async () => {
    const interaction = createChatInteraction();

    await federation.execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'federation_panel_status',
        'federation_panel_governance',
        'federation_panel_members',
        'federation_panel_intel',
        'federation_panel_teams',
        'federation_panel_announcements',
        'federation_panel_polls',
        'federation_panel_applications',
        'federation_panel_discord_settings',
        'federation_panel_sync_roles',
        'federation_panel_wiki',
        'federation_panel_conflicts',
        'federation_panel_treaties',
        'federation_panel_unlink',
      ])
    );
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it('opens governance subpanel', async () => {
    const interaction = createButtonInteraction('federation_panel_governance');

    await federation.handleButton?.(interaction as unknown as ButtonInteraction);

    // Subpanels open in place (CMD-06), not as a new reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    expect(customIds).toEqual(
      expect.arrayContaining([
        'federation_panel_polls',
        'federation_panel_treaties',
        'federation_panel_conflicts',
        'federation_panel_status',
      ])
    );
    // Breadcrumb trail + Back button for in-place navigation.
    expect(customIds).toContain('federation_panel_back');
    expect(extractEmbedAuthor(payload)).toBe('🧭 Federation › Governance');
  });

  it('opens poll handoff subpanel', async () => {
    const interaction = createButtonInteraction('federation_panel_polls');

    await federation.handleButton?.(interaction as unknown as ButtonInteraction);

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
        'federation_panel_back',
      ])
    );
  });

  it('returns to the root panel in place when Back is clicked', async () => {
    const interaction = createButtonInteraction('federation_panel_back');

    await federation.handleButton?.(interaction as unknown as ButtonInteraction);

    // Back steps up in place (CMD-06) — no new reply.
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as ReplyPayload;
    const customIds = extractCustomIds(payload);

    // The root panel category buttons are restored.
    expect(customIds).toEqual(
      expect.arrayContaining([
        'federation_panel_status',
        'federation_panel_governance',
        'federation_panel_unlink',
      ])
    );
    // The root panel has no Back button (it is the top of the hierarchy).
    expect(customIds).not.toContain('federation_panel_back');
  });

  it('replies with refresh guidance for stale federation panel actions', async () => {
    const interaction = createButtonInteraction('federation_legacy_action');

    await federation.handleButton?.(interaction as unknown as ButtonInteraction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Run `/federation` again to refresh'),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
