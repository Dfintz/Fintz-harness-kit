"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatRoleService = void 0;
const database_1 = require("../../config/database");
const MemberEngagement_1 = require("../../models/MemberEngagement");
const MemberEngagementService_1 = require("./MemberEngagementService");
class StatRoleService {
    static instance;
    repo;
    engagementService;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(MemberEngagement_1.StatRole);
        this.engagementService = MemberEngagementService_1.MemberEngagementService.getInstance();
    }
    static getInstance() {
        if (!StatRoleService.instance) {
            StatRoleService.instance = new StatRoleService();
        }
        return StatRoleService.instance;
    }
    async createStatRole(input) {
        const existing = await this.repo.findOne({
            where: { guildId: input.guildId, roleId: input.roleId },
        });
        if (existing) {
            throw new Error('A stat role for this Discord role already exists');
        }
        const statRole = this.repo.create({
            guildId: input.guildId,
            roleId: input.roleId,
            roleName: input.roleName,
            minMessages: input.minMessages ?? 0,
            minVoiceMinutes: input.minVoiceMinutes ?? 0,
            windowDays: input.windowDays ?? 30,
            autoRemove: input.autoRemove ?? true,
            enabled: true,
        });
        return this.repo.save(statRole);
    }
    async deleteStatRole(guildId, roleId) {
        const result = await this.repo.delete({ guildId, roleId });
        return (result.affected ?? 0) > 0;
    }
    async getStatRolesForGuild(guildId) {
        return this.repo.find({ where: { guildId, enabled: true } });
    }
    async evaluateGuild(guildId) {
        const statRoles = await this.getStatRolesForGuild(guildId);
        if (statRoles.length === 0) {
            return [];
        }
        const windowCaches = await this.buildWindowCaches(guildId, statRoles);
        return statRoles.map(sr => this.evaluateStatRole(sr, windowCaches));
    }
    async buildWindowCaches(guildId, statRoles) {
        const maxWindow = Math.max(...statRoles.map(sr => sr.windowDays));
        const maxAggregates = await this.engagementService.getGuildAggregates(guildId, maxWindow);
        const caches = new Map();
        for (const sr of statRoles) {
            if (caches.has(sr.windowDays)) {
                continue;
            }
            const agg = sr.windowDays === maxWindow
                ? maxAggregates
                : await this.engagementService.getGuildAggregates(guildId, sr.windowDays);
            const map = new Map();
            for (const a of agg) {
                map.set(a.userId, { messageCount: a.messageCount, voiceMinutes: a.voiceMinutes });
            }
            caches.set(sr.windowDays, map);
        }
        return caches;
    }
    evaluateStatRole(sr, windowCaches) {
        const userMap = windowCaches.get(sr.windowDays);
        if (!userMap) {
            return { roleId: sr.roleId, addUserIds: [], removeUserIds: [] };
        }
        const qualifiedUserIds = new Set();
        for (const [userId, stats] of userMap) {
            const meetsMessages = sr.minMessages === 0 || stats.messageCount >= sr.minMessages;
            const meetsVoice = sr.minVoiceMinutes === 0 || stats.voiceMinutes >= sr.minVoiceMinutes;
            if (meetsMessages && meetsVoice) {
                qualifiedUserIds.add(userId);
            }
        }
        const addUserIds = Array.from(qualifiedUserIds);
        const removeUserIds = sr.autoRemove
            ? Array.from(userMap.keys()).filter(uid => !qualifiedUserIds.has(uid))
            : [];
        return { roleId: sr.roleId, addUserIds, removeUserIds };
    }
}
exports.StatRoleService = StatRoleService;
//# sourceMappingURL=StatRoleService.js.map