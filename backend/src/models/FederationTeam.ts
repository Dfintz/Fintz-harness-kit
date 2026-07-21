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

import { Federation } from './Federation';

// ─── Types ────────────────────────────────────────────────────

export type FederationTeamType =
  | 'task_force'
  | 'diplomatic_mission'
  | 'joint_operation'
  | 'trade_convoy'
  | 'custom';

export type FederationTeamStatus = 'active' | 'disbanded';

export interface FederationTeamMember {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

// ─── Entity ───────────────────────────────────────────────────

/**
 * FederationTeam Entity
 *
 * Cross-org operational groups composed from member org personnel.
 * Each team has a leader from any member org, and members drawn
 * from any member org's user pool.
 *
 * Used for: joint operations, task forces, diplomatic missions,
 * trade convoys, and custom cross-org groups.
 */
@Entity('federation_teams')
@Index('idx_fed_team_federation', ['federationId'])
@Index('idx_fed_team_status', ['federationId', 'status'])
export class FederationTeam {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  federationId!: string;

  @ManyToOne(() => Federation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'federationId' })
  federation?: Federation;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'task_force' })
  type!: FederationTeamType;

  /** Leader user ID */
  @Column({ type: 'varchar', nullable: true })
  leaderId!: string | null;

  /** Denormalized leader display name */
  @Column({ type: 'varchar', length: 200, nullable: true })
  leaderName!: string | null;

  /** Leader's organization ID */
  @Column({ type: 'varchar', nullable: true })
  leaderOrgId!: string | null;

  /** Team members from across member organizations */
  @Column({ type: 'jsonb', default: '[]' })
  members!: FederationTeamMember[];

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: FederationTeamStatus;

  @Column({ type: 'int', default: 20 })
  maxMembers!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
