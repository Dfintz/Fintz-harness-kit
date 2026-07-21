import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { IntelEntry } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Approval status for Intel entries
 */
export enum IntelApprovalStatus {
  PENDING = 'pending', // Waiting for approval
  APPROVED = 'approved', // Approved by required approvers
  REJECTED = 'rejected', // Rejected by an approver
  WITHDRAWN = 'withdrawn', // Withdrawn by the requester
  EXPIRED = 'expired', // Approval request expired
}

/**
 * Intel Approval entity - tracks two-person approval for TOP_SECRET entries
 */
@Entity('intel_approvals')
export class IntelApproval {
  @PrimaryColumn()
  id!: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column()
  @Index()
  intelEntryId!: string;

  @ManyToOne(() => IntelEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intelEntryId' })
  intelEntry?: IntelEntry;

  @Column()
  requestedBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedBy' })
  requester?: User;

  @Column({
    type: 'varchar',
    enum: IntelApprovalStatus,
    default: IntelApprovalStatus.PENDING,
  })
  @Index()
  status!: IntelApprovalStatus;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'int', default: 2 })
  requiredApprovals!: number;

  @Column({ type: 'simple-array', nullable: true })
  approvers?: string[];

  @Column({ type: 'json', nullable: true })
  approvalDetails?: {
    userId: string;
    timestamp: Date;
    decision: 'approved' | 'rejected';
    comment?: string;
  }[];

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  completedBy?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completedBy' })
  completer?: User;

  @CreateDateColumn()
  @Index()
  createdAt!: Date;
}
