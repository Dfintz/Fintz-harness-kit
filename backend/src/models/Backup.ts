import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

// ==================== ENUMS ====================

export enum BackupStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
}

// ==================== ENTITY ====================

/**
 * Backup Entity Model
 *
 * Tracks organization backups with status lifecycle:
 * PENDING → PROCESSING → COMPLETED → EXPIRED
 *                     → FAILED
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 * STORAGE: Backup data stored in Azure Blob Storage.
 */
@Entity('backups')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['status', 'expiresAt'])
@Index(['createdBy'])
export class Backup extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, default: BackupType.FULL })
  backupType!: BackupType;

  @Column({ type: 'varchar', length: 50, default: BackupStatus.PENDING })
  status!: BackupStatus;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ type: 'varchar', length: 255 })
  createdByName!: string;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes?: number;

  @Column({ type: 'varchar', nullable: true })
  blobName?: string;

  @Column({ type: 'integer', default: 0 })
  entityCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  entityBreakdown?: Record<string, number>;

  @Column({ type: 'varchar', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @VersionColumn()
  version!: number;

  // ==================== COMPUTED PROPERTIES ====================

  get isCompleted(): boolean {
    return this.status === BackupStatus.COMPLETED;
  }

  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  get isPending(): boolean {
    return this.status === BackupStatus.PENDING || this.status === BackupStatus.PROCESSING;
  }
}
