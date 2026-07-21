import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

/**
 * TokenBlacklist Model
 * Stores revoked JWT tokens for immediate invalidation
 */
@Entity('token_blacklist')
@Index(['tokenJti'], { unique: true })
@Index(['userId'])
@Index(['expiresAt'])
export class TokenBlacklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Classified(DataClassification.RESTRICTED, { reason: 'JWT identifier for revocation' })
  @Column({ unique: true })
  tokenJti: string; // JWT ID claim

  @Column()
  userId: string; // Token owner

  @Column({ type: 'timestamp' })
  expiresAt: Date; // Natural token expiration (for cleanup)

  @CreateDateColumn()
  revokedAt: Date; // When token was revoked

  @Column({ nullable: true })
  reason?: string; // Optional revocation reason

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  ipAddress?: string; // IP that requested revocation

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  userAgent?: string; // User agent that requested revocation
}
