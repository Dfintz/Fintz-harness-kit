import {
  buildCustomId,
  customIdScope,
  isCustomIdWithinLimit,
  MAX_CUSTOM_ID_LENGTH,
  parseCustomId,
} from '../customId';

describe('buildCustomId', () => {
  it('joins prefix, action, and params with underscores', () => {
    expect(buildCustomId('event', 'confirmcancel', 'abc123')).toBe('event_confirmcancel_abc123');
    expect(buildCustomId('ticket', 'listpage', '2')).toBe('ticket_listpage_2');
    expect(buildCustomId('recruitment', 'confirmdeny', 'rec-1', 'app-2')).toBe(
      'recruitment_confirmdeny_rec-1_app-2'
    );
  });

  it('supports an action with no params (a bare scope)', () => {
    expect(buildCustomId('faq', 'panel')).toBe('faq_panel');
  });
});

describe('parseCustomId', () => {
  it('splits a full prefix/action/params customId', () => {
    expect(parseCustomId('event_join_abc123')).toEqual({
      prefix: 'event',
      action: 'join',
      params: ['abc123'],
    });
  });

  it('captures multiple params after the action', () => {
    expect(parseCustomId('recruitment_confirmdeny_rec-1_app-2')).toEqual({
      prefix: 'recruitment',
      action: 'confirmdeny',
      params: ['rec-1', 'app-2'],
    });
  });

  it('returns an empty action and params when only a prefix is present', () => {
    expect(parseCustomId('event')).toEqual({ prefix: 'event', action: '', params: [] });
  });

  it('returns empty params when only prefix and action are present', () => {
    expect(parseCustomId('event_join')).toEqual({ prefix: 'event', action: 'join', params: [] });
  });

  it('round-trips with buildCustomId for params without underscores', () => {
    const id = buildCustomId('giveaway', 'listpage', '3');
    expect(parseCustomId(id)).toEqual({ prefix: 'giveaway', action: 'listpage', params: ['3'] });
  });
});

describe('customIdScope', () => {
  // Mirrors the router's prior extractButtonCooldownScope semantics exactly.
  it.each([
    ['event_join_abc123', 'event_join'],
    ['faq_panel_list', 'faq_panel'],
    ['event_join', 'event_join'],
    ['event', 'event'],
  ])('scopes %s to %s', (input, expected) => {
    expect(customIdScope(input)).toBe(expected);
  });
});

describe('isCustomIdWithinLimit', () => {
  it('accepts ids at or under the Discord limit', () => {
    expect(isCustomIdWithinLimit('event_join_abc')).toBe(true);
    expect(isCustomIdWithinLimit('a'.repeat(MAX_CUSTOM_ID_LENGTH))).toBe(true);
  });

  it('rejects ids over the Discord limit', () => {
    expect(isCustomIdWithinLimit('a'.repeat(MAX_CUSTOM_ID_LENGTH + 1))).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
