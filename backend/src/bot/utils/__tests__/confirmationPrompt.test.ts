import { ButtonInteraction, ButtonStyle, MessageFlags } from 'discord.js';

import {
  buildConfirmationPrompt,
  CONFIRMATION_CANCELLED_MESSAGE,
  confirmationQuestion,
  respondConfirmationCancelled,
} from '../confirmationPrompt';

/** Minimal ButtonInteraction stub exposing only the members the responder uses. */
function createButtonInteraction(
  overrides: Partial<{ replied: boolean; deferred: boolean }> = {}
): ButtonInteraction & { reply: jest.Mock; followUp: jest.Mock } {
  return {
    replied: overrides.replied ?? false,
    deferred: overrides.deferred ?? false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
  } as unknown as ButtonInteraction & { reply: jest.Mock; followUp: jest.Mock };
}

describe('confirmationQuestion', () => {
  it('renders the uniform confirm copy from a verb phrase', () => {
    expect(confirmationQuestion('cancel this event')).toBe(
      "⚠️ Are you sure you want to cancel this event? **This can't be undone.**"
    );
  });
});

describe('buildConfirmationPrompt', () => {
  it('builds an ephemeral payload with Danger confirm + Secondary cancel buttons', () => {
    const payload = buildConfirmationPrompt({
      confirmCustomId: 'event_confirmcancel_act-1',
      cancelCustomId: 'event_canceldismiss_act-1',
      message: 'cancel this event',
    });

    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.content).toBe(
      "⚠️ Are you sure you want to cancel this event? **This can't be undone.**"
    );

    const row = payload.components?.[0] as {
      toJSON: () => { components: Array<Record<string, unknown>> };
    };
    const { components } = row.toJSON();
    expect(components).toHaveLength(2);

    const [confirm, cancel] = components;
    expect(confirm.custom_id).toBe('event_confirmcancel_act-1');
    expect(confirm.style).toBe(ButtonStyle.Danger);
    expect(confirm.label).toBe('Confirm');

    expect(cancel.custom_id).toBe('event_canceldismiss_act-1');
    expect(cancel.style).toBe(ButtonStyle.Secondary);
    expect(cancel.label).toBe('Cancel');
  });

  it('honors custom labels, emojis, and a full content override', () => {
    const payload = buildConfirmationPrompt({
      confirmCustomId: 'event_confirmcancel_act-2',
      cancelCustomId: 'event_canceldismiss_act-2',
      message: 'ignored when content is set',
      confirmLabel: 'Cancel Event',
      cancelLabel: 'Keep Event',
      confirmEmoji: '🛑',
      cancelEmoji: '↩️',
      content: '⚠️ Custom prompt copy.',
    });

    expect(payload.content).toBe('⚠️ Custom prompt copy.');

    const row = payload.components?.[0] as {
      toJSON: () => { components: Array<Record<string, unknown>> };
    };
    const [confirm, cancel] = row.toJSON().components;
    expect(confirm.label).toBe('Cancel Event');
    expect((confirm.emoji as { name: string }).name).toBe('🛑');
    expect(cancel.label).toBe('Keep Event');
    expect((cancel.emoji as { name: string }).name).toBe('↩️');
  });
});

describe('respondConfirmationCancelled', () => {
  it('replies ephemerally with the uniform message when not yet answered', async () => {
    const interaction = createButtonInteraction({ replied: false, deferred: false });

    await respondConfirmationCancelled(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: CONFIRMATION_CANCELLED_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('uses followUp when the interaction was already replied or deferred', async () => {
    const interaction = createButtonInteraction({ replied: true });

    await respondConfirmationCancelled(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: CONFIRMATION_CANCELLED_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('accepts a custom dismiss message', async () => {
    const interaction = createButtonInteraction();

    await respondConfirmationCancelled(interaction, '❎ Event kept.');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: '❎ Event kept.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('never throws when the response fails (best-effort)', async () => {
    const interaction = createButtonInteraction();
    interaction.reply.mockRejectedValueOnce(new Error('Unknown interaction'));

    await expect(respondConfirmationCancelled(interaction)).resolves.toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
