import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { UserPreferences } from '../types/models';
import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

@Entity('users')
export class User {
  @PrimaryColumn()
  id!: string;

  @Classified(DataClassification.INTERNAL, { reason: 'User identifier' })
  @Column({ unique: true })
  username!: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'PII - email address' })
  @Index()
  @Column({
    unique: true,
    type: 'text',
    transformer: conditionalEncryptionTransformer,
  })
  email!: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'External platform identifier' })
  @Index()
  @Column({ unique: true })
  discordId!: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'External platform identifier' })
  @Index()
  @Column({ nullable: true, unique: true })
  googleId?: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'External platform identifier' })
  @Index()
  @Column({ nullable: true, unique: true })
  twitchId?: string;

  @Classified(DataClassification.RESTRICTED, { reason: 'Authentication credential' })
  @Column({
    nullable: true,
    type: 'text',
    transformer: conditionalEncryptionTransformer,
    select: false, // Don't include password in default queries for security
  })
  password?: string;

  @Index()
  @Column({ default: 'user' })
  role!: string;

  @Column({ nullable: true })
  activeOrgId?: string;

  @Classified(DataClassification.RESTRICTED, { reason: 'TOTP secret key' })
  @Column({
    nullable: true,
    type: 'text',
    transformer: conditionalEncryptionTransformer,
  })
  twoFactorSecret?: string;

  @Column({ default: false })
  twoFactorEnabled!: boolean;

  @Classified(DataClassification.RESTRICTED, { reason: '2FA recovery codes' })
  @Column('simple-array', { nullable: true })
  backupCodes?: string[];

  @Classified(DataClassification.RESTRICTED, { reason: 'Account recovery codes' })
  @Column('simple-array', { nullable: true })
  recoveryCodes?: string[];

  @Column({ default: 0 })
  failedTwoFactorAttempts!: number;

  @Column({ nullable: true })
  twoFactorLockedUntil?: Date;

  @Column({ default: 0 })
  failedLoginAttempts!: number;

  @Column({ nullable: true })
  lockedUntil?: Date;

  // Authentication tracking
  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'IP address - network identifier' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  lastLoginIp?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastFailedLoginAt?: Date;

  // Activity tracking
  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt?: Date;

  // Profile fields
  @Column({ nullable: true })
  displayName?: string;

  @Column({ nullable: true })
  bio?: string;

  @Column({ type: 'text', nullable: true })
  avatar?: string;

  @Column('simple-json', { nullable: true })
  preferences?: UserPreferences;

  @Column('simple-array', { nullable: true })
  previousUsernames?: string[];

  @Column({ default: 0 })
  profileViews!: number;

  @Column({ default: 0 })
  loginCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastProfileViewAt?: Date;

  // RSI Account Verification fields
  @Classified(DataClassification.CONFIDENTIAL, { reason: 'External game account identifier' })
  @Index()
  @Column({ nullable: true })
  rsiHandle?: string;

  // Immutable UEE Citizen Record number (e.g. "15258"), captured at verification.
  // Survives RSI handle/moniker renames, so it anchors the verified link and
  // enables dedup / anti-impersonation across accounts.
  @Classified(DataClassification.CONFIDENTIAL, { reason: 'External game account identifier' })
  @Index()
  @Column({ nullable: true })
  rsiCitizenRecord?: string;

  @Column({ default: false })
  rsiVerified!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  rsiVerifiedAt?: Date;

  @Classified(DataClassification.RESTRICTED, { reason: 'Verification secret code' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  rsiVerificationCode?: string;

  @Column({ type: 'timestamp', nullable: true })
  rsiVerificationCodeExpiresAt?: Date;

  // Manual RSI verification fields (fallback when API unavailable)
  @Column({ default: false })
  manualVerificationRequested!: boolean;

  @Column({ nullable: true })
  manualVerificationReason?: string;

  @Column({ nullable: true })
  manualVerificationApprovedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  manualVerificationApprovedAt?: Date;

  @Column({ nullable: true })
  manualVerificationRejectedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  manualVerificationRejectedAt?: Date;

  @Column({ nullable: true })
  manualVerificationNotes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
