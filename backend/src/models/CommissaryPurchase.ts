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
import type { CommissaryItem } from './CommissaryItem';
import type { CreditTransaction } from './CreditTransaction';

// ==================== ENTITY ====================

/**
 * CommissaryPurchase Entity Model
 *
 * Records a purchase of a commissary item by an organization member.
 * Linked to the CreditTransaction that debited the treasury.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('commissary_purchases')
@Index(['organizationId', 'buyerId'])
@Index(['itemId'])
export class CommissaryPurchase extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  itemId!: string;

  @Column({ type: 'varchar' })
  buyerId!: string;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  @Column('decimal', { precision: 20, scale: 2 })
  totalPrice!: number;

  @Column({ type: 'uuid' })
  transactionId!: string;

  @ManyToOne('CommissaryItem', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item?: CommissaryItem;

  @ManyToOne('CreditTransaction', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction?: CreditTransaction;

  @CreateDateColumn()
  createdAt!: Date;
}
