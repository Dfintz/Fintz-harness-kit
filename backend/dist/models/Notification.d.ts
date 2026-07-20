import { User } from './User';
export declare enum NotificationType {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    SUCCESS = "success",
    ANNOUNCEMENT = "announcement",
    ACTIVITY_INVITATION = "activity_invitation",
    ACTIVITY_COMPLETED = "activity_completed",
    ACTIVITY_CANCELLED = "activity_cancelled",
    FLEET_CREATED = "fleet_created",
    FLEET_DEPLOYED = "fleet_deployed",
    FLEET_DISSOLVED = "fleet_dissolved",
    TRADE_OPERATION_CREATED = "trade_operation_created",
    ROUTE_STATUS_CHANGED = "route_status_changed",
    FEDERATION_INVITATION = "federation_invitation",
    FEDERATION_ACCEPTED = "federation_accepted"
}
export declare enum NotificationPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent"
}
export declare class Notification {
    id: string;
    userId: string;
    user?: User;
    senderId?: string | null;
    sender?: User | null;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    read: boolean;
    readAt?: Date | null;
    data?: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Notification.d.ts.map