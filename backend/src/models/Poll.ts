import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { PollVote } from './PollVote';

// ==================== ENUMS ====================

export enum PollType {
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  RANKED = 'ranked',
  APPROVAL = 'approval',
}

export enum PollVisibility {
  PUBLIC = 'public',
  MEMBERS_ONLY = 'members_only',
  ROLE_RESTRICTED = 'role_restricted',
}

export enum PollStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

// ==================== INTERFACES ====================

export interface PollOption {
  id: string;
  label: string;
  description?: string;
  sortOrder: number;
}

// ==================== ENTITY ====================

/**
 * Poll Entity Model
 *
 * Core entity for organization polls and voting.
 * Supports single choice, multiple choice, ranked, and approval voting.
 *
 * MULTI-TENANCY: This entity is tenant-scoped — each poll belongs to an organization.
 */
@Entity('polls')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['status', 'endsAt'])
@Index(['createdBy'])
export class Poll extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20 })
  pollType!: PollType;

  @Column({ type: 'varchar', length: 20, default: PollVisibility.MEMBERS_ONLY })
  visibility!: PollVisibility;

  @Column({ type: 'jsonb' })
  options!: PollOption[];

  @Column({ type: 'boolean', default: false })
  isAnonymous!: boolean;

  @Column({ type: 'integer', default: 1 })
  maxSelections!: number;

  @Column({ type: 'varchar', length: 20, default: PollStatus.ACTIVE })
  status!: PollStatus;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ length: 100, nullable: true })
  createdByName?: string;

  @Column({ type: 'timestamp', nullable: true })
  endsAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  closedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ type: 'simple-array', nullable: true })
  allowedRoles?: string[];

  /** When set, poll is scoped to a federation */
  @Column({ type: 'uuid', nullable: true })
  federationId?: string;

  /** Voting mode for federation polls: equal (1 vote per org) or weighted (uses votingPower) */
  @Column({ type: 'varchar', length: 20, nullable: true, default: 'equal' })
  votingMode?: string;

  @OneToMany(() => PollVote, vote => vote.poll)
  votes?: PollVote[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @VersionColumn()
  version!: number;

  // ==================== COMPUTED PROPERTIES ====================

  get isActive(): boolean {
    return this.status === PollStatus.ACTIVE;
  }

  get isClosed(): boolean {
    return this.status === PollStatus.CLOSED || this.status === PollStatus.CANCELLED;
  }

  get isExpired(): boolean {
    if (!this.endsAt) {
      return false;
    }
    return new Date() > this.endsAt;
  }
}
