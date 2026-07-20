"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberProfileService = void 0;
const database_1 = require("../../config/database");
const GuildOrganization_1 = require("../../models/GuildOrganization");
const MemberEngagement_1 = require("../../models/MemberEngagement");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const RsiCitizenOrg_1 = require("../../models/RsiCitizenOrg");
const RsiMemberCache_1 = require("../../models/RsiMemberCache");
const RsiSyncSchedule_1 = require("../../models/RsiSyncSchedule");
const RsiUserLink_1 = require("../../models/RsiUserLink");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const ModerationIncidentService_1 = require("../discord/ModerationIncidentService");
const RsiCrawlerService_1 = require("../external/RsiCrawlerService");
const RsiRoleMappingService_1 = require("../external/RsiRoleMappingService");
const VisibilityService_1 = require("../shared/VisibilityService");
const MemberAuditService_1 = require("./MemberAuditService");
const OrgWatchlistService_1 = require("./OrgWatchlistService");
const discordPresenceCache = new Map();
const DISCORD_PRESENCE_CACHE_TTL = 60_000;
class MemberProfileService {
    rsiLinkRepo;
    rsiCacheRepo;
    citizenOrgRepo;
    membershipRepo;
    guildOrgRepo;
    userRepo;
    auditService;
    watchlistService;
    visibilityService;
    roleMappingService;
    constructor() {
        this.rsiLinkRepo = database_1.AppDataSource.getRepository(RsiUserLink_1.RsiUserLink);
        this.rsiCacheRepo = database_1.AppDataSource.getRepository(RsiMemberCache_1.RsiMemberCache);
        this.citizenOrgRepo = database_1.AppDataSource.getRepository(RsiCitizenOrg_1.RsiCitizenOrg);
        this.membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.guildOrgRepo = database_1.AppDataSource.getRepository(GuildOrganization_1.GuildOrganization);
        this.userRepo = database_1.AppDataSource.getRepository(User_1.User);
        this.auditService = new MemberAuditService_1.MemberAuditService();
        this.watchlistService = new OrgWatchlistService_1.OrgWatchlistService();
        this.visibilityService = new VisibilityService_1.VisibilityService();
        this.roleMappingService = new RsiRoleMappingService_1.RsiRoleMappingService();
    }
    async getProfile(organizationId, targetUserId, viewerId, isPlatformAdmin = false) {
        let rsiLink = null;
        let otherRsiOrgs = [];
        let isFoundInOrgCrawl = false;
        try {
            rsiLink = await this.rsiLinkRepo.findOne({
                where: { userId: targetUserId, organizationId },
            });
            if (rsiLink && (!rsiLink.lastKnownRank || !rsiLink.discordUserId)) {
                try {
                    const { RsiCrawledMember } = await Promise.resolve().then(() => __importStar(require('../../models/RsiCrawledMember')));
                    const scheduleRepo = database_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule);
                    const schedule = await scheduleRepo.findOne({
                        where: { organizationId },
                        select: ['rsiOrgSid'],
                    });
                    if (schedule?.rsiOrgSid) {
                        const crawledRepo = database_1.AppDataSource.getRepository(RsiCrawledMember);
                        const crawled = await crawledRepo.findOne({
                            where: { organizationSid: schedule.rsiOrgSid, handle: rsiLink.rsiHandle },
                        });
                        if (crawled) {
                            isFoundInOrgCrawl = true;
                            let updated = false;
                            if (!rsiLink.lastKnownRank && crawled.rank) {
                                rsiLink.lastKnownRank = crawled.rank;
                                updated = true;
                            }
                            if (rsiLink.isAffiliate !== crawled.isAffiliate) {
                                rsiLink.isAffiliate = crawled.isAffiliate;
                                updated = true;
                            }
                            if (!rsiLink.lastSyncedAt) {
                                rsiLink.lastSyncedAt = new Date();
                                updated = true;
                            }
                            if (!rsiLink.discordUserId) {
                                const user = await this.userRepo.findOne({
                                    where: { id: targetUserId },
                                    select: ['id', 'discordId'],
                                });
                                if (user?.discordId) {
                                    rsiLink.discordUserId = user.discordId;
                                    updated = true;
                                }
                            }
                            if (updated) {
                                await this.rsiLinkRepo.save(rsiLink);
                            }
                        }
                    }
                }
                catch {
                }
            }
            else if (rsiLink?.lastKnownRank) {
                isFoundInOrgCrawl = true;
            }
            otherRsiOrgs = await this.fetchOtherRsiOrgs(rsiLink);
        }
        catch (err) {
            logger_1.logger.error('MemberProfileService: RSI link/orgs fetch failed', {
                error: err instanceof Error ? err.message : String(err),
                organizationId,
                targetUserId,
            });
        }
        const emptyFlags = {
            data: [],
            pagination: { total: 0, count: 0, page: 1, pageSize: 50, hasMore: false, totalPages: 0 },
        };
        const emptyFlagStats = {
            userId: targetUserId,
            organizationId,
            totalFlags: 0,
            openFlags: 0,
            resolvedFlags: 0,
            dismissedFlags: 0,
            escalatedFlags: 0,
            highestSeverity: null,
            lastFlagAt: null,
        };
        const [memberships, flagsResult, flagStats, watchlistHits, moderation, discord, targetUser] = await Promise.all([
            this.safeFetch('platformMemberships', () => this.fetchPlatformMemberships(targetUserId), []),
            this.safeFetch('listFlags', () => this.auditService.listFlags(organizationId, {
                userId: targetUserId,
                statuses: ['open'],
                pageSize: 50,
            }), emptyFlags),
            this.safeFetch('getUserFlagStats', () => this.auditService.getUserFlagStats(organizationId, targetUserId), emptyFlagStats),
            this.safeFetch('watchlistCrossRef', () => this.crossReferenceWatchlist(organizationId, rsiLink, otherRsiOrgs), []),
            this.fetchModerationSummary(organizationId, rsiLink),
            this.fetchDiscordPresence(organizationId, targetUserId),
            this.safeFetch('targetUser', () => this.userRepo.findOne({ where: { id: targetUserId }, select: ['id', 'activeOrgId'] }), null),
        ]);
        let viewerMembershipIds = [];
        if (viewerId) {
            try {
                viewerMembershipIds = (await this.fetchPlatformMemberships(viewerId)).map(m => m.organizationId);
            }
            catch (err) {
                logger_1.logger.error('MemberProfileService: viewer memberships fetch failed', {
                    error: err instanceof Error ? err.message : String(err),
                    viewerId,
                });
            }
        }
        const filteredRsiOrgs = this.applyVisibilityRules(otherRsiOrgs, viewerId ?? targetUserId, viewerMembershipIds, isPlatformAdmin);
        let rsi = this.buildRsiPresence(rsiLink, filteredRsiOrgs, isFoundInOrgCrawl);
        if (!rsi) {
            const userWithRsi = await this.userRepo.findOne({
                where: { id: targetUserId },
                select: ['id', 'rsiHandle'],
            });
            if (userWithRsi?.rsiHandle) {
                rsi = {
                    rsiHandle: userWithRsi.rsiHandle,
                    verificationStatus: 'pending',
                    lastSyncedAt: null,
                    rank: null,
                    isAffiliate: false,
                    isPrimaryOrg: false,
                    isFoundInOrg: false,
                    isHidden: false,
                    otherRsiOrgs: filteredRsiOrgs,
                };
            }
        }
        const enrichedMemberships = memberships.map(m => ({
            ...m,
            isPrimary: targetUser?.activeOrgId === m.organizationId,
        }));
        let roleAlignment = null;
        try {
            roleAlignment = await this.buildRoleAlignment(organizationId, rsiLink, discord, enrichedMemberships);
        }
        catch (err) {
            logger_1.logger.error('MemberProfileService: role alignment build failed', {
                error: err instanceof Error ? err.message : String(err),
                organizationId,
                targetUserId,
            });
        }
        const profileUser = await this.userRepo.findOne({
            where: { id: targetUserId },
            select: ['id', 'username', 'displayName'],
        });
        return {
            userId: targetUserId,
            organizationId,
            username: profileUser?.displayName ?? profileUser?.username ?? undefined,
            rsi,
            discord,
            platformMemberships: enrichedMemberships,
            watchlistHits,
            activeFlags: flagsResult.data,
            flagStats,
            moderation,
            roleAlignment,
            generatedAt: new Date().toISOString(),
        };
    }
    async safeFetch(source, fn, fallback) {
        try {
            return await fn();
        }
        catch (err) {
            logger_1.logger.error(`MemberProfileService: ${source} fetch failed`, {
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
            });
            return fallback;
        }
    }
    async fetchOtherRsiOrgs(link) {
        if (!link?.rsiHandle) {
            return [];
        }
        const cached = await this.rsiCacheRepo.find({
            where: { rsiHandle: link.rsiHandle },
        });
        if (cached.length > 0) {
            return cached.map(c => ({
                rsiOrgSid: c.rsiOrgSid,
                rsiOrgName: c.displayName ?? undefined,
                rank: c.rsiRank,
                isAffiliate: c.isAffiliate,
                isPrimary: !c.isAffiliate,
                isHidden: false,
            }));
        }
        try {
            const citizenOrgs = await this.citizenOrgRepo.find({
                where: { citizenHandle: link.rsiHandle },
            });
            if (citizenOrgs.length > 0) {
                return citizenOrgs.map(co => ({
                    rsiOrgSid: co.organizationSid,
                    rsiOrgName: co.organizationName,
                    rank: co.rank ?? 'Member',
                    isAffiliate: co.isAffiliate,
                    isPrimary: co.isMain,
                    isHidden: false,
                }));
            }
        }
        catch {
        }
        try {
            const memberships = await RsiCrawlerService_1.rsiCrawlerService.crawlUserMemberships(link.rsiHandle);
            return memberships.map(m => ({
                rsiOrgSid: m.sid,
                rsiOrgName: m.name,
                rank: m.rank ?? 'Member',
                isAffiliate: !m.isMain,
                isPrimary: m.isMain ?? false,
                isHidden: false,
            }));
        }
        catch {
            return [];
        }
    }
    async fetchPlatformMemberships(userId) {
        const memberships = await this.membershipRepo.find({
            where: { userId },
            relations: ['organization'],
        });
        return memberships.map(m => ({
            organizationId: m.organizationId,
            organizationName: m.organization?.name,
            role: (0, roleUtils_1.getRoleName)(m.role),
            title: m.title ?? null,
            isActive: m.isActive,
            joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
        }));
    }
    async crossReferenceWatchlist(organizationId, link, _otherOrgs) {
        if (!link?.rsiHandle) {
            return [];
        }
        return this.watchlistService.crossReference(organizationId, [link.rsiHandle]);
    }
    async fetchModerationSummary(organizationId, link) {
        const discordId = link?.discordUserId;
        if (!discordId) {
            return null;
        }
        try {
            const service = ModerationIncidentService_1.ModerationIncidentService.getInstance();
            const summary = await service.lookupUser(organizationId, discordId);
            return {
                totalIncidents: summary.totalIncidents,
                activeIncidents: summary.activeIncidents,
                highestSeverity: summary.totalIncidents > 0 ? String(summary.highestSeverity) : null,
                sharedIncidents: summary.sharedIncidents,
                lastIncidentAt: summary.lastIncident ? summary.lastIncident.toISOString() : null,
            };
        }
        catch {
            return null;
        }
    }
    async fetchDiscordPresence(organizationId, userId) {
        const cacheKey = `${organizationId}:${userId}`;
        const cached = discordPresenceCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        try {
            const user = await this.userRepo.findOne({
                where: { id: userId },
                select: ['id', 'discordId', 'username'],
            });
            if (!user?.discordId) {
                return null;
            }
            let guildId = null;
            const guildMapping = await this.guildOrgRepo.findOne({
                where: { organizationId, isActive: true, isPrimary: true },
            });
            guildId = guildMapping?.guildId ?? null;
            if (!guildId) {
                const schedule = await database_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule).findOne({
                    where: { organizationId },
                    select: ['guildId'],
                });
                guildId = schedule?.guildId ?? null;
            }
            if (!guildId) {
                const minimal = {
                    discordId: user.discordId,
                    displayName: user.username ?? null,
                    roleIds: [],
                    roleNames: [],
                    status: null,
                    joinedAt: null,
                };
                discordPresenceCache.set(cacheKey, {
                    data: minimal,
                    expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
                });
                return minimal;
            }
            try {
                const { BotClientManager } = await Promise.resolve().then(() => __importStar(require('../../bot/BotClientManager')));
                const botManager = BotClientManager.getInstance();
                if (botManager.isReady()) {
                    const client = botManager.getClient();
                    const guild = client.guilds.cache.get(guildId);
                    if (guild) {
                        const member = await guild.members.fetch(user.discordId).catch(() => null);
                        if (member) {
                            const presence = {
                                discordId: user.discordId,
                                displayName: member.displayName ?? member.user.username,
                                guildId: guild.id,
                                guildName: guild.name,
                                roleIds: member.roles.cache
                                    .filter(r => r.id !== guild.id)
                                    .map(r => r.id),
                                roleNames: member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name),
                                status: member.presence?.status === 'invisible'
                                    ? 'offline'
                                    : (member.presence?.status ?? null),
                                joinedAt: member.joinedAt?.toISOString() ?? null,
                                isInGuild: true,
                            };
                            discordPresenceCache.set(cacheKey, {
                                data: presence,
                                expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
                            });
                            return presence;
                        }
                    }
                }
            }
            catch {
            }
            const ipcResult = await this.fetchDiscordPresenceViaIPC(user.discordId, user.username ?? null, guildId, guildMapping?.guildName ?? null);
            if (ipcResult) {
                discordPresenceCache.set(cacheKey, {
                    data: ipcResult,
                    expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
                });
                return ipcResult;
            }
            let inferredInGuild;
            if (guildId) {
                const hasEngagement = await database_1.AppDataSource.getRepository(MemberEngagement_1.MemberEngagement)
                    .createQueryBuilder('me')
                    .where('me.guildId = :guildId AND me.userId = :userId', {
                    guildId,
                    userId: user.discordId,
                })
                    .limit(1)
                    .getExists();
                if (hasEngagement) {
                    inferredInGuild = true;
                }
            }
            const fallback = {
                discordId: user.discordId,
                displayName: user.username ?? null,
                guildId: guildId ?? undefined,
                guildName: guildMapping?.guildName ?? undefined,
                roleIds: [],
                roleNames: [],
                status: null,
                joinedAt: null,
                isInGuild: inferredInGuild,
            };
            discordPresenceCache.set(cacheKey, {
                data: fallback,
                expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
            });
            return fallback;
        }
        catch {
            discordPresenceCache.set(cacheKey, {
                data: null,
                expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
            });
            return null;
        }
    }
    async fetchDiscordPresenceViaIPC(discordId, username, guildId, guildName) {
        try {
            const { BotIPCService } = await Promise.resolve().then(() => __importStar(require('../../bot/BotIPCService')));
            const ipcService = BotIPCService.getInstance();
            if (!ipcService.isAvailable()) {
                return null;
            }
            const ipcResponse = await ipcService.request('guild:fetchMember', {
                guildId,
                discordUserId: discordId,
            }, {
                timeoutMs: 3_500,
                requireDefinitiveResponse: true,
                definitiveWaitMs: 500,
                routing: {
                    scope: 'guild',
                    guildId,
                },
            });
            if (!ipcResponse?.success || !ipcResponse.data) {
                return null;
            }
            const d = ipcResponse.data;
            const isDefinitive = ipcResponse.definitive ?? ipcResponse.status !== 'not_handled';
            if (d.found) {
                return {
                    discordId,
                    displayName: d.displayName ?? username ?? null,
                    guildId: d.guildId ?? guildId ?? undefined,
                    guildName: d.guildName ?? guildName ?? undefined,
                    roleIds: d.roleIds ?? [],
                    roleNames: d.roleNames ?? [],
                    status: d.status ?? null,
                    joinedAt: d.joinedAt ?? null,
                    isInGuild: true,
                };
            }
            return {
                discordId,
                displayName: username ?? null,
                guildId: guildId ?? undefined,
                guildName: d.guildName ?? guildName ?? undefined,
                roleIds: [],
                roleNames: [],
                status: null,
                joinedAt: null,
                isInGuild: isDefinitive ? false : undefined,
            };
        }
        catch {
            return null;
        }
    }
    applyVisibilityRules(orgs, viewerId, viewerMembershipIds, isPlatformAdmin) {
        const entitiesWithVisibility = orgs.map(org => ({
            id: org.rsiOrgSid,
            isPublic: true,
            ...org,
        }));
        const filtered = this.visibilityService.redactForViewer(entitiesWithVisibility, viewerId, viewerMembershipIds, isPlatformAdmin, 'organization');
        return filtered.map(item => {
            if ('isRedacted' in item && item.isRedacted) {
                return {
                    rsiOrgSid: item.id,
                    rsiOrgName: 'Redacted Organization',
                    rank: '—',
                    isAffiliate: false,
                    isPrimary: false,
                    isHidden: true,
                };
            }
            const org = item;
            return {
                rsiOrgSid: org.rsiOrgSid,
                rsiOrgName: org.rsiOrgName,
                rank: org.rank,
                isAffiliate: org.isAffiliate,
                isPrimary: org.isPrimary,
                isHidden: org.isHidden,
            };
        });
    }
    buildRsiPresence(link, otherOrgs, isFoundInOrg) {
        if (!link) {
            return null;
        }
        const isPrimaryOrg = isFoundInOrg ? !link.isAffiliate : false;
        const verificationStatus = link.verifiedAt && link.syncStatus !== RsiUserLink_1.SyncStatus.REMOVED
            ? 'verified'
            : this.mapSyncStatus(link.syncStatus);
        return {
            rsiHandle: link.rsiHandle,
            verificationStatus,
            lastSyncedAt: link.lastSyncedAt ? link.lastSyncedAt.toISOString() : null,
            rank: link.lastKnownRank ?? null,
            isAffiliate: link.isAffiliate,
            isPrimaryOrg,
            isFoundInOrg,
            isHidden: false,
            otherRsiOrgs: otherOrgs,
        };
    }
    mapSyncStatus(syncStatus) {
        switch (syncStatus.toLowerCase()) {
            case 'synced':
                return 'verified';
            case 'failed':
            case 'needs_review':
                return 'failed';
            case 'removed':
                return 'removed';
            default:
                return 'pending';
        }
    }
    async buildRoleAlignment(organizationId, rsiLink, discord, memberships) {
        const rsiRank = rsiLink?.lastKnownRank ?? null;
        if (!rsiRank) {
            return null;
        }
        const mapping = await this.roleMappingService.getMappingByRank(organizationId, rsiRank);
        if (!mapping) {
            return null;
        }
        const actualDiscordRoles = discord?.roleNames ?? [];
        const actualDiscordRoleIds = discord?.roleIds ?? [];
        const currentMembership = memberships.find(m => m.organizationId === organizationId);
        const actualWebRole = currentMembership?.role ?? 'unknown';
        let mappedDiscordRole = null;
        if (mapping.discordRoleId) {
            const roleIndex = actualDiscordRoleIds.indexOf(mapping.discordRoleId);
            if (roleIndex >= 0 && roleIndex < actualDiscordRoles.length) {
                mappedDiscordRole = actualDiscordRoles[roleIndex];
            }
            else {
                mappedDiscordRole = mapping.discordRoleId;
            }
        }
        let mappedWebRole = null;
        if (mapping.internalRoleId && mapping.internalRole) {
            mappedWebRole = mapping.internalRole.name;
        }
        const mismatches = [];
        const hasExpectedDiscordRole = mapping.discordRoleId
            ? actualDiscordRoleIds.includes(mapping.discordRoleId)
            : true;
        if (mapping.discordRoleId && !hasExpectedDiscordRole) {
            const expectedLabel = mappedDiscordRole === mapping.discordRoleId
                ? mapping.discordRoleId
                : `"${mappedDiscordRole}"`;
            if (actualDiscordRoles.length > 0) {
                mismatches.push(`Discord role mismatch: expected ${expectedLabel} but user has [${actualDiscordRoles.join(', ')}]`);
            }
            else {
                mismatches.push(`Discord role mismatch: expected ${expectedLabel} but user has no Discord roles`);
            }
        }
        if (mappedWebRole && actualWebRole.toLowerCase() !== mappedWebRole.toLowerCase()) {
            mismatches.push(`Web role mismatch: expected "${mappedWebRole}" but user has "${actualWebRole}"`);
        }
        return {
            rsiRank,
            mappedDiscordRole,
            actualDiscordRoles,
            mappedWebRole,
            actualWebRole,
            isAligned: mismatches.length === 0,
            mismatches,
        };
    }
}
exports.MemberProfileService = MemberProfileService;
//# sourceMappingURL=MemberProfileService.js.map