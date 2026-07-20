export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    category?: 'system' | 'fleet' | 'activity' | 'trading' | 'organization';
    data?: Record<string, unknown>;
    timestamp: number;
    read: boolean;
    actionUrl?: string;
}
export interface NotificationEvent {
    type: 'notification:new' | 'notification:read' | 'notification:deleted';
    notification: Notification;
    userId?: string;
    organizationId?: string;
}
export declare const sendUserNotification: (userId: string, notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
export declare const sendOrganizationNotification: (organizationId: string, notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
export declare const sendFleetNotification: (organizationId: string, title: string, message: string, data?: Record<string, unknown>) => void;
export declare const sendActivityNotification: (organizationId: string, title: string, message: string, data?: Record<string, unknown>) => void;
export declare const sendTradingNotification: (userId: string, title: string, message: string, data?: Record<string, unknown>) => void;
export declare const sendWarningNotification: (userId: string, title: string, message: string, data?: Record<string, unknown>) => void;
export declare const sendErrorNotification: (userId: string, title: string, message: string, data?: Record<string, unknown>) => void;
//# sourceMappingURL=notificationWebSocketController.d.ts.map