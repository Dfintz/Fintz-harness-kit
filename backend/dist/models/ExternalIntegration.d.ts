export declare enum IntegrationType {
    WEBHOOK = "webhook",
    REST_API = "rest_api",
    GRAPHQL = "graphql",
    DATABASE = "database",
    STARCOMMS = "starcomms",
    CUSTOM = "custom"
}
export type IntegrationOwnerType = 'fleet' | 'organization' | 'federation';
export declare enum IntegrationStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    ERROR = "error",
    PENDING = "pending"
}
export declare enum SyncDirection {
    INBOUND = "inbound",
    OUTBOUND = "outbound",
    BIDIRECTIONAL = "bidirectional"
}
export interface AuthConfig {
    type: 'none' | 'basic' | 'bearer' | 'apiKey' | 'oauth2';
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    oauth2Config?: {
        clientId: string;
        clientSecret: string;
        tokenUrl: string;
        scopes?: string[];
    };
}
export interface WebhookConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    events: string[];
    retryAttempts?: number;
    retryDelay?: number;
}
export interface ApiConfig {
    baseUrl: string;
    endpoints: {
        getInventory?: string;
        updateInventory?: string;
        syncInventory?: string;
        [key: string]: string | undefined;
    };
    rateLimit?: {
        requests: number;
        perSeconds: number;
    };
}
export interface StarCommsConfig {
    baseUrl: string;
    shardId?: string;
    metricsWindowMinutes?: number;
    keyReferenceId?: string;
    featureFlags?: Record<string, boolean>;
    netMappings?: Record<string, string>;
    requiredPermission?: string;
    minRolePriority?: number;
    sharing?: {
        enabled: boolean;
        whitelist: Array<{
            type: 'organization' | 'federation';
            targetId: string;
            targetName?: string;
        }>;
    };
}
export interface FieldMapping {
    sourceField: string;
    targetField: string;
    transform?: string;
    default?: unknown;
}
export interface SyncLog {
    timestamp: Date;
    status: 'success' | 'error' | 'partial';
    itemsSynced: number;
    errors?: string[];
    duration?: number;
}
export declare class ExternalIntegration {
    id: string;
    fleetId: string;
    ownerType?: IntegrationOwnerType;
    ownerId?: string;
    name: string;
    description?: string;
    type: IntegrationType;
    status: IntegrationStatus;
    syncDirection: SyncDirection;
    authConfig: AuthConfig;
    webhookConfig?: WebhookConfig;
    apiConfig?: ApiConfig;
    starCommsConfig?: StarCommsConfig;
    fieldMappings: FieldMapping[];
    autoSync: boolean;
    syncIntervalMinutes?: number;
    lastSyncAt?: Date;
    nextSyncAt?: Date;
    syncHistory: SyncLog[];
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    syncedCategories: string[];
    enabled: boolean;
    errorMessage?: string;
    lastErrorAt?: Date;
    createdBy: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateIntegrationDto {
    fleetId: string;
    ownerType?: IntegrationOwnerType;
    ownerId?: string;
    name: string;
    description?: string;
    type: IntegrationType;
    syncDirection: SyncDirection;
    authConfig: AuthConfig;
    webhookConfig?: WebhookConfig;
    apiConfig?: ApiConfig;
    starCommsConfig?: StarCommsConfig;
    fieldMappings?: FieldMapping[];
    autoSync?: boolean;
    syncIntervalMinutes?: number;
    syncedCategories?: string[];
    createdBy: string;
    notes?: string;
}
export interface UpdateIntegrationDto {
    ownerType?: IntegrationOwnerType;
    ownerId?: string;
    name?: string;
    description?: string;
    status?: IntegrationStatus;
    authConfig?: AuthConfig;
    webhookConfig?: WebhookConfig;
    apiConfig?: ApiConfig;
    starCommsConfig?: StarCommsConfig;
    fieldMappings?: FieldMapping[];
    autoSync?: boolean;
    syncIntervalMinutes?: number;
    syncedCategories?: string[];
    enabled?: boolean;
    notes?: string;
}
export interface SyncRequest {
    integrationId: string;
    categories?: string[];
    fullSync?: boolean;
    dryRun?: boolean;
}
export interface SyncResult {
    success: boolean;
    itemsSynced: number;
    errors: string[];
    duration: number;
    changes: {
        created: number;
        updated: number;
        deleted: number;
    };
}
//# sourceMappingURL=ExternalIntegration.d.ts.map