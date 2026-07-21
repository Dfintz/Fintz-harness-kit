// guild.ts constructs the discordSettingsService singleton + other heavy service
// modules at import; mock them so importing the command is side-effect-free and
// the feature-flag accessors are controllable.
const mockResolveOrganization = jest.fn();
const mockGetOverrides = jest.fn();
const mockSetOverride = jest.fn();

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getGuildFeatureFlagOverrides: (...args: unknown[]) => mockGetOverrides(...args),
    setGuildFeatureFlagOverride: (...args: unknown[]) => mockSetOverride(...args),
  },
}));
jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: () => ({
      resolveOrganization: (...args: unknown[]) => mockResolveOrganization(...args),
    }),
  },
}));
jest.mock('../../../services/organization/OrganizationMemberService', () => ({
  OrganizationMemberService: jest.fn(),
}));
jest.mock('../../../services/user/UserService', () => ({ UserService: jest.fn() }));

import { MessageFlags } from 'discord.js';

import { guild } from '../../commands/guild';

const FLAG = 'aiBriefings';

function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'admin-1', username: 'Admin' },
    guildId: 'guild-1',
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function createSelectInteraction(customId: string, values: string[]) {
  return {
    customId,
    values,
    user: { id: 'admin-1', username: 'Admin' },
    guildId: 'guild-1',
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

/** Extract the select-menu component JSON from a reply/editReply payload. */
function selectFromPayload(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Record<string, unknown> | undefined {
  const row = payload.components?.[0];
  return row ? row.toJSON().components[0] : undefined;
}

describe('guild feature-flags admin surface (ARCH-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveOrganization.mockResolvedValue('org-1');
    mockGetOverrides.mockResolvedValue({});
  });

  describe('handleFeatureFlagsPanel (guild_panel_flags)', () => {
    it('renders the flags embed + toggle select with the default-on state', async () => {
      const interaction = createButtonInteraction('guild_panel_flags');

      await guild.handleButton?.(interaction as never);

      expect(mockGetOverrides).toHaveBeenCalledWith('org-1', 'guild-1');
      const payload = interaction.reply.mock.calls[0][0];
      expect(payload.flags).toBe(MessageFlags.Ephemeral);

      const select = selectFromPayload(payload);
      expect(select?.custom_id).toBe('guild_flags_toggle');
      const options = (select?.options ?? []) as Array<Record<string, unknown>>;
      const aiOption = options.find(o => o.value === FLAG);
      expect(aiOption).toBeDefined();
      // Default-on → the toggle would "disable" it.
      expect(String(aiOption?.description)).toContain('select to disable');
    });

    it('refuses when the server is not linked to an organization', async () => {
      mockResolveOrganization.mockResolvedValueOnce(null);
      const interaction = createButtonInteraction('guild_panel_flags');

      await guild.handleButton?.(interaction as never);

      expect(mockGetOverrides).not.toHaveBeenCalled();
      expect(String(interaction.reply.mock.calls[0][0].content)).toContain('must be linked');
    });
  });

  describe('handleFeatureFlagToggle (guild_flags_toggle)', () => {
    it('flips the guild lever and persists the override, then re-renders', async () => {
      // before = {} (default-on) → toggle persists false; after = { aiBriefings: false }.
      mockGetOverrides.mockResolvedValueOnce({}).mockResolvedValueOnce({ [FLAG]: false });
      const interaction = createSelectInteraction('guild_flags_toggle', [FLAG]);

      await guild.handleSelectMenu?.(interaction as never);

      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
      expect(mockSetOverride).toHaveBeenCalledWith('org-1', 'guild-1', FLAG, false, 'admin-1');

      const payload = interaction.editReply.mock.calls[0][0];
      expect(String(payload.content)).toContain('Disabled');
      const select = selectFromPayload(payload);
      const options = (select?.options ?? []) as Array<Record<string, unknown>>;
      const aiOption = options.find(o => o.value === FLAG);
      // Now off → the toggle would "enable" it.
      expect(String(aiOption?.description)).toContain('select to enable');
    });

    it('rejects an unknown flag value without persisting', async () => {
      const interaction = createSelectInteraction('guild_flags_toggle', ['notARealFlag']);

      await guild.handleSelectMenu?.(interaction as never);

      expect(mockSetOverride).not.toHaveBeenCalled();
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(String(interaction.reply.mock.calls[0][0].content)).toContain('Unknown feature flag');
    });

    it('refuses when the server is not linked to an organization', async () => {
      mockResolveOrganization.mockResolvedValueOnce(null);
      const interaction = createSelectInteraction('guild_flags_toggle', [FLAG]);

      await guild.handleSelectMenu?.(interaction as never);

      expect(mockSetOverride).not.toHaveBeenCalled();
      expect(String(interaction.reply.mock.calls[0][0].content)).toContain('not linked');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
