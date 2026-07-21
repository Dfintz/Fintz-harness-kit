jest.mock('../../../services/discord/GuildOrganizationService');
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { GuildOrganizationService } from '../../../services/discord/GuildOrganizationService';
const mock = { resolveOrganization: jest.fn().mockResolvedValue('org-123') };
(GuildOrganizationService.getInstance as jest.Mock).mockReturnValue(mock);
import { wiki } from '../../commands/wiki';
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
describe('Wiki Command', () => {
  beforeEach(() => jest.clearAllMocks());
  it('has correct metadata', () => {
    expect(wiki.data.name).toBe('wiki');
    expect(wiki.guildOnly).toBe(true);
  });
  it('defines execute and handleButton', () => {
    expect(typeof wiki.execute).toBe('function');
    expect(typeof wiki.handleButton).toBe('function');
  });
  it('shows panel on execute', async () => {
    const i = mi();
    await wiki.execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
