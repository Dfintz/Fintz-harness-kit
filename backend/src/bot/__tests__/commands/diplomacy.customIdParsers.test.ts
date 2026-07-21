import { parseDiplomacyProposeModalType } from '../../commands/diplomacy';

describe('diplomacy customId parser helper (C9)', () => {
  it('parses proposal modal alliance type', () => {
    expect(parseDiplomacyProposeModalType('diplomacy_propose_modal_alliance')).toBe('alliance');
  });

  it('keeps permissive parsing for extra params', () => {
    expect(parseDiplomacyProposeModalType('diplomacy_propose_modal_trade_extra')).toBe('trade');
  });

  it.each([
    'diplomacy_propose_action_alliance',
    'diplomacy_panel_propose',
    'diplomacy_propose_modal',
    'diplomacy_propose_modal_',
  ])('returns null for unmatched id: %s', customId => {
    expect(parseDiplomacyProposeModalType(customId)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
