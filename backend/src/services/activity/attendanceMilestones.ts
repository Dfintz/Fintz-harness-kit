/**
 * Attendance milestones (Phase 4 C8 / INT-05).
 *
 * A milestone is a round-number lifetime attendance achievement (5, 10, 25, …
 * events attended). This module is the pure, dependency-free source of truth for
 * the thresholds and the "did this count just hit one" check, so it can be unit
 * tested without the Discord/DB stack and reused by any surface (bot, web, API).
 */

/** Lifetime attended-event counts that count as milestones, ascending. */
export const ATTENDANCE_MILESTONES = [5, 10, 25, 50, 100, 250, 500] as const;

export interface AttendanceMilestoneProgress {
  /** The milestone exactly equal to `attended`, or `null` if `attended` is not a milestone. */
  reached: number | null;
  /** The next milestone strictly greater than `attended`, or `null` if none remain. */
  next: number | null;
  /** Events still needed to reach `next`, or `null` if no milestone remains. */
  toNext: number | null;
}

/**
 * Compute milestone state for a lifetime attended-event count.
 *
 * `reached` is non-null only when `attended` is exactly a milestone value — the
 * moment worth celebrating. `next`/`toNext` describe the upcoming goal.
 */
export function getAttendanceMilestoneProgress(attended: number): AttendanceMilestoneProgress {
  const reached = ATTENDANCE_MILESTONES.includes(attended as (typeof ATTENDANCE_MILESTONES)[number])
    ? attended
    : null;
  const next = ATTENDANCE_MILESTONES.find(m => m > attended) ?? null;
  const toNext = next === null ? null : next - attended;
  return { reached, next, toNext };
}

/**
 * Build a celebratory one-line message for the moment a milestone is reached,
 * or `null` when `attended` is not exactly a milestone (so callers only surface
 * recognition at the milestone itself, not on every attendance).
 */
export function formatAttendanceMilestoneReached(attended: number): string | null {
  const { reached, next } = getAttendanceMilestoneProgress(attended);
  if (reached === null) {
    return null;
  }
  const headline = `🎉 **Milestone reached:** ${reached} events attended!`;
  return next === null
    ? `${headline} You've hit the highest milestone — outstanding. 🏆`
    : `${headline} Next up: ${next}.`;
}

