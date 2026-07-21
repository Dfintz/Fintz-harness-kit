// guild.ts constructs the `discordSettingsService` singleton at module load
// (which touches AppDataSource), so mock the heavy service modules to keep the
// import side-effect-free for these pure customId-helper tests.
jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {},
}));
jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: { getInstance: jest.fn() },
}));
jest.mock('../../../services/organization/OrganizationMemberService', () => ({
  OrganizationMemberService: jest.fn(),
}));
jest.mock('../../../services/user/UserService', () => ({
  UserService: jest.fn(),
}));

import { buildGuildSettingsToggleId, parseGuildSettingsToggleCategory } from '../../commands/guild';

/** The fixed, `_`-free settings categories (from CATEGORY_FIELD_MAP). */
const CATEGORIES = [
  'events',
  'voice',
  'tickets',
  'notifications',
  'welcome',
  'recruitment',
  'rolesync',
  'auditlog',
];

describe('guild settings-toggle customId codec (C9 / ARCH-09)', () => {
  describe('buildGuildSettingsToggleId', () => {
    it('builds the legacy `guild_settings_toggle_<category>` string', () => {
      expect(buildGuildSettingsToggleId('events')).toBe('guild_settings_toggle_events');
    });
  });

  describe('parseGuildSettingsToggleCategory', () => {
    it.each(CATEGORIES)('round-trips the fixed category %s', category => {
      expect(parseGuildSettingsToggleCategory(buildGuildSettingsToggleId(category))).toBe(category);
    });

    it.each([
      'guild_settings_category', // sibling select (params[0] = category)
      'guild_settings_channel_events', // sibling (params[0] = channel)
      'guild_setup_org_select', // different action
      'guild_settings_toggle', // no category segment
      'bounty_listpage_0', // different prefix
    ])('returns null for the non-toggle id %s', id => {
      expect(parseGuildSettingsToggleCategory(id)).toBeNull();
    });

    it('returns an empty string for a trailing-underscore (empty) category', () => {
      // Matches the previous `.replace('guild_settings_toggle_', '')`, which the
      // routing then rejects as an unknown category.
      expect(parseGuildSettingsToggleCategory('guild_settings_toggle_')).toBe('');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
