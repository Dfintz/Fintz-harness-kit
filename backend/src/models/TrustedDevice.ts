import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

import { User } from './User';

/**
 * TrustedDevice Entity
 * 
 * Stores trusted device information for Zero Trust security.
 * Replaces the in-memory Map storage for persistence across server restarts.
 * 
 * Features:
 * - Device fingerprint tracking
 * - Trust level management (low, medium, high)
 * - Verification method tracking
 * - Last usage tracking for activity monitoring
 */
@Entity('trusted_devices')
export class TrustedDevice {
    @PrimaryColumn('uuid')
    id!: string;

    @Index()
    @Column()
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user?: User;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Device identifier hash' })
    @Index()
    @Column({ length: 64 })
    deviceFingerprint!: string;

    @Column({ nullable: true, length: 255 })
    deviceName?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info' })
    @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
    userAgent?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address' })
    @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
    ipAddress?: string;

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Physical location' })
    @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
    location?: string;

    @Column({ type: 'timestamp' })
    lastUsed!: Date;

    @Column({ default: true })
    isActive!: boolean;

    @Column({
        type: 'varchar',
        length: 20,
        default: 'medium'
    })
    trustLevel!: 'low' | 'medium' | 'high';

    @Column({ 
        nullable: true,
        type: 'varchar',
        length: 20
    })
    verificationMethod?: 'email' | '2fa' | 'sso';

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
