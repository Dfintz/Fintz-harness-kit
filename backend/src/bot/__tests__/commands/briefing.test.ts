jest.mock('../../../services/content/BriefingService');
jest.mock('../../../services/discord/GuildOrganizationService');
// briefing.ts imports the discordSettingsService singleton (constructed at module
// load → touches AppDataSource); mock it so importing the command is side-effect-free.
jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getGuildFeatureFlagOverrides: jest.fn().mockResolvedValue({}),
  },
}));
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { GuildOrganizationService } from '../../../services/discord/GuildOrganizationService';
import { briefing } from '../../commands/briefing';
const mock = { resolveOrganization: jest.fn().mockResolvedValue('org-123') };
(GuildOrganizationService.getInstance as jest.Mock).mockReturnValue(mock);
function mi(o: Record<string, unknown> = {}): ChatInputCommandInteraction {
  return {
    user: { id: 'u1', username: 't' },
    guildId: 'g1',
    deferred: false,
    replied: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    options: {},
    ...o,
  } as unknown as ChatInputCommandInteraction;
}
describe('Briefing Command', () => {
  beforeEach(() => jest.clearAllMocks());
  it('has correct metadata', () => {
    expect(briefing.data.name).toBe('briefing');
    expect(briefing.guildOnly).toBe(true);
  });
  it('defines execute and handleButton', () => {
    expect(typeof briefing.execute).toBe('function');
    expect(typeof briefing.handleButton).toBe('function');
  });
  it('shows panel on execute', async () => {
    const i = mi();
    await briefing.execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
