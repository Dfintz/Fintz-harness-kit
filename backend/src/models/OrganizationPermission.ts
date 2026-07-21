import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { isIPAllowed } from '../utils/ipWhitelist';

import { Organization } from './Organization';
import { User } from './User';

/**
 * Permission scope levels
 */
export enum PermissionScope {
  ORGANIZATION = 'organization', // Applies to entire organization
  DIVISION = 'division', // Applies to division and below
  DEPARTMENT = 'department', // Applies to department and below
  TEAM = 'team', // Applies to team only
  CUSTOM = 'custom', // Custom scope
}

/**
 * Resource types that can be permissioned
 */
export enum ResourceType {
  FLEET = 'fleet',
  SHIP = 'ship',
  MEMBER = 'member',
  MEMBERS = 'members',
  EVENT = 'event',
  FINANCE = 'finance',
  TREASURY = 'treasury',
  COMMISSARY = 'commissary',
  LOOT = 'loot',
  CONTRACT = 'contract',
  RECRUITMENT = 'recruitment',
  LOGISTICS = 'logistics',
  SETTINGS = 'settings',
  PERMISSIONS = 'permissions',
  HIERARCHY = 'hierarchy',
  ANALYTICS = 'analytics',
  INTEL = 'intel',
  CUSTOM = 'custom',
}

/**
 * Permission actions
 */
export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  APPROVE = 'approve',
  MANAGE = 'manage',
  ADMIN = 'admin',
  ALL = 'all',
}

/**
 * Granular organization permission model
 * Supports resource-level permissions with inheritance
 */
@Entity('organization_permissions')
@Index(['organizationId', 'userId'])
@Index(['organizationId', 'resource'])
@Index(['scope'])
@Index(['isActive'])
export class OrganizationPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ nullable: true })
  userId?: string; // If null, applies to role

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  roleId?: string; // Role this permission applies to

  // ==================== PERMISSION DEFINITION ====================

  @Column({
    type: 'enum',
    enum: ResourceType,
  })
  resource!: ResourceType;

  @Column({ nullable: true })
  resourceId?: string; // Specific resource ID (null = all resources of type)

  @Column('simple-array')
  actions!: PermissionAction[]; // Actions allowed (view, create, edit, delete, etc.)

  @Column({
    type: 'enum',
    enum: PermissionScope,
    default: PermissionScope.ORGANIZATION,
  })
  scope!: PermissionScope;

  // ==================== INHERITANCE ====================

  @Column({ default: true })
  inheritable!: boolean; // Can be inherited by child organizations

  @Column({ default: false })
  inherited!: boolean; // Was inherited from parent organization

  @Column({ nullable: true })
  inheritedFrom?: string; // Parent organization ID if inherited

  @Column({ default: 1 })
  priority!: number; // Higher priority overrides lower (1-10)

  // ==================== CONDITIONS & RESTRICTIONS ====================

  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    timeRestriction?: {
      startTime?: string; // HH:mm format
      endTime?: string;
      daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    };
    ipRestriction?: {
      allowedIPs?: string[];
      blockedIPs?: string[];
    };
    resourceConditions?: Record<string, unknown>; // Custom conditions per resource
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // ==================== STATUS ====================

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  expiresAt?: Date; // Optional expiration

  @Column({ nullable: true })
  grantedBy?: string; // User ID who granted this permission

  @Column({ nullable: true })
  reason?: string; // Reason for granting permission

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if permission is expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  /**
   * Check if permission is currently valid
   */
  isValid(): boolean {
    return this.isActive && !this.isExpired();
  }

  /**
   * Check if permission allows specific action
   */
  allowsAction(action: PermissionAction): boolean {
    return this.actions.includes(action) || this.actions.includes(PermissionAction.ALL);
  }

  /**
   * Check if permission applies to specific resource
   */
  appliesToResource(resourceId?: string): boolean {
    // If no resourceId specified in permission, applies to all resources of type
    if (!this.resourceId) {
      return true;
    }
    // Otherwise, must match specific resource
    return this.resourceId === resourceId;
  }

  /**
   * Check if permission matches time restrictions
   */
  matchesTimeRestrictions(): boolean {
    if (!this.conditions?.timeRestriction) {
      return true;
    }

    const now = new Date();
    const restriction = this.conditions.timeRestriction;

    // Check day of week
    if (restriction.daysOfWeek && restriction.daysOfWeek.length > 0) {
      const currentDay = now.getDay();
      if (!restriction.daysOfWeek.includes(currentDay)) {
        return false;
      }
    }

    // Check time of day
    if (restriction.startTime && restriction.endTime) {
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < restriction.startTime || currentTime > restriction.endTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if permission matches IP restrictions
   * @param requestIP IP address of the request
   */
  matchesIPRestrictions(requestIP?: string): boolean {
    if (!this.conditions?.ipRestriction) {
      return true;
    }

    const restriction = this.conditions.ipRestriction;

    const result = isIPAllowed(requestIP, restriction.allowedIPs, restriction.blockedIPs);

    return result.allowed;
  }
}

/**
 * Permission template definitions
 */
export const PermissionTemplates = {
  OWNER: {
    name: 'Owner',
    description: 'Full access to all resources',
    permissions: [
      {
        resource: ResourceType.CUSTOM,
        actions: [PermissionAction.ALL],
        scope: PermissionScope.ORGANIZATION,
      },
    ],
  },
  ADMIN: {
    name: 'Administrator',
    description: 'Administrative access to most resources',
    permissions: [
      {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.ALL],
        scope: PermissionScope.ORGANIZATION,
      },
      {
        resource: ResourceType.MEMBER,
        actions: [PermissionAction.ALL],
        scope: PermissionScope.ORGANIZATION,
      },
      {
        resource: ResourceType.EVENT,
        actions: [PermissionAction.ALL],
        scope: PermissionScope.ORGANIZATION,
      },
      {
        resource: ResourceType.SETTINGS,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
        scope: PermissionScope.ORGANIZATION,
      },
    ],
  },
  MANAGER: {
    name: 'Manager',
    description: 'Department-level management access',
    permissions: [
      {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
        scope: PermissionScope.DEPARTMENT,
      },
      {
        resource: ResourceType.MEMBER,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
        scope: PermissionScope.DEPARTMENT,
      },
      {
        resource: ResourceType.EVENT,
        actions: [PermissionAction.ALL],
        scope: PermissionScope.DEPARTMENT,
      },
    ],
  },
  MEMBER: {
    name: 'Member',
    description: 'Basic member access',
    permissions: [
      {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        scope: PermissionScope.ORGANIZATION,
      },
      {
        resource: ResourceType.EVENT,
        actions: [PermissionAction.VIEW],
        scope: PermissionScope.ORGANIZATION,
      },
    ],
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        scope: PermissionScope.ORGANIZATION,
      },
      {
        resource: ResourceType.MEMBER,
        actions: [PermissionAction.VIEW],
        scope: PermissionScope.ORGANIZATION,
      },
    ],
  },
};
