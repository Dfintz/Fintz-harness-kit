export declare enum WebhookRetryStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    DEAD_LETTER = "dead_letter"
}
export interface WebhookRetryPayload {
    id: string;
    timestamp: string;
    event: string;
    organizationId: string;
    data: Record<string, unknown>;
    retryCount: number;
    signature?: string;
}
export declare class WebhookRetryQueue {
    id: string;
    webhookId: string;
    organizationId: string;
    event: string;
    payload: WebhookRetryPayload;
    retryCount: number;
    maxRetries: number;
    status: WebhookRetryStatus;
    nextRetryAt?: Date;
    lastError?: string;
    lastStatusCode?: number;
    lastResponseTime?: number;
    createdAt: Date;
    processedAt?: Date;
    completedAt?: Date;
}
export interface CreateWebhookRetryDto {
    webhookId: string;
    organizationId: string;
    event: string;
    payload: WebhookRetryPayload;
    maxRetries: number;
    retryDelayMs: number;
}
//# sourceMappingURL=WebhookRetryQueue.d.ts.map