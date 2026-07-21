import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { User } from './User';

/**
 * UserActivity entity
 * Logs user actions for audit trail and security monitoring
 */
@Entity('user_activities')
@Index(['userId'])
@Index(['action'])
@Index(['timestamp'])
@Index(['userId', 'timestamp'])
export class UserActivity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column()
    action!: string;

    @Column({ nullable: true })
    resource?: string;

    @Column({ nullable: true })
    method?: string;

    @Column({ nullable: true })
    ipAddress?: string;

    @Column({ nullable: true, type: 'text' })
    userAgent?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ nullable: true })
    statusCode?: number;

    @Column({ type: 'int', nullable: true })
    duration?: number; // milliseconds

    @CreateDateColumn()
    timestamp!: Date;
}

/**
 * Common activity action types
 */
export enum ActivityAction {
    // Authentication
    LOGIN = 'auth.login',
    LOGOUT = 'auth.logout',
    LOGIN_FAILED = 'auth.login_failed',
    TWO_FACTOR_ENABLED = 'auth.2fa_enabled',
    TWO_FACTOR_DISABLED = 'auth.2fa_disabled',
    
    // User management
    USER_CREATED = 'user.created',
    USER_UPDATED = 'user.updated',
    USER_DELETED = 'user.deleted',
    PASSWORD_CHANGED = 'user.password_changed',
    EMAIL_CHANGED = 'user.email_changed',
    ROLE_CHANGED = 'user.role_changed',
    
    // Password reset
    PASSWORD_RESET_REQUESTED = 'auth.password_reset_requested',
    PASSWORD_RESET_COMPLETED = 'auth.password_reset_completed',
    PASSWORD_RESET_FAILED = 'auth.password_reset_failed',
    
    // Profile
    PROFILE_VIEWED = 'profile.viewed',
    PROFILE_UPDATED = 'profile.updated',
    
    // Organization
    ORG_JOINED = 'org.joined',
    ORG_LEFT = 'org.left',
    ORG_CREATED = 'org.created',
    
    // Security
    SECURITY_ALERT = 'security.alert',
    SUSPICIOUS_ACTIVITY = 'security.suspicious',
    ACCOUNT_LOCKED = 'security.locked',
    ACCOUNT_UNLOCKED = 'security.unlocked',
}
