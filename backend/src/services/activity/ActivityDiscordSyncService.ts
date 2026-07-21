import { AppDataSource } from '../../config/database';
import { Activity } from '../../models/Activity';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

export interface ActivityVoiceChannelInfo {
  channelId: string;
  autoDelete: boolean;
}

/**
 * ActivityDiscordSyncService
 *
 * Owns activity-side reads/writes used by Discord lifecycle sync handlers.
 * Keeping these operations in the Activity domain avoids direct repository
 * mutations from bot runtime wiring code.
 */
export class ActivityDiscordSyncService {
  private readonly repository = AppDataSource.getRepository(Activity);

  private isDatabaseReady(): boolean {
    return AppDataSource.isInitialized;
  }

  async getDiscordEventId(activityId: string, organizationId: string): Promise<string | null> {
    try {
      if (!this.isDatabaseReady()) {
        return null;
      }

      const query = this.repository
        .createQueryBuilder('activity')
        .select(['activity.id', 'activity.discordEventId'])
        .where('activity.id = :activityId', { activityId });

      query.andWhere('activity.organizationId = :organizationId', { organizationId });

      const activity = await query.getOne();
      return activity?.discordEventId ?? null;
    } catch (error: unknown) {
      logger.warn('Failed to resolve activity discord event id', {
        activityId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getVoiceChannelInfo(
    activityId: string,
    organizationId: string
  ): Promise<ActivityVoiceChannelInfo | null> {
    try {
      if (!this.isDatabaseReady()) {
        return null;
      }

      const query = this.repository
        .createQueryBuilder('activity')
        .select(['activity.id', 'activity.voiceChannelId', 'activity.voiceChannel'])
        .where('activity.id = :activityId', { activityId });

      query.andWhere('activity.organizationId = :organizationId', { organizationId });

      const activity = await query.getOne();
      const channelId = activity?.voiceChannelId ?? activity?.voiceChannel?.channelId ?? null;
      if (!channelId) {
        return null;
      }

      return {
        channelId,
        autoDelete: activity?.voiceChannel?.autoDelete ?? false,
      };
    } catch (error: unknown) {
      logger.warn('Failed to resolve activity voice channel info', {
        activityId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async clearDiscordEventPointer(activityId: string, organizationId: string): Promise<boolean> {
    try {
      if (!this.isDatabaseReady()) {
        return false;
      }

      const updateResult = await this.repository
        .createQueryBuilder()
        .update()
        .set({ discordEventId: () => 'NULL' })
        .where('id = :activityId', { activityId })
        .andWhere('organizationId = :organizationId', { organizationId })
        .execute();

      logger.info('Cleared activity discord event pointer', {
        activityId,
        organizationId,
        affected: updateResult.affected ?? 0,
      });

      auditService.log({
        category: AuditCategory.ACTIVITY,
        action: 'ACTIVITY_DISCORD_EVENT_POINTER_CLEARED',
        message: `Cleared Discord event pointer for activity ${activityId}`,
        organizationId,
        resource: `activity/${activityId}`,
        metadata: {
          activityId,
          affected: updateResult.affected ?? 0,
        },
      });

      return (updateResult.affected ?? 0) > 0;
    } catch (error: unknown) {
      logger.warn('Failed to clear activity discord event pointer', {
        activityId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async clearVoiceChannelPointers(activityId: string, organizationId: string): Promise<boolean> {
    try {
      if (!this.isDatabaseReady()) {
        return false;
      }

      const updateResult = await this.repository
        .createQueryBuilder()
        .update()
        .set({
          voiceChannelId: () => 'NULL',
          voiceChannelName: () => 'NULL',
          voiceChannel: () => 'NULL',
        })
        .where('id = :activityId', { activityId })
        .andWhere('organizationId = :organizationId', { organizationId })
        .execute();

      logger.info('Cleared activity voice channel pointers', {
        activityId,
        organizationId,
        affected: updateResult.affected ?? 0,
      });

      auditService.log({
        category: AuditCategory.ACTIVITY,
        action: 'ACTIVITY_VOICE_POINTERS_CLEARED',
        message: `Cleared voice channel pointers for activity ${activityId}`,
        organizationId,
        resource: `activity/${activityId}`,
        metadata: {
          activityId,
          affected: updateResult.affected ?? 0,
        },
      });

      return (updateResult.affected ?? 0) > 0;
    } catch (error: unknown) {
      logger.warn('Failed to clear activity voice channel pointers', {
        activityId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export const activityDiscordSyncService = new ActivityDiscordSyncService();
