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
import { User } from './User';

export type KeyClaimStatus = 'pending' | 'claimed' | 'expired' | 'revoked';

/**
 * Encryption Key Claim Model
 *
 * Enables secure key distribution for organization E2E encryption.
 *
 * Flow:
 * 1. Admin who holds the org key creates a "claim" — the org key encrypted
 *    with a random one-time passphrase (PBKDF2 + AES-GCM, client-side).
 * 2. The encrypted blob is stored here; the passphrase is shared out-of-band.
 * 3. The recipient enters the passphrase in-browser to decrypt the org key,
 *    then re-wraps it with their own password.
 * 4. The claim is marked as used (single-use, time-limited).
 *
 * SECURITY: The server never sees the org key or the passphrase.
 *           Only the encrypted claim blob is stored.
 */
@Entity('encryption_key_claims')
@Index(['organizationId'])
@Index(['status', 'expiresAt'])
export class EncryptionKeyClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /** Which org encryption key this claim distributes */
  @Column({ length: 64 })
  keyId!: string;

  /** The org key encrypted with the claim passphrase (base64) */
  @Column({ type: 'text' })
  encryptedClaim!: string;

  /** Encryption metadata for the claim: {iv, salt, iterations, algorithm} */
  @Column({ type: 'jsonb' })
  claimMetadata!: {
    iv: string;
    salt: string;
    iterations: number;
    algorithm: string;
  };

  /** User who created this claim */
  @Column()
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  /** User who claimed this token (null until claimed) */
  @Column({ nullable: true })
  claimedBy?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'claimedBy' })
  claimant?: User;

  /** Admin-provided label for tracking (e.g., "For CommanderJohn") */
  @Column({ length: 100, nullable: true })
  label?: string;

  @Column({ length: 20, default: 'pending' })
  status!: KeyClaimStatus;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ── Helpers ──────────────────────────────────────────────

  get isExpired(): boolean {
    return this.status === 'pending' && new Date() > this.expiresAt;
  }

  get isClaimable(): boolean {
    return this.status === 'pending' && new Date() <= this.expiresAt;
  }

  markClaimed(userId: string): void {
    this.status = 'claimed';
    this.claimedBy = userId;
    this.claimedAt = new Date();
  }

  markExpired(): void {
    this.status = 'expired';
  }

  markRevoked(): void {
    this.status = 'revoked';
  }
}
