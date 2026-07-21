import { AppDataSource } from '../data-source';
import { Activity, ActivityType, ApplicationStatus } from '../models/Activity';
import { DiscordGuildSettings, type RecruitmentSettings } from '../models/DiscordGuildSettings';
import { domainEvents } from '../services/shared/DomainEventBus';
import { logger } from '../utils/logger';

interface DiscordRoleChangedEvent {
  userId: string;
  discordId: string;
  guildId: string;
  organizationId: string;
  addedRoles: readonly string[];
  removedRoles: readonly string[];
}

/**
 * Initialize the recruitment role auto-resolve listener.
 * When a Discord member receives the configured "accepted" role,
 * any pending applications for that org are automatically accepted.
 * When the role is removed, pending applications are rejected.
 */
export function initializeRecruitmentRoleHandler(): void {
  domainEvents.on('member:discord_role_changed', async (event: DiscordRoleChangedEvent) => {
    try {
      await handleRecruitmentRoleChange(event);
    } catch (error) {
      logger.error('Error in recruitment role auto-resolve handler:', error);
    }
  });

  logger.info('Recruitment role auto-resolve handler initialized');
}

async function handleRecruitmentRoleChange(event: DiscordRoleChangedEvent): Promise<void> {
  const { discordId, guildId, organizationId, addedRoles, removedRoles } = event;

  const recruitmentSettings = await getRecruitmentSettings(guildId, organizationId);
  if (!recruitmentSettings) {
    return;
  }

  const acceptRoleId = recruitmentSettings.acceptRoleId;
  if (!acceptRoleId) {
    return;
  }

  const roleAdded = addedRoles.includes(acceptRoleId);
  const roleRemoved = removedRoles.includes(acceptRoleId);

  if (!roleAdded && !roleRemoved) {
    return;
  }

  await resolveApplicationsByDiscordRole(
    discordId,
    organizationId,
    roleAdded ? 'accept' : 'reject'
  );
}

async function getRecruitmentSettings(
  guildId: string,
  organizationId: string
): Promise<RecruitmentSettings | null> {
  const guildSettingsRepo = AppDataSource.getRepository(DiscordGuildSettings);
  const guildSettings = await guildSettingsRepo.findOne({ where: { guildId, organizationId } });
  const recruitment = guildSettings?.recruitmentSettings;
  if (!recruitment?.enabled || !recruitment?.autoResolveOnRoleChange) {
    return null;
  }
  return recruitment;
}

async function resolveApplicationsByDiscordRole(
  discordId: string,
  organizationId: string,
  action: 'accept' | 'reject'
): Promise<void> {
  const activityRepo = AppDataSource.getRepository(Activity);
  const recruitmentActivities = await activityRepo
    .createQueryBuilder('activity')
    .where('activity.organizationId = :organizationId', { organizationId })
    .andWhere('activity.activityType = :type', { type: ActivityType.RECRUITMENT })
    .getMany();

  for (const activity of recruitmentActivities) {
    const applications = activity.applications ?? [];
    let updated = false;

    for (const app of applications) {
      if (app.discordId !== discordId || app.status !== ApplicationStatus.PENDING) {
        continue;
      }

      if (action === 'accept') {
        app.status = ApplicationStatus.ACCEPTED;
        app.acceptedAt = new Date();
        app.feedback = 'Auto-accepted via Discord role assignment';
      } else {
        app.status = ApplicationStatus.REJECTED;
        app.rejectionReason = 'Auto-rejected via Discord role removal';
      }
      app.reviewedBy = 'discord-role-sync';
      app.reviewedAt = new Date();
      updated = true;

      logger.info(
        `Auto-${action}ed recruitment application for Discord user ${discordId} in org ${organizationId}`,
        { activityId: activity.id, applicationId: app.applicationId }
      );
    }

    if (updated) {
      activity.applications = applications;
      await activityRepo.save(activity);
    }
  }
}
