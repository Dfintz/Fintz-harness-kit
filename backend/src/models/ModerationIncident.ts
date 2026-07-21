import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * Threshold in minutes for determining if a timeout is "long"
 * Timeouts exceeding this duration are classified as LONG_TIMEOUT (severity 3)
 */
export const LONG_TIMEOUT_THRESHOLD_MINUTES = 60;

/**
 * Incident type - maps to Discord moderation actions
 */
export enum IncidentType {
  WARNING = 'warning',
  TIMEOUT = 'timeout',
  LONG_TIMEOUT = 'long_timeout',
  KICK = 'kick',
  BAN = 'ban',
}

/**
 * Severity level for moderation incidents
 * 1 = Warning (lowest)
 * 2 = Timeout (up to 1 hour)
 * 3 = Long Timeout (more than 1 hour)
 * 4 = Kick
 * 5 = Ban (highest)
 */
export enum IncidentSeverity {
  WARNING = 1,
  TIMEOUT = 2,
  LONG_TIMEOUT = 3,
  KICK = 4,
  BAN = 5,
}

/**
 * Incident status
 */
export enum IncidentStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/**
 * Moderation Incident entity
 *
 * Tracks moderation actions across Discord servers.
 * Supports automatic detection from Discord events and manual reporting.
 *
 * Features:
 * - 5 severity levels (Warning, Timeout, Long Timeout, Kick, Ban)
 * - Cross-organization sharing for blacklist coordination
 * - Automatic and manual incident creation
 * - Expiration tracking for temporary actions
 */
@Entity('moderation_incidents')
@Index(['targetDiscordId'])
@Index(['guildId'])
@Index(['incidentType'])
@Index(['severity'])
@Index(['isShared'])
@Index(['status'])
@Index(['createdAt'])
@Index(['organizationId', 'targetDiscordId'])
export class ModerationIncident extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Discord Guild (server) ID where the incident occurred
   */
  @Column({ type: 'varchar', length: 20 })
  guildId!: string;

  /**
   * Discord Guild name (for display purposes)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  guildName?: string;

  /**
   * Target Discord user ID
   */
  @Column({ type: 'varchar', length: 20 })
  targetDiscordId!: string;

  /**
   * Target Discord username (cached for display)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  targetUsername?: string;

  /**
   * Moderator user ID (internal platform user ID)
   */
  @Column({ type: 'varchar' })
  moderatorId!: string;

  /**
   * Moderator Discord ID (for Discord audit log correlation)
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  moderatorDiscordId?: string;

  /**
   * Moderator username (cached for display)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  moderatorUsername?: string;

  /**
   * Type of incident (warning, timeout, kick, ban)
   */
  @Column({
    type: 'enum',
    enum: IncidentType,
    default: IncidentType.WARNING,
  })
  incidentType!: IncidentType;

  /**
   * Severity level (1-5)
   */
  @Column({
    type: 'int',
    default: IncidentSeverity.WARNING,
  })
  severity!: IncidentSeverity;

  /**
   * Current status of the incident
   */
  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.ACTIVE,
  })
  status!: IncidentStatus;

  /**
   * Reason for the moderation action
   */
  @Column({ type: 'text', nullable: true })
  reason?: string;

  /**
   * Duration in minutes (for timeouts)
   */
  @Column({ type: 'int', nullable: true })
  durationMinutes?: number;

  /**
   * Whether this incident is shared publicly with all organizations.
   * Note: This is separate from the inherited `sharedWithOrgs` array from TenantEntity.
   * - `isShared=true` means the incident is visible to ALL organizations (public blacklist)
   * - `sharedWithOrgs` (inherited) would be for sharing with SPECIFIC organizations
   * Phase 1 uses the simpler boolean approach; Phase 2 may add fine-grained sharing.
   */
  @Column({ type: 'boolean', default: false })
  isShared!: boolean;

  /**
   * Whether the incident was automatically detected from Discord events
   */
  @Column({ type: 'boolean', default: false })
  isAutoDetected!: boolean;

  /**
   * Discord audit log entry ID (for correlation with Discord events)
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  discordAuditLogId?: string;

  /**
   * Additional metadata (evidence links, notes, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * When the incident expires (for temporary actions like timeouts)
   */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  /**
   * Who revoked this incident (if revoked)
   */
  @Column({ type: 'varchar', nullable: true })
  revokedBy?: string;

  /**
   * When the incident was revoked
   */
  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  /**
   * Reason for revoking the incident
   */
  @Column({ type: 'text', nullable: true })
  revokeReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if the incident is currently active
   */
  isActive(): boolean {
    if (this.status !== IncidentStatus.ACTIVE) {
      return false;
    }
    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }
    return true;
  }

  /**
   * Check if the incident has expired
   */
  isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt !== undefined && new Date() > this.expiresAt;
  }

  /**
   * Get severity level label
   */
  getSeverityLabel(): string {
    switch (this.severity) {
      case IncidentSeverity.WARNING:
        return 'Warning';
      case IncidentSeverity.TIMEOUT:
        return 'Timeout';
      case IncidentSeverity.LONG_TIMEOUT:
        return 'Long Timeout';
      case IncidentSeverity.KICK:
        return 'Kick';
      case IncidentSeverity.BAN:
        return 'Ban';
      default:
        return 'Unknown';
    }
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
   * Calculate severity from incident type and duration
   */
  static calculateSeverity(type: IncidentType, durationMinutes?: number): IncidentSeverity {
    switch (type) {
      case IncidentType.WARNING:
        return IncidentSeverity.WARNING;
      case IncidentType.TIMEOUT:
        // Long timeout is more than the threshold (default 60 minutes)
        if (durationMinutes && durationMinutes > LONG_TIMEOUT_THRESHOLD_MINUTES) {
          return IncidentSeverity.LONG_TIMEOUT;
        }
        return IncidentSeverity.TIMEOUT;
      case IncidentType.LONG_TIMEOUT:
        return IncidentSeverity.LONG_TIMEOUT;
      case IncidentType.KICK:
        return IncidentSeverity.KICK;
      case IncidentType.BAN:
        return IncidentSeverity.BAN;
      default:
        return IncidentSeverity.WARNING;
    }
  }
}
