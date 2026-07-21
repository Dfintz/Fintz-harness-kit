import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Fleet } from './Fleet';
import { Organization } from './Organization';

/**
 * FleetAuditLog — Persisted audit trail for fleet lifecycle events.
 *
 * Stores every fleet change (ship add/remove, team changes, hierarchy, crew,
 * fleet CRUD) in PostgreSQL so logs survive server restarts.
 *
 * Indexed for efficient queries by fleet, organization, action, and timestamp.
 */
@Entity('fleet_audit_logs')
@Index(['fleetId', 'organizationId'])
@Index(['organizationId', 'createdAt'])
@Index(['fleetId', 'createdAt'])
export class FleetAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column()
  fleetId!: string;

  @ManyToOne(() => Fleet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fleetId' })
  fleet!: Fleet;

  @Column({ type: 'varchar', length: 255 })
  fleetName!: string;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'varchar', nullable: true })
  performedById?: string;

  @Column({ type: 'varchar', nullable: true })
  performedByName?: string;

  @Column({ type: 'jsonb', default: '{}' })
  details!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
