import { MISSION_STATUS_TRANSITIONS } from '@sc-fleet-manager/shared-types';
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
import { Fleet } from './Fleet';

/**
 * Mission type classification
 */
export enum MissionType {
  COMBAT = 'combat',
  MINING = 'mining',
  TRADING = 'trading',
  EXPLORATION = 'exploration',
  LOGISTICS = 'logistics',
  RESCUE = 'rescue',
  RECONNAISSANCE = 'reconnaissance',
  ESCORT = 'escort',
  SALVAGE = 'salvage',
  CUSTOM = 'custom',
}

/**
 * Mission lifecycle status
 *
 * Transitions:
 *   draft → planned → briefed → in_progress → completed | failed
 *   Any state → cancelled
 */
export enum MissionStatus {
  DRAFT = 'draft',
  PLANNED = 'planned',
  BRIEFED = 'briefed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Mission difficulty level
 */
export enum MissionDifficulty {
  TRIVIAL = 'trivial',
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXTREME = 'extreme',
}

/**
 * Mission priority level
 */
export enum MissionPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Individual mission objective stored as simple-json
 */
export interface MissionObjectiveData {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  optional?: boolean;
  order: number;
}

/**
 * Mission participant stored as simple-json
 */
export interface MissionParticipantData {
  userId: string;
  role: 'leader' | 'member' | 'support' | 'reserve';
  joinedAt: string;
  status: 'confirmed' | 'pending' | 'declined';
}

/**
 * Mission Entity
 *
 * Represents a planned, active, or completed mission within an organization.
 * Extends TenantEntity for multi-tenant isolation with soft delete support.
 *
 * Related entities:
 * - Fleet: optional fleet assignment
 * - Briefing: linked via briefing.missionId (one mission → many briefings)
 * - Activity: can be linked via linkedActivityId
 */
@Entity('missions')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'missionType'])
@Index(['organizationId', 'createdBy'])
@Index(['organizationId', 'createdAt'])
export class Mission extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: MissionType, default: MissionType.CUSTOM })
  missionType!: MissionType;

  @Column({ type: 'enum', enum: MissionStatus, default: MissionStatus.DRAFT })
  status!: MissionStatus;

  @Column({ type: 'enum', enum: MissionDifficulty, default: MissionDifficulty.MEDIUM })
  difficulty!: MissionDifficulty;

  @Column({ type: 'enum', enum: MissionPriority, default: MissionPriority.NORMAL })
  priority!: MissionPriority;

  /** User who created this mission */
  @Column()
  createdBy!: string;

  /** User or fleet commander assigned to lead the mission */
  @Column({ type: 'varchar', nullable: true })
  assignedTo?: string;

  /** Optional fleet assigned to this mission */
  @Index('idx_mission_fleet')
  @Column({ type: 'uuid', nullable: true })
  fleetId?: string;

  @ManyToOne(() => Fleet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fleetId' })
  fleet?: Fleet;

  /** Link to an Activity entity for activity stream integration */
  @Column({ type: 'uuid', nullable: true })
  linkedActivityId?: string;

  /** In-game location or area */
  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string;

  /** Mission objectives as structured JSON */
  @Column('simple-json', { nullable: true, default: '[]' })
  objectives!: MissionObjectiveData[];

  /** Mission participants as structured JSON */
  @Column('simple-json', { nullable: true, default: '[]' })
  participants!: MissionParticipantData[];

  /** Searchable tags */
  @Column('simple-array', { nullable: true, default: '' })
  tags?: string[];

  /**
   * Tracks external import source for duplicate-prevention and DB-level uniqueness.
   *
   * Format: `<provider>:<externalId>` (e.g. `scmdb:ABC123`)
   *
   * A partial unique index `idx_mission_org_source_ref_unique` on
   * (organizationId, sourceReference) WHERE sourceReference IS NOT NULL is managed
   * via migration 20260715100000. This prevents TOCTOU duplicates for concurrent
   * external catalog imports. NULLs (manually-created missions) are excluded.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceReference?: string;

  /** Reward description (e.g., "50,000 aUEC", "Reputation boost") */
  @Column({ type: 'varchar', length: 500, nullable: true })
  reward?: string;

  /** Planned start date/time */
  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  /** Planned end date/time */
  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  /** Actual completion date/time */
  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  /** Outcome notes (filled on completion/failure) */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ---- Helpers ----

  /** Check if mission is in an active state */
  isActive(): boolean {
    return this.status === MissionStatus.IN_PROGRESS;
  }

  /** Check if mission has ended (completed, failed, or cancelled) */
  isTerminal(): boolean {
    return [MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.CANCELLED].includes(
      this.status
    );
  }

  /** Valid status transitions map — delegates to the shared-types constant */
  static readonly STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]> =
    MISSION_STATUS_TRANSITIONS as Record<MissionStatus, MissionStatus[]>;

  /** Check if a status transition is valid */
  canTransitionTo(newStatus: MissionStatus): boolean {
    return Mission.STATUS_TRANSITIONS[this.status]?.includes(newStatus) ?? false;
  }
}
