import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { User } from './User';

/**
 * PasswordHistory entity
 * Stores hashed previous passwords to prevent password reuse
 * 
 * Security Features:
 * - Stores only bcrypt hashed passwords (never plaintext)
 * - Automatically tracks password change timestamps
 * - Supports configurable history depth
 * - Indexed by userId for efficient lookups
 * - Cascade delete when user is removed
 */
@Entity('password_history')
@Index(['userId'])
@Index(['userId', 'createdAt'])
export class PasswordHistory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255 })
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    /**
     * The hashed password (bcrypt hash)
     * This should never contain plaintext passwords
     */
    @Column({ type: 'text' })
    passwordHash!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
