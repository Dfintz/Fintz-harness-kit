import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Federation } from './Federation';
import { Organization } from './Organization';
import { UserAchievement } from './UserAchievement';

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum AchievementType {
  TITLE = 'title',
  BADGE = 'badge',
}

/**
 * Custom title / badge definition.
 * Scoped to an organization OR a federation (exactly one must be set).
 * Individual awards tracked via UserAchievement.
 */
@Entity('achievements')
@Index('IDX_achievements_type', ['type'])
@Index('IDX_achievements_federationId', ['federationId'])
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 'title' = text-only honor, 'badge' = visual icon with rarity */
  @Column({ type: 'varchar', default: AchievementType.BADGE })
  type!: string;

  @Column({ nullable: true })
  @Index()
  organizationId?: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ type: 'uuid', nullable: true })
  federationId?: string;

  @ManyToOne(() => Federation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'federationId' })
  federation?: Federation;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category?: string;

  @Column({ type: 'varchar', default: AchievementRarity.COMMON })
  rarity!: string;

  @Column({ type: 'varchar', nullable: true })
  icon?: string;

  /** Free-form styling / metadata (colors, border, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column()
  createdBy!: string;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => UserAchievement, ua => ua.achievement)
  userAchievements?: UserAchievement[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
