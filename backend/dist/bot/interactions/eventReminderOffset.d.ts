import { ReminderType } from '../../models/ActivityReminder';
export interface ReminderOffsetChoice {
    type: ReminderType;
    label: string;
    fireAt: Date;
}
export declare function pickReminderOffset(eventDate: Date, now?: Date): ReminderOffsetChoice | null;
//# sourceMappingURL=eventReminderOffset.d.ts.map