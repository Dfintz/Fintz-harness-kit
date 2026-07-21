import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decryptAuthConfig, encryptAuthConfig } from '../utils/credentialEncryption';

export enum IntegrationType {
  WEBHOOK = 'webhook',
  REST_API = 'rest_api',
  GRAPHQL = 'graphql',
  DATABASE = 'database',
  STARCOMMS = 'starcomms',
  CUSTOM = 'custom',
}

export type IntegrationOwnerType = 'fleet' | 'organization' | 'federation';

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  PENDING = 'pending',
}

export enum SyncDirection {
  INBOUND = 'inbound', // External -> Our system
  OUTBOUND = 'outbound', // Our system -> External
  BIDIRECTIONAL = 'bidirectional',
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
  /** Maps participant role names to StarComms net UIDs for bulk assignment. */
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
  transform?: string; // JavaScript function as string
  default?: unknown;
}

export interface SyncLog {
  timestamp: Date;
  status: 'success' | 'error' | 'partial';
  itemsSynced: number;
  errors?: string[];
  duration?: number;
}

@Entity('external_integrations')
export class ExternalIntegration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  fleetId!: string;

  @Column({ type: 'varchar', nullable: true })
  ownerType?: IntegrationOwnerType;

  @Column({ type: 'varchar', nullable: true })
  ownerId?: string;

  @Column()
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
  })
  type!: IntegrationType;

  @Column({
    type: 'varchar',
    default: IntegrationStatus.PENDING,
  })
  status!: IntegrationStatus;

  @Column({
    type: 'varchar',
  })
  syncDirection!: SyncDirection;

  @Column('simple-json', {
    transformer: {
      to: (value: AuthConfig): AuthConfig => {
        if (!value) {
          return value;
        }
        return encryptAuthConfig(
          value as unknown as Record<string, unknown>
        ) as unknown as AuthConfig;
      },
      from: (value: AuthConfig): AuthConfig => {
        if (!value) {
          return value;
        }
        return decryptAuthConfig(
          value as unknown as Record<string, unknown>
        ) as unknown as AuthConfig;
      },
    },
  })
  authConfig!: AuthConfig;

  @Column('simple-json', { nullable: true })
  webhookConfig?: WebhookConfig;

  @Column('simple-json', { nullable: true })
  apiConfig?: ApiConfig;

  @Column('simple-json', { nullable: true })
  starCommsConfig?: StarCommsConfig;

  @Column('simple-json', { default: '[]' })
  fieldMappings!: FieldMapping[];

  @Column({ default: false })
  autoSync!: boolean;

  @Column({ nullable: true })
  syncIntervalMinutes?: number;

  @Column({ nullable: true })
  lastSyncAt?: Date;

  @Column({ nullable: true })
  nextSyncAt?: Date;

  @Column('simple-json', { default: '[]' })
  syncHistory!: SyncLog[];

  @Column({ default: 0 })
  totalSyncs!: number;

  @Column({ default: 0 })
  successfulSyncs!: number;

  @Column({ default: 0 })
  failedSyncs!: number;

  @Column('simple-array', { default: '' })
  syncedCategories!: string[]; // Which inventory categories to sync

  @Column({ default: true })
  enabled!: boolean;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  lastErrorAt?: Date;

  @Column()
  createdBy!: string;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// DTOs
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
