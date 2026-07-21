/**
 * TeamMember Entity — Wave 2.6 Teams/Squads System
 *
 * Represents a user's membership in a team within an organization.
 * Follows the same pattern as FleetMember.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import type { Team } from './Team';
import { User } from './User';

export type TeamMemberRole = 'leader' | 'officer' | 'member';
export type TeamMemberStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'removed'
  | 'on_leave'
  | 'probation'
  | 'deployed';

@Entity('team_members')
@Index('idx_tm_org_team', ['organizationId', 'teamId'])
@Index('idx_tm_org_user', ['organizationId', 'userId'])
@Index('idx_tm_user_team', ['userId', 'teamId'], { unique: true })
export class TeamMember extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  teamId!: string;

  @ManyToOne('Team', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team!: Team;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role!: TeamMemberRole;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: TeamMemberStatus;

  @Column({ type: 'timestamp', nullable: true })
  joinedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt?: Date;

  // ==================== PERSONNEL FIELDS (Sprint 12) ====================

  @Column({ type: 'varchar', length: 50, nullable: true })
  rank?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'ship_type' })
  shipType?: string;

  @Column({ type: 'text', nullable: true })
  specialization?: string;

  @Column({ type: 'jsonb', nullable: true })
  stats?: { missionsCompleted?: number; hoursFlown?: number; creditsEarned?: number };

  @Column('simple-array', { nullable: true })
  certifications?: string[];

  @Column('simple-array', { nullable: true, name: 'additional_roles' })
  additionalRoles?: string[];

  @Column({ type: 'timestamp', nullable: true, name: 'last_active_at' })
  lastActiveAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'departure_reason' })
  departureReason?: string;

  // ==================== CREW POSITION FIELDS (Sprint 26) ====================

  @Column({ type: 'uuid', nullable: true, name: 'assigned_ship_id' })
  assignedShipId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'crew_role' })
  crewRole?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
