import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    userId!: string;

    @Classified(DataClassification.RESTRICTED, { reason: 'Hashed authentication token' })
    @Column()
    tokenHash!: string;

    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    @Column({ default: false })
    revoked!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    revokedAt?: Date;

    @Column({ nullable: true })
    replacedByToken?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address' })
    @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
    ipAddress?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info' })
    @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
    userAgent?: string;

    // Enhanced security fields
    @Classified(DataClassification.RESTRICTED, { reason: 'Encrypted authentication token' })
    @Column({ nullable: true, length: 512 })
    tokenEncrypted?: string; // AES-256-GCM encrypted token

    @Classified(DataClassification.RESTRICTED, { reason: 'Encryption initialization vector' })
    @Column({ nullable: true })
    encryptionIv?: string; // Initialization vector for decryption

    @Classified(DataClassification.RESTRICTED, { reason: 'Encryption auth tag' })
    @Column({ nullable: true })
    encryptionAuthTag?: string; // Authentication tag for AES-GCM

    // Token family tracking for breach detection
    @Column({ nullable: true })
    @Index()
    familyId?: string; // UUID linking related tokens

    @Column({ nullable: true })
    parentTokenId?: string; // Parent token in rotation chain

    @Column({ type: 'timestamp', nullable: true })
    lastUsedAt?: Date; // Track usage for suspicious activity

    @Column({ nullable: true })
    location?: string; // Geolocation for anomaly detection

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
