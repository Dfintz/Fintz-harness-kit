import { Repository } from 'typeorm';
import { CreateWebhookDto, UpdateWebhookDto, Webhook, WebhookDeliveryLog, WebhookDeliveryResult, WebhookEventType, WebhookPayload, WebhookStatus } from '../../../models/Webhook';
export declare class WebhookService {
    private readonly webhookRepository;
    private readonly axiosInstances;
    constructor(webhookRepository?: Repository<Webhook>);
    createWebhook(organizationId: string, dto: CreateWebhookDto): Promise<Webhook>;
    getWebhookById(id: string): Promise<Webhook | null>;
    getWebhook(id: string): Promise<Webhook | null>;
    getWebhooksByOrganization(organizationId: string): Promise<Webhook[]>;
    listWebhooks(organizationId: string, status?: WebhookStatus): Promise<Webhook[]>;
    updateWebhook(id: string, dto: UpdateWebhookDto): Promise<Webhook>;
    private applySimpleFieldUpdates;
    private applyConfigUpdates;
    private validateDiscordConfigUrl;
    deleteWebhook(id: string): Promise<void>;
    testWebhook(idOrWebhook: string | Webhook): Promise<WebhookDeliveryResult>;
    triggerEvent(organizationId: string, event: WebhookEventType, data: Record<string, unknown>): Promise<{
        success: number;
        failed: number;
        skipped: number;
        results: WebhookDeliveryResult[];
    }>;
    private deliverWithRetry;
    private deliverWebhook;
    private deliverDiscordWebhook;
    private deliverCustomWebhook;
    private formatDiscordMessage;
    private createDiscordEmbed;
    private formatDataAsFields;
    private formatFieldName;
    private getAxiosClient;
    private buildWebhookAuthConfig;
    private validateUrlForSSRF;
    private recordDelivery;
    private generateSignature;
    verifySignature(payload: string, signature: string, secret: string): boolean;
    private generateSecret;
    private generateDeliveryId;
    private validateWebhookConfig;
    private validateWebhookTypeConfig;
    testWebhookConfig(organizationId: string, dto: CreateWebhookDto): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        testResult?: WebhookDeliveryResult;
    }>;
    private delay;
    getStatistics(organizationId: string): Promise<{
        totalWebhooks: number;
        activeWebhooks: number;
        errorWebhooks: number;
        totalDeliveries: number;
        successRate: number;
        recentDeliveries: WebhookDeliveryLog[];
    }>;
    testWebhookWithPayload(idOrWebhook: string | Webhook, options?: {
        event?: WebhookEventType;
        data?: Record<string, unknown>;
        includeSignature?: boolean;
    }): Promise<WebhookDeliveryResult & {
        payload: WebhookPayload;
    }>;
    getTestPayloadPreview(id: string, options?: {
        event?: WebhookEventType;
        data?: Record<string, unknown>;
    }): Promise<{
        webhook: Pick<Webhook, 'id' | 'name' | 'type' | 'events'>;
        payload: WebhookPayload;
        headers: Record<string, string>;
        discordMessage?: object;
    }>;
    private readonly batchQueues;
    private readonly batchConfig;
    configureBatching(config: {
        maxBatchSize?: number;
        maxWaitTimeMs?: number;
        enabled?: boolean;
    }): void;
    getBatchConfig(): {
        maxBatchSize: number;
        maxWaitTimeMs: number;
        enabled: boolean;
    };
    queueEventForBatch(organizationId: string, event: WebhookEventType, data: Record<string, unknown>): Promise<{
        queued: boolean;
        webhookIds: string[];
    }>;
    private addToBatchQueue;
    flushBatch(organizationId: string, webhookId: string): Promise<WebhookDeliveryResult | null>;
    flushAllBatches(organizationId: string): Promise<{
        flushed: number;
        results: WebhookDeliveryResult[];
    }>;
    getPendingBatches(organizationId: string): {
        webhookId: string;
        eventCount: number;
        events: Array<{
            event: WebhookEventType;
            timestamp: string;
        }>;
    }[];
    cancelPendingBatches(organizationId: string, webhookId?: string): number;
    private notifyAdminsOfCircuitBreakerOpen;
    resetCircuitBreaker(webhookId: string): Promise<Webhook>;
    getWebhooksWithOpenCircuitBreakers(): Promise<Webhook[]>;
    getCircuitBreakerStats(organizationId: string): Promise<{
        total: number;
        active: number;
        circuitOpen: number;
        recentFailures: number;
    }>;
}
//# sourceMappingURL=WebhookService.d.ts.map