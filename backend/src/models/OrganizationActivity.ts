import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { Organization } from './Organization';
import { User } from './User';

/**
 * Organization activity action types
 */
export enum OrgActivityAction {
    // Organization management
    ORG_CREATED = 'org.created',
    ORG_UPDATED = 'org.updated',
    ORG_DELETED = 'org.deleted',
    ORG_ARCHIVED = 'org.archived',
    ORG_ACTIVATED = 'org.activated',
    
    // Hierarchy management
    SUB_ORG_CREATED = 'hierarchy.sub_org_created',
    ORG_MOVED = 'hierarchy.org_moved',
    ORG_DETACHED = 'hierarchy.org_detached',
    HIERARCHY_RESTRUCTURED = 'hierarchy.restructured',
    
    // Member management
    MEMBER_ADDED = 'member.added',
    MEMBER_REMOVED = 'member.removed',
    MEMBER_ROLE_CHANGED = 'member.role_changed',
    MEMBER_PROMOTED = 'member.promoted',
    MEMBER_DEMOTED = 'member.demoted',
    MEMBER_TRANSFERRED = 'member.transferred',
    
    // Permission management
    PERMISSION_GRANTED = 'permission.granted',
    PERMISSION_REVOKED = 'permission.revoked',
    PERMISSION_UPDATED = 'permission.updated',
    ROLE_CREATED = 'permission.role_created',
    ROLE_DELETED = 'permission.role_deleted',
    
    // Settings
    SETTINGS_UPDATED = 'settings.updated',
    METADATA_UPDATED = 'metadata.updated',
    
    // Security
    ACCESS_DENIED = 'security.access_denied',
    SECURITY_ALERT = 'security.alert',
    
    // Integration
    INTEGRATION_ENABLED = 'integration.enabled',
    INTEGRATION_DISABLED = 'integration.disabled'
}

/**
 * Activity severity levels
 */
export enum ActivitySeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

/**
 * Organization activity logging
 * Tracks all actions within organization for audit trail
 */
@Entity('organization_activities')
@Index(['organizationId', 'timestamp'])
@Index(['action'])
@Index(['actorId'])
@Index(['severity'])
@Index(['targetOrgId'])
export class OrganizationActivity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    organizationId!: string;

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organizationId' })
    organization!: Organization;

    @Column({
        type: 'enum',
        enum: OrgActivityAction
    })
    action!: OrgActivityAction;

    // ==================== ACTOR INFORMATION ====================

    @Column({ nullable: true })
    actorId?: string; // User who performed action

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'actorId' })
    actor?: User;

    @Column({ nullable: true })
    actorType?: 'user' | 'system' | 'api'; // Type of actor

    @Column({ nullable: true })
    actorName?: string; // Cached name for historical reference

    // ==================== TARGET INFORMATION ====================

    @Column({ nullable: true })
    targetUserId?: string; // User affected by action

    @Column({ nullable: true })
    targetUserName?: string; // Cached name

    @Column({ nullable: true })
    targetOrgId?: string; // Organization affected (for hierarchy operations)

    @Column({ nullable: true })
    targetOrgName?: string; // Cached name

    @Column({ nullable: true })
    resourceType?: string; // Type of resource affected

    @Column({ nullable: true })
    resourceId?: string; // ID of resource affected

    // ==================== ACTIVITY DETAILS ====================

    @Column({ type: 'text', nullable: true })
    description?: string; // Human-readable description

    @Column({ type: 'jsonb', nullable: true })
    before?: Record<string, unknown>; // State before change

    @Column({ type: 'jsonb', nullable: true })
    after?: Record<string, unknown>; // State after change

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>; // Additional context

    // ==================== CATEGORIZATION ====================

    @Column({
        type: 'enum',
        enum: ActivitySeverity,
        default: ActivitySeverity.INFO
    })
    severity!: ActivitySeverity;

    @Column('simple-array', { nullable: true })
    tags?: string[]; // For categorization and filtering

    @Column({ default: false })
    requiresReview!: boolean; // Flag for activities needing review

    @Column({ default: false })
    reviewed!: boolean; // Has been reviewed

    @Column({ nullable: true })
    reviewedBy?: string; // User who reviewed

    @Column({ nullable: true })
    reviewedAt?: Date;

    // ==================== REQUEST CONTEXT ====================

    @Column({ nullable: true })
    ipAddress?: string;

    @Column({ nullable: true, type: 'text' })
    userAgent?: string;

    @Column({ nullable: true })
    method?: string; // HTTP method

    @Column({ nullable: true, type: 'text' })
    endpoint?: string; // API endpoint

    @Column({ nullable: true })
    statusCode?: number;

    @CreateDateColumn()
    timestamp!: Date;

    // ==================== HELPER METHODS ====================

    /**
     * Get activity severity as number (for sorting)
     */
    getSeverityLevel(): number {
        const levels = {
            [ActivitySeverity.INFO]: 1,
            [ActivitySeverity.WARNING]: 2,
            [ActivitySeverity.ERROR]: 3,
            [ActivitySeverity.CRITICAL]: 4
        };
        return levels[this.severity] || 1;
    }

    /**
     * Check if activity needs attention
     */
    needsAttention(): boolean {
        return this.requiresReview && !this.reviewed;
    }

    /**
     * Get changed fields
     */
    getChangedFields(): string[] {
        if (!this.before || !this.after) {return [];}
        
        const changed: string[] = [];
        const allKeys = new Set([
            ...Object.keys(this.before),
            ...Object.keys(this.after)
        ]);

        for (const key of allKeys) {
            if (JSON.stringify(this.before[key]) !== JSON.stringify(this.after[key])) {
                changed.push(key);
            }
        }

        return changed;
    }

    /**
     * Generate human-readable summary
     */
    getSummary(): string {
        if (this.description) {return this.description;}

        const actor = this.actorName || 'System';
        const target = this.targetUserName || this.targetOrgName || 'resource';

        switch (this.action) {
            case OrgActivityAction.MEMBER_ADDED:
                return `${actor} added ${target} to the organization`;
            case OrgActivityAction.MEMBER_REMOVED:
                return `${actor} removed ${target} from the organization`;
            case OrgActivityAction.PERMISSION_GRANTED:
                return `${actor} granted permissions to ${target}`;
            case OrgActivityAction.ORG_UPDATED:
                return `${actor} updated organization settings`;
            case OrgActivityAction.SUB_ORG_CREATED:
                return `${actor} created sub-organization: ${target}`;
            default:
                return `${actor} performed ${this.action}`;
        }
    }
}

/**
 * Activity filtering options
 */
export interface ActivityFilter {
    actions?: OrgActivityAction[];
    actorIds?: string[];
    severity?: ActivitySeverity[];
    startDate?: Date;
    endDate?: Date;
    targetUserId?: string;
    targetOrgId?: string;
    resourceType?: string;
    requiresReview?: boolean;
    reviewed?: boolean;
    tags?: string[];
}
