import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { Fleet } from './Fleet';
import { Ship } from './Ship';

/**
 * FleetShip Join Table Entity
 *
 * This entity manages the many-to-many relationship between Fleets and Ships.
 * It allows ships to be assigned to fleets with optional metadata like role and notes.
 *
 * Design rationale:
 * - Ships can belong to multiple fleets (e.g., a ship could be part of "Combat Fleet" and "Escort Fleet")
 * - Fleets can contain multiple ships
 * - Assignment metadata (role, notes, assignedBy) provides context for the relationship
 * - Tracks who assigned the ship and when for audit purposes
 *
 * @example
 * // Assign a ship to a fleet with a specific role
 * const assignment = fleetShipRepo.create({
 *   fleetId: 'fleet-123',
 *   shipId: 'ship-456',
 *   role: 'scout',
 *   notes: 'Primary reconnaissance vessel',
 *   assignedBy: 'user-789'
 * });
 */
@Entity('fleet_ships')
@Index(['fleetId', 'shipId'], { unique: true }) // Prevent duplicate assignments
@Index(['fleetId']) // Fast fleet ship lookups
@Index(['shipId']) // Fast ship fleet lookups
export class FleetShip extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fleetId!: string;

  @ManyToOne(() => Fleet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fleetId' })
  fleet!: Fleet;

  @Column()
  shipId!: string;

  @ManyToOne(() => Ship, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipId' })
  ship!: Ship;

  @Column({ type: 'varchar', nullable: true })
  role?: string; // Optional role for the ship in this fleet (e.g., 'scout', 'fighter', 'cargo')

  @Column({ type: 'text', nullable: true })
  notes?: string; // Optional notes about this ship's assignment

  @Column({ nullable: true })
  assignedBy?: string; // User ID who assigned this ship to the fleet

  @CreateDateColumn()
  assignedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * DTO for creating a fleet-ship assignment
 */
export interface CreateFleetShipDTO {
  fleetId: string;
  shipId: string;
  role?: string;
  notes?: string;
  assignedBy?: string;
}

/**
 * DTO for updating a fleet-ship assignment
 */
export interface UpdateFleetShipDTO {
  role?: string;
  notes?: string;
}
