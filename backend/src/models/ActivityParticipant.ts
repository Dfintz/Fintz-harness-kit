import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ParticipantRole } from './Activity';

/**
 * Participant status in an activity
 */
export enum ActivityParticipantStatus {
  INVITED = 'invited',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  STANDBY = 'standby',
}

/**
 * ActivityParticipant Entity — Normalized participant table
 *
 * Replaces the `simple-json` participants array on the Activity entity.
 * Enables:
 * - SQL queries for "which activities is user X in?"
 * - Proper indexing on userId, activityId, status
 * - Concurrent join/leave without full-row read-modify-write
 * - SQL GROUP BY analytics instead of in-memory iteration
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Phase 4 (B1)
 */
@Entity('activity_participants')
@Unique('UQ_activity_participant', ['activityId', 'userId'])
@Index('IDX_activity_participants_user', ['userId'])
@Index('IDX_activity_participants_activity', ['activityId'])
@Index('IDX_activity_participants_status', ['activityId', 'status'])
export class ActivityParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  activityId!: string;

  @Column()
  userId!: string;

  @Column()
  userName!: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  organizationName?: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: ParticipantRole.MEMBER,
  })
  role!: ParticipantRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: ActivityParticipantStatus.ACCEPTED,
  })
  status!: ActivityParticipantStatus;

  @CreateDateColumn()
  joinedAt!: Date;

  @Column({ nullable: true })
  shipType?: string;

  @Column({ nullable: true })
  shipName?: string;

  @Column({ nullable: true })
  shipId?: string;

  @Column({ nullable: true, length: 50 })
  crewPosition?: string;

  @Column({ nullable: true })
  crewShipId?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  reputation?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column('simple-json', { nullable: true })
  metadata?: Record<string, unknown>;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation (optional — for eager loading when needed)
  @ManyToOne('Activity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activityId' })
  activity?: unknown;
}
