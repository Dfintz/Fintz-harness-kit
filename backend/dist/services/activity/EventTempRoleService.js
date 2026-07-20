"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTempRoleService = void 0;
const data_source_1 = require("../../data-source");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const DEFAULT_TEMP_ROLE_COLOR = 0x3498db;
const TEMP_ROLE_PREFIX = '📅 ';
const MAX_ROLE_NAME_LENGTH = 100;
class EventTempRoleService {
    static instance;
    static getInstance() {
        if (!EventTempRoleService.instance) {
            EventTempRoleService.instance = new EventTempRoleService();
        }
        return EventTempRoleService.instance;
    }
    async createTempRole(guild, activity, color) {
        try {
            const roleName = this.buildRoleName(activity.title);
            const role = await guild.roles.create({
                name: roleName,
                color: color ?? DEFAULT_TEMP_ROLE_COLOR,
                mentionable: false,
                hoist: false,
                reason: `Temporary role for event: ${activity.title} (${activity.id})`,
            });
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
                userId: activity.creatorId,
                username: activity.creatorName,
                resource: `discord/guild/${guild.id}/role/${role.id}`,
                action: 'EVENT_TEMP_ROLE_CREATED',
                message: `Created temp role "${roleName}" for event: ${activity.title}`,
                metadata: { activityId: activity.id, roleId: role.id, roleName },
            });
            return role.id;
        }
        catch (error) {
            logger_1.logger.warn('Failed to create temp event role', {
                guildId: guild.id,
                activityId: activity.id,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async assignTempRole(guild, userId, roleId, activityId) {
        try {
            const member = await this.fetchMember(guild, userId);
            if (!member) {
                return false;
            }
            if (member.roles.cache.has(roleId)) {
                return true;
            }
            await member.roles.add(roleId, `RSVP accepted for event ${activityId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.warn('Failed to assign temp event role', {
                guildId: guild.id,
                userId,
                roleId,
                activityId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async removeTempRole(guild, userId, roleId, activityId) {
        try {
            const member = await this.fetchMember(guild, userId);
            if (!member) {
                return false;
            }
            if (!member.roles.cache.has(roleId)) {
                return true;
            }
            await member.roles.remove(roleId, `Left/declined event ${activityId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.warn('Failed to remove temp event role', {
                guildId: guild.id,
                userId,
                roleId,
                activityId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async deleteTempRole(guild, roleId, activityId, reason) {
        try {
            const role = guild.roles.cache.get(roleId);
            if (!role) {
                return true;
            }
            await role.delete(`Event ${reason}: ${activityId}`);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
                userId: 'system',
                username: 'system',
                resource: `discord/guild/${guild.id}/role/${roleId}`,
                action: 'EVENT_TEMP_ROLE_DELETED',
                message: `Deleted temp role for event ${activityId}: ${reason}`,
                metadata: { activityId, roleId, reason },
            });
            return true;
        }
        catch (error) {
            logger_1.logger.warn('Failed to delete temp event role', {
                guildId: guild.id,
                roleId,
                activityId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async syncTempRoleToParticipants(guild, activity, roleId) {
        const result = { assigned: 0, failed: 0 };
        const participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
        const accepted = await participantRepo.find({
            where: { activityId: activity.id, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
            select: ['userId'],
        });
        for (const participant of accepted) {
            const success = await this.assignTempRole(guild, participant.userId, roleId, activity.id);
            if (success) {
                result.assigned++;
            }
            else {
                result.failed++;
            }
        }
        return result;
    }
    async resolveGuild(client, guildId) {
        try {
            return client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
        }
        catch {
            return null;
        }
    }
    buildRoleName(eventTitle) {
        const cleaned = eventTitle.trim().slice(0, MAX_ROLE_NAME_LENGTH - TEMP_ROLE_PREFIX.length);
        return `${TEMP_ROLE_PREFIX}${cleaned}`;
    }
    async fetchMember(guild, userId) {
        try {
            return guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
        }
        catch {
            return null;
        }
    }
}
exports.EventTempRoleService = EventTempRoleService;
//# sourceMappingURL=EventTempRoleService.js.map