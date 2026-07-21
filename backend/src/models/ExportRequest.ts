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

import { User } from './User';

/**
 * Export Request Status
 */
export enum ExportRequestStatus {
  PENDING = 'pending', // Waiting for processing
  PROCESSING = 'processing', // Currently being generated
  COMPLETED = 'completed', // Export file is ready
  FAILED = 'failed', // Export generation failed
  EXPIRED = 'expired', // Download link has expired
}

/**
 * ExportRequest Entity
 *
 * Tracks GDPR data export requests with queue-based processing.
 * Generates downloadable export files with expiration.
 * Provides audit trail for compliance.
 */
@Entity('export_requests')
@Index(['userId', 'status'])
@Index(['expiresAt'])
export class ExportRequest {
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
    enum: ExportRequestStatus,
    default: ExportRequestStatus.PENDING,
  })
  status!: ExportRequestStatus;

  @Column({ type: 'timestamp' })
  requestedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  processingStartedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  requestIpAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  requestUserAgent?: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  filePath?: string; // Path to generated export file

  @Column({ type: 'varchar', length: 50, nullable: true })
  fileSize?: string; // Size of export file in bytes (stored as string to handle large files)

  @Column({ type: 'varchar', length: 1000, nullable: true })
  downloadToken?: string; // Signed token for secure download

  @Column({ type: 'boolean', default: false })
  notificationSent!: boolean; // Whether email notification was sent

  @Column({ type: 'jsonb', nullable: true })
  exportMetadata?: Record<string, unknown>; // Metadata about the export (record counts, etc.)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
