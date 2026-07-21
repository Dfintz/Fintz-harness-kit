import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { LootItem } from './LootItem';
import { LootPool } from './LootPool';

// ==================== ENUMS ====================

/**
 * The kind of interest a participant registered against an item.
 *
 * NEED / GREED -> for NEED_GREED distribution
 * ROLL         -> for RANDOM_ROLL distribution (simple "I want it")
 * BID          -> for AUEC_BID distribution (carries bidAmount)
 */
export enum LootClaimType {
  NEED = 'need',
  GREED = 'greed',
  ROLL = 'roll',
  BID = 'bid',
}

export enum LootClaimStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
  WITHDRAWN = 'withdrawn',
}

// ==================== ENTITY ====================

/**
 * LootClaim Entity Model
 *
 * A participant's claim / bid on a specific LootItem. One active claim per
 * (item, user) is enforced; withdrawing then re-claiming creates a new row only
 * after the previous one is withdrawn.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('loot_claims')
@Unique('UQ_loot_claim_item_user', ['lootItemId', 'userId'])
@Index(['organizationId', 'lootPoolId'])
@Index(['lootItemId', 'status'])
export class LootClaim extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  lootPoolId!: string;

  @ManyToOne(() => LootPool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lootPoolId' })
  pool?: LootPool;

  @Column({ type: 'uuid' })
  lootItemId!: string;

  @ManyToOne(() => LootItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lootItemId' })
  item?: LootItem;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  userName!: string;

  @Column({
    type: 'enum',
    enum: LootClaimType,
    default: LootClaimType.ROLL,
  })
  claimType!: LootClaimType;

  /** aUEC amount for BID claims. */
  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  bidAmount?: number;

  /** Random roll (1-100) recorded at distribution time for transparency. */
  @Column({ type: 'integer', nullable: true })
  rollValue?: number;

  @Column({
    type: 'enum',
    enum: LootClaimStatus,
    default: LootClaimStatus.PENDING,
  })
  status!: LootClaimStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
