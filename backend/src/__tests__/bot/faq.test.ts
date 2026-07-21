/**
 * Tests for /faq panel command behavior.
 *
 * Validates panel rendering plus button/modal flows after
 * the migration from slash subcommands to panel interactions.
 */

import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
} from 'discord.js';

import { faq } from '../../bot/commands/faq';
import { botFaqCategories } from '../../bot/data/faqContent';

function createSlashInteraction(
  overrides: Partial<ChatInputCommandInteraction> = {}
): ChatInputCommandInteraction {
  return {
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    options: {},
    ...overrides,
  } as unknown as ChatInputCommandInteraction;
}

function createButtonInteraction(
  customId: string,
  overrides: Partial<ButtonInteraction> = {}
): ButtonInteraction {
  return {
    customId,
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ButtonInteraction;
}

function createModalInteraction(
  customId: string,
  fields: Record<string, string>,
  overrides: Partial<ModalSubmitInteraction> = {}
): ModalSubmitInteraction {
  return {
    customId,
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    fields: {
      getTextInputValue: jest.fn((key: string) => fields[key] ?? ''),
    },
    ...overrides,
  } as unknown as ModalSubmitInteraction;
}

function getCustomIds(payload: unknown): string[] {
  const message = payload as { components?: unknown[] };

  return (message.components ?? []).flatMap(row => {
    const resolvedRow =
      typeof (row as { toJSON?: () => unknown }).toJSON === 'function'
        ? (row as { toJSON: () => { components?: unknown[] } }).toJSON()
        : (row as { components?: unknown[] });

    const components = resolvedRow.components ?? [];

    return components
      .map(component => {
        const resolvedComponent =
          typeof (component as { toJSON?: () => unknown }).toJSON === 'function'
            ? (component as { toJSON: () => { custom_id?: string } }).toJSON()
            : (component as { custom_id?: string; data?: { custom_id?: string } });

        return resolvedComponent.custom_id ?? resolvedComponent.data?.custom_id;
      })
      .filter((id): id is string => typeof id === 'string');
  });
}

describe('/faq panel command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders panel buttons on /faq execute', async () => {
    const interaction = createSlashInteraction();

    await faq.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as {
      flags: number;
      embeds: Array<{ data: { title: string } }>;
    };

    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.embeds[0]?.data?.title).toContain('FAQ');

    const customIds = getCustomIds(payload);
    expect(customIds).toEqual(
      expect.arrayContaining(['faq_panel_list', 'faq_panel_search', 'faq_panel_category'])
    );
  });

  it('handles faq_panel_list button with FAQ overview embed', async () => {
    const interaction = createButtonInteraction('faq_panel_list');

    await faq.handleButton?.(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as {
      flags: number;
      embeds: Array<{ data: { title: string; description: string } }>;
    };

    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.embeds[0]?.data?.title).toContain('FAQ');
    expect(payload.embeds[0]?.data?.description).toContain('categories');
  });

  it('opens search modal from faq_panel_search button', async () => {
    const interaction = createButtonInteraction('faq_panel_search');

    await faq.handleButton?.(interaction);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    const modal = interaction.showModal.mock.calls[0][0] as { data?: { custom_id?: string } };
    expect(modal.data?.custom_id).toBe('faq_search_modal');
  });

  it('opens category modal from faq_panel_category button', async () => {
    const interaction = createButtonInteraction('faq_panel_category');

    await faq.handleButton?.(interaction);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    const modal = interaction.showModal.mock.calls[0][0] as { data?: { custom_id?: string } };
    expect(modal.data?.custom_id).toBe('faq_category_modal');
  });

  it('returns no-results embed for unmatched faq_search_modal query', async () => {
    const interaction = createModalInteraction('faq_search_modal', {
      query: 'xyznonexistent123',
    });

    await faq.handleModal?.(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as {
      flags: number;
      embeds: Array<{ data: { title: string } }>;
    };

    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.embeds[0]?.data?.title).toContain('No Results');
  });

  it('limits faq_search_modal results to at most five fields', async () => {
    const interaction = createModalInteraction('faq_search_modal', {
      query: 'a',
    });

    await faq.handleModal?.(interaction);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ data: { fields?: unknown[] } }>;
    };
    const fields = payload.embeds[0]?.data?.fields ?? [];
    expect(fields.length).toBeLessThanOrEqual(5);
  });

  it('returns category embed for valid faq_category_modal input', async () => {
    const interaction = createModalInteraction('faq_category_modal', {
      name: 'getting-started',
    });

    await faq.handleModal?.(interaction);

    const payload = interaction.reply.mock.calls[0][0] as {
      flags: number;
      embeds: Array<{ data: { title: string } }>;
    };

    const category = botFaqCategories.find(item => item.id === 'getting-started');
    expect(category).toBeDefined();
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.embeds[0]?.data?.title).toContain(category?.title ?? '');
  });

  it('returns validation message for unknown faq category', async () => {
    const interaction = createModalInteraction('faq_category_modal', {
      name: 'nonexistent-category',
    });

    await faq.handleModal?.(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Unknown category'),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
