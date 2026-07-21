import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

// ==================== ENTITY ====================

/**
 * CommissaryItem Entity Model
 *
 * Represents an item available for purchase in the organization's commissary.
 * Stock of -1 indicates unlimited availability.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('commissary_items')
@Index(['organizationId', 'isActive'])
@Index(['organizationId', 'category'])
export class CommissaryItem extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column('decimal', { precision: 20, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ type: 'integer', default: -1 })
  stock!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imageUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
