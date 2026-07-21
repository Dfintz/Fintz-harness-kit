import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

export enum OperationType {
  MISSION = 'mission',
  EVENT = 'event',
  MINING = 'mining',
  TRADING = 'trading',
  LOGISTICS = 'logistics',
  INTEL = 'intel'
}

export enum OperationStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Operation Entity - Unified domain for missions, events and other operational activities.
 * Minimal initial fields; expand per consolidation plan.
 */
@Entity('operations')
@Index(['organizationId', 'type'])
@Index(['organizationId', 'status'])
export class Operation extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: OperationType })
  type!: OperationType;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: OperationStatus, default: OperationStatus.PLANNED })
  status!: OperationStatus;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  // Participants (user IDs) stored as text array for now; may become relation table later
  @Column('text', { array: true, default: '{}' })
  participants!: string[];

  @Column()
  createdBy!: string; // user id

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /** Helper: check if operation active */
  isActive(): boolean {
    return this.status === OperationStatus.IN_PROGRESS;
  }
}
