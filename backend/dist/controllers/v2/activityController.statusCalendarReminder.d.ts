import { Request, Response } from 'express';
import { Activity } from '../../models/Activity';
import type { ActivityEventService } from '../../services/activity/ActivityEventService';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
type NotificationInput = {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    activityId: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
};
type StatusCalendarReminderDeps = {
    findActivityById: (id: string) => Promise<Activity | null>;
    getCompletionActivityForUser: (req: Request, activityId: string, userId: string) => Promise<Activity>;
    notifyOrg: (input: NotificationInput) => void;
    activityEventService: ActivityEventService;
};
export declare function getActivityCalendarHandler(req: Request, res: Response): Promise<void>;
export declare function exportActivityToCalendarHandler(req: Request, res: Response, deps: Pick<StatusCalendarReminderDeps, 'findActivityById'>): Promise<void>;
export declare function createActivityReminderHandler(req: Request, res: Response, deps: Pick<StatusCalendarReminderDeps, 'findActivityById'>): Promise<void>;
export declare function getActivityRemindersHandler(req: Request, res: Response, deps: Pick<StatusCalendarReminderDeps, 'findActivityById'>): Promise<void>;
export declare function updateActivityStatusHandler(req: Request, res: Response, deps: Pick<StatusCalendarReminderDeps, 'findActivityById' | 'notifyOrg'>): Promise<void>;
export declare function completeActivityHandler(req: Request, res: Response, deps: Pick<StatusCalendarReminderDeps, 'getCompletionActivityForUser'>): Promise<void>;
export declare function cancelActivityHandler(req: Request, res: Response, deps: Pick<StatusCalendarReminderDeps, 'getCompletionActivityForUser' | 'activityEventService'>): Promise<void>;
export {};
//# sourceMappingURL=activityController.statusCalendarReminder.d.ts.map