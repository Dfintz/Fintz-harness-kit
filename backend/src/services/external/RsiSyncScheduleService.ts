import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { logger } from '../../utils/logger';

/**
 * Input for creating or updating a sync schedule
 */
export interface SyncScheduleInput {
  organizationId: string;
  rsiOrgSid: string;
  guildId?: string;
  isEnabled?: boolean;
  intervalMinutes?: number;
  notifyOnChanges?: boolean;
  notifyOnErrors?: boolean;
  notificationChannelId?: string;
  removeRolesOnLeave?: boolean;
  affiliateHandling?: 'include' | 'exclude' | 'special_role';
  affiliateRoleId?: string;
  maxConsecutiveFailures?: number;
}

/**
 * RSI Sync Schedule Service
 *
 * Manages sync schedules for organizations.
 * Part of Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging.
 *
 * Features:
 * - CRUD operations for schedules
 * - Get schedules due for sync
 * - Track sync success/failure
 */
export class RsiSyncScheduleService {
  private scheduleRepository: Repository<RsiSyncSchedule>;

  constructor() {
    this.scheduleRepository = AppDataSource.getRepository(RsiSyncSchedule);
    logger.info('RsiSyncScheduleService initialized');
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create or update a sync schedule for an organization
   */
  public async upsertSchedule(input: SyncScheduleInput): Promise<RsiSyncSchedule> {
    try {
      // Check for existing schedule
      let schedule = await this.scheduleRepository.findOne({
        where: { organizationId: input.organizationId },
      });

      if (schedule) {
        // Update existing schedule
        schedule.rsiOrgSid = input.rsiOrgSid;

        if (input.guildId !== undefined) {
          schedule.guildId = input.guildId;
        }
        if (input.isEnabled !== undefined) {
          schedule.isEnabled = input.isEnabled;
        }
        if (input.intervalMinutes !== undefined) {
          if (!RsiSyncSchedule.validateInterval(input.intervalMinutes)) {
            throw new Error(
              'Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)'
            );
          }
          schedule.intervalMinutes = input.intervalMinutes;
        }
        if (input.notifyOnChanges !== undefined) {
          schedule.notifyOnChanges = input.notifyOnChanges;
        }
        if (input.notifyOnErrors !== undefined) {
          schedule.notifyOnErrors = input.notifyOnErrors;
        }
        if (input.notificationChannelId !== undefined) {
          schedule.notificationChannelId = input.notificationChannelId;
        }
        if (input.removeRolesOnLeave !== undefined) {
          schedule.removeRolesOnLeave = input.removeRolesOnLeave;
        }
        if (input.affiliateHandling !== undefined) {
          schedule.affiliateHandling = input.affiliateHandling;
        }
        if (input.affiliateRoleId !== undefined) {
          schedule.affiliateRoleId = input.affiliateRoleId;
        }
        if (input.maxConsecutiveFailures !== undefined) {
          schedule.maxConsecutiveFailures = input.maxConsecutiveFailures;
        }

        // If being enabled, set next sync time
        if (input.isEnabled && !schedule.nextSyncAt) {
          schedule.nextSyncAt = schedule.calculateNextSyncTime();
        }

        logger.info(`Updated sync schedule for org ${input.organizationId}`);
      } else {
        // Create new schedule
        if (input.intervalMinutes && !RsiSyncSchedule.validateInterval(input.intervalMinutes)) {
          throw new Error(
            'Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)'
          );
        }

        schedule = this.scheduleRepository.create({
          organizationId: input.organizationId,
          rsiOrgSid: input.rsiOrgSid,
          guildId: input.guildId,
          isEnabled: input.isEnabled ?? false,
          intervalMinutes: input.intervalMinutes ?? 360,
          notifyOnChanges: input.notifyOnChanges ?? true,
          notifyOnErrors: input.notifyOnErrors ?? true,
          notificationChannelId: input.notificationChannelId,
          removeRolesOnLeave: input.removeRolesOnLeave ?? true,
          affiliateHandling: input.affiliateHandling ?? 'include',
          affiliateRoleId: input.affiliateRoleId,
          maxConsecutiveFailures: input.maxConsecutiveFailures ?? 5,
        });

        // Set initial next sync time if enabled
        if (schedule.isEnabled) {
          schedule.nextSyncAt = new Date(); // Sync immediately on first enable
        }

        logger.info(`Created sync schedule for org ${input.organizationId}`);
      }

      return await this.scheduleRepository.save(schedule);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upsert sync schedule', { error: errorMessage, input });
      throw error;
    }
  }

  /**
   * Get schedule for an organization
   */
  public async getSchedule(organizationId: string): Promise<RsiSyncSchedule | null> {
    try {
      return await this.scheduleRepository.findOne({
        where: { organizationId },
      });
    } catch (error: unknown) {
      logger.error('Failed to get schedule', { error, organizationId });
      return null;
    }
  }

  /**
   * Get schedule by ID
   */
  public async getScheduleById(id: string): Promise<RsiSyncSchedule | null> {
    try {
      return await this.scheduleRepository.findOne({ where: { id } });
    } catch (error: unknown) {
      logger.error('Failed to get schedule by ID', { error, id });
      return null;
    }
  }

  /**
   * Delete schedule for an organization
   */
  public async deleteSchedule(organizationId: string): Promise<boolean> {
    try {
      const result = await this.scheduleRepository.delete({ organizationId });
      const deleted = (result.affected || 0) > 0;

      if (deleted) {
        logger.info(`Deleted sync schedule for org ${organizationId}`);
      }

      return deleted;
    } catch (error: unknown) {
      logger.error('Failed to delete schedule', { error, organizationId });
      return false;
    }
  }

  // ==================== SCHEDULING OPERATIONS ====================

  /**
   * Get all schedules that are due for sync
   */
  public async getSchedulesDueForSync(): Promise<RsiSyncSchedule[]> {
    try {
      const now = new Date();

      return await this.scheduleRepository.find({
        where: [
          // Enabled and next sync time has passed
          {
            isEnabled: true,
            nextSyncAt: LessThanOrEqual(now),
          },
          // Enabled but never synced (null nextSyncAt)
          {
            isEnabled: true,
            nextSyncAt: IsNull(),
          },
        ],
      });
    } catch (error: unknown) {
      logger.error('Failed to get schedules due for sync', { error });
      return [];
    }
  }

  /**
   * Get all enabled schedules
   */
  public async getEnabledSchedules(): Promise<RsiSyncSchedule[]> {
    try {
      return await this.scheduleRepository.find({
        where: { isEnabled: true },
      });
    } catch (error: unknown) {
      logger.error('Failed to get enabled schedules', { error });
      return [];
    }
  }

  /**
   * Get all auto-disabled schedules (due to failures)
   */
  public async getAutoDisabledSchedules(): Promise<RsiSyncSchedule[]> {
    try {
      return await this.scheduleRepository.find({
        where: {
          isEnabled: false,
          consecutiveFailures: Not(0),
        },
      });
    } catch (error: unknown) {
      logger.error('Failed to get auto-disabled schedules', { error });
      return [];
    }
  }

  /**
   * Enable a schedule
   */
  public async enableSchedule(organizationId: string): Promise<RsiSyncSchedule | null> {
    try {
      const schedule = await this.getSchedule(organizationId);
      if (!schedule) {
        return null;
      }

      schedule.reEnable();
      return await this.scheduleRepository.save(schedule);
    } catch (error: unknown) {
      logger.error('Failed to enable schedule', { error, organizationId });
      return null;
    }
  }

  /**
   * Disable a schedule
   */
  public async disableSchedule(organizationId: string): Promise<RsiSyncSchedule | null> {
    try {
      const schedule = await this.getSchedule(organizationId);
      if (!schedule) {
        return null;
      }

      schedule.isEnabled = false;
      return await this.scheduleRepository.save(schedule);
    } catch (error: unknown) {
      logger.error('Failed to disable schedule', { error, organizationId });
      return null;
    }
  }

  // ==================== SYNC STATUS TRACKING ====================

  /**
   * Mark a schedule as successfully synced
   */
  public async markSyncSuccess(organizationId: string): Promise<void> {
    try {
      const schedule = await this.getSchedule(organizationId);
      if (!schedule) {
        return;
      }

      schedule.markSyncSuccess();
      await this.scheduleRepository.save(schedule);

      logger.debug(`Marked sync success for org ${organizationId}`);
    } catch (error: unknown) {
      logger.error('Failed to mark sync success', { error, organizationId });
    }
  }

  /**
   * Mark a schedule as failed
   */
  public async markSyncFailed(
    organizationId: string,
    errorMessage: string
  ): Promise<{ autoDisabled: boolean }> {
    try {
      const schedule = await this.getSchedule(organizationId);
      if (!schedule) {
        return { autoDisabled: false };
      }

      const wasEnabled = schedule.isEnabled;
      schedule.markSyncFailed(errorMessage);
      await this.scheduleRepository.save(schedule);

      const autoDisabled = wasEnabled && !schedule.isEnabled;

      if (autoDisabled) {
        logger.warn(
          `Auto-disabled sync schedule for org ${organizationId} after ${schedule.consecutiveFailures} failures`
        );
      } else {
        logger.debug(`Marked sync failure for org ${organizationId}`);
      }

      return { autoDisabled };
    } catch (error: unknown) {
      logger.error('Failed to mark sync failed', { error, organizationId });
      return { autoDisabled: false };
    }
  }

  /**
   * Reset failure count for a schedule
   */
  public async resetFailures(organizationId: string): Promise<void> {
    try {
      const schedule = await this.getSchedule(organizationId);
      if (!schedule) {
        return;
      }

      schedule.consecutiveFailures = 0;
      schedule.lastErrorMessage = undefined;
      await this.scheduleRepository.save(schedule);

      logger.info(`Reset failures for org ${organizationId}`);
    } catch (error: unknown) {
      logger.error('Failed to reset failures', { error, organizationId });
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get schedule status summary
   */
  public async getScheduleStatus(organizationId: string): Promise<{
    exists: boolean;
    enabled: boolean;
    isDue: boolean;
    lastSync: Date | null;
    nextSync: Date | null;
    failures: number;
    autoDisabled: boolean;
    interval: string;
    rsiOrgSid: string | null;
  }> {
    const schedule = await this.getSchedule(organizationId);

    if (!schedule) {
      return {
        exists: false,
        enabled: false,
        isDue: false,
        lastSync: null,
        nextSync: null,
        failures: 0,
        autoDisabled: false,
        interval: 'Not configured',
        rsiOrgSid: null,
      };
    }

    return {
      exists: true,
      enabled: schedule.isEnabled,
      isDue: schedule.isDueForSync(),
      lastSync: schedule.lastSyncAt || null,
      nextSync: schedule.nextSyncAt || null,
      failures: schedule.consecutiveFailures,
      autoDisabled: schedule.isAutoDisabled(),
      interval: schedule.getIntervalDisplay(),
      rsiOrgSid: schedule.rsiOrgSid,
    };
  }

  /**
   * Update the interval for a schedule
   */
  public async updateInterval(
    organizationId: string,
    intervalMinutes: number
  ): Promise<RsiSyncSchedule | null> {
    if (!RsiSyncSchedule.validateInterval(intervalMinutes)) {
      throw new Error('Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)');
    }

    const schedule = await this.getSchedule(organizationId);
    if (!schedule) {
      return null;
    }

    schedule.intervalMinutes = intervalMinutes;
    schedule.nextSyncAt = schedule.calculateNextSyncTime();

    return this.scheduleRepository.save(schedule);
  }

  /**
   * Get all schedules (for admin dashboard)
   */
  public async getAllSchedules(): Promise<RsiSyncSchedule[]> {
    try {
      return await this.scheduleRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      logger.error('Failed to get all schedules', { error });
      return [];
    }
  }
}

// Export singleton instance
export const rsiSyncScheduleService = new RsiSyncScheduleService();

