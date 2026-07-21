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

import { TenantEntity } from './base/TenantEntity';
import type { FleetShip } from './FleetShip';
import type { Team } from './Team';

/**
 * Fleet status enum
 */
export enum FleetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPLOYED = 'deployed',
  DISBANDED = 'disbanded',
}

/**
 * Fleet type/purpose enum
 */
export enum FleetType {
  COMBAT = 'combat',
  MINING = 'mining',
  TRADING = 'trading',
  EXPLORATION = 'exploration',
  SALVAGE = 'salvage',
  ESCORT = 'escort',
  RECONNAISSANCE = 'reconnaissance',
  MEDICAL = 'medical',
  MIXED = 'mixed',
}

/**
 * Fleet composition summary
 */
export interface FleetComposition {
  totalShips: number;
  shipsByRole: Record<string, number>;
  totalCrewCapacity: number;
  totalCargoCapacity: number;
  estimatedValue: number;
}

/**
 * Fleet operational statistics
 */
export interface FleetOperationalStats {
  missionsCompleted: number;
  hoursOperational: number;
  lastDeployment: Date | null;
  averageUptime: number;
}

@Entity('fleets')
@Index('idx_fleet_org_id', ['organizationId'])
@Index('idx_fleet_org_name', ['organizationId', 'name'])
@Index('idx_fleet_org_createdat', ['organizationId', 'createdAt'])
@Index('idx_fleet_status', ['status'])
@Index('idx_fleet_type', ['type'])
@Index('idx_fleet_leader', ['leaderId'])
@Index('idx_fleet_parent', ['parentFleetId'])
@Index('idx_fleet_team', ['teamId'])
export class Fleet extends TenantEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  emblem?: string; // URL to fleet emblem/logo

  @Column({
    type: 'varchar',
    default: FleetStatus.ACTIVE,
  })
  status!: FleetStatus;

  @Column({
    type: 'varchar',
    default: FleetType.MIXED,
  })
  type!: FleetType;

  @Column({ nullable: true })
  leaderId?: string; // User ID of fleet commander

  @Column({ nullable: true })
  secondInCommandId?: string; // User ID of second in command

  @Column('simple-array')
  members!: string[];

  @Column('simple-array', { default: '' })
  shipIds!: string[]; // IDs of ships assigned to this fleet

  @Column({ default: 50 })
  maxMembers!: number;

  @Column({ default: false })
  isPublic!: boolean; // Visible to non-members

  @Column({ default: false })
  allowApplications!: boolean; // Accept membership applications

  @Column({ type: 'varchar', default: 'private' })
  visibility!: string; // Sharing visibility: private | org-only | public

  @Column('simple-array', { default: '' })
  allowedOrganizations!: string[]; // Org IDs allowed when visibility is restricted

  @Column({ default: false })
  publicViewEnabled!: boolean; // Allow public read-only views

  @Column({ default: false })
  allowJoinRequests!: boolean; // Allow join requests from outside org

  @Column('simple-json', { nullable: true })
  composition?: FleetComposition;

  @Column('simple-json', { nullable: true })
  operationalStats?: FleetOperationalStats;

  @Column({ type: 'text', nullable: true })
  primaryActivity?: string; // Current primary operation/activity

  @Column({ type: 'timestamp', nullable: true })
  deployedAt?: Date;

  @Column({ type: 'text', nullable: true })
  deploymentLocation?: string; // Current deployment location (system/planet)

  @Column({ default: '#00d9ff' })
  color!: string; // Fleet color for UI

  @Column('simple-array', { default: '' })
  tags!: string[]; // Custom tags for organization

  // ==================== CREW MODE (Fleet Crew Gate) ====================

  @Column({ type: 'varchar', length: 20, default: 'conservative' })
  crewMode!: 'lean' | 'conservative';

  // ==================== TEAM ASSIGNMENT (Phase 1.2) ====================

  @Column({ type: 'uuid', nullable: true })
  teamId?: string;

  @ManyToOne('Team', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team?: Team;

  // ==================== HIERARCHY FIELDS (Wave 2.2) ====================

  @Column({ nullable: true })
  parentFleetId?: string;

  @ManyToOne(() => Fleet, fleet => fleet.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentFleetId' })
  parent?: Fleet;

  @OneToMany(() => Fleet, fleet => fleet.parent)
  children?: Fleet[];

  @Column({ default: 0 })
  level!: number; // Depth in hierarchy (0 = root)

  @Column({ default: 0 })
  sortOrder!: number; // Display order among siblings

  @Column({ type: 'text', default: '' })
  hierarchyPath!: string; // Materialized path (e.g., "rootId.parentId.thisId")

  // ==================== ARCHIVE FIELDS ====================

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

  // Relations
  @OneToMany('FleetShip', 'fleet')
  fleetShips?: FleetShip[];

  // Virtual properties

  // Backing field for memberCount, populated by enrichFleetCounts
  private _memberCount?: number;

  get memberCount(): number {
    if (this._memberCount !== undefined) {
      return this._memberCount;
    }
    return this.members?.length ?? 0;
  }

  set memberCount(value: number) {
    this._memberCount = value;
  }

  // Backing field for shipCount, populated by loadRelationCountAndMap or enrichFleetCounts
  private _shipCount?: number;

  get shipCount(): number {
    // If explicitly set (e.g. via loadRelationCountAndMap), use that value
    if (this._shipCount !== undefined) {
      return this._shipCount;
    }
    // Otherwise compute from loaded relations or shipIds array
    return this.fleetShips?.length ?? this.shipIds?.length ?? 0;
  }

  set shipCount(value: number) {
    this._shipCount = value;
  }

  get isDeployed(): boolean {
    return this.status === FleetStatus.DEPLOYED;
  }

  get canAcceptMembers(): boolean {
    return this.memberCount < this.maxMembers && this.status === FleetStatus.ACTIVE;
  }
}

/**
 * Enrich a Fleet entity with explicit shipCount and memberCount properties.
 *
 * TypeORM class getters are not serialized to JSON, so API responses must
 * spread these computed counts onto a plain object. When the fleet was loaded
 * via `loadRelationCountAndMap('fleet.shipCount', 'fleet.fleetShips')`, the
 * count is already on the entity as a numeric property; otherwise pass an
 * explicit `shipCountOverride`.
 */
export function enrichFleetCounts(
  fleet: Fleet,
  shipCountOverride?: number
): Fleet & { shipCount: number; memberCount: number } {
  const shipCount = shipCountOverride ?? (fleet as Fleet & { shipCount?: number }).shipCount ?? 0;
  const memberCount = fleet.members?.length ?? 0;
  return Object.assign(fleet, { shipCount, memberCount });
}
