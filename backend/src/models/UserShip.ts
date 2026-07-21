import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { ShipCustomization } from '../types/models';

export enum ShipOwnershipStatus {
  OWNED = 'owned',
  PLEDGED = 'pledged',
  LOANED = 'loaned',
  GIFTED = 'gifted',
  LOST = 'lost',
  DESTROYED = 'destroyed',
  SOLD = 'sold',
}

export enum ShipCondition {
  PRISTINE = 'pristine',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  DAMAGED = 'damaged',
  CRITICAL = 'critical',
}

/**
 * Ship sharing levels - determines who can access/use this ship
 *
 * Visibility hierarchy (from most restrictive to least):
 * - PRIVATE: Personal use only, not visible to anyone else
 * - ORGANIZATION: Shared with the entire organization
 * - ALLIANCE: Shared with allied organizations
 * - PUBLIC: Visible to everyone
 *
 * Note: SHARED_USERS is for selective sharing with specific users (custom mode)
 */
export enum ShipSharingLevel {
  /**
   * Personal use only - not shared with anyone (formerly PERSONAL)
   */
  PRIVATE = 'private',
  /**
   * @deprecated Use PRIVATE instead for consistency
   */
  PERSONAL = 'personal',
  /**
   * Shared with specific users only (custom visibility mode)
   */
  SHARED_USERS = 'shared_users',
  /**
   * Shared with the entire organization (default when user joins org)
   */
  ORGANIZATION = 'organization',
  /**
   * Shared with the entire alliance (all allied orgs)
   */
  ALLIANCE = 'alliance',
  /**
   * Publicly visible to everyone
   */
  PUBLIC = 'public',
}

/**
 * UserShip Model - Individual ship ownership
 *
 * Represents a ship owned by a specific user (independent of organization).
 * Organizations can view their members' ships, but ships belong to users.
 * This is the actual ship instance, not the ship reference data.
 *
 * @example
 * - John owns a Cutlass Black (pledged, pristine condition)
 * - Sarah has an Aurora MR (owned, good condition)
 * - Mike borrowed a Constellation (loaned, excellent condition)
 *
 * Note: Ships are NOT organization-scoped. They belong to users.
 * For organization-owned ships, use OrganizationShip model instead.
 */
@Entity('user_ships')
@Index(['userId', 'status'])
@Index(['userId', 'shipId'])
@Index(['insuranceExpires'])
@Index(['userId', 'insuranceExpires'])
export class UserShip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * User who owns this ship
   */
  @Index()
  @Column()
  userId!: string;

  /**
   * Reference to the Ship model (manufacturer info)
   * Nullable for imported ships where catalogue lookup may not match
   */
  @Index()
  @Column({ nullable: true })
  shipId?: string;

  /**
   * Ship name (e.g., "Cutlass Black", "Aurora MR")
   */
  @Column()
  shipName!: string;

  /**
   * Custom name given to this specific ship
   */
  @Column({ nullable: true })
  customName?: string;

  /**
   * Ownership status
   */
  @Column({
    type: 'enum',
    enum: ShipOwnershipStatus,
    default: ShipOwnershipStatus.OWNED,
  })
  status!: ShipOwnershipStatus;

  /**
   * Ship condition
   */
  @Column({
    type: 'enum',
    enum: ShipCondition,
    default: ShipCondition.GOOD,
  })
  condition!: ShipCondition;

  /**
   * Purchase/pledge date
   */
  @Column({ type: 'timestamp', nullable: true })
  acquiredDate?: Date;

  /**
   * Purchase price or pledge amount (in UEC or USD)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  acquiredPrice?: number;

  /**
   * Currency (UEC, USD, etc.)
   */
  @Column({ nullable: true })
  acquiredCurrency?: string;

  /**
   * Insurance level
   */
  @Column({ nullable: true })
  insuranceLevel?: string;

  /**
   * Insurance expiration date
   */
  @Column({ type: 'timestamp', nullable: true })
  insuranceExpires?: Date;

  /**
   * Current location (hangar, planet, station, etc.)
   */
  @Column({ nullable: true })
  location?: string;

  /**
   * Current hangar (for stored ships)
   */
  @Column({ nullable: true })
  hangar?: string;

  /**
   * If loaned, who loaned it
   */
  @Column({ nullable: true })
  loanedFrom?: string;

  /**
   * If loaned out, who has it
   */
  @Column({ nullable: true })
  loanedTo?: string;

  /**
   * Loan expiration
   */
  @Column({ type: 'timestamp', nullable: true })
  loanExpires?: Date;

  /**
   * User-provided description of this ship
   */
  @Column('text', { nullable: true })
  description?: string;

  /**
   * Notes about this ship
   */
  @Column('text', { nullable: true })
  notes?: string;

  /**
   * Ship modifications/upgrades
   */
  @Column('jsonb', { nullable: true })
  modifications?: {
    components?: string[];
    weapons?: string[];
    upgrades?: string[];
    customization?: ShipCustomization;
  };

  /**
   * Statistics
   */
  @Column({ type: 'int', default: 0 })
  flightHours?: number;

  @Column({ type: 'int', default: 0 })
  missionsCompleted?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalEarnings?: number;

  /**
   * Tags for organization
   */
  @Column('simple-array', { nullable: true })
  tags?: string[];

  /**
   * Ship sharing level - determines who can access/use this ship
   * Default: ORGANIZATION (shared with org when user joins)
   */
  @Index()
  @Column({
    type: 'enum',
    enum: ShipSharingLevel,
    default: ShipSharingLevel.ORGANIZATION,
  })
  sharingLevel!: ShipSharingLevel;

  /**
   * Use custom per-ship visibility instead of global sharingLevel default
   * When false: use sharingLevel for this ship
   * When true: ship visibility can be set individually
   */
  @Column({ default: false })
  useCustomVisibility!: boolean;

  /**
   * Users this ship is shared with (when sharingLevel is SHARED_USERS)
   */
  @Column('simple-array', { nullable: true })
  sharedWithUsers?: string[];

  /**
   * Organization visibility control
   * When true, ship is visible to organization members (declassified)
   * When false, ship is hidden from organization view (classified)
   * Only organization leaders can change this setting
   */
  @Column({ default: true })
  visibleToOrganization!: boolean;

  /**
   * User ID of the org leader who last changed the classification status
   */
  @Column({ nullable: true })
  classificationChangedBy?: string;

  /**
   * When the classification status was last changed
   */
  @Column({ type: 'timestamp', nullable: true })
  classificationChangedAt?: Date;

  /**
   * Reason for classification/declassification (optional note from org leader)
   */
  @Column('text', { nullable: true })
  classificationReason?: string;

  /**
   * Erkul.games loadout URL for this ship
   */
  @Column({ nullable: true })
  erkulLoadoutUrl?: string;

  /**
   * Is this ship currently active in the org fleet?
   */
  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Soft delete support - when the ship is "deleted", this timestamp is set
   */
  @DeleteDateColumn()
  deletedAt?: Date;

  /**
   * Helper: Check if ship is currently loaned
   */
  isLoaned(): boolean {
    return this.status === ShipOwnershipStatus.LOANED;
  }

  /**
   * Helper: Check if ship needs insurance renewal
   */
  needsInsuranceRenewal(): boolean {
    if (!this.insuranceExpires) {
      return false;
    }
    const daysUntilExpiry = Math.floor(
      (this.insuranceExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30; // Within 30 days
  }

  /**
   * Helper: Get ship display name
   */
  getDisplayName(): string {
    return this.customName || this.shipName;
  }

  /**
   * Helper: Check if ship is in good operational condition
   */
  isOperational(): boolean {
    return (
      this.condition !== ShipCondition.DAMAGED &&
      this.condition !== ShipCondition.CRITICAL &&
      this.status !== ShipOwnershipStatus.DESTROYED &&
      this.status !== ShipOwnershipStatus.LOST &&
      this.status !== ShipOwnershipStatus.SOLD
    );
  }

  /**
   * Helper: Check if ship is shared at organization level or higher
   */
  isSharedWithOrg(): boolean {
    return (
      this.sharingLevel === ShipSharingLevel.ORGANIZATION ||
      this.sharingLevel === ShipSharingLevel.ALLIANCE
    );
  }

  /**
   * Helper: Check if ship is shared with specific user
   */
  isSharedWithUser(userId: string): boolean {
    if (this.userId === userId) {
      return true;
    } // Owner always has access
    if (this.sharingLevel === ShipSharingLevel.PERSONAL) {
      return false;
    }
    if (this.sharingLevel === ShipSharingLevel.SHARED_USERS) {
      return (this.sharedWithUsers || []).includes(userId);
    }
    // ORGANIZATION and ALLIANCE levels are handled at service level
    return true;
  }

  /**
   * Helper: Check if ship is shared at alliance level
   */
  isSharedWithAlliance(): boolean {
    return this.sharingLevel === ShipSharingLevel.ALLIANCE;
  }
}
