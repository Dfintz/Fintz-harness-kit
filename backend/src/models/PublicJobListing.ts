import type { PassengerSlot, ShipRequirement, TransportType } from '@sc-fleet-manager/shared-types';
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

// Import shared PassengerSlot from shared-types for consistency

/**
 * Role slot within a ship crew breakdown.
 * Supports multiple assignees per role when total > 1.
 */
export interface ShipCrewRoleSlot {
  role: string;
  total: number;
  filled: number;
  /** Array of user IDs assigned to this role (empty if no assignments) */
  assignedUserIds?: string[];
  /** Array of display names for assigned users (empty if no assignments) */
  assignedUserNames?: string[];
  /** @deprecated Legacy single assignee field - use assignedUserIds array */
  assignedUserId?: string | null;
  /** @deprecated Legacy single assignee field - use assignedUserNames array */
  assignedUserName?: string | null;
}

// Note: PassengerSlot is now imported from @sc-fleet-manager/shared-types
// to eliminate duplication with Activity.ts

/**
 * Per-ship crew breakdown entry.
 * Each entry represents one ship in the operation with its crew roles.
 * Supports nested transport: ships/vehicles carried inside a parent ship.
 */
export interface ShipCrewBreakdownEntry {
  shipName: string;
  crewCapacity: number;
  roles: ShipCrewRoleSlot[];
  /** Whether this ship is a loaner — contributed by someone not personally crewing it */
  isLoaner?: boolean;
  /** User ID of the person who contributed/provided this ship */
  contributedByUserId?: string | null;
  /** Display name of the ship contributor */
  contributedByUserName?: string | null;
  /** Index of the parent ship in the breakdown array (undefined = top-level ship) */
  parentShipIndex?: number;
  /** Whether this entry is a transported vehicle/ship nested inside a parent */
  isTransported?: boolean;
  /** Transport type for nested vehicles/ships (e.g. hangar, cargo, tractor beam, docking collar) */
  transportType?: TransportType;
  /** Non-crew passengers (e.g., marines in an APC) — NOT counted toward crew totals */
  passengers?: PassengerSlot[];
}

/**
 * Approved vehicle entry — tracked when a vehicle application is approved.
 */
export interface ApprovedVehicle {
  vehicleName: string;
  applicantUserId: string;
  applicantDisplayName: string;
  applicationId: string;
  approvedAt: string;
}

import { Organization } from './Organization';
import { OrgPrimaryFocus } from './PublicOrgProfile';

/**
 * Job types for public listings
 */
export enum JobType {
  CREW = 'crew',
  PILOT = 'pilot',
  GUNNER = 'gunner',
  ENGINEER = 'engineer',
  MEDIC = 'medic',
  MINER = 'miner',
  HAULER = 'hauler',
  SCOUT = 'scout',
  SECURITY = 'security',
  LEADERSHIP = 'leadership',
  SUPPORT = 'support',
  OTHER = 'other',
}

/**
 * Pay types for job compensation
 */
export enum PayType {
  FIXED = 'fixed',
  HOURLY = 'hourly',
  PERCENTAGE = 'percentage',
  NEGOTIABLE = 'negotiable',
  VOLUNTEER = 'volunteer',
}

/**
 * Listing owner types - supports both organizations and alliances
 */
export enum ListingOwnerType {
  ORGANIZATION = 'organization',
  ALLIANCE = 'alliance',
  USER = 'user',
}

/**
 * Listing category - distinguishes job postings from service offerings
 *
 * - 'job': The poster is looking to hire/recruit (e.g., "Looking for Crew")
 * - 'service': The poster is offering their services (e.g., "Ship Engineer for Hire")
 */
export enum ListingCategory {
  JOB = 'job',
  SERVICE = 'service',
}

/**
 * Public Job Listing entity
 *
 * Stores public-facing job listings for organizations and alliances
 * that opt-in to posting jobs in the public directory.
 * Phase 3: Public Job Listings feature
 */
@Entity('public_job_listings')
export class PublicJobListing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization ID (null if alliance listing)
   */
  @Column({ nullable: true })
  @Index()
  organizationId?: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * Alliance/Federation ID (null if organization listing)
   * Note: Uses in-memory federation storage, so no FK constraint
   */
  @Column({ nullable: true })
  @Index()
  allianceId?: string;

  /**
   * Type of owner (organization or alliance)
   */
  @Column({
    type: 'enum',
    enum: ListingOwnerType,
    default: ListingOwnerType.ORGANIZATION,
  })
  @Index()
  ownerType!: ListingOwnerType;

  /**
   * Listing category: 'job' (hiring/recruiting) or 'service' (offering services)
   */
  @Column({
    type: 'enum',
    enum: ListingCategory,
    default: ListingCategory.JOB,
  })
  @Index()
  listingCategory!: ListingCategory;

  /**
   * Job title (max 255 chars)
   */
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  /**
   * Job description with requirements, responsibilities, etc.
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Type of job/role
   */
  @Column({
    type: 'enum',
    enum: JobType,
    default: JobType.CREW,
  })
  @Index()
  jobType!: JobType;

  /**
   * Focus area for the job (uses same enum as org profiles)
   */
  @Column({
    type: 'enum',
    enum: OrgPrimaryFocus,
    default: OrgPrimaryFocus.MIXED,
  })
  @Index()
  focus!: OrgPrimaryFocus;

  /**
   * Type of pay/compensation
   */
  @Column({
    type: 'enum',
    enum: PayType,
    nullable: true,
  })
  payType?: PayType;

  /**
   * Minimum pay (in aUEC or percentage depending on payType)
   */
  @Column({ type: 'integer', nullable: true })
  payMin?: number;

  /**
   * Maximum pay (in aUEC or percentage depending on payType)
   */
  @Column({ type: 'integer', nullable: true })
  payMax?: number;

  /**
   * Required experience level (0-10 scale, 0 = no experience needed)
   */
  @Column({ type: 'integer', default: 0 })
  experienceLevel!: number;

  /**
   * Whether the listing is currently active
   */
  @Column({ default: true })
  @Index()
  isActive!: boolean;

  /**
   * Date the job was posted
   */
  @Column({ type: 'timestamp', default: () => 'NOW()' })
  @Index()
  postedAt!: Date;

  /**
   * Optional expiration date
   */
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  expiresAt?: Date;

  /**
   * User ID who created the listing
   */
  @Column({ nullable: true })
  createdBy?: string;

  /**
   * Contact method or info
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  contactInfo?: string;

  /**
   * Required timezone for scheduling
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone?: string;

  /**
   * Required languages
   */
  @Column({ type: 'jsonb', nullable: true })
  languages?: string[];

  /**
   * Tags for additional categorization
   */
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  /**
   * Total crew positions available
   */
  @Column({ type: 'integer', nullable: true })
  crewSpotsTotal?: number;

  /**
   * Number of crew positions already filled
   */
  @Column({ type: 'integer', default: 0 })
  crewSpotsFilled!: number;

  /**
   * Required/preferred ships with quantity and crew info.
   * Each entry is a SpecificShipRequirement or RoleShipRequirement.
   * Legacy data (string[]) is migrated to SpecificShipRequirement[].
   */
  @Column({ type: 'jsonb', nullable: true })
  requiredShips?: ShipRequirement[];

  /**
   * Ship requirement type: 'none', 'required', 'preferred'
   */
  @Column({ type: 'varchar', length: 20, nullable: true, default: 'none' })
  shipRequirementType?: string;

  /**
   * Per-ship crew breakdown with role-based positions.
   * Each entry represents one ship slot in the operation with its crew roles.
   * Roles include: pilot, copilot, gunner, engineer, crew, medic, marine.
   * crewCapacity is sourced from the Ship DB for that ship type.
   */
  @Column({ type: 'jsonb', nullable: true })
  shipCrewBreakdown!: ShipCrewBreakdownEntry[] | null;

  /**
   * Vehicles whose applications have been approved.
   * Populated when a VEHICLE-type application is approved.
   */
  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  approvedVehicles!: ApprovedVehicle[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Check if the listing has expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  /**
   * Check if the listing is visible (active and not expired)
   */
  isVisible(): boolean {
    return this.isActive && !this.isExpired();
  }

  /**
   * Get pay display string
   */
  getPayDisplay(): string {
    if (!this.payType) {
      return 'Not specified';
    }

    if (this.payType === PayType.VOLUNTEER) {
      return 'Volunteer';
    }

    if (this.payType === PayType.NEGOTIABLE) {
      return 'Negotiable';
    }

    const suffix = this.payType === PayType.PERCENTAGE ? '%' : ' aUEC';
    const hourlyIndicator = this.payType === PayType.HOURLY ? '/hr' : '';

    if (this.payMin && this.payMax) {
      return `${this.payMin.toLocaleString()}-${this.payMax.toLocaleString()}${suffix}${hourlyIndicator}`;
    }

    if (this.payMin) {
      return `From ${this.payMin.toLocaleString()}${suffix}${hourlyIndicator}`;
    }

    if (this.payMax) {
      return `Up to ${this.payMax.toLocaleString()}${suffix}${hourlyIndicator}`;
    }

    return 'Negotiable';
  }
}
