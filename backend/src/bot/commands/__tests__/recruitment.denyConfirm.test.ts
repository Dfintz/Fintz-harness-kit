import { ButtonStyle, MessageFlags } from 'discord.js';

const mockPut = jest.fn().mockResolvedValue({ data: {} });

// recruitment.ts uses botApiClient (aliased to `axios`) for the deny PUT, and
// discordSettingsService for config — mock both so importing the command and
// running the confirm route never touches the network or database.
jest.mock('../../utils/botApiClient', () => ({
  botApiClient: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettingsByGuildId: jest.fn().mockResolvedValue([]),
  },
}));

import { recruitment } from '../recruitment';

const REC_ID = '11111111-1111-1111-1111-111111111111';
const APP_ID = '22222222-2222-2222-2222-222222222222';

/** Minimal ButtonInteraction stub exposing the members the deny routes touch. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Reviewer' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: undefined,
    guild: undefined,
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

describe('recruitment deny — confirm by default (C2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a confirmation prompt instead of denying on the first "Deny" click', async () => {
    const interaction = createButtonInteraction(`recruitment_deny_${REC_ID}_${APP_ID}`);

    await recruitment.handleButton?.(interaction as never);

    // Must NOT defer/deny immediately — only present the prompt.
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const [confirm, cancel] = buttonsFromReply(payload);
    // Confirm/cancel customIds keep the `recruitment_` routing prefix so the
    // follow-up clicks dispatch back through the router to this handler.
    expect(confirm.custom_id).toBe(`recruitment_confirmdeny_${REC_ID}_${APP_ID}`);
    expect(confirm.style).toBe(ButtonStyle.Danger);
    expect(cancel.custom_id).toBe(`recruitment_denydismiss_${REC_ID}_${APP_ID}`);
    expect(cancel.style).toBe(ButtonStyle.Secondary);
  });

  it('dismisses without denying when the user clicks "Keep Pending"', async () => {
    const interaction = createButtonInteraction(`recruitment_denydismiss_${REC_ID}_${APP_ID}`);

    await recruitment.handleButton?.(interaction as never);

    expect(mockPut).not.toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(String(payload.content)).toContain('Cancelled');
  });

  it('routes the confirm click to the real deny handler', async () => {
    const interaction = createButtonInteraction(`recruitment_confirmdeny_${REC_ID}_${APP_ID}`);

    await recruitment.handleButton?.(interaction as never);

    // The confirm route defers (it does not re-show the prompt) and performs the
    // deny via the API with the reject action.
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [url, body] = mockPut.mock.calls[0];
    expect(String(url)).toContain(`/recruitment/${REC_ID}/applications/${APP_ID}`);
    expect(body).toEqual({ action: 'reject' });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
