"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeModerationEventHandlers = initializeModerationEventHandlers;
exports.startIncidentExpirationTask = startIncidentExpirationTask;
exports.stopIncidentExpirationTask = stopIncidentExpirationTask;
const discord_js_1 = require("discord.js");
const ModerationIncident_1 = require("../models/ModerationIncident");
const BlacklistSharingService_1 = require("../services/discord/BlacklistSharingService");
const GuildOrganizationService_1 = require("../services/discord/GuildOrganizationService");
const ModerationIncidentService_1 = require("../services/discord/ModerationIncidentService");
const DomainEventBus_1 = require("../services/shared/DomainEventBus");
const logger_1 = require("../utils/logger");
const botApiClient_1 = require("./utils/botApiClient");
let _services = null;
function getServices() {
    _services ??= {
        incidentService: ModerationIncidentService_1.ModerationIncidentService.getInstance(),
        sharingService: BlacklistSharingService_1.BlacklistSharingService.getInstance(),
        guildOrgService: GuildOrganizationService_1.GuildOrganizationService.getInstance(),
    };
    return _services;
}
const SYSTEM_USER_ID = 'system';
function initializeModerationEventHandlers(client) {
    client.on('guildBanAdd', async (ban) => {
        try {
            await handleGuildBanAdd(ban);
        }
        catch (error) {
            logger_1.logger.error('Error handling guildBanAdd event:', error);
        }
    });
    client.on('guildBanRemove', async (ban) => {
        try {
            await handleGuildBanRemove(ban);
        }
        catch (error) {
            logger_1.logger.error('Error handling guildBanRemove event:', error);
        }
    });
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            await handleGuildMemberUpdate(oldMember, newMember);
        }
        catch (error) {
            logger_1.logger.error('Error handling guildMemberUpdate event:', error);
        }
    });
    client.on('guildMemberRemove', async (member) => {
        try {
            await handleGuildMemberRemove(member);
        }
        catch (error) {
            logger_1.logger.error('Error handling guildMemberRemove event:', error);
        }
    });
    logger_1.logger.info('🛡️ Moderation event handlers initialized');
}
async function handleGuildBanAdd(ban) {
    const guild = ban.guild;
    const user = ban.user;
    logger_1.logger.info(`Ban detected: ${user.tag} in ${guild.name}`, {
        guildId: guild.id,
        userId: user.id,
    });
    const moderatorId = SYSTEM_USER_ID;
    let moderatorDiscordId;
    let moderatorUsername = 'Unknown Moderator';
    let reason = ban.reason || 'No reason provided';
    let auditLogId;
    try {
        const auditLogs = await guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberBanAdd,
            limit: 1,
        });
        const entry = auditLogs.entries.first();
        if (entry && entry.target?.id === user.id) {
            moderatorDiscordId = entry.executor?.id;
            moderatorUsername = entry.executor?.username || 'Unknown Moderator';
            reason = entry.reason || reason;
            auditLogId = entry.id;
        }
    }
    catch (error) {
        logger_1.logger.warn('Could not fetch audit logs for ban:', error);
    }
    const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
    if (!organizationId) {
        logger_1.logger.warn(`Skipping ban incident for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`);
        return;
    }
    const incident = await getServices().incidentService.createFromDiscordEvent(organizationId, moderatorId, guild.id, guild.name, user.id, user.username, moderatorDiscordId || SYSTEM_USER_ID, moderatorUsername, ModerationIncident_1.IncidentType.BAN, reason, undefined, auditLogId);
    DomainEventBus_1.domainEvents.emit('member:moderation_action', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        organizationId,
        incidentId: incident.id,
        incidentType: ModerationIncident_1.IncidentType.BAN,
        severity: incident.severity,
        moderatorId: moderatorDiscordId || SYSTEM_USER_ID,
        reason,
        isShared: false,
    });
    DomainEventBus_1.domainEvents.emit('member:discord_left', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        discordId: user.id,
        discordUsername: user.username,
        guildId: guild.id,
        guildName: guild.name,
        organizationId,
        reason: 'ban',
    });
    await autoShareIncidentWithAllies(incident, organizationId);
}
async function handleGuildBanRemove(ban) {
    const guild = ban.guild;
    const user = ban.user;
    logger_1.logger.info(`Unban detected: ${user.tag} in ${guild.name}`, {
        guildId: guild.id,
        userId: user.id,
    });
    let moderatorDiscordId;
    let moderatorUsername = 'Unknown Moderator';
    let auditReason;
    try {
        const auditLogs = await guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberBanRemove,
            limit: 5,
        });
        const entry = auditLogs.entries.find(e => e.target?.id === user.id);
        if (entry) {
            moderatorDiscordId = entry.executor?.id;
            moderatorUsername = entry.executor?.username || moderatorUsername;
            auditReason = entry.reason || undefined;
        }
    }
    catch (error) {
        logger_1.logger.warn('Could not fetch audit logs for unban:', error);
    }
    const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
    if (!organizationId) {
        logger_1.logger.warn(`Skipping unban revocation for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`);
        return;
    }
    let summary;
    try {
        summary = await getServices().incidentService.lookupUser(organizationId, user.id, false);
    }
    catch (error) {
        logger_1.logger.error('Failed to look up user incidents during unban revocation:', error);
        return;
    }
    const activeBans = summary.incidents.filter(incident => incident.guildId === guild.id &&
        incident.incidentType === ModerationIncident_1.IncidentType.BAN &&
        incident.status === ModerationIncident_1.IncidentStatus.ACTIVE);
    if (activeBans.length === 0) {
        logger_1.logger.info(`No active ban incidents found to revoke for ${user.tag} in ${guild.name}`);
        return;
    }
    const revokeReason = auditReason
        ? `Discord unban: ${auditReason}`
        : 'Discord unban detected via guildBanRemove event';
    for (const incident of activeBans) {
        try {
            await getServices().incidentService.revokeIncident(organizationId, incident.id, moderatorDiscordId || SYSTEM_USER_ID, moderatorUsername, revokeReason);
        }
        catch (error) {
            logger_1.logger.error(`Failed to revoke ban incident ${incident.id}:`, error);
        }
    }
    logger_1.logger.info(`Revoked ${activeBans.length} ban incident(s) for ${user.tag} in ${guild.name} (org ${organizationId})`);
}
async function handleGuildMemberUpdate(oldMember, newMember) {
    const oldTimeout = oldMember?.communicationDisabledUntil;
    const newTimeout = newMember.communicationDisabledUntil;
    if (newTimeout && newTimeout > new Date() && (!oldTimeout || oldTimeout <= new Date())) {
        const guild = newMember.guild;
        const user = newMember.user;
        const durationMs = newTimeout.getTime() - Date.now();
        const durationMinutes = Math.ceil(durationMs / (60 * 1000));
        logger_1.logger.info(`Timeout detected: ${user.tag} in ${guild.name} for ${durationMinutes} minutes`, {
            guildId: guild.id,
            userId: user.id,
            durationMinutes,
        });
        const moderatorId = SYSTEM_USER_ID;
        let moderatorDiscordId;
        let moderatorUsername = 'Unknown Moderator';
        let reason = 'No reason provided';
        let auditLogId;
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: discord_js_1.AuditLogEvent.MemberUpdate,
                limit: 5,
            });
            const entry = auditLogs.entries.find(e => e.target?.id === user.id && e.changes?.some(c => c.key === 'communication_disabled_until'));
            if (entry) {
                moderatorDiscordId = entry.executor?.id;
                moderatorUsername = entry.executor?.username || 'Unknown Moderator';
                reason = entry.reason || reason;
                auditLogId = entry.id;
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch audit logs for timeout:', error);
        }
        const incidentType = durationMinutes > ModerationIncident_1.LONG_TIMEOUT_THRESHOLD_MINUTES
            ? ModerationIncident_1.IncidentType.LONG_TIMEOUT
            : ModerationIncident_1.IncidentType.TIMEOUT;
        const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
        if (!organizationId) {
            logger_1.logger.warn(`Skipping timeout incident for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`);
            return;
        }
        const incident = await getServices().incidentService.createFromDiscordEvent(organizationId, moderatorId, guild.id, guild.name, user.id, user.username, moderatorDiscordId || SYSTEM_USER_ID, moderatorUsername, incidentType, reason, durationMinutes, auditLogId);
        DomainEventBus_1.domainEvents.emit('member:moderation_action', {
            timestamp: new Date().toISOString(),
            userId: user.id,
            organizationId,
            incidentId: incident.id,
            incidentType,
            severity: incident.severity,
            moderatorId: moderatorDiscordId || SYSTEM_USER_ID,
            reason,
            isShared: false,
        });
        DomainEventBus_1.domainEvents.emit('member:discord_timeout', {
            timestamp: new Date().toISOString(),
            userId: user.id,
            discordId: user.id,
            guildId: guild.id,
            guildName: guild.name,
            organizationId,
            durationMinutes,
            moderatorDiscordId,
            reason,
        });
        await autoShareIncidentWithAllies(incident, organizationId);
    }
    else if (oldTimeout && oldTimeout > new Date() && (!newTimeout || newTimeout <= new Date())) {
        logger_1.logger.info(`Timeout removed: ${newMember.user.tag} in ${newMember.guild.name}`);
    }
    await emitDiscordRoleChanges(oldMember, newMember);
}
async function emitDiscordRoleChanges(oldMember, newMember) {
    const oldRoles = oldMember.roles?.cache;
    const newRoles = newMember.roles.cache;
    if (!oldRoles) {
        return;
    }
    const addedRoles = newRoles.filter((_, id) => !oldRoles.has(id)).map(r => r.id);
    const removedRoles = oldRoles.filter((_, id) => !newRoles.has(id)).map(r => r.id);
    if (addedRoles.length === 0 && removedRoles.length === 0) {
        return;
    }
    try {
        const organizationId = await getServices().guildOrgService.resolveOrganization(newMember.guild.id);
        if (!organizationId) {
            return;
        }
        DomainEventBus_1.domainEvents.emit('member:discord_role_changed', {
            timestamp: new Date().toISOString(),
            userId: newMember.user.id,
            discordId: newMember.user.id,
            guildId: newMember.guild.id,
            organizationId,
            addedRoles,
            removedRoles,
        });
    }
    catch (error) {
        logger_1.logger.warn('Failed to emit discord_role_changed event:', error);
    }
}
async function handleGuildMemberRemove(member) {
    const guild = member.guild;
    const user = member.user;
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const auditLogs = await guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberKick,
            limit: 5,
        });
        const entry = auditLogs.entries.find(e => e.target?.id === user.id && e.createdTimestamp > Date.now() - 30_000);
        if (entry) {
            logger_1.logger.info(`Kick detected: ${user.tag} in ${guild.name}`, {
                guildId: guild.id,
                userId: user.id,
            });
            const moderatorDiscordId = entry.executor?.id;
            const moderatorUsername = entry.executor?.username || 'Unknown Moderator';
            const reason = entry.reason || 'No reason provided';
            const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
            if (!organizationId) {
                logger_1.logger.warn(`Skipping kick incident for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`);
                return;
            }
            const existingIncident = await getServices().incidentService.findByAuditLogId(organizationId, entry.id);
            if (existingIncident) {
                logger_1.logger.debug(`Kick audit-log entry ${entry.id} already recorded as incident ${existingIncident.id} — skipping`);
                return;
            }
            const incident = await getServices().incidentService.createFromDiscordEvent(organizationId, SYSTEM_USER_ID, guild.id, guild.name, user.id, user.username, moderatorDiscordId || SYSTEM_USER_ID, moderatorUsername, ModerationIncident_1.IncidentType.KICK, reason, undefined, entry.id);
            DomainEventBus_1.domainEvents.emit('member:moderation_action', {
                timestamp: new Date().toISOString(),
                userId: user.id,
                organizationId,
                incidentId: incident.id,
                incidentType: ModerationIncident_1.IncidentType.KICK,
                severity: incident.severity,
                moderatorId: moderatorDiscordId || SYSTEM_USER_ID,
                reason,
                isShared: false,
            });
            DomainEventBus_1.domainEvents.emit('member:discord_left', {
                timestamp: new Date().toISOString(),
                userId: user.id,
                discordId: user.id,
                discordUsername: user.username,
                guildId: guild.id,
                guildName: guild.name,
                organizationId,
                reason: 'kick',
            });
            await autoShareIncidentWithAllies(incident, organizationId);
            await withdrawPendingRecruitmentApplications(user.id, guild.id, organizationId, 'kicked');
        }
        else {
            const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
            if (!organizationId) {
                logger_1.logger.warn(`Skipping voluntary-leave event for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`);
                return;
            }
            DomainEventBus_1.domainEvents.emit('member:discord_left', {
                timestamp: new Date().toISOString(),
                userId: user.id,
                discordId: user.id,
                discordUsername: user.username,
                guildId: guild.id,
                guildName: guild.name,
                organizationId,
                reason: 'leave',
            });
            await withdrawPendingRecruitmentApplications(user.id, guild.id, organizationId, 'left');
        }
    }
    catch (error) {
        logger_1.logger.warn('Could not fetch audit logs for member remove:', error);
    }
}
async function autoShareIncidentWithAllies(incident, organizationId) {
    try {
        const config = await getServices().sharingService.getConfig(organizationId);
        if (config.shouldAutoShare(incident.severity) &&
            config.shouldShareIncidentType(incident.incidentType)) {
            await getServices().sharingService.shareIncidentWithAllies(incident, organizationId, SYSTEM_USER_ID, 'System');
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to auto-share incident with allies:', error);
    }
}
async function withdrawPendingRecruitmentApplications(userId, guildId, organizationId, reason) {
    try {
        const response = await botApiClient_1.botApiClient.get(`/v2/recruitment/my-applications`, {
            headers: {
                'X-Discord-User-Id': userId,
                'X-Discord-Guild-Id': guildId,
            },
        });
        const applications = response.data?.data ?? response.data ?? [];
        const pending = applications.filter(app => app.status === 'pending' || app.status === 'submitted');
        for (const app of pending) {
            try {
                await botApiClient_1.botApiClient.put(`/v2/recruitment/applications/${app.id}/status`, { status: 'withdrawn', reason: `Auto-withdrawn: member ${reason} the server` }, {
                    headers: {
                        'X-Discord-User-Id': 'system',
                        'X-Discord-Guild-Id': guildId,
                    },
                });
            }
            catch {
            }
        }
        if (pending.length > 0) {
            logger_1.logger.info(`Auto-withdrew ${pending.length} pending recruitment application(s) for user ${userId} (${reason})`, { guildId, organizationId });
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to auto-withdraw recruitment applications:', error);
    }
}
let incidentExpirationInterval = null;
function startIncidentExpirationTask(intervalMs = 5 * 60 * 1000) {
    if (incidentExpirationInterval) {
        clearInterval(incidentExpirationInterval);
    }
    incidentExpirationInterval = setInterval(async () => {
        try {
            const expiredCount = await getServices().incidentService.expireIncidents();
            if (expiredCount > 0) {
                logger_1.logger.info(`Expired ${expiredCount} moderation incidents`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error during incident expiration task:', error);
        }
    }, intervalMs);
    logger_1.logger.info('🧹 Incident expiration task started');
}
function stopIncidentExpirationTask() {
    if (incidentExpirationInterval) {
        clearInterval(incidentExpirationInterval);
        incidentExpirationInterval = null;
        logger_1.logger.info('🧹 Incident expiration task stopped');
    }
}
//# sourceMappingURL=moderationEventHandler.js.map