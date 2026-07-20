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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiMemberIntelService = exports.RsiMemberIntelService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const GuildOrganization_1 = require("../../models/GuildOrganization");
const MemberAuditEvent_1 = require("../../models/MemberAuditEvent");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const RsiCitizenOrg_1 = require("../../models/RsiCitizenOrg");
const RsiCrawledMember_1 = require("../../models/RsiCrawledMember");
const RsiMemberCache_1 = require("../../models/RsiMemberCache");
const RsiRoleMapping_1 = require("../../models/RsiRoleMapping");
const RsiSyncSchedule_1 = require("../../models/RsiSyncSchedule");
const RsiUserLink_1 = require("../../models/RsiUserLink");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const DiscordService_1 = require("../discord/DiscordService");
const MemberAuditService_1 = require("../intel/MemberAuditService");
const RsiCrawlerService_1 = require("./RsiCrawlerService");
function generateHandleUuid(handle) {
    const hash = crypto_1.default.createHash('sha256').update(`unlinked:${handle.toLowerCase()}`).digest('hex');
    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        `4${hash.slice(13, 16)}`,
        ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
        hash.slice(20, 32),
    ].join('-');
}
class RsiMemberIntelService {
    crawledMemberRepo;
    citizenOrgRepo;
    userLinkRepo;
    membershipRepo;
    roleMappingRepo;
    flagRepo;
    scheduleRepo;
    userRepo;
    memberCacheRepo;
    constructor() {
        this.crawledMemberRepo = database_1.AppDataSource.getRepository(RsiCrawledMember_1.RsiCrawledMember);
        this.citizenOrgRepo = database_1.AppDataSource.getRepository(RsiCitizenOrg_1.RsiCitizenOrg);
        this.userLinkRepo = database_1.AppDataSource.getRepository(RsiUserLink_1.RsiUserLink);
        this.membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.roleMappingRepo = database_1.AppDataSource.getRepository(RsiRoleMapping_1.RsiRoleMapping);
        this.flagRepo = database_1.AppDataSource.getRepository(MemberAuditEvent_1.MemberAuditEvent);
        this.scheduleRepo = database_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule);
        this.userRepo = database_1.AppDataSource.getRepository(User_1.User);
        this.memberCacheRepo = database_1.AppDataSource.getRepository(RsiMemberCache_1.RsiMemberCache);
    }
    static LIST_STATUS = {
        OK: 'ok',
        NO_SCHEDULE: 'no_schedule',
        NO_MEMBERS: 'no_members',
    };
    async getMemberList(organizationId, rsiOrgSid) {
        const orgSid = rsiOrgSid ?? (await this.resolveOrgSid(organizationId));
        if (!orgSid) {
            return { members: [], status: RsiMemberIntelService.LIST_STATUS.NO_SCHEDULE };
        }
        const [crawledMembers, links, activeFlagCounts] = await Promise.all([
            this.crawledMemberRepo.find({
                where: { organizationSid: orgSid },
                order: { rank: 'ASC', handle: 'ASC' },
            }),
            this.userLinkRepo.find({
                where: { organizationId },
            }),
            this.getActiveFlagCountsByUser(organizationId),
        ]);
        const linkedHandles = new Set(links.map(l => l.rsiHandle.toLowerCase()));
        const unlinkedHandles = crawledMembers
            .filter(m => !linkedHandles.has(m.handle.toLowerCase()))
            .map(m => m.handle);
        if (unlinkedHandles.length > 0) {
            const loweredHandles = unlinkedHandles.map(h => h.toLowerCase());
            const matchableUsers = await this.userRepo
                .createQueryBuilder('u')
                .innerJoin('organization_memberships', 'om', 'om."userId" = u.id AND om."organizationId" = :orgId AND om."isActive" = true', { orgId: organizationId })
                .where('LOWER(u."rsiHandle") IN (:...lowered) OR LOWER(u.username) IN (:...lowered)', {
                lowered: loweredHandles,
            })
                .select(['u.id', 'u."rsiHandle"', 'u."discordId"', 'u.username'])
                .getRawMany();
            const alreadyLinkedUserIds = new Set();
            for (const user of matchableUsers) {
                const userId = user.u_id;
                if (alreadyLinkedUserIds.has(userId)) {
                    continue;
                }
                const rsiHandleField = user.u_rsiHandle;
                const usernameField = user.u_username;
                let matchedHandle;
                let isHighConfidence = false;
                if (rsiHandleField && loweredHandles.includes(rsiHandleField.toLowerCase())) {
                    matchedHandle = rsiHandleField;
                    isHighConfidence = true;
                }
                else if (usernameField) {
                    matchedHandle = unlinkedHandles.find(h => h.toLowerCase() === usernameField.toLowerCase());
                    isHighConfidence = false;
                }
                if (!matchedHandle) {
                    continue;
                }
                if (linkedHandles.has(matchedHandle.toLowerCase())) {
                    continue;
                }
                const crawled = crawledMembers.find(m => m.handle.toLowerCase() === matchedHandle.toLowerCase());
                const newLink = this.userLinkRepo.create({
                    organizationId,
                    rsiHandle: matchedHandle,
                    userId,
                    discordUserId: user.u_discordId ?? undefined,
                    syncStatus: isHighConfidence ? RsiUserLink_1.SyncStatus.SYNCED : RsiUserLink_1.SyncStatus.NEEDS_REVIEW,
                    verificationMethod: isHighConfidence
                        ? RsiUserLink_1.VerificationMethod.DISCORD_MATCH
                        : RsiUserLink_1.VerificationMethod.MANUAL,
                    verifiedAt: isHighConfidence ? new Date() : undefined,
                    lastSyncedAt: new Date(),
                    lastKnownRank: crawled?.rank ?? undefined,
                    isAffiliate: crawled?.isAffiliate ?? false,
                });
                if (!isHighConfidence) {
                    newLink.markNeedsReview(`Username match: "${usernameField}" ~ "${matchedHandle}"`);
                }
                await this.userLinkRepo.save(newLink);
                links.push(newLink);
                linkedHandles.add(matchedHandle.toLowerCase());
                alreadyLinkedUserIds.add(userId);
                if (isHighConfidence) {
                    logger_1.logger.info(`Auto-linked RSI member ${matchedHandle} to platform user ${userId} (rsiHandle match)`, { organizationId });
                }
                else {
                    logger_1.logger.info(`Tentative link: RSI member ${matchedHandle} ↔ platform user ${userId} (username match, pending review)`, { organizationId });
                }
            }
        }
        const stillUnlinked = crawledMembers
            .filter(m => !linkedHandles.has(m.handle.toLowerCase()))
            .map(m => m.handle);
        const guildId = await this.resolveGuildId(organizationId);
        if (stillUnlinked.length > 0 && guildId) {
            await this.tryDiscordGuildNameMatch(organizationId, guildId, stillUnlinked, linkedHandles, crawledMembers, links);
            this.guildMemberNameMapCache.delete(guildId);
        }
        const linkByHandle = new Map(links.map(l => [l.rsiHandle.toLowerCase(), l]));
        const linksWithoutDiscord = links.filter(l => !l.discordUserId && l.userId);
        if (linksWithoutDiscord.length > 0) {
            const userIds = linksWithoutDiscord.map(l => l.userId);
            const usersWithDiscord = await this.userRepo.find({
                where: { id: (0, typeorm_1.In)(userIds) },
                select: ['id', 'discordId'],
            });
            const userDiscordMap = new Map(usersWithDiscord.filter(u => u.discordId).map(u => [u.id, u.discordId]));
            for (const link of linksWithoutDiscord) {
                const discordId = userDiscordMap.get(link.userId);
                if (discordId) {
                    link.discordUserId = discordId;
                    await this.userLinkRepo.save(link);
                    logger_1.logger.info(`Backfilled discordUserId on link for ${link.rsiHandle} (user ${link.userId})`, { organizationId });
                }
            }
        }
        const discordUserIds = links
            .map(l => l.discordUserId)
            .filter((id) => Boolean(id));
        const discordStatusMap = new Map();
        if (guildId && (0, DiscordService_1.isDiscordServiceInitialized)() && discordUserIds.length > 0) {
            const discordService = (0, DiscordService_1.getDiscordService)();
            for (const link of links) {
                if (link.discordUserId) {
                    try {
                        const roles = await discordService.getUserRoles(guildId, link.discordUserId);
                        discordStatusMap.set(link.rsiHandle.toLowerCase(), roles.length > 0);
                    }
                    catch {
                        discordStatusMap.set(link.rsiHandle.toLowerCase(), false);
                    }
                }
            }
        }
        const members = crawledMembers.map(m => {
            const handleLower = m.handle.toLowerCase();
            const link = linkByHandle.get(handleLower);
            const flagCount = link ? (activeFlagCounts.get(link.userId) ?? 0) : 0;
            return {
                rsiHandle: m.handle,
                displayName: m.displayName,
                rsiRank: m.rank,
                rsiStars: m.stars,
                isMainOrg: m.isMain,
                isAffiliate: m.isAffiliate,
                isHidden: m.isHidden,
                isRedacted: m.isRedacted ?? false,
                isLinked: !!link,
                isInDiscord: discordStatusMap.get(handleLower) ?? false,
                activeFlagCount: flagCount,
                hasMismatch: false,
            };
        });
        return {
            members,
            status: members.length > 0
                ? RsiMemberIntelService.LIST_STATUS.OK
                : RsiMemberIntelService.LIST_STATUS.NO_MEMBERS,
        };
    }
    async getMemberCard(organizationId, rsiHandle) {
        const orgSid = await this.resolveOrgSid(organizationId);
        if (!orgSid) {
            return null;
        }
        const [crawledMember, citizenOrgs, existingLink, roleMappings] = await Promise.all([
            this.crawledMemberRepo.findOne({
                where: { organizationSid: orgSid, handle: rsiHandle },
            }),
            this.citizenOrgRepo.find({
                where: { citizenHandle: rsiHandle },
                order: { isMain: 'DESC', organizationName: 'ASC' },
            }),
            this.userLinkRepo.findOne({
                where: { organizationId, rsiHandle },
            }),
            this.roleMappingRepo.find({
                where: { organizationId, isActive: true },
            }),
        ]);
        if (!crawledMember) {
            return null;
        }
        let link = existingLink;
        if (!link) {
            let matchedUser = await this.userRepo
                .createQueryBuilder('u')
                .where('LOWER(u.rsiHandle) = LOWER(:handle)', { handle: rsiHandle })
                .select(['u.id', 'u.discordId', 'u.rsiHandle', 'u.username'])
                .getOne();
            let isHighConfidence = !!matchedUser;
            if (!matchedUser) {
                matchedUser = await this.userRepo
                    .createQueryBuilder('u')
                    .where('LOWER(u.username) = LOWER(:handle)', { handle: rsiHandle })
                    .select(['u.id', 'u.discordId', 'u.rsiHandle', 'u.username'])
                    .getOne();
                isHighConfidence = false;
            }
            let discordMatchSource;
            if (!matchedUser) {
                const cardGuildId = await this.resolveGuildId(organizationId);
                if (cardGuildId) {
                    const nameMap = await this.fetchGuildMemberNameMap(cardGuildId);
                    const discordMatch = nameMap.get(rsiHandle.toLowerCase());
                    if (discordMatch) {
                        matchedUser = await this.userRepo
                            .createQueryBuilder('u')
                            .where('u."discordId" = :discordId', { discordId: discordMatch.discordUserId })
                            .select(['u.id', 'u.discordId', 'u.rsiHandle', 'u.username'])
                            .getOne();
                        isHighConfidence = false;
                        discordMatchSource = discordMatch.matchedVia;
                    }
                }
            }
            if (matchedUser) {
                const isMember = await this.membershipRepo.findOne({
                    where: { userId: matchedUser.id, organizationId, isActive: true },
                    select: ['id'],
                });
                if (isMember) {
                    const existingForUser = await this.userLinkRepo.findOne({
                        where: { userId: matchedUser.id, organizationId },
                    });
                    if (!existingForUser) {
                        link = this.userLinkRepo.create({
                            organizationId,
                            rsiHandle,
                            userId: matchedUser.id,
                            discordUserId: matchedUser.discordId ?? undefined,
                            syncStatus: isHighConfidence ? RsiUserLink_1.SyncStatus.SYNCED : RsiUserLink_1.SyncStatus.NEEDS_REVIEW,
                            verificationMethod: isHighConfidence
                                ? RsiUserLink_1.VerificationMethod.DISCORD_MATCH
                                : RsiUserLink_1.VerificationMethod.MANUAL,
                            verifiedAt: isHighConfidence ? new Date() : undefined,
                            lastSyncedAt: new Date(),
                            lastKnownRank: crawledMember.rank ?? undefined,
                            isAffiliate: crawledMember.isAffiliate,
                        });
                        if (!isHighConfidence) {
                            const reviewReason = discordMatchSource
                                ? `Discord guild ${discordMatchSource} match: "${rsiHandle}" ↔ Discord user ${matchedUser.username ?? matchedUser.id}`
                                : `Username match: "${matchedUser.username}" ≈ "${rsiHandle}"`;
                            link.markNeedsReview(reviewReason);
                        }
                        await this.userLinkRepo.save(link);
                        if (isHighConfidence) {
                            logger_1.logger.info(`Auto-linked RSI member ${rsiHandle} to platform user ${matchedUser.id} (rsiHandle match)`, { organizationId });
                        }
                        else {
                            const matchType = discordMatchSource ? `Discord ${discordMatchSource}` : 'username';
                            logger_1.logger.info(`Tentative link: RSI member ${rsiHandle} ↔ platform user ${matchedUser.id} (${matchType} match, pending review)`, { organizationId });
                        }
                    }
                }
            }
        }
        let membership = null;
        let activeFlags = [];
        if (link) {
            [membership, activeFlags] = await Promise.all([
                this.membershipRepo.findOne({
                    where: { userId: link.userId, organizationId, isActive: true },
                    relations: ['role'],
                }),
                this.flagRepo.find({
                    where: {
                        organizationId,
                        userId: link.userId,
                        status: shared_types_1.FlagStatus.OPEN,
                    },
                    order: { createdAt: 'DESC' },
                }),
            ]);
        }
        let discordUserId = link?.discordUserId;
        if (!discordUserId && link?.userId) {
            const user = await this.userRepo.findOne({
                where: { id: link.userId },
                select: ['id', 'discordId'],
            });
            if (user?.discordId &&
                !user.discordId.startsWith('google:') &&
                !user.discordId.startsWith('twitch:')) {
                discordUserId = user.discordId;
            }
        }
        const discordStatus = await this.getDiscordStatus(organizationId, discordUserId, crawledMember.rank, roleMappings);
        const roleMappingStatus = this.validateMemberRoleMapping(crawledMember.rank, roleMappings, discordStatus, membership);
        return {
            rsiHandle: crawledMember.handle,
            displayName: crawledMember.displayName,
            rsiRank: crawledMember.rank,
            rsiStars: crawledMember.stars,
            rsiRoles: crawledMember.roles ?? [],
            isMainOrg: crawledMember.isMain,
            isAffiliate: crawledMember.isAffiliate,
            isHidden: crawledMember.isHidden,
            isRedacted: crawledMember.isRedacted ?? false,
            avatar: crawledMember.avatar,
            enlisted: crawledMember.enlisted,
            lastCrawledAt: crawledMember.lastCrawledAt,
            otherOrgs: citizenOrgs
                .filter(co => co.organizationSid !== orgSid)
                .map(co => ({
                sid: co.organizationSid,
                name: co.organizationName,
                rank: co.rank,
                stars: co.stars ?? undefined,
                isMain: co.isMain,
            })),
            webAppStatus: {
                isLinked: !!link,
                syncStatus: link?.syncStatus,
                userId: link?.userId,
                membershipRole: membership?.role?.name,
                isActiveMember: membership?.isActive ?? false,
            },
            discordStatus,
            activeFlags: activeFlags.map(f => ({
                id: f.id,
                flagType: f.flagType,
                severity: f.severity,
                description: f.description,
                createdAt: f.createdAt,
            })),
            roleMappingStatus,
        };
    }
    async enrichMember(organizationId, rsiHandle) {
        try {
            const crawler = new RsiCrawlerService_1.RsiCrawlerService();
            const memberships = await crawler.crawlUserMemberships(rsiHandle);
            for (const org of memberships) {
                await this.citizenOrgRepo.upsert({
                    citizenHandle: rsiHandle,
                    organizationSid: org.sid,
                    organizationName: org.name,
                    rank: org.rank,
                    stars: org.stars,
                    isMain: org.isMain,
                    isAffiliate: !org.isMain,
                    lastFetchedAt: new Date(),
                }, {
                    conflictPaths: ['citizenHandle', 'organizationSid'],
                });
            }
            logger_1.logger.info(`Enriched member ${rsiHandle}: found ${memberships.length} org affiliations`, {
                organizationId,
                rsiHandle,
                orgsFound: memberships.length,
            });
            return { rsiHandle, orgsFound: memberships.length, success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`Failed to enrich member ${rsiHandle}: ${message}`, {
                organizationId,
                rsiHandle,
            });
            return { rsiHandle, orgsFound: 0, success: false, error: message };
        }
    }
    async enrichOrganizationMembers(organizationId) {
        const orgSid = await this.resolveOrgSid(organizationId);
        if (!orgSid) {
            return { total: 0, enriched: 0, failed: 0, results: [] };
        }
        const members = await this.crawledMemberRepo.find({
            where: { organizationSid: orgSid, isHidden: false },
            select: ['handle'],
        });
        const results = [];
        let enriched = 0;
        let failed = 0;
        for (const member of members) {
            const result = await this.enrichMember(organizationId, member.handle);
            results.push(result);
            if (result.success) {
                enriched++;
            }
            else {
                failed++;
            }
        }
        logger_1.logger.info(`Batch enrichment complete for org ${organizationId}`, {
            total: members.length,
            enriched,
            failed,
        });
        return { total: members.length, enriched, failed, results };
    }
    async runMemberAudit(organizationId, guildId) {
        const orgSid = await this.resolveOrgSid(organizationId);
        const resolvedGuildId = guildId ?? (await this.resolveGuildId(organizationId));
        const auditService = new MemberAuditService_1.MemberAuditService();
        const result = {
            organizationId,
            totalChecked: 0,
            flagsCreated: 0,
            flagsSkipped: 0,
            errors: [],
            flagsByType: {},
        };
        if (!orgSid) {
            result.errors.push('No RSI org SID configured for this organization');
            return result;
        }
        const [crawledMembers, links, memberships, roleMappings, existingFlags] = await Promise.all([
            this.crawledMemberRepo.find({ where: { organizationSid: orgSid } }),
            this.userLinkRepo.find({ where: { organizationId } }),
            this.membershipRepo.find({
                where: { organizationId, isActive: true },
                relations: ['role'],
            }),
            this.roleMappingRepo.find({ where: { organizationId, isActive: true } }),
            this.flagRepo.find({
                where: { organizationId, status: shared_types_1.FlagStatus.OPEN },
            }),
        ]);
        const linkByHandle = new Map(links.map(l => [l.rsiHandle.toLowerCase(), l]));
        const memberByUserId = new Map(memberships.map(m => [m.userId, m]));
        const crawledByHandle = new Map(crawledMembers.map(m => [m.handle.toLowerCase(), m]));
        const mappingByRank = new Map(roleMappings.map(r => [r.rsiRank, r]));
        const existingFlagSet = new Set(existingFlags.map(f => `${f.userId}:${f.flagType}`));
        const auditLinksWithoutDiscord = links.filter(l => !l.discordUserId && l.userId);
        if (auditLinksWithoutDiscord.length > 0) {
            const userIds = auditLinksWithoutDiscord.map(l => l.userId);
            const usersWithDiscord = await this.userRepo.find({
                where: { id: (0, typeorm_1.In)(userIds) },
                select: ['id', 'discordId'],
            });
            const userDiscordMap = new Map(usersWithDiscord.filter(u => u.discordId).map(u => [u.id, u.discordId]));
            for (const link of auditLinksWithoutDiscord) {
                const discordId = userDiscordMap.get(link.userId);
                if (discordId) {
                    link.discordUserId = discordId;
                    await this.userLinkRepo.save(link);
                    logger_1.logger.info(`Audit backfilled discordUserId on link for ${link.rsiHandle} (user ${link.userId})`, { organizationId });
                }
            }
        }
        const maybeCreateFlag = async (userId, flagType, description, metadata) => {
            const key = `${userId}:${flagType}`;
            if (existingFlagSet.has(key)) {
                result.flagsSkipped++;
                return;
            }
            try {
                await auditService.createFlag({
                    userId,
                    organizationId,
                    flagType,
                    severity: shared_types_1.DEFAULT_FLAG_SEVERITY[flagType],
                    description,
                    metadata,
                    isAutoGenerated: true,
                });
                existingFlagSet.add(key);
                result.flagsCreated++;
                result.flagsByType[flagType] = (result.flagsByType[flagType] ?? 0) + 1;
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                result.errors.push(`Flag creation failed for ${userId}/${flagType}: ${msg}`);
            }
        };
        let discordService = null;
        if (resolvedGuildId && (0, DiscordService_1.isDiscordServiceInitialized)()) {
            discordService = (0, DiscordService_1.getDiscordService)();
        }
        for (const member of crawledMembers) {
            result.totalChecked++;
            const handleLower = member.handle.toLowerCase();
            const link = linkByHandle.get(handleLower);
            if (!link) {
                const syntheticId = generateHandleUuid(member.handle);
                await maybeCreateFlag(syntheticId, shared_types_1.MemberFlagType.MISSING_FROM_WEB_APP, `RSI member "${member.handle}" (rank: ${member.rank ?? 'unknown'}) is not linked in the web app`, { rsiHandle: member.handle, rsiRank: member.rank });
                continue;
            }
            if (member.isHidden || member.isRedacted) {
                await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.HIDDEN_RSI_MEMBER, `RSI member "${member.handle}" has a hidden/redacted profile`, { rsiHandle: member.handle, isHidden: member.isHidden, isRedacted: member.isRedacted });
            }
            if (member.isAffiliate && !member.isMain) {
                await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.AFFILIATE_NOT_PRIMARY, `"${member.handle}" is an affiliate member, not a primary member of this organization`, { rsiHandle: member.handle });
            }
            if (discordService && resolvedGuildId && link.discordUserId) {
                try {
                    const roles = await discordService.getUserRoles(resolvedGuildId, link.discordUserId);
                    if (roles.length === 0) {
                        await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.MISSING_FROM_DISCORD, `"${member.handle}" is linked but not found in the Discord guild`, { rsiHandle: member.handle, discordUserId: link.discordUserId });
                    }
                    else {
                        const mapping = member.rank ? mappingByRank.get(member.rank) : undefined;
                        if (mapping?.discordRoleId) {
                            const hasExpectedRole = roles.some(r => r.id === mapping.discordRoleId);
                            if (!hasExpectedRole) {
                                await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.ROLE_MISMATCH_DISCORD, `"${member.handle}" has RSI rank "${member.rank}" but does not have the mapped Discord role`, {
                                    rsiHandle: member.handle,
                                    rsiRank: member.rank,
                                    expectedDiscordRoleId: mapping.discordRoleId,
                                    actualRoles: roles.map(r => r.id),
                                });
                            }
                        }
                    }
                }
                catch {
                }
            }
            else if (!link.discordUserId && link.userId) {
                await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.MISSING_FROM_DISCORD, `"${member.handle}" has no Discord account linked`, { rsiHandle: member.handle });
            }
            const membership = memberByUserId.get(link.userId);
            if (membership && member.rank) {
                const mapping = mappingByRank.get(member.rank);
                if (mapping?.internalRoleId && membership.roleId !== mapping.internalRoleId) {
                    await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.ROLE_MISMATCH_INTERNAL, `"${member.handle}" has RSI rank "${member.rank}" but internal role does not match the mapping`, {
                        rsiHandle: member.handle,
                        rsiRank: member.rank,
                        expectedInternalRoleId: mapping.internalRoleId,
                        actualRoleId: membership.roleId,
                    });
                }
            }
        }
        for (const link of links) {
            if (String(link.syncStatus) === 'removed') {
                continue;
            }
            const handleLower = link.rsiHandle.toLowerCase();
            if (!crawledByHandle.has(handleLower)) {
                await maybeCreateFlag(link.userId, shared_types_1.MemberFlagType.MISSING_FROM_RSI, `Linked member "${link.rsiHandle}" was not found in the RSI org member listing`, { rsiHandle: link.rsiHandle, lastKnownRank: link.lastKnownRank });
            }
        }
        logger_1.logger.info(`Member audit complete for org ${organizationId}`, {
            totalChecked: result.totalChecked,
            flagsCreated: result.flagsCreated,
            flagsSkipped: result.flagsSkipped,
            errorCount: result.errors.length,
        });
        return result;
    }
    async validateRoleMappings(organizationId, guildId) {
        const orgSid = await this.resolveOrgSid(organizationId);
        const resolvedGuildId = guildId ?? (await this.resolveGuildId(organizationId));
        const result = {
            organizationId,
            totalMembers: 0,
            validatedMembers: 0,
            mismatches: [],
            unmappedRanks: [],
            summary: {
                correctDiscordRoles: 0,
                incorrectDiscordRoles: 0,
                correctInternalRoles: 0,
                incorrectInternalRoles: 0,
                noMappingDefined: 0,
                notInDiscord: 0,
            },
        };
        if (!orgSid) {
            return result;
        }
        const [crawledMembers, links, memberships, roleMappings] = await Promise.all([
            this.crawledMemberRepo.find({ where: { organizationSid: orgSid } }),
            this.userLinkRepo.find({ where: { organizationId } }),
            this.membershipRepo.find({
                where: { organizationId, isActive: true },
                relations: ['role'],
            }),
            this.roleMappingRepo.find({ where: { organizationId, isActive: true } }),
        ]);
        result.totalMembers = crawledMembers.length;
        const linkByHandle = new Map(links.map(l => [l.rsiHandle.toLowerCase(), l]));
        const memberByUserId = new Map(memberships.map(m => [m.userId, m]));
        const mappingByRank = new Map(roleMappings.map(r => [r.rsiRank, r]));
        let discordService = null;
        if (resolvedGuildId && (0, DiscordService_1.isDiscordServiceInitialized)()) {
            discordService = (0, DiscordService_1.getDiscordService)();
        }
        const unmappedRanks = new Set();
        for (const member of crawledMembers) {
            if (!member.rank) {
                continue;
            }
            const mapping = mappingByRank.get(member.rank);
            if (!mapping) {
                unmappedRanks.add(member.rank);
                result.summary.noMappingDefined++;
                continue;
            }
            const link = linkByHandle.get(member.handle.toLowerCase());
            if (!link) {
                continue;
            }
            result.validatedMembers++;
            const mismatch = {
                rsiHandle: member.handle,
                userId: link.userId,
                rsiRank: member.rank,
                expectedMapping: {
                    discordRoleId: mapping.discordRoleId,
                    internalRoleId: mapping.internalRoleId,
                },
                actual: { discordRoles: [], internalRoleId: undefined },
                issues: [],
            };
            if (mapping.discordRoleId && discordService && resolvedGuildId && link.discordUserId) {
                try {
                    const roles = await discordService.getUserRoles(resolvedGuildId, link.discordUserId);
                    mismatch.actual.discordRoles = roles.map(r => r.id);
                    const hasRole = roles.some(r => r.id === mapping.discordRoleId);
                    if (hasRole) {
                        result.summary.correctDiscordRoles++;
                    }
                    else {
                        result.summary.incorrectDiscordRoles++;
                        mismatch.issues.push(`Expected Discord role ${mapping.discordRoleId} but user has: [${roles.map(r => r.name).join(', ')}]`);
                    }
                }
                catch {
                    result.summary.notInDiscord++;
                    mismatch.issues.push('Could not fetch Discord roles');
                }
            }
            else if (mapping.discordRoleId && !link.discordUserId) {
                result.summary.notInDiscord++;
                mismatch.issues.push('No Discord account linked');
            }
            const membership = memberByUserId.get(link.userId);
            if (mapping.internalRoleId && membership) {
                mismatch.actual.internalRoleId = membership.roleId;
                if (membership.roleId === mapping.internalRoleId) {
                    result.summary.correctInternalRoles++;
                }
                else {
                    result.summary.incorrectInternalRoles++;
                    mismatch.issues.push(`Expected internal role ${mapping.internalRoleId} but user has ${membership.roleId}`);
                }
            }
            if (mismatch.issues.length > 0) {
                result.mismatches.push(mismatch);
            }
        }
        result.unmappedRanks = Array.from(unmappedRanks);
        return result;
    }
    async resolveOrgSid(organizationId) {
        const schedule = await this.scheduleRepo.findOne({
            where: { organizationId },
            select: ['rsiOrgSid'],
        });
        return schedule?.rsiOrgSid ?? null;
    }
    async resolveGuildId(organizationId) {
        const schedule = await this.scheduleRepo.findOne({
            where: { organizationId },
            select: ['guildId'],
        });
        if (schedule?.guildId) {
            return schedule.guildId;
        }
        const guildOrg = await database_1.AppDataSource.getRepository(GuildOrganization_1.GuildOrganization).findOne({
            where: { organizationId, isActive: true, isPrimary: true },
            select: ['guildId'],
        });
        return guildOrg?.guildId ?? null;
    }
    guildMemberNameMapCache = new Map();
    async fetchGuildMemberNameMap(guildId) {
        const cached = this.guildMemberNameMapCache.get(guildId);
        if (cached) {
            return cached;
        }
        const nameMap = new Map();
        try {
            const { BotClientManager } = await Promise.resolve().then(() => __importStar(require('../../bot/BotClientManager')));
            const botManager = BotClientManager.getInstance();
            if (!botManager.isReady()) {
                return nameMap;
            }
            const client = botManager.getClient();
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return nameMap;
            }
            const guildMembers = await guild.members.fetch();
            for (const [, member] of guildMembers) {
                const candidates = [];
                if (member.nickname) {
                    candidates.push({ name: member.nickname, via: 'nickname' });
                }
                if (member.user.globalName) {
                    candidates.push({ name: member.user.globalName, via: 'globalName' });
                }
                if (member.displayName) {
                    candidates.push({ name: member.displayName, via: 'displayName' });
                }
                if (member.user.username) {
                    candidates.push({ name: member.user.username, via: 'username' });
                }
                for (const { name, via } of candidates) {
                    const key = name.toLowerCase();
                    if (!nameMap.has(key)) {
                        nameMap.set(key, { discordUserId: member.user.id, matchedVia: via });
                    }
                }
            }
            this.guildMemberNameMapCache.set(guildId, nameMap);
            logger_1.logger.debug(`Built Discord guild name map for guild ${guildId}: ${nameMap.size} entries`);
        }
        catch (error) {
            logger_1.logger.debug('Failed to fetch Discord guild members for name matching', {
                guildId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return nameMap;
    }
    async tryDiscordGuildNameMatch(organizationId, guildId, unlinkedHandles, linkedHandles, crawledMembers, links) {
        if (unlinkedHandles.length === 0) {
            return;
        }
        try {
            const nameMap = await this.fetchGuildMemberNameMap(guildId);
            if (nameMap.size === 0) {
                return;
            }
            const alreadyLinkedUserIds = new Set(links.map(l => l.userId));
            for (const handle of unlinkedHandles) {
                if (linkedHandles.has(handle.toLowerCase())) {
                    continue;
                }
                const discordMatch = nameMap.get(handle.toLowerCase());
                if (!discordMatch) {
                    continue;
                }
                const user = await this.userRepo.findOne({
                    where: { discordId: discordMatch.discordUserId },
                    select: ['id', 'discordId', 'rsiHandle', 'username'],
                });
                if (!user || alreadyLinkedUserIds.has(user.id)) {
                    continue;
                }
                const isMember = await this.membershipRepo.findOne({
                    where: { userId: user.id, organizationId, isActive: true },
                    select: ['id'],
                });
                if (!isMember) {
                    continue;
                }
                const existingLink = await this.userLinkRepo.findOne({
                    where: { userId: user.id, organizationId },
                });
                if (existingLink) {
                    continue;
                }
                const crawled = crawledMembers.find(m => m.handle.toLowerCase() === handle.toLowerCase());
                const newLink = this.userLinkRepo.create({
                    organizationId,
                    rsiHandle: handle,
                    userId: user.id,
                    discordUserId: discordMatch.discordUserId,
                    syncStatus: RsiUserLink_1.SyncStatus.NEEDS_REVIEW,
                    verificationMethod: RsiUserLink_1.VerificationMethod.DISCORD_MATCH,
                    lastSyncedAt: new Date(),
                    lastKnownRank: crawled?.rank ?? undefined,
                    isAffiliate: crawled?.isAffiliate ?? false,
                });
                newLink.markNeedsReview(`Discord guild ${discordMatch.matchedVia} match: "${handle}" ↔ Discord user ${user.username ?? discordMatch.discordUserId}`);
                await this.userLinkRepo.save(newLink);
                links.push(newLink);
                linkedHandles.add(handle.toLowerCase());
                alreadyLinkedUserIds.add(user.id);
                logger_1.logger.info(`Tentative link via Discord guild: RSI member ${handle} ↔ platform user ${user.id} (${discordMatch.matchedVia} match)`, { organizationId, discordUserId: discordMatch.discordUserId });
            }
        }
        catch (error) {
            logger_1.logger.debug('Discord guild name matching skipped', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getActiveFlagCountsByUser(organizationId) {
        const counts = await this.flagRepo
            .createQueryBuilder('flag')
            .select('flag.userId', 'userId')
            .addSelect('COUNT(*)', 'count')
            .where('flag.organizationId = :organizationId', { organizationId })
            .andWhere('flag.status = :status', { status: shared_types_1.FlagStatus.OPEN })
            .groupBy('flag.userId')
            .getRawMany();
        return new Map(counts.map(c => [c.userId, parseInt(c.count, 10)]));
    }
    async getDiscordStatus(organizationId, discordUserId, rsiRank, roleMappings) {
        const status = {
            isInGuild: false,
            discordUserId,
            discordRoles: [],
            expectedDiscordRoleId: undefined,
            expectedDiscordRoleName: undefined,
            hasCorrectRole: false,
        };
        if (rsiRank) {
            const mapping = roleMappings.find(m => m.rsiRank === rsiRank);
            status.expectedDiscordRoleId = mapping?.discordRoleId;
        }
        if (!status.expectedDiscordRoleId) {
            status.hasCorrectRole = true;
        }
        if (!discordUserId || !(0, DiscordService_1.isDiscordServiceInitialized)()) {
            if (discordUserId && !(0, DiscordService_1.isDiscordServiceInitialized)()) {
                const guildId = await this.resolveGuildId(organizationId);
                if (guildId) {
                    try {
                        const { BotClientManager } = await Promise.resolve().then(() => __importStar(require('../../bot/BotClientManager')));
                        const botManager = BotClientManager.getInstance();
                        if (botManager.isReady()) {
                            const client = botManager.getClient();
                            const guild = client.guilds.cache.get(guildId);
                            if (guild) {
                                const member = await guild.members.fetch(discordUserId).catch(() => null);
                                if (member) {
                                    status.isInGuild = true;
                                    status.discordRoles = member.roles.cache
                                        .filter(r => r.id !== guild.id)
                                        .map(r => ({ id: r.id, name: r.name }));
                                    if (status.expectedDiscordRoleId) {
                                        status.hasCorrectRole = status.discordRoles.some(r => r.id === status.expectedDiscordRoleId);
                                        const expectedRole = member.roles.cache.get(status.expectedDiscordRoleId) ??
                                            guild.roles.cache.get(status.expectedDiscordRoleId);
                                        status.expectedDiscordRoleName = expectedRole?.name;
                                    }
                                }
                            }
                        }
                    }
                    catch {
                    }
                }
            }
            return status;
        }
        const guildId = await this.resolveGuildId(organizationId);
        if (!guildId) {
            return status;
        }
        try {
            const discordService = (0, DiscordService_1.getDiscordService)();
            const roles = await discordService.getUserRoles(guildId, discordUserId);
            status.isInGuild = true;
            status.discordRoles = roles;
            if (status.expectedDiscordRoleId) {
                status.hasCorrectRole = roles.some(r => r.id === status.expectedDiscordRoleId);
                const matchedRole = roles.find(r => r.id === status.expectedDiscordRoleId);
                if (matchedRole) {
                    status.expectedDiscordRoleName = matchedRole.name;
                }
                else {
                    try {
                        const allGuildRoles = await discordService.getGuildRoles(guildId);
                        const guildRole = allGuildRoles.find((r) => r.id === status.expectedDiscordRoleId);
                        status.expectedDiscordRoleName = guildRole?.name;
                    }
                    catch {
                    }
                }
            }
        }
        catch {
            status.isInGuild = false;
        }
        return status;
    }
    validateMemberRoleMapping(rsiRank, roleMappings, discordStatus, membership) {
        const status = {
            isRankMatchingMapping: false,
            isDiscordRoleCorrect: false,
            isInternalRoleCorrect: false,
            mismatches: [],
        };
        if (!rsiRank) {
            return status;
        }
        const mapping = roleMappings.find(m => m.rsiRank === rsiRank);
        if (!mapping) {
            status.mismatches.push(`No role mapping defined for RSI rank "${rsiRank}"`);
            return status;
        }
        status.expectedMapping = {
            rsiRank: mapping.rsiRank,
            discordRoleId: mapping.discordRoleId,
            internalRoleId: mapping.internalRoleId,
        };
        status.isRankMatchingMapping = true;
        if (mapping.discordRoleId) {
            status.isDiscordRoleCorrect = discordStatus.hasCorrectRole;
            if (!status.isDiscordRoleCorrect) {
                const expectedLabel = discordStatus.expectedDiscordRoleName
                    ? `"${discordStatus.expectedDiscordRoleName}"`
                    : mapping.discordRoleId;
                if (!discordStatus.isInGuild) {
                    status.mismatches.push(`Expected Discord role ${expectedLabel} but user is not in Discord guild`);
                }
                else if (discordStatus.discordRoles.length > 0) {
                    const actualNames = discordStatus.discordRoles.map(r => r.name).join(', ');
                    status.mismatches.push(`Expected Discord role ${expectedLabel} but user has: ${actualNames}`);
                }
                else {
                    status.mismatches.push(`Expected Discord role ${expectedLabel} but user has no Discord roles`);
                }
            }
        }
        else {
            status.isDiscordRoleCorrect = true;
        }
        if (mapping.internalRoleId) {
            status.isInternalRoleCorrect = membership?.roleId === mapping.internalRoleId;
            if (!status.isInternalRoleCorrect) {
                status.mismatches.push(`Expected internal role ${mapping.internalRoleId} but user has ${membership?.roleId ?? 'no role'}`);
            }
        }
        else {
            status.isInternalRoleCorrect = true;
        }
        return status;
    }
    async suggestLinkCandidates(organizationId, query) {
        const qb = this.membershipRepo
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.user', 'user')
            .where('m.organizationId = :organizationId', { organizationId })
            .andWhere('m.isActive = true');
        if (query && query.trim().length > 0) {
            qb.andWhere('user.username ILIKE :q', { q: `%${query.trim()}%` });
        }
        qb.orderBy('user.username', 'ASC').take(20);
        const memberships = await qb.getMany();
        const userIds = memberships.map(m => m.userId);
        const existingLinks = userIds.length > 0
            ? await this.userLinkRepo
                .createQueryBuilder('link')
                .where('link.organizationId = :organizationId', { organizationId })
                .andWhere('link.userId IN (:...userIds)', { userIds })
                .getMany()
            : [];
        const linkByUserId = new Map(existingLinks.map(l => [l.userId, l]));
        return memberships.map(m => {
            const link = linkByUserId.get(m.userId);
            const user = m.user;
            return {
                userId: m.userId,
                username: user?.username ?? m.userId,
                discordId: user?.discordId,
                isAlreadyLinked: !!link,
                existingRsiHandle: link?.rsiHandle,
            };
        });
    }
    async manualLink(organizationId, rsiHandle, input, performedBy) {
        const orgSid = await this.resolveOrgSid(organizationId);
        if (orgSid) {
            const crawled = await this.crawledMemberRepo.findOne({
                where: { organizationSid: orgSid, handle: rsiHandle },
            });
            if (!crawled) {
                throw new apiErrors_1.NotFoundError(`RSI member "${rsiHandle}" not found in crawled org data`);
            }
        }
        const membership = await this.membershipRepo.findOne({
            where: { userId: input.userId, organizationId, isActive: true },
        });
        if (!membership) {
            throw new apiErrors_1.ValidationError('Target user is not an active member of this organization');
        }
        const existingUserLink = await this.userLinkRepo.findOne({
            where: { userId: input.userId, organizationId },
        });
        if (existingUserLink) {
            throw new apiErrors_1.ValidationError(`User already linked to RSI handle "${existingUserLink.rsiHandle}" in this organization`);
        }
        const existingHandleLink = await this.userLinkRepo.findOne({
            where: { rsiHandle, organizationId },
        });
        if (existingHandleLink) {
            throw new apiErrors_1.ValidationError(`RSI handle "${rsiHandle}" is already linked to another user in this organization`);
        }
        const user = await this.userRepo.findOne({
            where: { id: input.userId },
            select: ['id', 'discordId'],
        });
        const discordUserId = input.discordUserId ?? user?.discordId;
        const link = this.userLinkRepo.create({
            userId: input.userId,
            organizationId,
            rsiHandle,
            verificationMethod: RsiUserLink_1.VerificationMethod.MANUAL,
            discordUserId: discordUserId ?? undefined,
            syncStatus: RsiUserLink_1.SyncStatus.SYNCED,
            verifiedAt: new Date(),
            lastSyncedAt: new Date(),
        });
        const saved = await this.userLinkRepo.save(link);
        logger_1.logger.info('Manual RSI link created', {
            linkId: saved.id,
            rsiHandle,
            userId: input.userId,
            organizationId,
            performedBy,
        });
        return {
            success: true,
            linkId: saved.id,
            rsiHandle,
            userId: input.userId,
        };
    }
    async unlinkMember(organizationId, rsiHandle, performedBy) {
        const link = await this.userLinkRepo.findOne({
            where: { organizationId, rsiHandle },
        });
        if (!link) {
            throw new apiErrors_1.NotFoundError(`No link found for RSI handle "${rsiHandle}" in this organization`);
        }
        await this.userLinkRepo.remove(link);
        logger_1.logger.info('Manual RSI unlink performed', {
            rsiHandle,
            userId: link.userId,
            organizationId,
            performedBy,
        });
        return { success: true };
    }
    async clearCache(organizationId, performedBy) {
        const orgSid = await this.resolveOrgSid(organizationId);
        let crawledDeleted = 0;
        let citizenOrgsDeleted = 0;
        let memberCacheDeleted = 0;
        if (orgSid) {
            const crawledResult = await this.crawledMemberRepo.delete({
                organizationSid: orgSid,
            });
            crawledDeleted = crawledResult.affected ?? 0;
            const links = await this.userLinkRepo.find({
                where: { organizationId },
                select: ['rsiHandle'],
            });
            if (links.length > 0) {
                const handles = links.map(l => l.rsiHandle);
                for (const handle of handles) {
                    const result = await this.citizenOrgRepo.delete({ citizenHandle: handle });
                    citizenOrgsDeleted += result.affected ?? 0;
                }
            }
        }
        const cacheResult = await this.memberCacheRepo.delete({ organizationId });
        memberCacheDeleted = cacheResult.affected ?? 0;
        logger_1.logger.info('RSI cache cleared for organization', {
            organizationId,
            performedBy,
            crawledMembers: crawledDeleted,
            citizenOrgs: citizenOrgsDeleted,
            memberCache: memberCacheDeleted,
        });
        return {
            crawledMembers: crawledDeleted,
            citizenOrgs: citizenOrgsDeleted,
            memberCache: memberCacheDeleted,
        };
    }
}
exports.RsiMemberIntelService = RsiMemberIntelService;
exports.rsiMemberIntelService = new RsiMemberIntelService();
//# sourceMappingURL=RsiMemberIntelService.js.map