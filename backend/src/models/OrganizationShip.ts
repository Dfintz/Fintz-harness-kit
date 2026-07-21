import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { ShipOwnershipStatus, ShipCondition, ShipSharingLevel } from './UserShip';

export enum OrgShipRole {
    COMMAND = 'command',
    COMBAT = 'combat',
    LOGISTICS = 'logistics',
    MINING = 'mining',
    EXPLORATION = 'exploration',
    MEDICAL = 'medical',
    TRANSPORT = 'transport',
    SUPPORT = 'support',
    RESERVE = 'reserve'
}

/**
 * OrganizationShip Model - Organization-owned ships
 * 
 * Represents ships owned by the organization itself,
 * not by individual members.
 * 
 * @example
 * - Org owns a capital ship (Idris)
 * - Org pool vehicle (Hercules for logistics)
 * - Shared mining ship (MOLE)
 */
@Entity('organization_ships')
@Index(['organizationId', 'shipId'])
@Index(['organizationId', 'role'])
@Index(['organizationId', 'status'])
export class OrganizationShip extends TenantEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    /**
     * Reference to the Ship model (manufacturer info)
     */
    @Index()
    @Column()
    shipId!: string;

    /**
     * Ship name (e.g., "Idris-P", "Hercules C2")
     */
    @Column()
    shipName!: string;

    /**
     * Custom name for this org ship
     */
    @Column({ nullable: true })
    customName?: string;

    /**
     * Organizational role
     */
    @Column({
        type: 'enum',
        enum: OrgShipRole,
        default: OrgShipRole.RESERVE
    })
    role!: OrgShipRole;

    /**
     * Ownership status
     */
    @Column({
        type: 'enum',
        enum: ShipOwnershipStatus,
        default: ShipOwnershipStatus.OWNED
    })
    status!: ShipOwnershipStatus;

    /**
     * Ship condition
     */
    @Column({
        type: 'enum',
        enum: ShipCondition,
        default: ShipCondition.GOOD
    })
    condition!: ShipCondition;

    /**
     * How was this ship acquired?
     */
    @Column({ nullable: true })
    acquisitionMethod?: string; // 'purchased', 'donated', 'captured', 'gifted'

    /**
     * Who donated/purchased it (if applicable)
     */
    @Column({ nullable: true })
    acquiredBy?: string;

    /**
     * Acquisition date
     */
    @Column({ type: 'timestamp', nullable: true })
    acquiredDate?: Date;

    /**
     * Acquisition cost
     */
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    acquisitionCost?: number;

    /**
     * Current assigned captain/commander
     */
    @Column({ nullable: true })
    assignedCaptain?: string;

    /**
     * Current assigned crew
     */
    @Column('simple-array', { nullable: true })
    assignedCrew?: string[];

    /**
     * Maximum crew capacity
     */
    @Column({ type: 'int', nullable: true })
    maxCrew?: number;

    /**
     * Current location
     */
    @Column({ nullable: true })
    location?: string;

    /**
     * Home base/hangar
     */
    @Column({ nullable: true })
    homeBase?: string;

    /**
     * Ship visibility/sharing level
     * Default: ORGANIZATION (shared within org only)
     * 
     * Options:
     * - private/personal: Not visible to anyone except owner
     * - shared_users: Shared with specific users
     * - organization: Shared with entire organization
     * - alliance: Shared with allied organizations
     * - public: Visible to everyone
     * 
     * When minRequiredRank is set, only org members with rank >= minRequiredRank can access (for ORGANIZATION level)
     */
    @Index()
    @Column({
        type: 'enum',
        enum: ShipSharingLevel,
        default: ShipSharingLevel.ORGANIZATION,
    })
    sharingLevel!: ShipSharingLevel;

    /**
     * Minimum required rank to view/use this ship (for rank-based visibility)
     * When sharingLevel is ORGANIZATION and this is set, only members with
     * rank >= minRequiredRank can see/use the ship.
     * 
     * Rank values typically: 1 (lowest) to 10 (highest/leader)
     * null means no rank restriction
     */
    @Column({ type: 'int', nullable: true })
    minRequiredRank?: number;

    /**
     * Use custom per-ship visibility instead of organization default
     * When false: use organization's default ship sharing policy
     * When true: this ship's sharingLevel is individually configured
     */
    @Column({ default: false })
    useCustomVisibility!: boolean;

    /**
     * Insurance details
     */
    @Column({ nullable: true })
    insuranceLevel?: string;

    @Column({ type: 'timestamp', nullable: true })
    insuranceExpires?: Date;

    /**
     * Maintenance schedule
     */
    @Column({ type: 'timestamp', nullable: true })
    lastMaintenance?: Date;

    @Column({ type: 'timestamp', nullable: true })
    nextMaintenance?: Date;

    /**
     * Usage tracking
     */
    @Column({ type: 'int', default: 0 })
    flightHours?: number;

    @Column({ type: 'int', default: 0 })
    missionsCompleted?: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalEarnings?: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    maintenanceCosts?: number;

    /**
     * Ship modifications/loadout
     */
    @Column('jsonb', { nullable: true })
    modifications?: {
        components?: string[];
        weapons?: string[];
        upgrades?: string[];
        cargo?: Record<string, unknown>;
    };

    /**
     * Availability
     */
    @Column({ default: true })
    isAvailable!: boolean;

    /**
     * Is this a capital ship?
     */
    @Column({ default: false })
    isCapital?: boolean;

    /**
     * Requires special permissions to use?
     */
    @Column({ default: false })
    requiresPermission?: boolean;

    /**
     * Minimum rank/role required to captain
     */
    @Column({ nullable: true })
    minimumRank?: string;

    /**
     * Notes about this ship
     */
    @Column('text', { nullable: true })
    notes?: string;

    /**
     * Tags for organization
     */
    @Column('simple-array', { nullable: true })
    tags?: string[];

    @Column({ default: true })
    isActive!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    /**
     * Helper: Get display name
     */
    getDisplayName(): string {
        return this.customName || this.shipName;
    }

    /**
     * Helper: Check if ship needs maintenance
     */
    needsMaintenance(): boolean {
        if (!this.nextMaintenance) {return false;}
        return new Date() >= this.nextMaintenance;
    }

    /**
     * Helper: Check if ship is operational
     */
    isOperational(): boolean {
        return this.condition !== ShipCondition.DAMAGED && 
               this.condition !== ShipCondition.CRITICAL &&
               this.status !== ShipOwnershipStatus.DESTROYED &&
               this.status !== ShipOwnershipStatus.LOST &&
               this.isActive;
    }

    /**
     * Helper: Check if ship is available for use
     */
    isReadyForUse(): boolean {
        return this.isOperational() && 
               this.isAvailable && 
               !this.needsMaintenance();
    }

    /**
     * Helper: Check if user can captain this ship
     */
    canUserCaptain(userRank?: string): boolean {
        if (!this.requiresPermission) {return true;}
        if (!this.minimumRank) {return true;}
        if (!userRank) {return false;}
        
        // Would need rank comparison logic here
        return true;
    }

    /**
     * Helper: Get crew fill percentage
     */
    getCrewFillPercentage(): number {
        if (!this.maxCrew || !this.assignedCrew) {return 0;}
        return (this.assignedCrew.length / this.maxCrew) * 100;
    }
}
