export declare const ATTENDANCE_MILESTONES: readonly [5, 10, 25, 50, 100, 250, 500];
export interface AttendanceMilestoneProgress {
    reached: number | null;
    next: number | null;
    toNext: number | null;
}
export declare function getAttendanceMilestoneProgress(attended: number): AttendanceMilestoneProgress;
export declare function formatAttendanceMilestoneReached(attended: number): string | null;
//# sourceMappingURL=attendanceMilestones.d.ts.map