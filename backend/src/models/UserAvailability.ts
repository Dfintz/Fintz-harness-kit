/**
 * UserAvailability Entity — Wave 2.4 Group Scheduling & Availability
 * Stores per-hour availability slots for users within an organization.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_availability')
@Index('idx_avail_user_org', ['userId', 'organizationId'])
@Index('idx_avail_org_day', ['organizationId', 'dayOfWeek'])
export class UserAvailability {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  organizationId!: string;

  /** 0 = Sunday, 6 = Saturday */
  @Column({ type: 'int' })
  dayOfWeek!: number;

  /** Minutes from midnight, 0–1439 */
  @Column({ type: 'int' })
  startMinute!: number;

  /** Minutes from midnight, 0–1439 */
  @Column({ type: 'int' })
  endMinute!: number;

  @Column({ type: 'boolean', default: true })
  isRecurring!: boolean;

  @Column({ type: 'date', nullable: true })
  effectiveDate?: string;

  @Column({ type: 'date', nullable: true })
  expiresAt?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
