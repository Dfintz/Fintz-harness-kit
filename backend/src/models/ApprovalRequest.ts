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

export enum ApprovalRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELEGATED = 'delegated',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

export enum ApprovalRequestType {
  MEMBERSHIP = 'membership',
  RESOURCE_ACCESS = 'resource_access',
  FLEET_MODIFICATION = 'fleet_modification',
  ROLE_CHANGE = 'role_change',
  CONTENT_PUBLISH = 'content_publish',
  GENERAL = 'general',
}

export interface ApprovalHistoryEntry {
  action: string;
  userId: string;
  timestamp: string;
  comment?: string;
}

/**
 * Generic org-scoped approval request.
 * Supports membership changes, resource access, fleet modifications, etc.
 */
@Entity('approval_requests')
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ length: 200, nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', nullable: true })
  resourceId?: string;

  @Column({ type: 'varchar', nullable: true })
  resourceType?: string;

  @Column()
  requestedBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedBy' })
  requester?: User;

  @Column({ type: 'varchar', default: ApprovalRequestStatus.PENDING })
  @Index()
  status!: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ nullable: true })
  @Index()
  assignedTo?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedTo' })
  assignee?: User;

  @Column({ nullable: true })
  delegatedTo?: string;

  @Column({ nullable: true })
  delegatedBy?: string;

  @Column({ type: 'json', nullable: true })
  history?: ApprovalHistoryEntry[];

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  completedBy?: string;

  @CreateDateColumn()
  @Index()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
