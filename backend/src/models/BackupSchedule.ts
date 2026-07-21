import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

// ==================== ENUMS ====================

export enum BackupFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

// ==================== ENTITY ====================

/**
 * BackupSchedule Entity Model
 *
 * Configures automated backup schedules per organization.
 * One active schedule per organization.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('backup_schedules')
@Index('UQ_backup_schedules_organization_id', ['organizationId'], { unique: true })
export class BackupSchedule extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  frequency!: BackupFrequency;

  @Column({ type: 'integer', default: 30 })
  retentionDays!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRunAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
