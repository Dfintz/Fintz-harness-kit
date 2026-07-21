// Unit tests for attendance milestones (Phase 4 C8 / INT-05).

import {
  ATTENDANCE_MILESTONES,
  formatAttendanceMilestoneReached,
  getAttendanceMilestoneProgress,
} from '../attendanceMilestones';

describe('getAttendanceMilestoneProgress', () => {
  it('reports the next milestone and distance when below the first', () => {
    expect(getAttendanceMilestoneProgress(0)).toEqual({ reached: null, next: 5, toNext: 5 });
    expect(getAttendanceMilestoneProgress(3)).toEqual({ reached: null, next: 5, toNext: 2 });
  });

  it('marks reached only when the count is exactly a milestone', () => {
    expect(getAttendanceMilestoneProgress(5)).toEqual({ reached: 5, next: 10, toNext: 5 });
    expect(getAttendanceMilestoneProgress(10)).toEqual({ reached: 10, next: 25, toNext: 15 });
    expect(getAttendanceMilestoneProgress(100)).toEqual({ reached: 100, next: 250, toNext: 150 });
  });

  it('does not mark non-milestone counts as reached', () => {
    expect(getAttendanceMilestoneProgress(7).reached).toBeNull();
    expect(getAttendanceMilestoneProgress(26).reached).toBeNull();
  });

  it('returns null next/toNext past the highest milestone', () => {
    const top = ATTENDANCE_MILESTONES[ATTENDANCE_MILESTONES.length - 1];
    expect(getAttendanceMilestoneProgress(top)).toEqual({ reached: top, next: null, toNext: null });
    expect(getAttendanceMilestoneProgress(top + 50)).toEqual({
      reached: null,
      next: null,
      toNext: null,
    });
  });
});

describe('formatAttendanceMilestoneReached', () => {
  it('returns null when the count is not exactly a milestone', () => {
    expect(formatAttendanceMilestoneReached(0)).toBeNull();
    expect(formatAttendanceMilestoneReached(4)).toBeNull();
    expect(formatAttendanceMilestoneReached(11)).toBeNull();
  });

  it('celebrates a reached milestone and names the next one', () => {
    const msg = formatAttendanceMilestoneReached(10);
    expect(msg).toContain('10 events attended');
    expect(msg).toContain('Next up: 25');
  });

  it('celebrates the highest milestone without a next', () => {
    const top = ATTENDANCE_MILESTONES[ATTENDANCE_MILESTONES.length - 1];
    const msg = formatAttendanceMilestoneReached(top);
    expect(msg).toContain(`${top} events attended`);
    expect(msg).not.toContain('Next up');
    expect(msg).toContain('🏆');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

