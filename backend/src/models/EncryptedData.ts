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

/**
 * Encryption Metadata Interface
 * Stored alongside encrypted data for decryption
 */
export interface EncryptionMetadata {
  iv: string; // Initialization vector (base64)
  authTag: string; // Authentication tag for GCM mode (base64)
  algorithm: string; // 'AES-256-GCM'
  version?: number; // Encryption format version
}

/**
 * Encrypted Data Model
 *
 * Stores encrypted data blobs for organizations.
 * Server stores encrypted data but cannot decrypt it (zero-knowledge).
 *
 * Data Flow:
 * 1. Client encrypts data with org encryption key
 * 2. Encrypted blob sent to server
 * 3. Server stores blob + metadata
 * 4. Server enforces access control (who can read the blob)
 * 5. Client retrieves blob and decrypts locally
 */
@Entity('encrypted_data')
@Index(['organizationId'])
@Index(['organizationId', 'dataType'])
@Index(['resourceId'])
@Index(['keyId'])
@Index(['encryptionMode'])
@Index(['dekId'])
export class EncryptedData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization that owns this encrypted data
   */
  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * ID of the encryption key used
   * References OrganizationEncryptionKey.keyId (flat mode)
   * or DataEncryptionKey.dekId (hybrid mode)
   */
  @Column({ length: 64 })
  keyId!: string;

  /**
   * Encryption mode:
   * - 'flat': Legacy mode — data encrypted with org master key
   * - 'hybrid': Per-resource DEK mode — data encrypted with AES-GCM DEK,
   *   DEK wrapped with RSA-OAEP per recipient
   */
  @Column({ type: 'varchar', length: 10, default: 'flat' })
  encryptionMode!: 'flat' | 'hybrid';

  /**
   * Reference to the Data Encryption Key (hybrid mode only).
   * Points to DataEncryptionKey.dekId.
   * NULL for flat-mode data.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  dekId?: string;

  /**
   * Phase 4 migration status:
   * - 'none': Not applicable (new hybrid data or not migrating)
   * - 'pending': Marked for flat→hybrid migration
   * - 'migrated': Successfully migrated to hybrid mode
   */
  @Column({ type: 'varchar', length: 10, default: 'none' })
  migrationStatus!: 'none' | 'pending' | 'migrated';

  /**
   * Type of data encrypted
   * Examples: 'operation', 'intelligence', 'message', 'note', 'financial'
   */
  @Column({ length: 50 })
  dataType!: string;

  /**
   * Optional reference to the resource this encrypted data belongs to
   * For example, if encrypting an operation, this would be the operation ID
   */
  @Column({ type: 'uuid', nullable: true })
  resourceId?: string;

  /**
   * The actual encrypted data (stored as base64 text)
   * SECURITY: Server cannot decrypt this without the encryption key
   */
  @Column({ type: 'text' })
  encryptedData!: string;

  /**
   * Metadata needed for decryption
   * Contains: IV, authentication tag, algorithm, etc.
   */
  @Column({ type: 'jsonb' })
  encryptionMetadata!: EncryptionMetadata;

  /**
   * User who created this encrypted data
   */
  @Column()
  createdBy!: string;

  /**
   * Minimum security level required to access this data
   * Users with lower security levels cannot retrieve the blob
   */
  @Column({ type: 'int', default: 1 })
  minSecurityLevel!: number;

  /**
   * Specific roles allowed to access this data
   * NULL = all org members can access (subject to security level)
   */
  @Column({ type: 'text', array: true, nullable: true })
  allowedRoles?: string[];

  /**
   * When this data was encrypted
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * When this data was last updated
   * (Note: Updates should re-encrypt with new IV)
   */
  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Number of times this data has been accessed
   * Useful for analytics and identifying sensitive data
   */
  @Column({ type: 'int', default: 0 })
  accessedCount!: number;

  /**
   * Last time this data was accessed
   */
  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt?: Date;

  /**
   * Soft delete flag
   * Allows recovery of accidentally deleted data
   */
  @Column({ default: false })
  isDeleted!: boolean;

  /**
   * When this data was deleted
   */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  /**
   * User who deleted this data
   */
  @Column({ nullable: true })
  deletedBy?: string;

  /**
   * Helper: Check if user meets security level requirement
   */
  meetsSecurityLevel(userSecurityLevel: number): boolean {
    return userSecurityLevel >= this.minSecurityLevel;
  }

  /**
   * Helper: Check if user's role is allowed
   */
  isRoleAllowed(userRole: string): boolean {
    // If no specific roles required, all roles allowed
    if (!this.allowedRoles || this.allowedRoles.length === 0) {
      return true;
    }
    return this.allowedRoles.includes(userRole);
  }

  /**
   * Helper: Increment access counter
   */
  incrementAccessCount(): void {
    this.accessedCount += 1;
    this.lastAccessedAt = new Date();
  }

  /**
   * Helper: Soft delete
   */
  softDelete(deletedBy: string): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
  }

  /**
   * Helper: Restore from soft delete
   */
  restore(): void {
    this.isDeleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;
  }
}
