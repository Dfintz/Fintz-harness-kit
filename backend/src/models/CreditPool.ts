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

// ==================== ENTITY ====================

/**
 * CreditPool Entity Model
 *
 * Represents an organization's treasury balance.
 * Each organization has exactly one credit pool.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 * CONCURRENCY: Uses VersionColumn for optimistic locking.
 */
@Entity('credit_pools')
@Index('UQ_credit_pools_organizationId', ['organizationId'], { unique: true })
export class CreditPool extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  balance!: number;

  @Column({ type: 'varchar', length: 20, default: 'aUEC' })
  currency!: string;

  @Column({ type: 'timestamp', nullable: true })
  lastTransactionAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @VersionColumn()
  version!: number;
}
