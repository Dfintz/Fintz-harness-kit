import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Achievement } from './Achievement';
import { User } from './User';

/**
 * Junction entity tracking which titles / badges a user has been awarded.
 */
@Entity('user_achievements')
@Index(['userId', 'isDisplayed'])
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  achievementId!: string;

  @ManyToOne(() => Achievement, achievement => achievement.userAchievements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'achievementId' })
  achievement?: Achievement;

  @Column()
  @Index()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column()
  @Index()
  organizationId!: string;

  @Column()
  awardedBy!: string;

  /** Whether the user wants this title/badge visible on their profile */
  @Column({ type: 'boolean', default: true })
  isDisplayed!: boolean;

  /** Ordering slot for profile display (lower = first) */
  @Column({ type: 'int', nullable: true })
  displaySlot!: number | null;

  @CreateDateColumn()
  awardedAt!: Date;
}
