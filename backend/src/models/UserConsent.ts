import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

import { User } from './User';

/**
 * Consent Types for GDPR Compliance
 */
export enum ConsentType {
    ESSENTIAL = 'essential',           // Required for basic functionality
    ANALYTICS = 'analytics',           // Usage analytics and telemetry
    MARKETING = 'marketing',           // Marketing communications
    THIRD_PARTY = 'third_party',       // Third-party integrations (Discord, etc.)
    DATA_PROCESSING = 'data_processing' // General data processing consent
}

/**
 * User Consent Entity
 * Tracks explicit user consent for GDPR compliance
 * Maintains audit trail of consent changes
 */
@Entity('user_consents')
@Index(['userId', 'consentType'], { unique: true })
export class UserConsent {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column({ type: 'varchar', length: 255 })
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column({
        type: 'enum',
        enum: ConsentType
    })
    consentType!: ConsentType;

    @Column({ type: 'boolean' })
    granted!: boolean;

    @Column({ type: 'text', nullable: true })
    purpose?: string; // Description of why consent is needed

    @Column({ type: 'varchar', length: 100, nullable: true })
    version?: string; // Privacy policy version at time of consent

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address for consent audit' })
    @Column({ type: 'text', nullable: true, transformer: conditionalEncryptionTransformer })
    ipAddress?: string; // IP address when consent was given

    @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info for consent audit' })
    @Column({ type: 'text', nullable: true, transformer: conditionalEncryptionTransformer })
    userAgent?: string; // Browser/client info when consent was given

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt?: Date; // Some consents may have expiration dates
}
