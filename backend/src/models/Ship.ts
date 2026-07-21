import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { OptionalTenantEntity } from './base/OptionalTenantEntity';
import { FleetShip } from './FleetShip';

export enum ShipSize {
  VEHICLE = 'vehicle',
  SNUB = 'snub',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  SUB_CAPITAL = 'sub_capital',
  CAPITAL = 'capital',
}

export enum ShipStatus {
  FLIGHT_READY = 'flight_ready',
  IN_CONCEPT = 'in_concept',
  IN_PRODUCTION = 'in_production',
  ANNOUNCED = 'announced',
}

/**
 * Origin of a Ship row, used by ShipDataFetcher to scope soft-delete
 * reconciliation per data source.
 */
export enum ShipDataSource {
  ERKUL = 'erkul',
  SHEETS = 'sheets',
  CSV = 'csv',
  MANUAL = 'manual',
}

/**
 * Ship Model - Reference catalog of all Star Citizen ships
 *
 * This entity stores ship specifications, manufacturer information, and reference data.
 * It is NOT used for tracking ship ownership - use UserShip or OrganizationShip for that.
 *
 * This entity has a dual-purpose design:
 * - Multi-tenancy: Ships with organizationId are custom ships for specific organizations
 * - Global: Ships without organizationId are shared reference data (official catalog)
 *
 * @example
 * - Reference catalog: "Aegis Avenger Titan" (manufacturer specs, images, stats)
 * - User ownership: See UserShip model
 * - Organization ownership: See OrganizationShip model
 *
 * Note: Ship extends OptionalTenantEntity which provides @Index() on organizationId.
 * organizationId is nullable — NULL means global catalog, set means org-specific.
 */
@Entity('ships')
@Index(['organizationId', 'name'])
@Index(['organizationId', 'manufacturer'])
@Index(['organizationId', 'isActive'])
export class Ship extends OptionalTenantEntity {
  @PrimaryColumn()
  id!: string;

  @Index()
  @Column()
  name!: string;

  @Index()
  @Column()
  manufacturer!: string;

  @Column({ nullable: true })
  manufacturerCode?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  career?: string;

  @Column('simple-array', { nullable: true })
  roles?: string[];

  @Column({
    type: 'varchar',
    nullable: true,
  })
  size?: ShipSize;

  @Column({
    type: 'varchar',
    default: ShipStatus.FLIGHT_READY,
  })
  status!: ShipStatus;

  @Column({ nullable: true })
  crew?: number;

  @Column({ nullable: true })
  minCrew?: number;

  @Column({ nullable: true })
  maxCrew?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  beam?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mass?: number;

  @Column({ nullable: true })
  cargo?: number;

  @Column({ nullable: true })
  vehicleCargo?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ nullable: true })
  pledgePrice?: number;

  @Column({ nullable: true })
  speed?: number;

  @Column({ nullable: true })
  afterburnerSpeed?: number;

  @Column({ nullable: true })
  quantumSpeed?: number;

  @Column({ nullable: true })
  quantumFuelCapacity?: number;

  @Column({ nullable: true })
  hydrogenFuelCapacity?: number;

  @Column({ nullable: true })
  shields?: number;

  @Column({ nullable: true })
  armor?: number;

  @Column('simple-json', { nullable: true })
  weapons?: {
    type: string;
    size: number;
    count: number;
  }[];

  @Column('simple-json', { nullable: true })
  hardpoints?: {
    type: string;
    size: number;
    location: string;
  }[];

  @Column({ nullable: true })
  hangarSize?: string;

  @Column({ nullable: true })
  storageUrl?: string;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ nullable: true })
  brochureUrl?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  loanerShip?: string;

  @Column('simple-array', { nullable: true })
  variants?: string[];

  @Column({ default: false })
  isVehicle!: boolean;

  /**
   * Whether this ship/vehicle is currently flyable in the game. Concept ships
   * (announced but not yet released) should be `false` so downstream pages can
   * hide them or render them with a distinct label.
   */
  @Column({ default: true })
  isFlyable!: boolean;

  @Column('simple-json', { nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * Origin of this row. Used by ShipDataFetcher to scope soft-delete
   * reconciliation so a failure in one source cannot deactivate ships
   * tracked by another source.
   */
  @Column({ type: 'varchar', length: 32, default: ShipDataSource.MANUAL })
  dataSource!: ShipDataSource;

  /**
   * Wall-clock time of the last successful upsert from an external source.
   * NULL for rows that have never been refreshed by ShipDataFetcher.
   */
  @Column({ type: 'timestamp', nullable: true })
  lastFetchedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  @OneToMany(() => FleetShip, fleetShip => fleetShip.ship)
  fleetAssignments?: FleetShip[];
}

/**
 * DTO for creating a new ship
 */
export interface CreateShipDTO {
  name: string;
  manufacturer: string;
  manufacturerCode?: string;
  description?: string;
  role?: string;
  career?: string;
  roles?: string[];
  size?: ShipSize;
  status?: ShipStatus;
  crew?: number;
  minCrew?: number;
  maxCrew?: number;
  length?: number;
  beam?: number;
  height?: number;
  mass?: number;
  cargo?: number;
  vehicleCargo?: number;
  price?: number;
  pledgePrice?: number;
  speed?: number;
  afterburnerSpeed?: number;
  quantumSpeed?: number;
  quantumFuelCapacity?: number;
  hydrogenFuelCapacity?: number;
  shields?: number;
  armor?: number;
  weapons?: {
    type: string;
    size: number;
    count: number;
  }[];
  hardpoints?: {
    type: string;
    size: number;
    location: string;
  }[];
  hangarSize?: string;
  storageUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  brochureUrl?: string;
  isActive?: boolean;
  loanerShip?: string;
  variants?: string[];
  isVehicle?: boolean;
  isFlyable?: boolean;
  metadata?: Record<string, unknown>;
}
