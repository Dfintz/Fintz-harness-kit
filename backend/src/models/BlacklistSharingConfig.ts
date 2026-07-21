import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * Blacklist Sharing Configuration entity
 *
 * Configures how an organization shares and receives moderation incidents
 * with allied organizations. Part of Phase 2: Alliance-Wide Sharing.
 *
 * Features:
 * - Configurable sharing per incident type (warnings, timeouts, kicks, bans)
 * - Alert channel configuration for real-time notifications
 * - Minimum severity threshold for sharing/receiving
 */
@Entity('blacklist_sharing_config')
export class BlacklistSharingConfig extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ==================== SHARING SETTINGS ====================
  // What types of incidents this organization shares with allies

  /**
   * Share warning incidents with allied organizations
   */
  @Column({ type: 'boolean', default: false })
  shareWarnings!: boolean;

  /**
   * Share timeout incidents with allied organizations
   */
  @Column({ type: 'boolean', default: true })
  shareTimeouts!: boolean;

  /**
   * Share kick incidents with allied organizations
   */
  @Column({ type: 'boolean', default: true })
  shareKicks!: boolean;

  /**
   * Share ban incidents with allied organizations
   */
  @Column({ type: 'boolean', default: true })
  shareBans!: boolean;

  // ==================== RECEIVING SETTINGS ====================
  // Settings for receiving incidents from allied organizations

  /**
   * Receive alerts for incidents from allied organizations
   */
  @Column({ type: 'boolean', default: true })
  receiveAlerts!: boolean;

  /**
   * Minimum severity level to receive alerts for (1-5)
   * 1 = Warning, 2 = Timeout, 3 = Long Timeout, 4 = Kick, 5 = Ban
   */
  @Column({ type: 'int', default: 2 })
  minAlertSeverity!: number;

  /**
   * Discord channel ID where alerts should be posted
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  alertChannelId?: string;

  // ==================== AUTO-SHARE SETTINGS ====================

  /**
   * Automatically share incidents with all allies
   * When false, incidents must be manually shared
   */
  @Column({ type: 'boolean', default: false })
  autoShareWithAllies!: boolean;

  /**
   * Minimum severity to auto-share (1-5)
   * Only incidents at or above this severity will be auto-shared
   */
  @Column({ type: 'int', default: 3 })
  autoShareMinSeverity!: number;

  // ==================== AUTO-ENFORCE SETTINGS ====================
  // When enabled, automatically enforce mirrored incidents from allies
  // (execute timeout/kick on this server). Bans are ALWAYS manual.

  /**
   * Master toggle for auto-enforcement of allied incidents.
   * When false, all mirrored incidents require manual action.
   */
  @Column({ type: 'boolean', default: false })
  autoEnforceEnabled!: boolean;

  /**
   * Automatically enforce timeout actions from allied incidents
   */
  @Column({ type: 'boolean', default: false })
  autoEnforceTimeouts!: boolean;

  /**
   * Automatically enforce kick actions from allied incidents
   */
  @Column({ type: 'boolean', default: false })
  autoEnforceKicks!: boolean;

  // ==================== TIMESTAMPS ====================

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if a specific incident type should be shared based on config
   */
  shouldShareIncidentType(
    incidentType: 'warning' | 'timeout' | 'long_timeout' | 'kick' | 'ban'
  ): boolean {
    switch (incidentType) {
      case 'warning':
        return this.shareWarnings;
      case 'timeout':
      case 'long_timeout':
        return this.shareTimeouts;
      case 'kick':
        return this.shareKicks;
      case 'ban':
        return this.shareBans;
      default:
        return false;
    }
  }

  /**
   * Check if an incident with given severity should trigger an alert
   */
  shouldAlert(severity: number): boolean {
    return this.receiveAlerts && severity >= this.minAlertSeverity;
  }

  /**
   * Check if an incident should be auto-shared based on severity
   */
  shouldAutoShare(severity: number): boolean {
    return this.autoShareWithAllies && severity >= this.autoShareMinSeverity;
  }

  /**
   * Check if an incident type should be auto-enforced.
   * Bans are NEVER auto-enforced (always require manual confirmation).
   */
  shouldAutoEnforce(
    incidentType: 'warning' | 'timeout' | 'long_timeout' | 'kick' | 'ban'
  ): boolean {
    if (!this.autoEnforceEnabled) {
      return false;
    }
    switch (incidentType) {
      case 'timeout':
      case 'long_timeout':
        return this.autoEnforceTimeouts;
      case 'kick':
        return this.autoEnforceKicks;
      // Bans and warnings are never auto-enforced
      case 'ban':
      case 'warning':
      default:
        return false;
    }
  }

  /**
   * Get a summary of sharing settings
   */
  getSharingSummary(): {
    sharingEnabled: boolean;
    sharedTypes: string[];
    alertsEnabled: boolean;
    alertChannel: string | null;
  } {
    const sharedTypes: string[] = [];
    if (this.shareWarnings) {
      sharedTypes.push('warnings');
    }
    if (this.shareTimeouts) {
      sharedTypes.push('timeouts');
    }
    if (this.shareKicks) {
      sharedTypes.push('kicks');
    }
    if (this.shareBans) {
      sharedTypes.push('bans');
    }

    return {
      sharingEnabled: sharedTypes.length > 0,
      sharedTypes,
      alertsEnabled: this.receiveAlerts,
      alertChannel: this.alertChannelId || null,
    };
  }
}
