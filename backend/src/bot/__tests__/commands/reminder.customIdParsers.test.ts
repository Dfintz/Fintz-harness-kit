import { parseReminderTypeSelectEventId } from '../../commands/reminder';

describe('reminder customId parser helper (C9)', () => {
  it('parses type-select event id', () => {
    expect(parseReminderTypeSelectEventId('reminder_type_select_event-1')).toBe('event-1');
  });

  it('keeps permissive parsing for extra params', () => {
    expect(parseReminderTypeSelectEventId('reminder_type_select_event-1_extra')).toBe('event-1');
  });

  it.each([
    'reminder_type_modal_event-1',
    'reminder_event_for_create',
    'reminder_type_select',
    'reminder_type_select_',
  ])('returns null for unmatched id: %s', customId => {
    expect(parseReminderTypeSelectEventId(customId)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
