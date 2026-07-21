import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { User } from './User';

/**
 * PasswordlessToken Entity
 * 
 * Stores tokens for passwordless authentication via magic links or email codes.
 * Supports email-based login without requiring a password.
 * 
 * Features:
 * - Secure token generation and storage
 * - Token expiration handling
 * - Single-use token enforcement
 * - IP and user agent tracking for security
 * - Rate limiting support via attempt tracking
 */
@Entity('passwordless_tokens')
export class PasswordlessToken {
    @PrimaryColumn('uuid')
    id!: string;

    /**
     * User ID this token belongs to (null for new user registration)
     */
    @Index()
    @Column({ nullable: true })
    userId?: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'userId' })
    user?: User;

    /**
     * Email address the magic link was sent to
     */
    @Index()
    @Column({ type: 'varchar', length: 255 })
    email!: string;

    /**
     * The token hash (tokens are hashed for security)
     */
    @Index()
    @Column({ type: 'varchar', length: 128 })
    tokenHash!: string;

    /**
     * Short code for email verification (6 digits)
     * Optional alternative to magic link
     */
    @Column({ type: 'varchar', length: 6, nullable: true })
    shortCode?: string;

    /**
     * Token type: 'magic_link' or 'code'
     */
    @Column({ type: 'varchar', length: 20, default: 'magic_link' })
    tokenType!: 'magic_link' | 'code';

    /**
     * When the token expires
     */
    @Index()
    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    /**
     * Whether the token has been used
     */
    @Column({ type: 'boolean', default: false })
    used!: boolean;

    /**
     * When the token was used
     */
    @Column({ type: 'timestamp', nullable: true })
    usedAt?: Date;

    /**
     * Number of verification attempts (for rate limiting)
     */
    @Column({ type: 'int', default: 0 })
    attempts!: number;

    /**
     * Maximum allowed verification attempts
     */
    @Column({ type: 'int', default: 5 })
    maxAttempts!: number;

    /**
     * IP address from which the token was requested
     */
    @Column({ type: 'varchar', length: 45, nullable: true })
    requestIp?: string;

    /**
     * User agent from which the token was requested
     */
    @Column({ type: 'text', nullable: true })
    requestUserAgent?: string;

    /**
     * IP address from which the token was verified
     */
    @Column({ type: 'varchar', length: 45, nullable: true })
    verifyIp?: string;

    /**
     * User agent from which the token was verified
     */
    @Column({ type: 'text', nullable: true })
    verifyUserAgent?: string;

    /**
     * Purpose of the passwordless token
     */
    @Column({ type: 'varchar', length: 30, default: 'login' })
    purpose!: 'login' | 'register' | 'link_account' | 'verify_email';

    @CreateDateColumn()
    createdAt!: Date;

    /**
     * Check if the token is expired
     */
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    /**
     * Check if maximum attempts have been exceeded
     */
    isLocked(): boolean {
        return this.attempts >= this.maxAttempts;
    }

    /**
     * Check if the token can be used
     */
    isValid(): boolean {
        return !this.used && !this.isExpired() && !this.isLocked();
    }
}
