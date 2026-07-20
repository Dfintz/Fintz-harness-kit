"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteTrackingService = void 0;
const database_1 = require("../../config/database");
const MemberEngagement_1 = require("../../models/MemberEngagement");
const logger_1 = require("../../utils/logger");
class InviteTrackingService {
    static instance;
    repo;
    inviteCache = new Map();
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(MemberEngagement_1.InviteTracking);
    }
    static getInstance() {
        if (!InviteTrackingService.instance) {
            InviteTrackingService.instance = new InviteTrackingService();
        }
        return InviteTrackingService.instance;
    }
    async cacheGuildInvites(guild) {
        try {
            const invites = await guild.invites.fetch();
            const inviteMap = new Map();
            invites.forEach(invite => {
                if (invite.code) {
                    inviteMap.set(invite.code, invite.uses ?? 0);
                }
            });
            this.inviteCache.set(guild.id, inviteMap);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to cache invites for guild ${guild.id}:`, error);
        }
    }
    async handleMemberJoin(member) {
        const guildId = member.guild.id;
        const oldInvites = this.inviteCache.get(guildId);
        try {
            const newInvites = await member.guild.invites.fetch();
            const newMap = new Map();
            let usedCode;
            let inviterUserId;
            newInvites.forEach(invite => {
                if (!invite.code) {
                    return;
                }
                newMap.set(invite.code, invite.uses ?? 0);
                const oldUses = oldInvites?.get(invite.code) ?? 0;
                const newUses = invite.uses ?? 0;
                if (newUses > oldUses) {
                    usedCode = invite.code;
                    inviterUserId = invite.inviter?.id;
                }
            });
            this.inviteCache.set(guildId, newMap);
            const tracking = this.repo.create({
                guildId,
                invitedUserId: member.id,
                inviterUserId,
                inviteCode: usedCode,
                joinedAt: new Date(),
            });
            await this.repo.save(tracking);
            if (usedCode) {
                logger_1.logger.info(`📨 ${member.user.username} joined ${member.guild.name} via invite ${usedCode} (by ${inviterUserId ?? 'unknown'})`);
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to track invite for ${member.user.username}:`, error);
        }
    }
    async getInviterStats(guildId, inviterUserId) {
        const count = await this.repo.count({
            where: { guildId, inviterUserId },
        });
        return { totalInvites: count };
    }
    async getInviterOf(guildId, invitedUserId) {
        return this.repo.findOne({
            where: { guildId, invitedUserId },
        });
    }
    async getTopInviters(guildId, limit = 10) {
        const results = await this.repo
            .createQueryBuilder('it')
            .select('it.inviterUserId', 'inviterUserId')
            .addSelect('COUNT(*)', 'count')
            .where('it.guildId = :guildId AND it.inviterUserId IS NOT NULL', { guildId })
            .groupBy('it.inviterUserId')
            .orderBy('count', 'DESC')
            .limit(limit)
            .getRawMany();
        return results.map((r) => ({
            inviterUserId: r.inviterUserId,
            count: Number.parseInt(r.count, 10),
        }));
    }
}
exports.InviteTrackingService = InviteTrackingService;
//# sourceMappingURL=InviteTrackingService.js.map