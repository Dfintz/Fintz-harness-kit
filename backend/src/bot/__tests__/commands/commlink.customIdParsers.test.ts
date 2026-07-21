jest.mock('../../../services/discord/TunnelService', () => ({
  TunnelService: { getInstance: jest.fn().mockReturnValue({}) },
}));

jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: { getInstance: jest.fn().mockReturnValue({}) },
}));

import {
  parseCommlinkPasswordModalTunnelId,
  parseCommlinkRenameModalTunnelId,
  parseCommlinkSettingsActionTunnelId,
} from '../../commands/commlink';

describe('commlink customId parser helpers (C9)', () => {
  it('parses rename modal tunnel id', () => {
    expect(parseCommlinkRenameModalTunnelId('commlink_rename_modal_tunnel-1')).toBe('tunnel-1');
  });

  it('parses password modal tunnel id', () => {
    expect(parseCommlinkPasswordModalTunnelId('commlink_password_modal_tunnel-2')).toBe('tunnel-2');
  });

  it('parses settings-action tunnel id', () => {
    expect(parseCommlinkSettingsActionTunnelId('commlink_settings_action_tunnel-3')).toBe(
      'tunnel-3'
    );
  });

  it('keeps permissive parsing for extra params', () => {
    expect(parseCommlinkRenameModalTunnelId('commlink_rename_modal_tunnel-1_extra')).toBe(
      'tunnel-1'
    );
    expect(parseCommlinkSettingsActionTunnelId('commlink_settings_action_tunnel-3_extra')).toBe(
      'tunnel-3'
    );
  });

  it.each([
    'commlink_rename_action_tunnel-1',
    'commlink_settings_modal_tunnel-3',
    'commlink_password_modal',
    'commlink_rename_modal_',
    'event_rename_modal_tunnel-1',
  ])('returns null for unmatched id: %s', customId => {
    expect(parseCommlinkRenameModalTunnelId(customId)).toBeNull();
    expect(parseCommlinkPasswordModalTunnelId(customId)).toBeNull();
    expect(parseCommlinkSettingsActionTunnelId(customId)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
