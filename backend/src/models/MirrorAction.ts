import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { IncidentSeverity, IncidentType, ModerationIncident } from './ModerationIncident';

/**
 * Action type for mirror operations
 */
export enum MirrorActionType {
  /** Warning applied to the user */
  WARNING = 'warning',
  /** Timeout applied to the user */
  TIMEOUT = 'timeout',
  /** User was kicked from the server */
  KICK = 'kick',
  /** User was banned from the server */
  BAN = 'ban',
}

/**
 * Status of the mirror action
 */
export enum MirrorActionStatus {
  /** Action is waiting for confirmation */
  PENDING = 'pending',
  /** Action was confirmed and executed successfully */
  CONFIRMED = 'confirmed',
  /** Action was cancelled before execution */
  CANCELLED = 'cancelled',
  /** Action failed to execute */
  FAILED = 'failed',
}

/**
 * Mirror Action entity
 *
 * Records when a moderator mirrors an incident from an allied organization
 * to their own server. Part of Phase 3: Mirror Action Capability.
 *
 * Features:
 * - Tracks source incident and source organization
 * - Records the moderator who performed the mirror
 * - Stores the action type and status
 * - Confirmation tracking for ban actions
 * - Audit trail for all mirror operations
 */
@Entity('mirror_actions')
export class MirrorAction extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ==================== SOURCE INCIDENT INFO ====================

  /**
   * ID of the source incident being mirrored
   */
  @Column({ type: 'uuid' })
  @Index()
  sourceIncidentId!: string;

  /**
   * Reference to the source incident
   */
  @ManyToOne(() => ModerationIncident, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sourceIncidentId' })
  sourceIncident?: ModerationIncident;

  /**
   * Organization ID where the incident originated
   */
  @Column({ type: 'uuid' })
  sourceOrganizationId!: string;

  /**
   * Guild ID of the source server (for display)
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  sourceGuildId?: string;

  /**
   * Guild name of the source server (cached for display)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceGuildName?: string;

  // ==================== TARGET INFO ====================

  /**
   * Discord user ID of the user being actioned
   */
  @Column({ type: 'varchar', length: 20 })
  @Index()
  targetDiscordId!: string;

  /**
   * Discord username of the target (cached for display)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  targetUsername?: string;

  /**
   * Guild ID where the mirror action is being applied
   */
  @Column({ type: 'varchar', length: 20 })
  targetGuildId!: string;

  /**
   * Guild name where the action is being applied (cached)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  targetGuildName?: string;

  // ==================== ACTION INFO ====================

  /**
   * Type of action taken (warning, timeout, kick, ban)
   */
  @Column({
    type: 'enum',
    enum: MirrorActionType,
    default: MirrorActionType.BAN,
  })
  actionType!: MirrorActionType;

  /**
   * Severity level of the mirrored action (1-5)
   */
  @Column({
    type: 'int',
    default: IncidentSeverity.BAN,
  })
  severity!: IncidentSeverity;

  /**
   * Status of the mirror action
   */
  @Column({
    type: 'enum',
    enum: MirrorActionStatus,
    default: MirrorActionStatus.PENDING,
  })
  @Index()
  status!: MirrorActionStatus;
  /**
   * Reason for the mirror action (can be copied or customized)
   */
  @Column({ type: 'text', nullable: true })
  reason?: string;

  /**
   * Original reason from the source incident
   */
  @Column({ type: 'text', nullable: true })
  originalReason?: string;

  /**
   * Duration in minutes (for timeouts)
   */
  @Column({ type: 'int', nullable: true })
  durationMinutes?: number;

  // ==================== MODERATOR INFO ====================

  /**
   * Platform user ID of the moderator performing the mirror
   */
  @Column({ type: 'uuid' })
  @Index()
  moderatorId!: string;

  /**
   * Discord ID of the moderator
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  moderatorDiscordId?: string;

  /**
   * Username of the moderator (cached)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  moderatorUsername?: string;

  // ==================== CONFIRMATION INFO ====================

  /**
   * Whether confirmation was required (e.g., for bans)
   */
  @Column({ type: 'boolean', default: false })
  confirmationRequired!: boolean;

  /**
   * When confirmation was received (if required)
   */
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  /**
   * When the action was executed
   */
  @Column({ type: 'timestamp', nullable: true })
  executedAt?: Date;

  /**
   * Error message if the action failed
   */
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  // ==================== BULK MIRROR INFO ====================

  /**
   * Whether this was part of a bulk mirror operation
   */
  @Column({ type: 'boolean', default: false })
  isBulkMirror!: boolean;

  /**
   * ID linking related bulk mirror actions together
   */
  @Column({ type: 'uuid', nullable: true })
  bulkMirrorId?: string;

  // ==================== METADATA ====================

  /**
   * Additional metadata (source incident details, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // ==================== TIMESTAMPS ====================

  @CreateDateColumn()
  @Index()
  createdAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if this action requires confirmation before execution
   */
  needsConfirmation(): boolean {
    return this.confirmationRequired && this.status === MirrorActionStatus.PENDING;
  }

  /**
   * Check if this action is pending
   */
  isPending(): boolean {
    return this.status === MirrorActionStatus.PENDING;
  }

  /**
   * Check if this action was executed successfully
   */
  isExecuted(): boolean {
    return this.status === MirrorActionStatus.CONFIRMED && this.executedAt !== null;
  }

  /**
   * Check if this action is a ban (highest severity)
   */
  isBan(): boolean {
    return this.actionType === MirrorActionType.BAN;
  }

  /**
   * Get severity emoji for Discord display
   */
  getSeverityEmoji(): string {
    switch (this.severity) {
      case IncidentSeverity.WARNING:
        return '⚠️';
      case IncidentSeverity.TIMEOUT:
        return '⏰';
      case IncidentSeverity.LONG_TIMEOUT:
        return '🕐';
      case IncidentSeverity.KICK:
        return '👢';
      case IncidentSeverity.BAN:
        return '🔨';
      default:
        return '❓';
    }
  }

  /**
   * Get action type from incident type
   */
  static actionTypeFromIncidentType(incidentType: IncidentType): MirrorActionType {
    switch (incidentType) {
      case IncidentType.WARNING:
        return MirrorActionType.WARNING;
      case IncidentType.TIMEOUT:
      case IncidentType.LONG_TIMEOUT:
        return MirrorActionType.TIMEOUT;
      case IncidentType.KICK:
        return MirrorActionType.KICK;
      case IncidentType.BAN:
        return MirrorActionType.BAN;
      default:
        return MirrorActionType.WARNING;
    }
  }
}
