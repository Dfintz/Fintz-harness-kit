import { TenantEntity } from './base/TenantEntity';
export declare enum WebhookType {
    DISCORD = "discord",
    CUSTOM = "custom"
}
export declare enum WebhookStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    ERROR = "error",
    PENDING = "pending"
}
export declare enum WebhookEventType {
    FLEET_CREATED = "fleet.created",
    FLEET_UPDATED = "fleet.updated",
    FLEET_DELETED = "fleet.deleted",
    FLEET_MEMBER_JOINED = "fleet.member.joined",
    FLEET_MEMBER_LEFT = "fleet.member.left",
    MEMBER_JOINED = "member.joined",
    MEMBER_LEFT = "member.left",
    MEMBER_ROLE_CHANGED = "member.role.changed",
    ACTIVITY_CREATED = "activity.created",
    ACTIVITY_STARTED = "activity.started",
    ACTIVITY_COMPLETED = "activity.completed",
    ACTIVITY_CANCELLED = "activity.cancelled",
    ACTIVITY_PARTICIPANT_JOINED = "activity.participant.joined",
    ACTIVITY_PARTICIPANT_LEFT = "activity.participant.left",
    ALERT_CREATED = "alert.created",
    ALERT_RESOLVED = "alert.resolved",
    SHIP_ADDED = "ship.added",
    SHIP_REMOVED = "ship.removed",
    SHIP_TRANSFERRED = "ship.transferred",
    BATCH = "batch"
}
export interface DiscordWebhookConfig {
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
    threadId?: string;
}
export interface CustomWebhookConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    authentication?: {
        type: 'none' | 'basic' | 'bearer' | 'apiKey';
        username?: string;
        password?: string;
        token?: string;
        apiKey?: string;
        apiKeyHeader?: string;
    };
}
export interface WebhookDeliveryLog {
    deliveryId: string;
    timestamp: Date;
    event: WebhookEventType;
    status: 'success' | 'failed' | 'pending';
    statusCode?: number;
    responseTime?: number;
    error?: string;
    retryCount: number;
    nextRetryAt?: Date;
}
export declare class Webhook extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    type: WebhookType;
    status: WebhookStatus;
    enabled: boolean;
    events: WebhookEventType[];
    discordConfig?: DiscordWebhookConfig;
    customConfig?: CustomWebhookConfig;
    secret?: string;
    maxRetries: number;
    retryDelayMs: number;
    timeoutMs: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastDeliveryAt?: Date;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
    lastError?: string;
    deliveryHistory: WebhookDeliveryLog[];
    circuitBreakerThreshold: number;
    consecutiveFailures: number;
    circuitBreakerOpen: boolean;
    circuitOpenedAt?: Date;
    adminNotifiedOfFailure: boolean;
    adminNotifiedAt?: Date;
    createdBy: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    get successRate(): number;
    get isHealthy(): boolean;
    get canDeliver(): boolean;
}
export interface CreateWebhookDto {
    name: string;
    description?: string;
    type: WebhookType;
    events: WebhookEventType[];
    discordConfig?: DiscordWebhookConfig;
    customConfig?: CustomWebhookConfig;
    secret?: string;
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    circuitBreakerThreshold?: number;
    createdBy: string;
    notes?: string;
}
export interface UpdateWebhookDto {
    name?: string;
    description?: string;
    events?: WebhookEventType[];
    discordConfig?: DiscordWebhookConfig;
    customConfig?: CustomWebhookConfig;
    secret?: string;
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    enabled?: boolean;
    notes?: string;
}
export interface WebhookPayload {
    id: string;
    timestamp: string;
    event: WebhookEventType;
    organizationId: string;
    data: Record<string, unknown>;
    signature?: string;
    retryCount: number;
}
export interface WebhookDeliveryResult {
    success: boolean;
    statusCode?: number;
    responseTime?: number;
    error?: string;
    deliveryId: string;
    skipped?: boolean;
}
//# sourceMappingURL=Webhook.d.ts.map