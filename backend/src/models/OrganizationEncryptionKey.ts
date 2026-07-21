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
 * Organization Encryption Key Model
 *
 * Stores metadata about organization encryption keys.
 * SECURITY: The actual encryption key is NEVER stored on the server.
 * Only encrypted "key wrappers" are stored (keys encrypted with user passwords).
 *
 * Zero-Knowledge Architecture:
 * - Actual key generated client-side only
 * - Key encrypted with user password before storage
 * - Server cannot decrypt the key wrappers
 * - Multiple leaders can have their own encrypted copy
 */
@Entity('organization_encryption_keys')
@Index(['organizationId'])
@Index(['keyId'], { unique: true })
export class OrganizationEncryptionKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization this key belongs to
   */
  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * Unique identifier for this key (not the actual key!)
   * Used to reference which key encrypted which data
   */
  @Column({ length: 64, unique: true })
  keyId!: string;

  /**
   * Encryption algorithm used
   * Default: AES-256-GCM (authenticated encryption)
   */
  @Column({ length: 32, default: 'AES-256-GCM' })
  algorithm!: string;

  /**
   * Key version (for key rotation)
   * Incremented each time key is rotated
   */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /**
   * Encrypted key wrappers
   * Format: { "userId": "base64_encrypted_key", ... }
   *
   * Each wrapper is the organization's encryption key encrypted
   * with that user's password-derived key (PBKDF2).
   *
   * Multiple users (leaders) can have access to the same org key.
   */
  @Column({ type: 'jsonb' })
  keyWrappers!: Record<string, string>;

  /**
   * Optional hint for key recovery
   * WARNING: Should NOT reveal the actual recovery phrase
   * Example: "Recovery phrase stored in LastPass" or "Ask John for backup"
   */
  @Column({ type: 'text', nullable: true })
  recoveryHint?: string;

  /**
   * Whether this key requires a recovery phrase
   * If true, user must have saved the BIP39 mnemonic
   */
  @Column({ default: true })
  requiresRecoveryPhrase!: boolean;

  /**
   * User who created/initialized this key
   */
  @Column()
  createdBy!: string;

  /**
   * When the key was created
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * When the key was last rotated
   * NULL if never rotated
   */
  @Column({ type: 'timestamp', nullable: true })
  rotatedAt?: Date;

  /**
   * Whether this is the active encryption key
   * Only one key per organization can be active
   * Old keys kept for decrypting historical data
   */
  @Column({ default: true })
  isActive!: boolean;

  /**
   * Last time this key was used for encryption/decryption
   */
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  /**
   * Number of times this key has been used
   * Useful for tracking and deciding when to rotate
   */
  @Column({ type: 'int', default: 0 })
  usageCount!: number;

  /**
   * Helper: Check if user has access to this key
   */
  hasUserAccess(userId: string): boolean {
    return userId in this.keyWrappers;
  }

  /**
   * Helper: Get encrypted key wrapper for user
   */
  getKeyWrapperForUser(userId: string): string | null {
    return this.keyWrappers[userId] || null;
  }

  /**
   * Helper: Add key wrapper for new user
   */
  addKeyWrapperForUser(userId: string, wrappedKey: string): void {
    this.keyWrappers = {
      ...this.keyWrappers,
      [userId]: wrappedKey,
    };
  }

  /**
   * Helper: Remove key wrapper for user (revoke access)
   */
  removeKeyWrapperForUser(userId: string): void {
    const { [userId]: _, ...remaining } = this.keyWrappers;
    this.keyWrappers = remaining;
  }

  /**
   * Helper: Get list of user IDs with access
   */
  getUsersWithAccess(): string[] {
    return Object.keys(this.keyWrappers);
  }
}
