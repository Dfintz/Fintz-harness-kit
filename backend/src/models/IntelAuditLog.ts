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
 * Intel audit actions
 */
export enum IntelAuditAction {
  // Entry actions
  ENTRY_CREATED = 'entry_created',
  ENTRY_VIEWED = 'entry_viewed',
  ENTRY_UPDATED = 'entry_updated',
  ENTRY_DELETED = 'entry_deleted',
  ENTRY_ARCHIVED = 'entry_archived',
  ENTRY_RESTORED = 'entry_restored',

  // Officer actions
  OFFICER_APPOINTED = 'officer_appointed',
  OFFICER_PROMOTED = 'officer_promoted',
  OFFICER_DEMOTED = 'officer_demoted',
  OFFICER_REMOVED = 'officer_removed',
  OFFICER_ACCESS_CHANGED = 'officer_access_changed',

  // Access actions
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  UNAUTHORIZED_ATTEMPT = 'unauthorized_attempt',

  // Vault actions
  VAULT_ACCESSED = 'vault_accessed',
  EXPORT_PERFORMED = 'export_performed',
  BULK_OPERATION = 'bulk_operation',

  // Two-person approval actions
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_GRANTED = 'approval_granted',
  APPROVAL_REJECTED = 'approval_rejected',
  APPROVAL_WITHDRAWN = 'approval_withdrawn',
  APPROVAL_EXPIRED = 'approval_expired',

  // Sharing actions
  SHARE_CREATED = 'share_created',
  SHARE_ACCEPTED = 'share_accepted',
  SHARE_DECLINED = 'share_declined',
  SHARE_REVOKED = 'share_revoked',
  SHARE_EXPIRED = 'share_expired',
  SHARE_VIEWED = 'share_viewed',

  // Aging/declassification actions
  DECLASSIFICATION_SCHEDULED = 'declassification_scheduled',
  DECLASSIFICATION_EXECUTED = 'declassification_executed',
  DECLASSIFICATION_CANCELLED = 'declassification_cancelled',
  AGING_REVIEW_DUE = 'aging_review_due',
  AGING_REVIEW_COMPLETED = 'aging_review_completed',
  EXPIRATION_WARNING = 'expiration_warning',
  ENTRY_EXPIRED = 'entry_expired',
}

/**
 * Intel Audit Log entity - tracks all Intel vault activities
 */
@Entity('intel_audit_logs')
export class IntelAuditLog {
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
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  @Index()
  intelEntryId?: string;

  @ManyToOne(() => IntelEntry, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'intelEntryId' })
  intelEntry?: IntelEntry;

  @Column({
    type: 'varchar',
    enum: IntelAuditAction,
  })
  @Index()
  action!: IntelAuditAction;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({
    type: 'varchar',
    default: 'info',
  })
  @Index()
  severity!: 'info' | 'warning' | 'critical';

  @Column({ type: 'json', nullable: true })
  metadata?: {
    changes?: Record<string, unknown>;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    affectedUsers?: string[];
    reason?: string;
    customData?: Record<string, unknown>;
  };

  @CreateDateColumn()
  @Index()
  createdAt!: Date;
}
