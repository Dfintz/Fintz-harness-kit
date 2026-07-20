import { ActivityReminder, DeliveryStatus, ReminderChannel, ReminderType } from '../../models/ActivityReminder';
import { NotificationService } from '../communication';
export interface CreateReminderParams {
    activityId?: string;
    eventId?: string;
    reminderType: ReminderType;
    channel: ReminderChannel;
    scheduledTime?: Date;
    recipientUserIds?: string[];
    recipientEmails?: string[];
    discordChannelId?: string;
    messageTemplate?: string;
    createdBy?: string;
}
export interface ReminderStats {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
}
export interface ProcessRemindersResult {
    sent: number;
    failed: number;
    errors: string[];
}
export declare class ActivityReminderService {
    private reminderRepository;
    private activityRepository;
    private notificationService;
    constructor(notificationService: NotificationService);
    private getActivityData;
    createActivityReminders(activityId: string, reminderTypes: ReminderType[], channel: ReminderChannel, recipientUserIds?: string[], recipientEmails?: string[]): Promise<ActivityReminder[]>;
    createReminder(params: CreateReminderParams): Promise<ActivityReminder>;
    processDueReminders(): Promise<ProcessRemindersResult>;
    sendReminder(reminder: ActivityReminder): Promise<void>;
    retryFailedReminders(): Promise<number>;
    getActivityReminders(activityId: string): Promise<ActivityReminder[]>;
    cancelReminder(reminderId: string): Promise<void>;
    cancelActivityReminders(activityId: string): Promise<number>;
    rescheduleReminder(reminderId: string, newTime: Date): Promise<ActivityReminder>;
    getReminderStats(activityId?: string): Promise<ReminderStats>;
    getReminders(activityId: string): Promise<ActivityReminder[]>;
    private calculateReminderTime;
    private getTimeUntilText;
    private getDefaultMessageTemplate;
    createEventReminders(eventId: string, reminderTypes: ReminderType[], channel: ReminderChannel, recipientUserIds?: string[], recipientEmails?: string[]): Promise<ActivityReminder[]>;
    getEventReminders(eventId: string): Promise<ActivityReminder[]>;
    cancelEventReminders(eventId: string): Promise<number>;
}
export { ActivityReminder, DeliveryStatus, ReminderChannel, ReminderType };
//# sourceMappingURL=ActivityReminderService.d.ts.map