import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

import { Organization } from './Organization';
import { User } from './User';

/**
 * Organization Deletion Request Status
 */
export enum OrgDeletionRequestStatus {
    PENDING = 'pending',                          // Waiting for email verification
    EMAIL_VERIFICATION_PENDING = 'email_verification_pending', // Email sent, awaiting confirmation
    APPROVED = 'approved',                        // Admin approved, waiting for grace period
    REJECTED = 'rejected',                        // Rejected by admin
    CANCELLED = 'cancelled',                      // Cancelled during grace period
    COMPLETED = 'completed',                      // Deletion executed
    FAILED = 'failed'                             // Deletion attempt failed
}

/**
 * OrganizationDeletionRequest Entity
 * 
 * Tracks organization deletion requests with admin approval workflow.
 * Implements soft delete with grace period for GDPR compliance.
 * Provides audit trail and data export before deletion.
 */
@Entity('organization_deletion_requests')
@Index(['organizationId', 'status'])
@Index(['status', 'scheduledFor'])
export class OrganizationDeletionRequest {
    @PrimaryColumn('uuid')
    id!: string;

    @Index()
    @Column({ type: 'varchar', length: 255 })
    organizationId!: string;

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organizationId' })
    organization?: Organization;

    @Column({ type: 'varchar', length: 255 })
    requestedBy!: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'requestedBy' })
    requester?: User;

    @Column({
        type: 'enum',
        enum: OrgDeletionRequestStatus,
        default: OrgDeletionRequestStatus.PENDING
    })
    status!: OrgDeletionRequestStatus;

    @Column({ type: 'timestamp' })
    requestedAt!: Date;

    @Column({ type: 'timestamp', nullable: true })
    approvedAt?: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    approvedBy?: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'approvedBy' })
    approver?: User;

    @Column({ type: 'text', nullable: true })
    approvalNotes?: string;

    @Column({ type: 'timestamp', nullable: true })
    rejectedAt?: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    rejectedBy?: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'rejectedBy' })
    rejector?: User;

    @Column({ type: 'text', nullable: true })
    rejectionReason?: string;

    @Column({ type: 'timestamp', nullable: true })
    scheduledFor?: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    cancelledAt?: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cancelledBy?: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'cancelledBy' })
    canceller?: User;

    @Column({ type: 'text', nullable: true })
    cancellationReason?: string;

    @Column({ type: 'text', nullable: true })
    requestReason?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address for GDPR audit' })
    @Column({ type: 'text', nullable: true, transformer: conditionalEncryptionTransformer })
    requestIpAddress?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info for GDPR audit' })
    @Column({ type: 'text', nullable: true, transformer: conditionalEncryptionTransformer })
    requestUserAgent?: string;

    @Column({ type: 'text', nullable: true })
    failureReason?: string;

    @Column({ type: 'boolean', default: false })
    deleteDescendants!: boolean;

    @Column({ type: 'boolean', default: false })
    dataExportGenerated!: boolean;

    @Column({ type: 'varchar', length: 500, nullable: true })
    exportFilePath?: string | null;

    @Column({ type: 'varchar', length: 1000, nullable: true })
    exportDownloadToken?: string | null;

    @Column({ type: 'integer', default: 0 })
    exportDownloadCount!: number;

    @Column({ type: 'timestamp', nullable: true })
    exportLastDownloadedAt?: Date;

    @Column({ type: 'jsonb', nullable: true })
    deletionPreview?: {
        descendantCount?: number;
        memberCount?: number;
        shipCount?: number;
        dataSize?: string;
        [key: string]: unknown;
    };

    @Column({ type: 'integer', default: 30 })
    gracePeriodDays!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    emailVerificationToken?: string;

    @Column({ type: 'timestamp', nullable: true })
    emailVerifiedAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    /**
     * Check if email has been verified
     */
    isEmailVerified(): boolean {
        return !!this.emailVerifiedAt;
    }

    /**
     * Check if grace period has expired
     */
    isGracePeriodExpired(): boolean {
        if (!this.scheduledFor) {
            return false;
        }
        return new Date() >= this.scheduledFor;
    }

    /**
     * Check if request can be cancelled
     */
    canBeCancelled(): boolean {
        return [
            OrgDeletionRequestStatus.PENDING,
            OrgDeletionRequestStatus.APPROVED
        ].includes(this.status) && !this.isGracePeriodExpired();
    }

    /**
     * Check if request can be approved
     */
    canBeApproved(): boolean {
        return this.status === OrgDeletionRequestStatus.PENDING && this.isEmailVerified();
    }

    /**
     * Check if request can be rejected
     */
    canBeRejected(): boolean {
        return this.status === OrgDeletionRequestStatus.PENDING;
    }
}
