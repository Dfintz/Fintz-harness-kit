"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATTENDANCE_MILESTONES = void 0;
exports.getAttendanceMilestoneProgress = getAttendanceMilestoneProgress;
exports.formatAttendanceMilestoneReached = formatAttendanceMilestoneReached;
exports.ATTENDANCE_MILESTONES = [5, 10, 25, 50, 100, 250, 500];
function getAttendanceMilestoneProgress(attended) {
    const reached = exports.ATTENDANCE_MILESTONES.includes(attended)
        ? attended
        : null;
    const next = exports.ATTENDANCE_MILESTONES.find(m => m > attended) ?? null;
    const toNext = next === null ? null : next - attended;
    return { reached, next, toNext };
}
function formatAttendanceMilestoneReached(attended) {
    const { reached, next } = getAttendanceMilestoneProgress(attended);
    if (reached === null) {
        return null;
    }
    const headline = `🎉 **Milestone reached:** ${reached} events attended!`;
    return next === null
        ? `${headline} You've hit the highest milestone — outstanding. 🏆`
        : `${headline} Next up: ${next}.`;
}
//# sourceMappingURL=attendanceMilestones.js.map