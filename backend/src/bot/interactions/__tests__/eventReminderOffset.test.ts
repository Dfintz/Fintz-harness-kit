// Unit tests for pickReminderOffset (INT-07 one-click event reminders).
//
// pickReminderOffset chooses the largest standard lead time (1 day -> 1 hour ->
// 30 minutes before) whose fire time is still in the future, so the "🔔 Remind Me"
// button can set a useful reminder without asking the user to pick a time.

import { ReminderType } from '../../../models/ActivityReminder';
import { pickReminderOffset } from '../eventReminderOffset';

const now = new Date('2026-06-14T12:00:00.000Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('pickReminderOffset', () => {
  it('picks 1 day before when the event is more than a day away', () => {
    const choice = pickReminderOffset(new Date(now.getTime() + 3 * DAY), now);
    expect(choice).not.toBeNull();
    expect(choice?.type).toBe(ReminderType.ONE_DAY_BEFORE);
    expect(choice?.label).toBe('1 day before');
    // Fires 1 day before the event = 2 days from now.
    expect(choice?.fireAt.toISOString()).toBe(new Date(now.getTime() + 2 * DAY).toISOString());
  });

  it('falls back to 1 hour before when the event is within a day', () => {
    const choice = pickReminderOffset(new Date(now.getTime() + 3 * HOUR), now);
    expect(choice?.type).toBe(ReminderType.ONE_HOUR_BEFORE);
    expect(choice?.label).toBe('1 hour before');
  });

  it('falls back to 30 minutes before when the event is within the hour', () => {
    const choice = pickReminderOffset(new Date(now.getTime() + 45 * MINUTE), now);
    expect(choice?.type).toBe(ReminderType.THIRTY_MINUTES_BEFORE);
    expect(choice?.label).toBe('30 minutes before');
  });

  it('returns null when the event is under 30 minutes away (too soon)', () => {
    expect(pickReminderOffset(new Date(now.getTime() + 20 * MINUTE), now)).toBeNull();
  });

  it('returns null when the event is in the past', () => {
    expect(pickReminderOffset(new Date(now.getTime() - HOUR), now)).toBeNull();
  });

  it('uses the exact boundary: a reminder firing exactly now is not in the future', () => {
    // Event exactly 30 minutes away -> 30-min reminder fires exactly now -> not > now.
    expect(pickReminderOffset(new Date(now.getTime() + 30 * MINUTE), now)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
