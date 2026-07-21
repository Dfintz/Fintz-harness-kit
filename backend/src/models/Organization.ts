import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Organization type hierarchy
 */
export enum OrganizationType {
  ROOT = 'root', // Top-level organization
  DIVISION = 'division', // Major division
  DEPARTMENT = 'department', // Department within division
  TEAM = 'team', // Small team
  PROJECT = 'project', // Project-based temporary org
}

/**
 * Organization status
 */
export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  SUSPENDED = 'suspended',
}

/**
 * IP Whitelisting settings for organizations
 */
export interface IPWhitelistSettings {
  enabled: boolean;
  allowedIPs?: string[];
  blockedIPs?: string[];
  bypassForAdmins?: boolean;
  auditFailures?: boolean;
}

/**
 * GDPR settings for organizations
 * Configurable compliance parameters per organization
 */
export interface GdprSettings {
  /**
   * Grace period for data deletion requests (in days)
   * GDPR requires deletion within 30 days, but organizations can offer
   * a grace period where users can cancel the request
   * Min: 1, Max: 30, Default: 30
   */
  deletionGracePeriodDays?: number;

  /**
   * Expiration time for export download links (in days)
   * After this period, export files are deleted and links become invalid
   * Min: 1, Max: 90, Default: 7
   */
  exportLinkExpirationDays?: number;
}

/**
 * Default GDPR settings
 */
export const DEFAULT_GDPR_SETTINGS = {
  deletionGracePeriodDays: 30,
  exportLinkExpirationDays: 7,
} as const;

/**
 * GDPR export link expiration bounds (in days)
 */
export const MIN_EXPORT_EXPIRATION_DAYS = 1;
export const MAX_EXPORT_EXPIRATION_DAYS = 90;

// Re-export grace period bounds from config for convenience
export { MAX_GRACE_PERIOD_DAYS, MIN_GRACE_PERIOD_DAYS } from '../config/gdpr';

import type { ApplicationQuestion, VoiceServerConfig } from '@sc-fleet-manager/shared-types';

/**
 * Organization settings interface
 */
export interface OrganizationSettings {
  visibility?: 'public' | 'private' | 'restricted';
  allowSubOrgs?: boolean;
  maxDepth?: number;
  requireApproval?: boolean;
  inheritPermissions?: boolean;
  enableTeams?: boolean;
  enableTitlesBadges?: boolean;
  /** UEX marketplace handle used by Trading page "Open UEX Store" link. */
  uexStoreHandle?: string;
  starComms?: {
    enableBriefingSync?: boolean;
    enableTeamSync?: boolean;
  };
  customFields?: Record<string, unknown>;
  ipWhitelist?: IPWhitelistSettings;
  gdpr?: GdprSettings;
  /** Adaptive application form questions (empty/undefined = simple mode) */
  applicationQuestions?: ApplicationQuestion[];
  /** External voice server configuration (Mumble, TeamSpeak, etc.) */
  voiceServer?: VoiceServerConfig;
}

/**
 * Enhanced Organization entity with hierarchy support
 */
@Entity('organizations')
@Index(['parentOrgId'])
@Index(['type'])
@Index(['status'])
@Index(['path'])
@Index(['level'])
export class Organization {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  /**
   * @deprecated Use OrganizationMembership entity for member data. Use totalMembers for counts.
   * This field is kept for backward compatibility and will be removed in a future migration.
   */
  @Column('simple-array', { nullable: true, default: '' })
  members?: string[];

  // ==================== HIERARCHY FIELDS ====================

  @Column({ nullable: true })
  parentOrgId?: string;

  @ManyToOne(() => Organization, org => org.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentOrgId' })
  parent?: Organization;

  @OneToMany(() => Organization, org => org.parent)
  children!: Organization[];

  @Column({
    type: 'enum',
    enum: OrganizationType,
    default: OrganizationType.ROOT,
  })
  type!: OrganizationType;

  @Column({ default: 0 })
  level!: number; // Depth in hierarchy (0 = root)

  @Column({ type: 'text', default: '' })
  path!: string; // Materialized path: "root_id.parent_id.org_id"

  @Column({ nullable: true })
  rootOrgId?: string; // ID of root organization in tree

  // ==================== STATUS & OWNERSHIP ====================

  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  status!: OrganizationStatus;

  @Column({ nullable: true })
  ownerId?: string; // Primary owner user ID

  /**
   * @deprecated Use OrganizationMembership with role-based queries instead.
   * This field is kept for backward compatibility and will be removed in a future migration.
   */
  @Column('simple-array', { nullable: true })
  adminIds?: string[]; // Organization admin user IDs

  // ==================== SETTINGS & METADATA ====================

  @Column({ type: 'jsonb', nullable: true })
  settings?: OrganizationSettings;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>; // Custom metadata

  @Column({ type: 'jsonb', nullable: true })
  structure?: unknown; // Organization structure from template

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  logoUrl?: string;

  @Column({ nullable: true })
  website?: string;

  @Column({ nullable: true })
  contactEmail?: string;

  // ==================== STATISTICS ====================

  @Column({ default: 0 })
  totalMembers!: number;

  @Column({ default: 0 })
  directMembers!: number; // Members directly in this org (not children)

  @Column({ default: 0 })
  childCount!: number; // Number of direct children

  // ==================== RSI VERIFICATION FIELDS ====================
  // RSI Organization verification fields

  @Index()
  @Column({ nullable: true })
  rsiSid?: string; // RSI organization SID

  @Column({ default: false })
  rsiVerified!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  rsiVerifiedAt?: Date;

  @Column({ nullable: true })
  rsiVerificationCode?: string;

  @Column({ type: 'timestamp', nullable: true })
  rsiVerificationCodeExpiresAt?: Date;

  // ==================== ARCHIVE FIELDS ====================
  // Issue #173: Organization soft-delete support

  @Column({ default: false })
  isArchived!: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  archivedAt?: Date;

  @Column({ nullable: true })
  archivedBy?: string;

  @Column({ nullable: true, type: 'text' })
  archiveReason?: string;

  @Column({ nullable: true, type: 'timestamp' })
  restoredAt?: Date;

  @Column({ nullable: true })
  restoredBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if organization is a root organization
   */
  isRoot(): boolean {
    return !this.parentOrgId || this.level === 0;
  }

  /**
   * Check if organization is a leaf (no children)
   */
  isLeaf(): boolean {
    return this.childCount === 0;
  }

  /**
   * Get ancestor IDs from path
   */
  getAncestorIds(): string[] {
    if (!this.path) {
      return [];
    }
    return this.path.split('.').filter(id => id !== this.id);
  }

  /**
   * Check if organization is ancestor of another
   */
  isAncestorOf(orgId: string): boolean {
    return this.path ? this.path.includes(orgId) : false;
  }

  /**
   * Check if organization is descendant of another
   */
  isDescendantOf(orgId: string): boolean {
    return this.getAncestorIds().includes(orgId);
  }

  /**
   * Get full path as array
   */
  getPathArray(): string[] {
    return this.path ? this.path.split('.') : [this.id];
  }

  /**
   * Build materialized path from parent
   */
  buildPath(parentPath?: string): string {
    if (!parentPath) {
      return this.id;
    }
    return `${parentPath}.${this.id}`;
  }

  /**
   * Get GDPR settings with defaults
   * Returns organization-specific GDPR settings or global defaults
   */
  getGdprSettings(): Required<GdprSettings> {
    if (!this.settings?.gdpr) {
      return { ...DEFAULT_GDPR_SETTINGS };
    }

    return {
      deletionGracePeriodDays:
        this.settings.gdpr.deletionGracePeriodDays ?? DEFAULT_GDPR_SETTINGS.deletionGracePeriodDays,
      exportLinkExpirationDays:
        this.settings.gdpr.exportLinkExpirationDays ??
        DEFAULT_GDPR_SETTINGS.exportLinkExpirationDays,
    };
  }
}
