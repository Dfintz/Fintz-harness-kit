import type { ReactionRolePanel } from '../../../services/discord/ReactionRoleService';
import { buildReactionRolePanelsListEmbed } from '../rolesEmbeds';

function makePanel(overrides: Partial<ReactionRolePanel> = {}): ReactionRolePanel {
  return {
    id: 'rr_1',
    guildId: 'guild_1',
    channelId: 'channel_1',
    messageId: 'message_1',
    title: 'Panel One',
    description: 'desc',
    roles: [{ roleId: '123', label: 'Pilot' }],
    exclusive: false,
    createdBy: 'user_1',
    ...overrides,
  };
}

describe('rolesEmbeds', () => {
  it('buildReactionRolePanelsListEmbed preserves list contract fields', () => {
    const embed = buildReactionRolePanelsListEmbed([
      makePanel({ id: 'rr_alpha', title: 'Alpha', exclusive: true }),
      makePanel({ id: 'rr_beta', title: 'Beta', exclusive: false }),
    ]);

    expect(embed.data.color).toBe(0x00d9ff);
    expect(embed.data.title).toBe('🎭 Reaction Role Panels');
    expect(embed.data.description).toBe('2 panel(s) configured');
    expect(embed.data.timestamp).toBeTruthy();
    expect(embed.data.fields).toHaveLength(2);

    expect(embed.data.fields?.[0]?.name).toBe('Alpha');
    expect(embed.data.fields?.[0]?.value).toContain('Mode: Exclusive');
    expect(embed.data.fields?.[0]?.value).toContain('Roles: <@&123>');
    expect(embed.data.fields?.[0]?.value).toContain('ID: `rr_alpha`');

    expect(embed.data.fields?.[1]?.name).toBe('Beta');
    expect(embed.data.fields?.[1]?.value).toContain('Mode: Multi-select');
  });

  it('falls back to no roles text when a panel has no roles', () => {
    const embed = buildReactionRolePanelsListEmbed([
      makePanel({ id: 'rr_empty', title: 'Empty Roles', roles: [] }),
    ]);

    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.fields?.[0]?.value).toContain('Roles: No roles added');
  });

  it('truncates listed panels to 10 while keeping total configured count in description', () => {
    const panels = Array.from({ length: 12 }, (_, index) =>
      makePanel({ id: `rr_${index}`, title: `Panel ${index}` })
    );

    const embed = buildReactionRolePanelsListEmbed(panels);

    expect(embed.data.description).toBe('12 panel(s) configured');
    expect(embed.data.fields).toHaveLength(10);
    expect(embed.data.fields?.[9]?.name).toBe('Panel 9');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
