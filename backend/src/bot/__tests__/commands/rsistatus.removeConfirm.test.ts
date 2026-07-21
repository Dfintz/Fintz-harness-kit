import { ButtonStyle } from 'discord.js';

import { parseRsiStatusChannelAction, rsistatus } from '../../commands/rsistatus';

/** Minimal ButtonInteraction stub for the remove-panel confirm flow. */
function createButtonInteraction(customId: string, overrides: Record<string, unknown> = {}) {
  return {
    customId,
    user: { id: 'user-1', username: 'Admin' },
    guildId: 'guild-1',
    guild: undefined,
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function rowButtons(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

describe('rsistatus remove-panel confirmation (C2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a confirmation prompt instead of removing on the remove button', async () => {
    const interaction = createButtonInteraction('rsistatus_panel_remove');

    await rsistatus.handleButton?.(interaction as never);

    // Confirm-by-default: a fresh ephemeral prompt, not an immediate removal/defer.
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();

    const payload = interaction.reply.mock.calls[0][0];
    const [confirm, cancel] = rowButtons(payload);
    expect(confirm.custom_id).toBe('rsistatus_confirmremove');
    expect(cancel.custom_id).toBe('rsistatus_removedismiss');
    expect(confirm.style).toBe(ButtonStyle.Danger);
    expect(String(payload.content)).toContain('remove the live RSI status panel');
  });

  it('dismisses without removing on the cancel button', async () => {
    const interaction = createButtonInteraction('rsistatus_removedismiss');

    await rsistatus.handleButton?.(interaction as never);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    const payload = interaction.reply.mock.calls[0][0];
    expect(String(payload.content)).toContain('Cancelled');
  });

  it('routes the confirm button to the real removal handler', async () => {
    // No guild context → handleRemovePanel defers then bails on the guild check,
    // which proves the confirm customId is wired to the removal handler (not dropped).
    const interaction = createButtonInteraction('rsistatus_confirmremove', { guildId: null });

    await rsistatus.handleButton?.(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

// ARCH-09: the panel-button routing migrated onto the shared customId codec must
// preserve the previous permissive `.replace('rsistatus_panel_', '')` + switch
// behaviour — only `rsistatus_panel_<known-action>` ids act; everything else
// (unknown panel action, or a non-panel id) is a silent no-op.
describe('rsistatus panel routing (ARCH-09 codec)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['rsistatus_panel_bogus', 'rsistatus_notpanel', 'rsistatus_panel'])(
    'is a no-op for the unrouted customId %s',
    async customId => {
      const interaction = createButtonInteraction(customId);

      await rsistatus.handleButton?.(interaction as never);

      expect(interaction.reply).not.toHaveBeenCalled();
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.update).not.toHaveBeenCalled();
    }
  );
});

describe('rsistatus channel-action parser helper (C9)', () => {
  it.each([
    ['rsistatus_chan_create', 'create'],
    ['rsistatus_chan_remove', 'remove'],
    ['rsistatus_chan_create_extra', 'create'],
  ])('parses %s as %s', (customId, expected) => {
    expect(parseRsiStatusChannelAction(customId)).toBe(expected);
  });

  it.each(['rsistatus_panel_remove', 'rsistatus_chan', 'rsistatus_chan_unknown'])(
    'returns null for unrouted id %s',
    customId => {
      expect(parseRsiStatusChannelAction(customId)).toBeNull();
    }
  );

afterAll(() => {
  jest.restoreAllMocks();
});
});
