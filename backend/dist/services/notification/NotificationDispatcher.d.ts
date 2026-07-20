import { NotificationPriority, NotificationType } from '../../models/Notification';
export interface AdminAlertOptions {
    type?: NotificationType;
    priority?: NotificationPriority;
    data?: Record<string, unknown>;
}
export declare class NotificationDispatcher {
    private static instance;
    private readonly notificationService;
    private constructor();
    static getInstance(): NotificationDispatcher;
    private get userRepo();
    getPlatformAdminIds(): Promise<string[]>;
    notifyPlatformAdmins(title: string, message: string, options?: AdminAlertOptions): Promise<number>;
}
export declare const notificationDispatcher: NotificationDispatcher;
//# sourceMappingURL=NotificationDispatcher.d.ts.map