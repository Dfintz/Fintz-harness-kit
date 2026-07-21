import { StringSelectMenuInteraction } from 'discord.js';

import { LFGActivity } from '../../types';
import { lfg } from '../../bot/commands/lfg';

function createSelectInteraction(customId: string, values: string[]): StringSelectMenuInteraction {
  return {
    customId,
    values,
    user: { id: 'user-1' },
    showModal: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as StringSelectMenuInteraction;
}

function collectCustomIds(node: unknown, result: string[] = []): string[] {
  if (!node || typeof node !== 'object') {
    return result;
  }

  const record = node as Record<string, unknown>;
  const maybeId = record.custom_id;
  if (typeof maybeId === 'string') {
    result.push(maybeId);
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        collectCustomIds(item, result);
      }
    } else if (value && typeof value === 'object') {
      collectCustomIds(value, result);
    }
  }

  return result;
}

describe('lfg modal builder migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens create modal with unchanged custom and field IDs', async () => {
    const interaction = createSelectInteraction('lfg_select_create_activity', [LFGActivity.MINING]);

    await lfg.handleSelectMenu?.(interaction);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    const modal = interaction.showModal.mock.calls[0][0] as { toJSON: () => unknown };
    const payload = modal.toJSON() as Record<string, unknown>;

    expect(payload.custom_id).toBe('lfg_panel_create_modal');
    const allCustomIds = collectCustomIds(payload);
    expect(allCustomIds).toEqual(expect.arrayContaining(['description', 'maxplayers']));
  });
});
