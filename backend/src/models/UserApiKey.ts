import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

/**
 * UserApiKey Entity
 *
 * Stores hashed API keys for external integrations (e.g., Wingman AI).
 * The raw key is shown ONCE at creation and never stored — only the SHA-256 hash is persisted.
 *
 * Scopes control access:
 *   - 'read:activities' — read activity/operation data
 *   - 'write:activities' — join, respond to ready checks, acknowledge commands
 *   - 'read:fleet' — read fleet data
 *   - 'read:profile' — read own profile data
 *
 * @see docs/FRONTEND_UX_NAVIGATION_AUDIT.md — User Settings > API Keys tab
 */
@Entity('user_api_keys')
@Index('IDX_user_api_keys_user', ['userId'])
@Index('IDX_user_api_keys_hash', ['tokenHash'], { unique: true })
export class UserApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ length: 100 })
  name!: string;

  /**
   * Key prefix (first 8 chars) for identification in listings.
   * e.g., "fc_a1b2c3d4..." — allows users to identify which key is which.
   */
  @Column({ length: 16 })
  prefix!: string;

  /**
   * SHA-256 hash of the full API key.
   * The raw key is never stored.
   */
  @Classified(DataClassification.RESTRICTED, { reason: 'Hashed API key' })
  @Column({ length: 64 })
  tokenHash!: string;

  /**
   * Permission scopes granted to this key.
   */
  @Column('simple-json')
  scopes!: string[];

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ default: false })
  revoked!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  lastUsedIp?: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP at creation' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  createdByIp?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Check if this key is currently valid (not revoked and not expired).
   */
  isValid(): boolean {
    if (this.revoked) {
      return false;
    }
    if (this.expiresAt && this.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  /**
   * Check if this key has a specific scope.
   */
  hasScope(scope: string): boolean {
    return this.scopes.includes(scope) || this.scopes.includes('*');
  }
}
