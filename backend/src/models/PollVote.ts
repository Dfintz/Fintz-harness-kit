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
import { Poll } from './Poll';

/**
 * PollVote Entity Model
 *
 * Records individual votes cast in a poll.
 * Unique constraint on [pollId, userId, optionId] prevents duplicate votes.
 *
 * For anonymous polls, userId is stored server-side for dedup
 * but never exposed to clients in results.
 *
 * MULTI-TENANCY: Inherits tenant scoping from TenantEntity.
 */
@Entity('poll_votes')
@Index(['pollId', 'userId', 'optionId'], { unique: true })
@Index(['pollId'])
@Index(['userId'])
export class PollVote extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  pollId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  optionId!: string;

  @Column({ type: 'integer', nullable: true })
  rank?: number;

  @ManyToOne(() => Poll, poll => poll.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll?: Poll;

  @CreateDateColumn()
  createdAt!: Date;
}
