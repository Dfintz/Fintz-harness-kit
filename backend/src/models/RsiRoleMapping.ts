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

import { TenantEntity } from './base/TenantEntity';
import { Role } from './Role';

/**
 * RBAC Permissions structure for role mappings
 */
export interface RbacPermissions {
  /** Permission to view fleet data */
  fleetView?: boolean;
  /** Permission to edit fleet data */
  fleetEdit?: boolean;
  /** Permission to manage fleet members */
  fleetManage?: boolean;
  /** Permission to view organization data */
  orgView?: boolean;
  /** Permission to edit organization settings */
  orgEdit?: boolean;
  /** Permission to manage organization members */
  orgManage?: boolean;
  /** Permission to view events */
  eventView?: boolean;
  /** Permission to create/edit events */
  eventManage?: boolean;
  /** Permission to view intel data */
  intelView?: boolean;
  /** Permission to manage intel */
  intelManage?: boolean;
  /** Admin permission - full access */
  admin?: boolean;
  /** Custom permissions object for extensibility */
  custom?: Record<string, boolean>;
}

/**
 * RSI Role Mapping Entity
 *
 * Maps RSI organization ranks to Discord roles and RBAC permissions.
 * Part of Phase 2: RSI Role Sync System - Role Mapping Configuration.
 *
 * Features:
 * - RSI rank → Discord role mapping
 * - RSI rank → RBAC permission mapping
 * - Per-organization configuration
 * - Priority-based role assignment
 */
@Entity('rsi_role_mappings')
// Uniqueness enforced via partial unique index in migration (WHERE deletedAt IS NULL)
// to allow re-creating mappings after soft-delete
@Index('IDX_rsi_role_mappings_org_id', ['organizationId'])
@Index('IDX_rsi_role_mappings_rsi_rank', ['rsiRank'])
@Index('IDX_rsi_role_mappings_discord_role', ['discordRoleId'])
@Index('IDX_rsi_role_mappings_active', ['isActive'])
export class RsiRoleMapping extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * RSI Rank name to map from
   * This is the human-readable rank title from RSI
   */
  @Column({ type: 'varchar', length: 50 })
  rsiRank!: string;

  /**
   * Discord Role ID to assign
   * When a user has this RSI rank, they receive this Discord role
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  discordRoleId?: string;

  /**
   * Internal Role ID to assign
   * When set, RSI sync also updates the user's OrganizationMembership.roleId
   * Bridges RSI ranks to the internal RBAC role system
   */
  @Column({ type: 'uuid', nullable: true })
  internalRoleId?: string;

  @ManyToOne(() => Role, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'internalRoleId' })
  internalRole?: Role;

  /**
   * Team IDs to auto-assign members to when they have this RSI rank
   * Enables automatic team placement based on RSI org structure
   * Members can be in multiple teams (generic divisions + specialized squads)
   */
  @Column({ type: 'jsonb', nullable: true })
  autoAssignTeamIds?: string[];

  /**
   * RBAC Permissions to assign
   * JSON object containing permission flags
   */
  @Column({ type: 'jsonb', nullable: true })
  rbacPermissions?: RbacPermissions;

  /**
   * Whether this mapping is active
   * Inactive mappings are not applied during sync
   */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Priority for role assignment
   * Higher priority mappings are applied first
   * Useful when a user has multiple ranks
   */
  @Column({ type: 'int', default: 0 })
  priority!: number;

  /**
   * Optional description for the mapping
   * Helps administrators understand the purpose
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if this mapping has a Discord role configured
   */
  hasDiscordRole(): boolean {
    return !!this.discordRoleId && this.discordRoleId.length > 0;
  }

  /**
   * Check if this mapping has an internal role configured
   */
  hasInternalRole(): boolean {
    return !!this.internalRoleId && this.internalRoleId.length > 0;
  }

  /**
   * Check if this mapping has auto-assign teams configured
   */
  hasAutoAssignTeams(): boolean {
    return Array.isArray(this.autoAssignTeamIds) && this.autoAssignTeamIds.length > 0;
  }

  /**
   * Check if this mapping has any RBAC permissions configured
   */
  hasRbacPermissions(): boolean {
    if (!this.rbacPermissions) {
      return false;
    }
    return Object.keys(this.rbacPermissions).some(
      key => this.rbacPermissions?.[key as keyof RbacPermissions] === true
    );
  }

  /**
   * Check if user with this mapping should have admin access
   */
  isAdmin(): boolean {
    return this.rbacPermissions?.admin === true;
  }

  /**
   * Get a list of enabled permissions
   */
  getEnabledPermissions(): string[] {
    if (!this.rbacPermissions) {
      return [];
    }

    const enabled: string[] = [];

    for (const [key, value] of Object.entries(this.rbacPermissions)) {
      if (key === 'custom' && value && typeof value === 'object') {
        // Handle custom permissions (guard against null — typeof null === 'object')
        for (const [customKey, customValue] of Object.entries(value)) {
          if (customValue === true) {
            enabled.push(`custom.${customKey}`);
          }
        }
      } else if (value === true) {
        enabled.push(key);
      }
    }

    return enabled;
  }

  /**
   * Check if a specific permission is enabled
   */
  hasPermission(permission: keyof RbacPermissions | string): boolean {
    if (!this.rbacPermissions) {
      return false;
    }

    // Check if it's a custom permission
    if (permission.startsWith('custom.')) {
      const customKey = permission.substring(7);
      return this.rbacPermissions.custom?.[customKey] === true;
    }

    return this.rbacPermissions[permission as keyof RbacPermissions] === true;
  }

  /**
   * Get a summary of the mapping for display
   */
  getSummary(): {
    rsiRank: string;
    hasDiscordRole: boolean;
    discordRoleId: string | null;
    hasInternalRole: boolean;
    hasAutoAssignTeams: boolean;
    permissionCount: number;
    isActive: boolean;
    priority: number;
  } {
    return {
      rsiRank: this.rsiRank,
      hasDiscordRole: this.hasDiscordRole(),
      discordRoleId: this.discordRoleId ?? null,
      hasInternalRole: this.hasInternalRole(),
      hasAutoAssignTeams: this.hasAutoAssignTeams(),
      permissionCount: this.getEnabledPermissions().length,
      isActive: this.isActive,
      priority: this.priority,
    };
  }
}
