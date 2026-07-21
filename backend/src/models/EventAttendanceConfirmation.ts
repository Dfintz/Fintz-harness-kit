import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import type { AttendanceConfirmationSummary } from '../types/models';

import { TenantEntity } from './base/TenantEntity';

/**
 * Attendance confirmation status
 */
export enum AttendanceStatus {
  ATTENDED = 'attended',
  NO_SHOW = 'no_show',
  LATE = 'late',
  EARLY_DEPARTURE = 'early_departure',
  PENDING_CONFIRMATION = 'pending_confirmation',
}

/**
 * Post-event attendance confirmation tracking
 * Records actual attendance for tactical operations
 *
 * Multi-tenancy: Each confirmation belongs to an organization (inherited from TenantEntity)
 */
@Entity('event_attendance_confirmations')
@Index(['organizationId', 'eventId'])
@Index(['organizationId', 'userId'])
@Index(['organizationId', 'status'])
@Index(['eventId', 'userId'])
@Index(['eventId', 'status'])
@Index(['confirmedAt'])
export class EventAttendanceConfirmation extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  eventId!: string;

  @Index()
  @Column()
  userId!: string;

  @Column({
    type: 'varchar',
    enum: AttendanceStatus,
    default: AttendanceStatus.PENDING_CONFIRMATION,
  })
  status!: AttendanceStatus;

  // Pre-event RSVP information
  @Column({ nullable: true })
  rsvpStatus?: string; // accepted, tentative, declined

  @Column({ nullable: true })
  rsvpRole?: string;

  // Actual attendance details
  @Column({ nullable: true })
  actualRole?: string; // Role they actually fulfilled

  @Column({ nullable: true })
  checkInTime?: Date;

  @Column({ nullable: true })
  checkOutTime?: Date;

  @Column({ nullable: true })
  durationMinutes?: number;

  // Notes and feedback
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  feedbackFromOrganizer?: string;

  @Column({ type: 'simple-json', nullable: true })
  performanceRating?: {
    reliability?: number; // 1-5
    skillLevel?: number; // 1-5
    teamwork?: number; // 1-5
    comments?: string;
  };

  // Confirmation tracking
  @Column({ nullable: true })
  confirmedBy?: string; // Who confirmed (organizer, system, self)

  @Column({ nullable: true })
  confirmedAt?: Date;

  @Column({ default: false })
  autoConfirmed!: boolean; // Auto-confirmed by system

  // No-show handling
  @Column({ default: false })
  excusedAbsence!: boolean;

  @Column({ type: 'text', nullable: true })
  absenceReason?: string;

  @Column({ default: false })
  notificationSent!: boolean; // Confirmation request sent

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Calculate attendance percentage
   */
  getAttendanceScore(): number {
    if (this.status === AttendanceStatus.ATTENDED) {
      return 100;
    }
    if (this.status === AttendanceStatus.LATE) {
      return 75;
    }
    if (this.status === AttendanceStatus.EARLY_DEPARTURE) {
      return 50;
    }
    if (this.status === AttendanceStatus.NO_SHOW && this.excusedAbsence) {
      return 25;
    }
    if (this.status === AttendanceStatus.NO_SHOW) {
      return 0;
    }
    return 0; // Pending
  }

  /**
   * Check if needs follow-up
   */
  needsFollowUp(): boolean {
    return this.status === AttendanceStatus.PENDING_CONFIRMATION && !this.notificationSent;
  }

  /**
   * Get summary for display
   */
  getSummary(): AttendanceConfirmationSummary {
    return {
      id: this.id,
      eventId: this.eventId,
      userId: this.userId,
      status: this.status,
      rsvpStatus: this.rsvpStatus,
      rsvpRole: this.rsvpRole,
      actualRole: this.actualRole,
      attendanceScore: this.getAttendanceScore(),
      excusedAbsence: this.excusedAbsence,
      confirmedAt: this.confirmedAt?.toISOString(),
      confirmedBy: this.confirmedBy,
      durationMinutes: this.durationMinutes,
    };
  }
}
