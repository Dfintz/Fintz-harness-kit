import { ButtonStyle, MessageFlags } from 'discord.js';

const mockGetActivityById = jest.fn();

// ActivityService / ActivityParticipantService are lazily constructed inside
// eventButtons.ts; mock the module so importing it never touches the database.
jest.mock('../../../services/activity', () => ({
  ActivityService: jest.fn().mockImplementation(() => ({
    getActivityById: (...args: unknown[]) => mockGetActivityById(...args),
  })),
  ActivityParticipantService: jest.fn().mockImplementation(() => ({
    getParticipants: jest.fn().mockResolvedValue([]),
  })),
}));

import { handleEventButton } from '../eventButtons';

/** Minimal ButtonInteraction stub exposing the members the cancel routes touch. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Pilot' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

/** Extract the rendered button components from a captured reply payload. */
function buttonsFromReply(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

describe('event cancellation — confirm by default (C2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a confirmation prompt instead of cancelling on the first "Cancel Event" click', async () => {
    const interaction = createButtonInteraction('event_cancel_act-123');

    await handleEventButton(interaction as never);

    // It must NOT defer/cancel immediately — only present the prompt.
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const [confirm, cancel] = buttonsFromReply(payload);
    // Confirm/cancel customIds keep the `event_` routing prefix so the follow-up
    // clicks dispatch back through the router to the right handlers.
    expect(confirm.custom_id).toBe('event_confirmcancel_act-123');
    expect(confirm.style).toBe(ButtonStyle.Danger);
    expect(cancel.custom_id).toBe('event_canceldismiss_act-123');
    expect(cancel.style).toBe(ButtonStyle.Secondary);
  });

  it('dismisses without cancelling when the user clicks "Keep Event"', async () => {
    const interaction = createButtonInteraction('event_canceldismiss_act-123');

    await handleEventButton(interaction as never);

    // Dismiss must not run the real cancellation.
    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(String(payload.content)).toContain('Cancelled');
  });

  it('routes the confirm click to the real cancellation handler', async () => {
    // Null activity → handler defers then short-circuits with "no longer exists".
    mockGetActivityById.mockResolvedValueOnce(null);
    const interaction = createButtonInteraction('event_confirmcancel_act-123');

    await handleEventButton(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockGetActivityById).toHaveBeenCalledWith('act-123');
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
