import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * RecoveryToken Model
 * Stores recovery tokens for account recovery and 2FA reset
 */
@Entity('recovery_tokens')
export class RecoveryToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  tokenHash: string; // Hashed recovery token

  @Column({ nullable: true })
  token?: string; // Plain token (for temporary storage before hashing)

  @Column({ type: 'varchar' })
  type: 'email' | 'recovery_code' | 'admin'; // Recovery method type

  @Column({ type: 'timestamp' })
  @Index()
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @Column({ default: false })
  isUsed: boolean; // Alias for 'used' for backward compatibility

  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  adminUserId?: string; // For admin-assisted recovery

  @Column({ nullable: true, length: 1000 })
  reason?: string; // Reason for recovery (especially for admin)

  @CreateDateColumn()
  createdAt: Date;
}
