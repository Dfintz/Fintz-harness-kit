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

import { Organization } from './Organization';
import { User } from './User';

export enum EquipmentStatus {
  AVAILABLE = 'available',
  EQUIPPED = 'equipped',
  IN_TRANSIT = 'in_transit',
  DAMAGED = 'damaged',
  DESTROYED = 'destroyed',
}

export enum EquipmentRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

/**
 * Equipment / gear inventory item.
 * Org-scoped; owned by a user and optionally mounted on a ship.
 */
@Entity('equipment')
export class Equipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ length: 200 })
  name!: string;

  @Column({ length: 64 })
  type!: string;

  @Column({ type: 'varchar', default: EquipmentRarity.COMMON })
  rarity!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  @Index()
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner?: User;

  @Column({ nullable: true })
  shipId?: string;

  @Column({ type: 'varchar', default: EquipmentStatus.AVAILABLE })
  status!: string;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
