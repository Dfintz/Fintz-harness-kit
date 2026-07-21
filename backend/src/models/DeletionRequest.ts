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

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

import { User } from './User';

/**
 * Deletion Request Status
 */
export enum DeletionRequestStatus {
  PENDING = 'pending', // Waiting for grace period to expire
  CANCELLED = 'cancelled', // User cancelled during grace period
  COMPLETED = 'completed', // Deletion has been executed
  FAILED = 'failed', // Deletion attempt failed
}

/**
 * DeletionRequest Entity
 *
 * Tracks GDPR data deletion requests with grace period support.
 * Allows users to cancel deletion during the grace period.
 * Provides audit trail for compliance.
 */
@Entity('deletion_requests')
@Index(['userId', 'status'])
export class DeletionRequest {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({
    type: 'enum',
    enum: DeletionRequestStatus,
    default: DeletionRequestStatus.PENDING,
  })
  status!: DeletionRequestStatus;

  @Column({ type: 'timestamp' })
  requestedAt!: Date;

  @Column({ type: 'timestamp' })
  scheduledFor!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelledBy?: string; // User ID who cancelled (usually the user themselves)

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address for GDPR audit' })
  @Column({ type: 'text', nullable: true, transformer: conditionalEncryptionTransformer })
  requestIpAddress?: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info for GDPR audit' })
  @Column({ type: 'text', nullable: true, transformer: conditionalEncryptionTransformer })
  requestUserAgent?: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  deletionPreview?: Record<string, number>; // Preview of data to be deleted

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
