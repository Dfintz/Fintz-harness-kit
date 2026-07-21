import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * Webhook integration types
 */
export enum WebhookType {
  DISCORD = 'discord',
  CUSTOM = 'custom',
}

/**
 * Webhook status
 */
export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  PENDING = 'pending',
}

/**
 * Webhook event types that can trigger notifications
 */
export enum WebhookEventType {
  // Fleet events
  FLEET_CREATED = 'fleet.created',
  FLEET_UPDATED = 'fleet.updated',
  FLEET_DELETED = 'fleet.deleted',
  FLEET_MEMBER_JOINED = 'fleet.member.joined',
  FLEET_MEMBER_LEFT = 'fleet.member.left',

  // Member events
  MEMBER_JOINED = 'member.joined',
  MEMBER_LEFT = 'member.left',
  MEMBER_ROLE_CHANGED = 'member.role.changed',

  // Activity events
  ACTIVITY_CREATED = 'activity.created',
  ACTIVITY_STARTED = 'activity.started',
  ACTIVITY_COMPLETED = 'activity.completed',
  ACTIVITY_CANCELLED = 'activity.cancelled',
  ACTIVITY_PARTICIPANT_JOINED = 'activity.participant.joined',
  ACTIVITY_PARTICIPANT_LEFT = 'activity.participant.left',

  // Alert events
  ALERT_CREATED = 'alert.created',
  ALERT_RESOLVED = 'alert.resolved',

  // Ship events
  SHIP_ADDED = 'ship.added',
  SHIP_REMOVED = 'ship.removed',
  SHIP_TRANSFERRED = 'ship.transferred',

  // Batch event (used for batched webhook deliveries)
  BATCH = 'batch',
}

/**
 * Discord webhook configuration
 */
export interface DiscordWebhookConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  threadId?: string;
}

/**
 * Custom webhook configuration
 */
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

/**
 * Delivery log entry
 */
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

/**
 * Webhook Entity
 * Stores webhook configurations for organizations
 *
 * MULTI-TENANCY: This entity is tenant-scoped via TenantEntity
 */
@Entity('webhooks')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'type'])
export class Webhook extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
  })
  type!: WebhookType;

  @Column({
    type: 'varchar',
    default: WebhookStatus.PENDING,
  })
  status!: WebhookStatus;

  @Column({ default: true })
  enabled!: boolean;

  // Event subscription configuration
  @Column('simple-array')
  events!: WebhookEventType[];

  // Discord-specific configuration
  @Column('simple-json', { nullable: true })
  discordConfig?: DiscordWebhookConfig;

  // Custom webhook configuration
  @Column('simple-json', { nullable: true })
  customConfig?: CustomWebhookConfig;

  // Security
  @Column({ nullable: true })
  secret?: string; // HMAC-SHA256 secret for signature verification

  // Retry configuration
  @Column({ default: 3 })
  maxRetries!: number;

  @Column({ default: 1000 })
  retryDelayMs!: number; // Initial delay, exponential backoff applied

  @Column({ default: 30000 })
  timeoutMs!: number;

  // Statistics
  @Column({ default: 0 })
  totalDeliveries!: number;

  @Column({ default: 0 })
  successfulDeliveries!: number;

  @Column({ default: 0 })
  failedDeliveries!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastDeliveryAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastFailureAt?: Date;

  @Column('text', { nullable: true })
  lastError?: string;

  // Delivery history (last N deliveries)
  @Column('simple-json', { default: '[]' })
  deliveryHistory!: WebhookDeliveryLog[];

  // Circuit breaker configuration
  @Column({ default: 5 })
  circuitBreakerThreshold!: number; // Number of consecutive failures before opening circuit

  @Column({ default: 0 })
  consecutiveFailures!: number; // Current count of consecutive failures

  @Column({ default: false })
  circuitBreakerOpen!: boolean; // Circuit breaker state

  @Column({ type: 'timestamp', nullable: true })
  circuitOpenedAt?: Date; // When circuit breaker was opened

  @Column({ default: false })
  adminNotifiedOfFailure!: boolean; // Whether admin has been notified

  @Column({ type: 'timestamp', nullable: true })
  adminNotifiedAt?: Date; // When admin was notified

  // Metadata
  @Column()
  createdBy!: string;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Computed properties
  get successRate(): number {
    if (this.totalDeliveries === 0) {
      return 0;
    }
    return Math.round((this.successfulDeliveries / this.totalDeliveries) * 100);
  }

  get isHealthy(): boolean {
    // Consider unhealthy if circuit breaker is open or more than 50% failures in last 10 deliveries
    if (this.circuitBreakerOpen) {
      return false;
    }

    const recentDeliveries = this.deliveryHistory.slice(0, 10);
    if (recentDeliveries.length === 0) {
      return true;
    }

    const failures = recentDeliveries.filter(d => d.status === 'failed').length;
    return failures / recentDeliveries.length < 0.5;
  }

  get canDeliver(): boolean {
    // Cannot deliver if circuit breaker is open or webhook is disabled
    return !this.circuitBreakerOpen && this.enabled && this.status !== WebhookStatus.ERROR;
  }
}

// DTOs
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
  skipped?: boolean; // True if delivery was skipped due to circuit breaker
}
