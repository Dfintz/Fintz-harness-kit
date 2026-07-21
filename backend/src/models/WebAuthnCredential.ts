import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { User } from './User';

/**
 * WebAuthnCredential Entity
 * 
 * Stores WebAuthn/FIDO2 credential information for passwordless authentication.
 * Supports security keys, platform authenticators (Touch ID, Windows Hello), and passkeys.
 * 
 * Features:
 * - Credential ID and public key storage
 * - Counter tracking for replay attack prevention
 * - Authenticator metadata (AAGUID, transports)
 * - Device naming for user-friendly management
 * - Backup eligibility and state tracking (for passkeys)
 */
@Entity('webauthn_credentials')
export class WebAuthnCredential {
    @PrimaryColumn('uuid')
    id!: string;

    @Index()
    @Column()
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user?: User;

    /**
     * The credential ID returned by the authenticator (base64url encoded)
     * Used to identify the credential during authentication
     */
    @Index()
    @Column({ type: 'text' })
    credentialId!: string;

    /**
     * The public key of the credential (base64url encoded)
     * Used to verify authentication assertions
     */
    @Column({ type: 'text' })
    credentialPublicKey!: string;

    /**
     * Signature counter for replay attack prevention
     * Must increase with each authentication
     */
    @Column({ type: 'bigint', default: 0 })
    counter!: number;

    /**
     * Authenticator Attestation GUID
     * Identifies the authenticator model
     */
    @Column({ type: 'varchar', length: 36, nullable: true })
    aaguid?: string;

    /**
     * Credential type (usually 'public-key')
     */
    @Column({ type: 'varchar', length: 20, default: 'public-key' })
    credentialType!: string;

    /**
     * User-friendly name for the credential
     * e.g., "MacBook Touch ID", "YubiKey 5C"
     */
    @Column({ type: 'varchar', length: 100, nullable: true })
    deviceName?: string;

    /**
     * Transports supported by the authenticator
     * e.g., ['usb', 'nfc', 'ble', 'internal', 'hybrid']
     */
    @Column({ type: 'simple-json', nullable: true })
    transports?: string[];

    /**
     * Whether the credential is backed up (for passkeys)
     * Indicates cloud sync capability
     */
    @Column({ type: 'boolean', default: false })
    backedUp!: boolean;

    /**
     * Whether the credential is eligible for backup
     */
    @Column({ type: 'boolean', default: false })
    backupEligible!: boolean;

    /**
     * Attestation format used during registration
     */
    @Column({ type: 'varchar', length: 50, nullable: true })
    attestationFormat?: string;

    /**
     * Whether the credential is currently active
     */
    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    /**
     * Last time this credential was used for authentication
     */
    @Column({ type: 'timestamp', nullable: true })
    lastUsedAt?: Date;

    /**
     * Number of times this credential has been used
     */
    @Column({ type: 'int', default: 0 })
    useCount!: number;

    /**
     * IP address from which the credential was registered
     */
    @Column({ type: 'varchar', length: 45, nullable: true })
    registrationIp?: string;

    /**
     * User agent from which the credential was registered
     */
    @Column({ type: 'text', nullable: true })
    registrationUserAgent?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
