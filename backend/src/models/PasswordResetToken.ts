import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { User } from './User';

/**
 * PasswordResetToken entity
 * Stores password reset tokens for email-based password recovery
 */
@Entity('password_reset_tokens')
@Index(['token'], { unique: true })
@Index(['userId'])
@Index(['expiresAt'])
export class PasswordResetToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column({ unique: true })
    token!: string;

    @Column()
    expiresAt!: Date;

    @Column({ default: false })
    used!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    /**
     * Check if the token has expired
     * @returns True if token is expired, false otherwise
     */
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    /**
     * Mark the token as used
     */
    markAsUsed(): void {
        this.used = true;
    }

    /**
     * Check if token is valid (not expired and not used)
     * @returns True if token is valid, false otherwise
     */
    isValid(): boolean {
        return !this.used && !this.isExpired();
    }
}
