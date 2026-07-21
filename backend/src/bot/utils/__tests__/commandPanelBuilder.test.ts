// Unit tests for the CMD-06 panel breadcrumb/back primitives in commandPanelBuilder.

import { ButtonInteraction, ButtonStyle } from 'discord.js';

import {
  buildEphemeralPanelEmbed,
  buildPanelBackButton,
  decorateSubpanel,
  formatPanelBreadcrumb,
  stripLeadingPanelEmoji,
  updateEphemeralPanel,
  type EphemeralPanelContent,
} from '../commandPanelBuilder';

describe('formatPanelBreadcrumb', () => {
  it('joins the trail with the compass icon and separator', () => {
    expect(formatPanelBreadcrumb(['Org Hub', 'Activities'])).toBe('🧭 Org Hub › Activities');
  });

  it('drops blank segments', () => {
    expect(formatPanelBreadcrumb(['Org Hub', '  ', '', 'Fleet'])).toBe('🧭 Org Hub › Fleet');
  });

  it('renders a single segment without a separator', () => {
    expect(formatPanelBreadcrumb(['Org Hub'])).toBe('🧭 Org Hub');
  });
});

describe('buildPanelBackButton', () => {
  it('builds a secondary back button with the given customId', () => {
    const button = buildPanelBackButton('org_panel_back');
    expect(button.data).toEqual(
      expect.objectContaining({
        custom_id: 'org_panel_back',
        label: 'Back',
        style: ButtonStyle.Secondary,
      })
    );
  });

  it('accepts a custom label', () => {
    const button = buildPanelBackButton('org_panel_back', 'Back to Hub');
    expect((button.data as { label?: string }).label).toBe('Back to Hub');
  });
});

describe('stripLeadingPanelEmoji', () => {
  it('strips a leading emoji and space from a panel title', () => {
    expect(stripLeadingPanelEmoji('🚀 User Hangar')).toBe('User Hangar');
    expect(stripLeadingPanelEmoji('📅 Activities')).toBe('Activities');
  });

  it('strips emoji with a variation selector', () => {
    expect(stripLeadingPanelEmoji('🛰️ RSI Status')).toBe('RSI Status');
  });

  it('passes through an emoji-less title unchanged', () => {
    expect(stripLeadingPanelEmoji('Activities')).toBe('Activities');
  });
});

describe('decorateSubpanel', () => {
  const base: EphemeralPanelContent = { title: '📅 Activities', description: 'Pick an action.' };

  function customIds(content: EphemeralPanelContent): string[] {
    return (content.rows ?? []).flatMap(row =>
      row.components.map(component => (component.data as { custom_id?: string }).custom_id ?? '')
    );
  }

  it('sets the breadcrumb and appends a Back button row', () => {
    const decorated = decorateSubpanel(base, {
      breadcrumb: ['Org Hub', 'Activities'],
      backCustomId: 'org_panel_back',
    });

    expect(decorated.breadcrumb).toEqual(['Org Hub', 'Activities']);
    expect(customIds(decorated)).toContain('org_panel_back');
  });

  it('preserves existing rows and appends Back last', () => {
    const { buildButton, buildRow } =
      jest.requireActual<typeof import('../commandPanelBuilder')>('../commandPanelBuilder');
    const existing = buildRow(buildButton('event_panel_list', 'List', '📋'));

    const decorated = decorateSubpanel(
      { ...base, rows: [existing] },
      { breadcrumb: ['Org Hub', 'Activities'], backCustomId: 'org_panel_back' }
    );

    const ids = customIds(decorated);
    expect(ids[0]).toBe('event_panel_list');
    expect(ids[ids.length - 1]).toBe('org_panel_back');
  });
});

describe('buildEphemeralPanelEmbed', () => {
  const base: EphemeralPanelContent = { title: '📅 Activities', description: 'Pick an action.' };

  it('renders the breadcrumb as the embed author when provided', () => {
    const embed = buildEphemeralPanelEmbed({ ...base, breadcrumb: ['Org Hub', 'Activities'] });
    expect(embed.data.author?.name).toBe('🧭 Org Hub › Activities');
  });

  it('omits the author line when no breadcrumb is provided', () => {
    const embed = buildEphemeralPanelEmbed(base);
    expect(embed.data.author).toBeUndefined();
  });

  it('omits the author line for an empty breadcrumb', () => {
    const embed = buildEphemeralPanelEmbed({ ...base, breadcrumb: [] });
    expect(embed.data.author).toBeUndefined();
  });
});

describe('updateEphemeralPanel', () => {
  function createButtonInteraction() {
    return { update: jest.fn().mockResolvedValue(undefined) };
  }

  it('updates the message in place with the panel embed and rows', async () => {
    const interaction = createButtonInteraction();

    await updateEphemeralPanel(interaction as unknown as ButtonInteraction, {
      title: '📅 Activities',
      description: 'Pick an action.',
      breadcrumb: ['Org Hub', 'Activities'],
      rows: [],
    });

    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0] as {
      embeds: unknown[];
      components: unknown[];
    };
    expect(payload.embeds).toHaveLength(1);
    // components is always present (empty here) so stale buttons are cleared.
    expect(payload.components).toEqual([]);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
