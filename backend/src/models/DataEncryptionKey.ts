import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * Data Encryption Key (DEK) Model
 *
 * Stores metadata and wrapped copies of per-resource AES-256-GCM keys.
 * Part of the hybrid encryption model:
 * 1. A fresh DEK is generated client-side for each encrypted resource
 * 2. The DEK is wrapped (RSA-OAEP) with each authorized user's public key
 * 3. Server stores the wrapped DEK copies + encrypted data
 * 4. Users unwrap DEK with their private key → decrypt data
 *
 * SECURITY:
 * - Raw DEK bytes are NEVER stored on the server
 * - Only RSA-OAEP-wrapped copies are stored
 * - Each wrapped copy can only be unwrapped by the private key holder
 */
@Entity('data_encryption_keys')
@Index(['organizationId'])
@Index(['dekId'], { unique: true })
@Index(['dataType', 'resourceId'])
export class DataEncryptionKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * Unique identifier for this DEK (hash-derived, not the key itself).
   */
  @Column({ length: 64, unique: true })
  dekId!: string;

  /**
   * Type of data this DEK encrypts (e.g. 'document', 'message', 'note').
   */
  @Column({ length: 64 })
  dataType!: string;

  /**
   * Specific resource ID this DEK is bound to (nullable for shared/multi-resource DEKs).
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId?: string;

  /**
   * Algorithm used for the DEK (AES-GCM-256).
   */
  @Column({ length: 32, default: 'AES-GCM-256' })
  algorithm!: string;

  /**
   * Wrapped DEK copies, one per authorized user.
   * Format: { "userId": "base64_rsa_oaep_wrapped_dek", ... }
   *
   * Each entry is the raw DEK bytes encrypted with that user's RSA-OAEP public key.
   */
  @Column({ type: 'jsonb' })
  wrappedKeys!: Record<string, string>;

  /**
   * DEK version (for re-encryption / rotation).
   */
  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column()
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  // ── Helpers ──────────────────────────────────────────────

  hasUserAccess(userId: string): boolean {
    return userId in this.wrappedKeys;
  }

  getWrappedKeyForUser(userId: string): string | null {
    return this.wrappedKeys[userId] || null;
  }

  addWrappedKeyForUser(userId: string, wrappedDEK: string): void {
    this.wrappedKeys = { ...this.wrappedKeys, [userId]: wrappedDEK };
  }

  removeWrappedKeyForUser(userId: string): void {
    const { [userId]: _, ...remaining } = this.wrappedKeys;
    this.wrappedKeys = remaining;
  }

  getUsersWithAccess(): string[] {
    return Object.keys(this.wrappedKeys);
  }
}
