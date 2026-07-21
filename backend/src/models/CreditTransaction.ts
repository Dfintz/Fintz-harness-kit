import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import type { CreditPool } from './CreditPool';

// ==================== ENUMS ====================

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  DUES = 'dues',
  REWARD = 'reward',
  PURCHASE = 'purchase',
}

// ==================== ENTITY ====================

/**
 * CreditTransaction Entity Model
 *
 * Represents a single credit movement in the organization's treasury.
 * Stores a running balance snapshot after each transaction for fast lookups.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 * INTEGRITY: Running balance computed server-side in a DB transaction
 * with SELECT ... FOR UPDATE on the CreditPool row.
 */
@Entity('credit_transactions')
@Index(['organizationId', 'createdAt'])
@Index(['creditPoolId'])
@Index(['fromUserId'])
@Index(['toUserId'])
export class CreditTransaction extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  creditPoolId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: TransactionType;

  @Column('decimal', { precision: 20, scale: 2 })
  amount!: number;

  @Column('decimal', { precision: 20, scale: 2 })
  balance!: number;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'varchar', nullable: true })
  fromUserId?: string;

  @Column({ type: 'varchar', nullable: true })
  toUserId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @ManyToOne('CreditPool', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditPoolId' })
  creditPool?: CreditPool;

  @CreateDateColumn()
  createdAt!: Date;
}
