import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * First-class assistant-manager assignments for loot pools.
 *
 * This table is authoritative for manager authorization checks.
 */
@Entity('loot_pool_assistants')
@Index(['organizationId', 'lootPoolId'])
@Index(['lootPoolId', 'userId'], { unique: true })
export class LootPoolAssistant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  lootPoolId!: string;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
