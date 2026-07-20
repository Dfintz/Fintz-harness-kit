"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickReminderOffset = pickReminderOffset;
const ActivityReminder_1 = require("../../models/ActivityReminder");
const STANDARD_OFFSETS = [
    { type: ActivityReminder_1.ReminderType.ONE_DAY_BEFORE, ms: 24 * 60 * 60 * 1000, label: '1 day before' },
    { type: ActivityReminder_1.ReminderType.ONE_HOUR_BEFORE, ms: 60 * 60 * 1000, label: '1 hour before' },
    { type: ActivityReminder_1.ReminderType.THIRTY_MINUTES_BEFORE, ms: 30 * 60 * 1000, label: '30 minutes before' },
];
function pickReminderOffset(eventDate, now = new Date()) {
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
//# sourceMappingURL=eventReminderOffset.js.map