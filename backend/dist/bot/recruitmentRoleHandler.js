"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRecruitmentRoleHandler = initializeRecruitmentRoleHandler;
const data_source_1 = require("../data-source");
const Activity_1 = require("../models/Activity");
const DiscordGuildSettings_1 = require("../models/DiscordGuildSettings");
const DomainEventBus_1 = require("../services/shared/DomainEventBus");
const logger_1 = require("../utils/logger");
function initializeRecruitmentRoleHandler() {
    DomainEventBus_1.domainEvents.on('member:discord_role_changed', async (event) => {
        try {
            await handleRecruitmentRoleChange(event);
        }
        catch (error) {
            logger_1.logger.error('Error in recruitment role auto-resolve handler:', error);
        }
    });
    logger_1.logger.info('Recruitment role auto-resolve handler initialized');
}
async function handleRecruitmentRoleChange(event) {
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
    await resolveApplicationsByDiscordRole(discordId, organizationId, roleAdded ? 'accept' : 'reject');
}
async function getRecruitmentSettings(guildId, organizationId) {
    const guildSettingsRepo = data_source_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
    const guildSettings = await guildSettingsRepo.findOne({ where: { guildId, organizationId } });
    const recruitment = guildSettings?.recruitmentSettings;
    if (!recruitment?.enabled || !recruitment?.autoResolveOnRoleChange) {
        return null;
    }
    return recruitment;
}
async function resolveApplicationsByDiscordRole(discordId, organizationId, action) {
    const activityRepo = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    const recruitmentActivities = await activityRepo
        .createQueryBuilder('activity')
        .where('activity.organizationId = :organizationId', { organizationId })
        .andWhere('activity.activityType = :type', { type: Activity_1.ActivityType.RECRUITMENT })
        .getMany();
    for (const activity of recruitmentActivities) {
        const applications = activity.applications ?? [];
        let updated = false;
        for (const app of applications) {
            if (app.discordId !== discordId || app.status !== Activity_1.ApplicationStatus.PENDING) {
                continue;
            }
            if (action === 'accept') {
                app.status = Activity_1.ApplicationStatus.ACCEPTED;
                app.acceptedAt = new Date();
                app.feedback = 'Auto-accepted via Discord role assignment';
            }
            else {
                app.status = Activity_1.ApplicationStatus.REJECTED;
                app.rejectionReason = 'Auto-rejected via Discord role removal';
            }
            app.reviewedBy = 'discord-role-sync';
            app.reviewedAt = new Date();
            updated = true;
            logger_1.logger.info(`Auto-${action}ed recruitment application for Discord user ${discordId} in org ${organizationId}`, { activityId: activity.id, applicationId: app.applicationId });
        }
        if (updated) {
            activity.applications = applications;
            await activityRepo.save(activity);
        }
    }
}
//# sourceMappingURL=recruitmentRoleHandler.js.map