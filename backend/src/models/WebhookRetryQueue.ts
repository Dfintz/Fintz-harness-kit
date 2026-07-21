import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Webhook retry queue status
 */
export enum WebhookRetryStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    DEAD_LETTER = 'dead_letter'  // Permanently failed after max retries
}

/**
 * Payload structure for webhook retry
 */
export interface WebhookRetryPayload {
    id: string;
    timestamp: string;
    event: string;
    organizationId: string;
    data: Record<string, unknown>;
    retryCount: number;
    signature?: string;
}

/**
 * WebhookRetryQueue entity for durable webhook delivery
 * 
 * Stores failed webhook deliveries for retry with exponential backoff
 * Ensures webhook deliveries survive application restarts
 */
@Entity('webhook_retry_queue')
@Index(['status', 'nextRetryAt'])
@Index(['webhookId', 'status'])
export class WebhookRetryQueue {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    @Index()
    webhookId!: string;

    @Column()
    organizationId!: string;

    @Column()
    event!: string;

    @Column('simple-json')
    payload!: WebhookRetryPayload;

    @Column()
    retryCount!: number;

    @Column()
    maxRetries!: number;

    @Column({
        type: 'varchar',
        default: WebhookRetryStatus.PENDING
    })
    status!: WebhookRetryStatus;

    @Column({ type: 'timestamp', nullable: true })
    @Index()
    nextRetryAt?: Date;

    @Column({ type: 'text', nullable: true })
    lastError?: string;

    @Column({ nullable: true })
    lastStatusCode?: number;

    @Column({ nullable: true })
    lastResponseTime?: number;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: 'timestamp', nullable: true })
    processedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;
}

/**
 * DTO for creating a retry queue entry
 */
export interface CreateWebhookRetryDto {
    webhookId: string;
    organizationId: string;
    event: string;
    payload: WebhookRetryPayload;
    maxRetries: number;
    retryDelayMs: number;
}
