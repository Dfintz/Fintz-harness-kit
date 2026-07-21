import { LogisticsStatus, ResourceItem } from '@sc-fleet-manager/shared-types';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Re-export for backward compatibility
export { LogisticsStatus };
export type { ResourceItem };

export interface ShipLogistics {
  shipId: string;
  shipName: string;
  fuelCapacity: number;
  cargoCapacity: number;
  currentFuel: number;
  currentCargo: number;
  jumpRange: number;
}

export interface RouteWaypoint {
  location: string;
  distance: number;
  requiredFuel: number;
  order: number;
}

@Entity('fleet_logistics')
export class FleetLogistics {
  @PrimaryColumn()
  id!: string;

  @Column()
  fleetId!: string;

  @Column()
  operationName!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column()
  coordinatorId!: string;

  @Column({
    type: 'varchar',
    default: LogisticsStatus.PLANNING,
  })
  status!: LogisticsStatus;

  @Column('simple-json', { default: '[]' })
  ships!: ShipLogistics[];

  @Column('simple-json', { default: '[]' })
  resources!: ResourceItem[];

  @Column('simple-json', { default: '[]' })
  route!: RouteWaypoint[];

  @Column({ default: 0 })
  totalFuelCapacity!: number;

  @Column({ default: 0 })
  totalCargoCapacity!: number;

  @Column({ default: 0 })
  totalFuelRequired!: number;

  @Column({ default: 0 })
  totalCargoUsed!: number;

  @Column({ nullable: true })
  maxJumpRange?: number;

  @Column({ nullable: true })
  estimatedDuration?: number;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
