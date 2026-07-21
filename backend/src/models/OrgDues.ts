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

export enum DuesFrequency {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

// ==================== ENTITY ====================

/**
 * OrgDues Entity Model
 *
 * Represents a recurring dues schedule for organization members.
 * Processed by the DuesCollectionScheduler on the configured frequency.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('org_dues')
@Index(['organizationId', 'isActive'])
export class OrgDues extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column('decimal', { precision: 20, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 20 })
  frequency!: DuesFrequency;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', default: 1 })
  dueDay!: number;

  @Column({ type: 'integer', default: 7 })
  gracePeriodDays!: number;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
