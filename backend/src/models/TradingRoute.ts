import { RouteStatus, RouteVisibility } from '@sc-fleet-manager/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';

// Re-export for backward compatibility
export { RouteStatus, RouteVisibility };

export interface TradeStop {
  location: string;
  buyGoods?: string[];
  sellGoods?: string[];
  order: number;
  type?: 'trade' | 'refuel' | 'waypoint'; // Stop type for fleet routing
  requiredFuel?: number; // Fuel required to reach this stop
  distance?: number; // Distance from previous stop in km
}

export interface RoutePerformance {
  runCount: number;
  avgProfit: number;
  avgDuration: number;
  lastRun?: Date;
}

export interface FleetComposition {
  ships: Array<{
    shipId: string;
    shipName: string;
    quantity: number;
    cargo?: number;
    speed?: number;
    quantumSpeed?: number;
    quantumFuelCapacity?: number;
    isRefuelingShip?: boolean; // Starfarer, etc.
  }>;
  totalCargo: number;
  slowestSpeed: number;
  slowestQuantumSpeed: number;
  minFuelCapacity: number;
  hasRefuelingShip: boolean;
}

/**
 * TradingRoute entity with multi-tenancy support
 *
 * UPDATED: Added organizationId for multi-tenancy and visibility controls
 */
@Entity('trading_routes')
@Index(['organizationId', 'status'])
@Index(['creatorId', 'status'])
export class TradingRoute {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column()
  creatorId!: string;

  /**
   * Organization ID for multi-tenancy
   * Routes are scoped to organizations
   */
  @Column({ nullable: true })
  @Index()
  organizationId?: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * Visibility controls who can see the route
   */
  @Column({
    type: 'varchar',
    default: RouteVisibility.ORGANIZATION,
  })
  visibility!: RouteVisibility;

  @Column('simple-json')
  stops!: TradeStop[];

  @Column({ nullable: true })
  estimatedProfit?: number;

  @Column({ nullable: true })
  estimatedDuration?: number;

  @Column({ nullable: true })
  minCargoCapacity?: number;

  @Column('simple-json', { nullable: true })
  fleetComposition?: FleetComposition;

  @Column({
    type: 'varchar',
    default: RouteStatus.ACTIVE,
  })
  status!: RouteStatus;

  @Column('simple-json', { nullable: true })
  performance?: RoutePerformance;

  @Column('simple-array', { default: '' })
  tags!: string[];

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
