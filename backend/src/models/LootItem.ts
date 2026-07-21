import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { LootPool } from './LootPool';

// ==================== ENUMS ====================

export enum LootItemCategory {
  GEAR = 'gear',
  COMPONENT = 'component',
  COMMODITY = 'commodity',
  WEAPON = 'weapon',
  SHIP = 'ship',
  OTHER = 'other',
}

export enum LootItemStatus {
  AVAILABLE = 'available',
  AWARDED = 'awarded',
}

/** How the item entry was created — useful for surfacing OCR-suggested rows. */
export enum LootItemSource {
  MANUAL = 'manual',
  OCR = 'ocr',
}

// ==================== ENTITY ====================

/**
 * LootItem Entity Model
 *
 * A single looted item (gear / component / commodity) belonging to a LootPool.
 * Items carry a per-unit value so the pool's total value can be calculated.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('loot_items')
@Index(['organizationId', 'lootPoolId'])
@Index(['lootPoolId', 'status'])
export class LootItem extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  lootPoolId!: string;

  @ManyToOne(() => LootPool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lootPoolId' })
  pool?: LootPool;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({
    type: 'enum',
    enum: LootItemCategory,
    default: LootItemCategory.OTHER,
  })
  category!: LootItemCategory;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  /** Estimated value per unit in the pool currency. */
  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  unitValue!: number;

  /** quantity * unitValue, maintained by the service. */
  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  totalValue!: number;

  @Column({
    type: 'enum',
    enum: LootItemStatus,
    default: LootItemStatus.AVAILABLE,
  })
  status!: LootItemStatus;

  @Column({
    type: 'enum',
    enum: LootItemSource,
    default: LootItemSource.MANUAL,
  })
  source!: LootItemSource;

  /** Winner of the item once distributed (LEADER_ASSIGN / contest result). */
  @Column({ type: 'varchar', nullable: true })
  awardedToUserId?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imageUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
