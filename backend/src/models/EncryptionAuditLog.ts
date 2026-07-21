import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * Encryption Event Types
 */
export enum EncryptionEventType {
  KEY_GENERATED = 'key_generated',
  KEY_ROTATED = 'key_rotated',
  KEY_SHARED = 'key_shared',
  KEY_REVOKED = 'key_revoked',
  DATA_ENCRYPTED = 'data_encrypted',
  DATA_DECRYPTED = 'data_decrypted',
  DATA_DELETED = 'data_deleted',
  ENCRYPTION_ENABLED = 'encryption_enabled',
  ENCRYPTION_DISABLED = 'encryption_disabled',
  ACCESS_DENIED = 'access_denied',
  RECOVERY_PHRASE_USED = 'recovery_phrase_used',
  DATA_REENCRYPTED = 'data_reencrypted',
}

/**
 * Encryption Audit Log Model
 *
 * Tracks all encryption-related events for security auditing.
 * Helps detect unauthorized access attempts and track key usage.
 */
@Entity('encryption_audit_log')
@Index(['organizationId'])
@Index(['eventType'])
@Index(['userId'])
@Index(['createdAt'])
export class EncryptionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization this event belongs to
   */
  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * Type of encryption event
   */
  @Column({ length: 50 })
  eventType!: EncryptionEventType | string;

  /**
   * User who triggered the event
   */
  @Column()
  userId!: string;

  /**
   * Human-readable message describing the event
   */
  @Column({ type: 'text' })
  message!: string;

  /**
   * Additional event details
   * Can include: keyId, dataId, dataType, success/failure, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  /**
   * IP address of the client
   */
  @Column({ length: 45, nullable: true })
  ipAddress?: string;

  /**
   * User agent of the client
   */
  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  /**
   * When the event occurred
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Static helper: Create audit log entry
   */
  static createEntry(
    organizationId: string,
    eventType: EncryptionEventType | string,
    userId: string,
    message: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Partial<EncryptionAuditLog> {
    return {
      organizationId,
      eventType,
      userId,
      message,
      details,
      ipAddress,
      userAgent,
    };
  }
}
