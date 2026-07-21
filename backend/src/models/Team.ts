/**
 * Team Entity — Wave 2.6 Teams System
 *
 * Represents a team (squadron, division, crew, platoon) within an organization.
 * Supports hierarchy with parentTeamId, level, sortOrder (same pattern as Fleet).
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import type { TeamMember } from './TeamMember';

export type TeamType = 'squadron' | 'division' | 'crew' | 'platoon' | 'custom';
export type TeamJoinPolicy = 'open' | 'closed';

@Entity('teams')
@Index('idx_team_org_parent', ['organizationId', 'parentTeamId'])
@Index('idx_team_org_name', ['organizationId', 'name'], { unique: true })
export class Team extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: 'squadron' })
  type!: TeamType;

  // ── Emblem ───────────────────────────────────────────────────────────────
  /** URL to team emblem/logo image (synced to linked fleets) */
  @Column({ type: 'text', nullable: true })
  emblem?: string | null;

  // ── Ship Assignment (for crew/squadron/platoon stationed on a ship) ─────
  /**
   * When a squadron is stationed on a capital ship (e.g., Alpha Squadron on Idris-1),
   * or a crew is assigned to a ship, or a platoon is assigned to a dropship/transport,
   * this field links the team to that ship. Auto-nesting logic can then move the
   * team under the capital's crew team in the hierarchy.
   */
  @Column({ type: 'varchar', nullable: true })
  assignedShipId?: string;

  /**
   * Functional division assignment. When a fleet has a specific function
   * (mining, salvage, combat), this links the team to the appropriate
   * division (T&I, Security, etc.) for dynamic organizational grouping.
   */
  @Column({ type: 'uuid', nullable: true })
  assignedDivisionId?: string;

  // ── Hierarchy ────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  parentTeamId?: string;

  @ManyToOne('Team', 'children', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentTeamId' })
  parent?: Team;

  @OneToMany('Team', 'parent')
  children?: Team[];

  @Column({ default: 0 })
  level!: number;

  @Column({ default: 0 })
  sortOrder!: number;

  // ── Capacity ─────────────────────────────────────────────────────────────
  @Column({ default: 20 })
  maxMembers!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Join policy: 'open' = anyone in the org can join directly,
   * 'closed' = membership requires approval from a leader/officer.
   */
  @Column({ type: 'varchar', length: 10, default: 'closed' })
  joinPolicy!: TeamJoinPolicy;

  // ── Members ──────────────────────────────────────────────────────────────
  @OneToMany('TeamMember', 'team')
  members?: TeamMember[];

  // ── Timestamps ───────────────────────────────────────────────────────────
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
