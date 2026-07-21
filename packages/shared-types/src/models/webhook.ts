/**
 * Webhook integration domain types.
 */

export type WebhookType = 'discord' | 'custom';

export type WebhookStatus = 'active' | 'inactive' | 'error' | 'pending';

/**
 * Canonical webhook event-type values (runtime source set for {@link WebhookEventType}).
 *
 * Per ADR-004, exposed as a runtime-introspectable `as const` array plus a derived
 * union type, with exact parity to the backend `Webhook.WebhookEventType` enum (no
 * client-only exclusions).
 */
export const WEBHOOK_EVENT_TYPE_VALUES = [
  // Fleet events
  'fleet.created',
  'fleet.updated',
  'fleet.deleted',
  'fleet.member.joined',
  'fleet.member.left',
  // Member events
  'member.joined',
  'member.left',
  'member.role.changed',
  // Activity events
  'activity.created',
  'activity.started',
  'activity.completed',
  'activity.cancelled',
  'activity.participant.joined',
  'activity.participant.left',
  // Alert events
  'alert.created',
  'alert.resolved',
  // Ship events
  'ship.added',
  'ship.removed',
  'ship.transferred',
  // Batch event (used for batched webhook deliveries)
  'batch',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPE_VALUES)[number];

export interface DiscordWebhookConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  threadId?: string;
}

export type WebhookAuthenticationType = 'none' | 'basic' | 'bearer' | 'apiKey';

export interface CustomWebhookAuthentication {
  type: WebhookAuthenticationType;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
}

export interface CustomWebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  authentication?: CustomWebhookAuthentication;
}

export interface WebhookDeliveryLog {
  deliveryId: string;
  timestamp: Date | string;
  event: WebhookEventType;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  retryCount: number;
  nextRetryAt?: Date | string;
}

export interface Webhook {
  id: string;
  organizationId: string;
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
  lastDeliveryAt?: Date | string;
  lastSuccessAt?: Date | string;
  lastFailureAt?: Date | string;
  lastError?: string;
  deliveryHistory: WebhookDeliveryLog[];
  circuitBreakerThreshold: number;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  circuitOpenedAt?: Date | string;
  adminNotifiedOfFailure: boolean;
  adminNotifiedAt?: Date | string;
  createdBy: string;
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type WebhookHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface WebhookV2 extends Webhook {
  successRate: number;
  healthStatus: WebhookHealthStatus;
}

export interface CreateWebhookRequest {
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

export interface UpdateWebhookRequest {
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

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  timestamp: Date | string;
}
