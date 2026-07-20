"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamVoiceAuditLogger = exports.TeamVoiceAuditLogger = exports.TeamVoiceAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var TeamVoiceAuditAction;
(function (TeamVoiceAuditAction) {
    TeamVoiceAuditAction["CHANNELS_CREATED"] = "TEAM_VOICE_CHANNELS_CREATED";
    TeamVoiceAuditAction["CHANNELS_DELETED"] = "TEAM_VOICE_CHANNELS_DELETED";
    TeamVoiceAuditAction["MEMBER_ADDED"] = "TEAM_VOICE_MEMBER_ADDED";
    TeamVoiceAuditAction["MEMBER_REMOVED"] = "TEAM_VOICE_MEMBER_REMOVED";
})(TeamVoiceAuditAction || (exports.TeamVoiceAuditAction = TeamVoiceAuditAction = {}));
class TeamVoiceAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.DISCORD,
            domainLabel: 'TeamVoice',
        });
    }
    static getInstance() {
        if (!TeamVoiceAuditLogger.instance) {
            TeamVoiceAuditLogger.instance = new TeamVoiceAuditLogger();
        }
        return TeamVoiceAuditLogger.instance;
    }
    buildMessage(entry) {
        return `TeamVoice ${entry.action}: team ${entry.teamName ?? entry.teamId}`;
    }
    buildResource(entry) {
        return `teamVoice/${entry.teamId}`;
    }
    logChannelsCreated(organizationId, teamId, teamName, guildId, performedById) {
        this.log({
            action: TeamVoiceAuditAction.CHANNELS_CREATED,
            organizationId,
            teamId,
            teamName,
            guildId,
            performedById,
            details: { guildId, teamName },
        });
    }
    logChannelsDeleted(organizationId, teamId, guildId) {
        this.log({
            action: TeamVoiceAuditAction.CHANNELS_DELETED,
            organizationId,
            teamId,
            guildId,
            details: { guildId },
        });
    }
    logMemberAdded(organizationId, teamId, userId, memberRole) {
        this.log({
            action: TeamVoiceAuditAction.MEMBER_ADDED,
            organizationId,
            teamId,
            details: { userId, memberRole },
        });
    }
    logMemberRemoved(organizationId, teamId, userId) {
        this.log({
            action: TeamVoiceAuditAction.MEMBER_REMOVED,
            organizationId,
            teamId,
            details: { userId },
        });
    }
}
exports.TeamVoiceAuditLogger = TeamVoiceAuditLogger;
exports.teamVoiceAuditLogger = TeamVoiceAuditLogger.getInstance();
//# sourceMappingURL=TeamVoiceAuditLogger.js.map