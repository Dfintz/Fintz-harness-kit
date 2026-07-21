import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { IntelClassification, IntelEntry } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Share permission levels for Intel entries
 */
export enum IntelSharePermission {
  VIEW = 'view', // Can only view the intel
  COMMENT = 'comment', // Can view and add comments
  CONTRIBUTE = 'contribute', // Can view, comment, and suggest updates
  FULL = 'full', // Full access including edit (still requires approval)
}

/**
 * Share status for Intel entries
 */
export enum IntelShareStatus {
  PENDING = 'pending', // Awaiting acceptance
  ACTIVE = 'active', // Share is active
  REVOKED = 'revoked', // Share was revoked by sharer
  DECLINED = 'declined', // Share was declined by recipient
  EXPIRED = 'expired', // Share expired
}

/**
 * Intel Share entity - tracks sharing of intel between allied organizations
 */
@Entity('intel_shares')
export class IntelShare {
  @PrimaryColumn()
  id!: string;

  @Column()
  @Index()
  intelEntryId!: string;

  @ManyToOne(() => IntelEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intelEntryId' })
  intelEntry?: IntelEntry;

  @Column()
  @Index()
  sourceOrganizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceOrganizationId' })
  sourceOrganization?: Organization;

  @Column()
  @Index()
  targetOrganizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetOrganizationId' })
  targetOrganization?: Organization;

  @Column({
    type: 'varchar',
    enum: IntelSharePermission,
    default: IntelSharePermission.VIEW,
  })
  permission!: IntelSharePermission;

  @Column({
    type: 'varchar',
    enum: IntelShareStatus,
    default: IntelShareStatus.PENDING,
  })
  @Index()
  status!: IntelShareStatus;
  // Maximum classification level the recipient can see
  // If the intel is higher than this, content will be redacted
  @Column({
    type: 'varchar',
    enum: IntelClassification,
    default: IntelClassification.RESTRICTED,
  })
  maxClassification!: IntelClassification;

  @Column()
  sharedBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sharedBy' })
  sharer?: User;

  @Column({ nullable: true })
  acceptedBy?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acceptedBy' })
  accepter?: User;

  @Column({ nullable: true })
  revokedBy?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'revokedBy' })
  revoker?: User;

  @Column({ type: 'text', nullable: true })
  shareReason?: string;

  @Column({ type: 'text', nullable: true })
  revokeReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastViewedAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    allianceId?: string; // If shared via alliance
    treatyId?: string; // If shared via treaty
    conditions?: string[]; // Conditions for sharing
    restrictedSections?: string[]; // Sections that should be redacted
    notes?: string;
  };

  @CreateDateColumn()
  @Index()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Check if share is currently active
   */
  isActive(): boolean {
    if (this.status !== IntelShareStatus.ACTIVE) {
      return false;
    }
    if (this.expiresAt && this.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  /**
   * Check if share is expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return this.expiresAt < new Date();
  }
}
