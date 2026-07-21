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
 * Member Public Key Model
 *
 * Stores RSA-OAEP public keys for organization members.
 * Used in the hybrid encryption model where:
 * 1. Each member has an RSA key pair (private key client-side only)
 * 2. Data Encryption Keys (DEKs) are wrapped with recipients' public keys
 * 3. Only the intended recipients can unwrap and decrypt data
 *
 * SECURITY:
 * - Only the PUBLIC key is stored server-side
 * - Private keys NEVER leave the client
 * - Key fingerprint enables verification without exposing key material
 */
@Entity('member_public_keys')
@Index(['organizationId', 'userId'], { unique: true })
@Index(['keyFingerprint'], { unique: true })
export class MemberPublicKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column()
  userId!: string;

  /**
   * RSA-OAEP public key in SPKI format, base64-encoded.
   */
  @Column({ type: 'text' })
  publicKey!: string;

  /**
   * SHA-256 hex hash of the SPKI-encoded public key.
   * Used for quick identity verification without exposing key material.
   */
  @Column({ length: 64 })
  keyFingerprint!: string;

  /**
   * RSA key size in bits (e.g. 4096).
   */
  @Column({ type: 'int', default: 4096 })
  keySize!: number;

  /**
   * Algorithm identifier for key usage.
   */
  @Column({ length: 32, default: 'RSA-OAEP-SHA256' })
  algorithm!: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;
}
