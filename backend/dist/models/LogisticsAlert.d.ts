export declare enum AlertType {
    LOW_STOCK = "low_stock",
    CRITICAL_STOCK = "critical_stock",
    OUT_OF_STOCK = "out_of_stock",
    EXPIRING_SOON = "expiring_soon",
    RESTOCK_DUE = "restock_due",
    CONSUMPTION_SPIKE = "consumption_spike",
    SUPPLIER_ISSUE = "supplier_issue",
    CUSTOM = "custom"
}
export declare enum AlertSeverity {
    INFO = "info",
    WARNING = "warning",
    CRITICAL = "critical",
    URGENT = "urgent"
}
export declare enum AlertStatus {
    ACTIVE = "active",
    ACKNOWLEDGED = "acknowledged",
    RESOLVED = "resolved",
    DISMISSED = "dismissed"
}
export declare enum NotificationChannel {
    IN_APP = "in_app",
    EMAIL = "email",
    DISCORD = "discord",
    WEBHOOK = "webhook"
}
export interface AlertRecipient {
    userId?: string;
    email?: string;
    discordId?: string;
    webhookUrl?: string;
}
export interface AlertAction {
    actionType: string;
    description: string;
    performedBy?: string;
    performedAt?: Date;
}
export declare class LogisticsAlert {
    id: string;
    fleetId: string;
    inventoryItemId: string;
    itemName: string;
    type: AlertType;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    message: string;
    metadata?: {
        currentQuantity?: number;
        threshold?: number;
        unit?: string;
        category?: string;
        location?: string;
        daysRemaining?: number;
        consumptionRate?: number;
        [key: string]: unknown;
    };
    recipients: AlertRecipient[];
    notificationChannels: NotificationChannel[];
    notificationSent: boolean;
    notificationSentAt?: Date;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    resolvedBy?: string;
    resolvedAt?: Date;
    resolutionNotes?: string;
    actions: AlertAction[];
    repeatCount: number;
    lastTriggeredAt?: Date;
    expiresAt?: Date;
    autoResolve: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateAlertDto {
    fleetId: string;
    inventoryItemId: string;
    itemName: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    recipients: AlertRecipient[];
    notificationChannels: NotificationChannel[];
    expiresAt?: Date;
    autoResolve?: boolean;
}
export interface UpdateAlertDto {
    status?: AlertStatus;
    acknowledgedBy?: string;
    resolvedBy?: string;
    resolutionNotes?: string;
}
export interface AlertFilterOptions {
    fleetId?: string;
    inventoryItemId?: string;
    type?: AlertType | AlertType[];
    severity?: AlertSeverity | AlertSeverity[];
    status?: AlertStatus | AlertStatus[];
    unacknowledgedOnly?: boolean;
    activeOnly?: boolean;
}
export interface AlertConfiguration {
    enabled: boolean;
    type: AlertType;
    threshold?: number;
    recipients: AlertRecipient[];
    channels: NotificationChannel[];
    repeatInterval?: number;
    maxRepeats?: number;
    autoResolve?: boolean;
}
//# sourceMappingURL=LogisticsAlert.d.ts.map