import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

import { Bounty } from './Bounty';
import { BountyEvidence } from './BountyEvidence';

/**
 * Bounty Claim Status
 */
export enum BountyClaimStatus {
  ACTIVE = 'active',
  SUBMITTED = 'submitted',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  REJECTED = 'rejected',
}

/**
 * Bounty Claim Entity
 *
 * Tracks individual claims on bounties by hunters.
 * Supports claim limits and evidence submission workflow.
 */
@Entity('bounty_claims')
@Index(['bountyId', 'status'])
@Index(['hunterId', 'status'])
@Index(['organizationId', 'status'])
export class BountyClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  bountyId!: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bountyId' })
  bounty?: Bounty;

  @Column({ type: 'varchar' })
  hunterId!: string;

  @Column({ length: 100, nullable: true })
  hunterName?: string;

  @Column({ type: 'varchar' })
  organizationId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: BountyClaimStatus.ACTIVE,
  })
  status!: BountyClaimStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  claimedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @OneToMany(() => BountyEvidence, evidence => evidence.claim)
  evidence?: BountyEvidence[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Computed properties
  get isActive(): boolean {
    return this.status === BountyClaimStatus.ACTIVE;
  }

  get isSubmitted(): boolean {
    return this.status === BountyClaimStatus.SUBMITTED;
  }

  get isCompleted(): boolean {
    return this.status === BountyClaimStatus.COMPLETED;
  }

  get canSubmitEvidence(): boolean {
    return this.status === BountyClaimStatus.ACTIVE || this.status === BountyClaimStatus.SUBMITTED;
  }

  get canBeAbandoned(): boolean {
    return this.status === BountyClaimStatus.ACTIVE;
  }
}
