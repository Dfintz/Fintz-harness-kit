import {
  parseFederationDiscordSettingsToggleCategory,
  parseFederationSettingValueCustomId,
} from '../../commands/federation';

describe('federation customId parser helpers (C9)', () => {
  it('parses setting-value key', () => {
    expect(parseFederationSettingValueCustomId('federation_setting_value_autoCreateOrgRoles')).toBe(
      'autoCreateOrgRoles'
    );
  });

  it('parses discord-settings toggle category', () => {
    expect(parseFederationDiscordSettingsToggleCategory('federation_ds_toggle_events')).toBe(
      'events'
    );
  });

  it('keeps permissive parsing for extra params', () => {
    expect(parseFederationSettingValueCustomId('federation_setting_value_conflict_extra')).toBe(
      'conflict'
    );
    expect(parseFederationDiscordSettingsToggleCategory('federation_ds_toggle_voice_extra')).toBe(
      'voice'
    );
  });

  it.each([
    'federation_setting_toggle_autoCreateOrgRoles',
    'federation_ds_value_events',
    'federation_setting_value',
    'federation_ds_toggle_',
    'guild_settings_toggle_events',
  ])('returns null for unmatched id: %s', customId => {
    expect(parseFederationSettingValueCustomId(customId)).toBeNull();
    expect(parseFederationDiscordSettingsToggleCategory(customId)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
