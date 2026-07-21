/**
 * Pure helper for the event "🔔 Remind Me" button (INT-07 reminders).
 *
 * Picks a sensible default reminder time for a one-click reminder: the largest
 * standard offset (1 day → 1 hour → 30 minutes before the event) whose fire time
 * is still in the future. This gives the most useful lead time without asking the
 * user to choose, while `/reminder` remains available for fully custom timing.
 *
 * Kept dependency-light (only the `ReminderType` enum) so it is cheap to unit test
 * without loading the heavy Discord interaction handlers in `eventButtons.ts`.
 */
import { ReminderType } from '../../models/ActivityReminder';

export interface ReminderOffsetChoice {
  type: ReminderType;
  /** Human-readable label, e.g. "1 day before". */
  label: string;
  /** Absolute time the reminder should fire. */
  fireAt: Date;
}

/** Standard offsets, largest lead time first. */
const STANDARD_OFFSETS: ReadonlyArray<{ type: ReminderType; ms: number; label: string }> = [
  { type: ReminderType.ONE_DAY_BEFORE, ms: 24 * 60 * 60 * 1000, label: '1 day before' },
  { type: ReminderType.ONE_HOUR_BEFORE, ms: 60 * 60 * 1000, label: '1 hour before' },
  { type: ReminderType.THIRTY_MINUTES_BEFORE, ms: 30 * 60 * 1000, label: '30 minutes before' },
];

/**
 * Choose the largest standard reminder offset whose fire time is still in the
 * future relative to `now`. Returns `null` when the event is too soon (under
 * 30 minutes away) or already started.
 */
export function pickReminderOffset(
  eventDate: Date,
  now: Date = new Date()
): ReminderOffsetChoice | null {
  const eventMs = eventDate.getTime();
  const nowMs = now.getTime();
  for (const offset of STANDARD_OFFSETS) {
    const fireMs = eventMs - offset.ms;
    if (fireMs > nowMs) {
      return { type: offset.type, label: offset.label, fireAt: new Date(fireMs) };
    }
  }
  return null;
}
