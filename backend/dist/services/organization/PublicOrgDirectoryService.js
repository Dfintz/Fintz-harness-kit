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
exports.PublicOrgDirectoryService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const SCStatsCsvImport_1 = require("../../models/SCStatsCsvImport");
const cacheInvalidation_1 = require("../../utils/cacheInvalidation");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class PublicOrgDirectoryService {
    profileRepository;
    organizationRepository;
    constructor() {
        this.profileRepository = data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    }
    async getPublicDirectory(filters, pagination) {
        const queryBuilder = this.profileRepository
            .createQueryBuilder('profile')
            .leftJoinAndSelect('profile.organization', 'org')
            .where('profile.isPublic = :isPublic', { isPublic: true });
        if (filters) {
            this.applyDirectoryFilters(queryBuilder, filters);
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        const sortBy = pagination?.sortBy || 'memberCount';
        const sortOrder = pagination?.sortOrder || 'DESC';
        const allowedSortFields = ['memberCount', 'createdAt', 'updatedAt', 'activityLevel'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'memberCount';
        queryBuilder.addOrderBy('profile.isVerified', 'DESC');
        queryBuilder.addOrderBy(`profile.${safeSortBy}`, sortOrder);
        const [profiles, total] = await queryBuilder.getManyAndCount();
        const orgIds = profiles.map(p => p.organizationId);
        const liveMemberCounts = await this.getLiveMemberCounts(orgIds);
        const skillEligibleOrgIds = profiles
            .filter(p => p.scstatsVisibility?.showSkills !== false)
            .map(p => p.organizationId);
        const skillDistributions = await this.batchGetSkillDistributions(skillEligibleOrgIds);
        const { slugify } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
        const data = [];
        for (const profile of profiles) {
            let profileSlug = profile.slug || '';
            if (!profileSlug && profile.organization?.name) {
                profileSlug = slugify(profile.organization.name);
                profile.slug = profileSlug;
                void this.profileRepository.save(profile).catch(() => {
                });
            }
            const liveCount = liveMemberCounts.get(profile.organizationId) ?? profile.memberCount;
            data.push({
                id: profile.id,
                organizationId: profile.organizationId,
                organizationName: profile.organization?.name || 'Unknown',
                rsiSid: profile.organization?.rsiSid,
                slug: profileSlug,
                organizationDescription: profile.organization?.description || undefined,
                organizationLogoUrl: profile.organization?.logoUrl || undefined,
                tagline: profile.tagline,
                primaryFocus: profile.primaryFocus,
                secondaryFocus: profile.secondaryFocus,
                memberCount: liveCount,
                activityLevel: profile.activityLevel,
                rsiUrl: profile.rsiUrl,
                discordInvite: profile.discordInvite,
                twitterUrl: profile.twitterUrl,
                youtubeUrl: profile.youtubeUrl,
                twitchUrl: profile.twitchUrl,
                websiteUrl: profile.websiteUrl,
                bannerUrl: profile.bannerUrl,
                languages: profile.languages,
                timezone: profile.timezone,
                isVerified: profile.isVerified,
                isRecruiting: profile.isRecruiting,
                rsiArchetype: profile.rsiArchetype,
                rsiCommitment: profile.rsiCommitment,
                rsiRolePlay: profile.rsiRolePlay,
                rsiExclusive: profile.rsiExclusive,
                skillDistribution: skillDistributions.get(profile.organizationId),
            });
        }
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getPublicProfile(identifier) {
        const { isUUID } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
        let profile;
        const normalizedIdentifier = identifier.trim();
        if (isUUID(normalizedIdentifier)) {
            profile = await this.profileRepository.findOne({
                where: { organizationId: normalizedIdentifier, isPublic: true },
                relations: ['organization'],
            });
        }
        else {
            profile = await this.profileRepository.findOne({
                where: [
                    { isPublic: true, organization: { rsiSid: normalizedIdentifier.toUpperCase() } },
                    { isPublic: true, slug: normalizedIdentifier },
                ],
                relations: ['organization'],
            });
        }
        if (!profile) {
            return null;
        }
        const liveMemberCounts = await this.getLiveMemberCounts([profile.organizationId]);
        const liveCount = liveMemberCounts.get(profile.organizationId) ?? profile.memberCount;
        const showSkills = profile.scstatsVisibility?.showSkills ?? true;
        const skillDistributions = showSkills
            ? await this.batchGetSkillDistributions([profile.organizationId])
            : new Map();
        return {
            id: profile.id,
            organizationId: profile.organizationId,
            organizationName: profile.organization?.name || 'Unknown',
            rsiSid: profile.organization?.rsiSid,
            slug: profile.slug || '',
            organizationDescription: profile.organization?.description || undefined,
            organizationLogoUrl: profile.organization?.logoUrl || undefined,
            tagline: profile.tagline,
            primaryFocus: profile.primaryFocus,
            secondaryFocus: profile.secondaryFocus,
            memberCount: liveCount,
            activityLevel: profile.activityLevel,
            rsiUrl: profile.rsiUrl,
            discordInvite: profile.discordInvite,
            twitterUrl: profile.twitterUrl,
            youtubeUrl: profile.youtubeUrl,
            twitchUrl: profile.twitchUrl,
            websiteUrl: profile.websiteUrl,
            bannerUrl: profile.bannerUrl,
            languages: profile.languages,
            timezone: profile.timezone,
            isVerified: profile.isVerified,
            isRecruiting: profile.isRecruiting,
            rsiArchetype: profile.rsiArchetype,
            rsiCommitment: profile.rsiCommitment,
            rsiRolePlay: profile.rsiRolePlay,
            rsiExclusive: profile.rsiExclusive,
            skillDistribution: skillDistributions.get(profile.organizationId),
        };
    }
    async getOrCreateProfile(organizationId) {
        let profile = await this.profileRepository.findOne({
            where: { organizationId },
            relations: ['organization'],
        });
        if (!profile) {
            const organization = await this.organizationRepository.findOne({
                where: { id: organizationId },
            });
            if (!organization) {
                throw new Error('Organization not found');
            }
            const { slugify } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
            const slug = await this.generateUniqueSlug(slugify(organization.name));
            profile = this.profileRepository.create({
                organizationId,
                slug,
                isPublic: false,
                primaryFocus: PublicOrgProfile_1.OrgPrimaryFocus.MIXED,
                activityLevel: PublicOrgProfile_1.ActivityLevel.MODERATE,
                memberCount: organization.totalMembers || 0,
                isVerified: false,
                isRecruiting: false,
            });
            profile = await this.profileRepository.save(profile);
            logger_1.logger.info(`Created public profile for organization ${organizationId}`);
            (0, cacheInvalidation_1.invalidateDirectoryStatsCache)();
        }
        return profile;
    }
    async updateProfile(organizationId, input) {
        const profile = await this.getOrCreateProfile(organizationId);
        if (input.isPublic !== undefined) {
            profile.isPublic = input.isPublic;
        }
        if (input.tagline !== undefined) {
            profile.tagline = input.tagline;
        }
        if (input.primaryFocus !== undefined) {
            profile.primaryFocus = input.primaryFocus;
        }
        if (input.secondaryFocus !== undefined) {
            profile.secondaryFocus = input.secondaryFocus;
        }
        if (input.rsiUrl !== undefined) {
            profile.rsiUrl = input.rsiUrl;
        }
        if (input.discordInvite !== undefined) {
            profile.discordInvite = input.discordInvite;
        }
        if (input.languages !== undefined) {
            profile.languages = input.languages;
        }
        if (input.timezone !== undefined) {
            profile.timezone = input.timezone;
        }
        if (input.isRecruiting !== undefined) {
            profile.isRecruiting = input.isRecruiting;
        }
        if (input.useDiscordForApplications !== undefined) {
            profile.useDiscordForApplications = input.useDiscordForApplications;
        }
        if (input.scstatsVisibility !== undefined) {
            profile.scstatsVisibility = input.scstatsVisibility;
        }
        if (input.bannerUrl !== undefined) {
            profile.bannerUrl = input.bannerUrl;
        }
        if (input.logoUrl !== undefined) {
            const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
            if (org) {
                org.logoUrl = input.logoUrl;
                await this.organizationRepository.save(org);
            }
        }
        const updated = await this.profileRepository.save(profile);
        logger_1.logger.info(`Updated public profile for organization ${organizationId}`);
        (0, cacheInvalidation_1.invalidateDirectoryStatsCache)();
        return updated;
    }
    async getLiveMemberCounts(orgIds) {
        const result = new Map();
        if (orgIds.length === 0) {
            return result;
        }
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const rows = await membershipRepo
            .createQueryBuilder('m')
            .select('m.organizationId', 'orgId')
            .addSelect('COUNT(m.id)', 'cnt')
            .where('m.organizationId IN (:...orgIds)', { orgIds })
            .groupBy('m.organizationId')
            .getRawMany();
        for (const row of rows) {
            result.set(row.orgId, Number.parseInt(row.cnt, 10));
        }
        return result;
    }
    async batchGetSkillDistributions(orgIds) {
        const result = new Map();
        if (orgIds.length === 0) {
            return result;
        }
        try {
            const { userToOrgs, userIds } = await this.fetchMemberOrgMapping(orgIds);
            if (userIds.length === 0) {
                return result;
            }
            const csvImportRepo = data_source_1.AppDataSource.getRepository(SCStatsCsvImport_1.SCStatsCsvImport);
            const imports = await csvImportRepo.find({
                where: { userId: (0, typeorm_1.In)(userIds) },
                select: ['userId', 'summary'],
            });
            this.aggregateImportsIntoDistribution(imports, userToOrgs, result);
        }
        catch (err) {
            logger_1.logger.warn('Failed to batch-fetch skill distributions', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return result;
    }
    async fetchMemberOrgMapping(orgIds) {
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const memberships = await membershipRepo
            .createQueryBuilder('m')
            .select('m.organizationId', 'orgId')
            .addSelect('m.userId', 'userId')
            .where('m.organizationId IN (:...orgIds)', { orgIds })
            .andWhere('m.isActive = true')
            .getRawMany();
        const userToOrgs = new Map();
        for (const m of memberships) {
            const orgs = userToOrgs.get(m.userId) ?? [];
            orgs.push(m.orgId);
            userToOrgs.set(m.userId, orgs);
        }
        return { userToOrgs, userIds: [...new Set(memberships.map(m => m.userId))] };
    }
    aggregateImportsIntoDistribution(imports, userToOrgs, result) {
        for (const csvImport of imports) {
            const summary = csvImport.summary;
            if (!summary) {
                continue;
            }
            const hoursByCareer = summary.hoursByCareer;
            if (!Array.isArray(hoursByCareer) || hoursByCareer.length === 0) {
                continue;
            }
            const orgs = userToOrgs.get(csvImport.userId);
            if (!orgs) {
                continue;
            }
            this.distributeCareerHoursToOrgs(hoursByCareer, orgs, result);
        }
    }
    distributeCareerHoursToOrgs(entries, orgIds, result) {
        for (const entry of entries) {
            const hours = Number(entry.hours) || 0;
            if (hours <= 0) {
                continue;
            }
            const category = entry.career;
            const bucket = this.bucketFlightHours(hours);
            for (const orgId of orgIds) {
                let dist = result.get(orgId);
                if (!dist) {
                    dist = {};
                    result.set(orgId, dist);
                }
                if (!dist[category]) {
                    dist[category] = { low: 0, medium: 0, high: 0, expert: 0 };
                }
                dist[category][bucket]++;
            }
        }
    }
    bucketFlightHours(hours) {
        if (hours < 50) {
            return 'low';
        }
        if (hours < 200) {
            return 'medium';
        }
        if (hours < 500) {
            return 'high';
        }
        return 'expert';
    }
    async syncMemberCount(organizationId) {
        const profile = await this.profileRepository.findOne({
            where: { organizationId },
        });
        if (!profile) {
            return null;
        }
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (organization) {
            profile.memberCount = organization.totalMembers || 0;
            return this.profileRepository.save(profile);
        }
        return profile;
    }
    async syncFromRsi(organizationId, rsiSid) {
        const { RsiCrawlerService } = await Promise.resolve().then(() => __importStar(require('../external/RsiCrawlerService')));
        const crawler = new RsiCrawlerService();
        const rsiData = await crawler.crawlOrganization(rsiSid);
        const profile = await this.getOrCreateProfile(organizationId);
        this.applyRsiFieldsToProfile(profile, rsiData);
        this.applyRsiMetadataToProfile(profile, rsiData);
        await this.syncOrgEntityFromRsi(organizationId, profile, rsiData);
        const updated = await this.profileRepository.save(profile);
        logger_1.logger.info(`Synced public profile from RSI for org ${organizationId} (SID: ${rsiSid})`);
        return updated;
    }
    applyRsiFieldsToProfile(profile, rsiData) {
        if (rsiData.banner) {
            profile.bannerUrl = rsiData.banner;
        }
        if (!profile.tagline && rsiData.description) {
            profile.tagline =
                rsiData.description.length > 200
                    ? `${rsiData.description.slice(0, 197)}...`
                    : rsiData.description;
        }
        if (profile.primaryFocus === PublicOrgProfile_1.OrgPrimaryFocus.MIXED && rsiData.focus?.primary) {
            const mapped = this.mapRsiFocusToEnum(rsiData.focus.primary);
            if (mapped) {
                profile.primaryFocus = mapped;
            }
        }
        if ((!profile.secondaryFocus || profile.secondaryFocus.length === 0) &&
            rsiData.focus?.secondary) {
            const mapped = this.mapRsiFocusToEnum(rsiData.focus.secondary);
            if (mapped) {
                profile.secondaryFocus = [mapped];
            }
        }
        if (!profile.rsiUrl && rsiData.links?.website) {
            profile.rsiUrl = rsiData.links.website;
        }
        if (!profile.discordInvite && rsiData.links?.discord) {
            profile.discordInvite = rsiData.links.discord;
        }
        if (rsiData.memberCount > 0) {
            profile.memberCount = rsiData.memberCount;
        }
        if (rsiData.language && (!profile.languages || profile.languages.length === 0)) {
            profile.languages = [rsiData.language];
        }
    }
    applyRsiMetadataToProfile(profile, rsiData) {
        if (rsiData.archetype) {
            profile.rsiArchetype = rsiData.archetype;
        }
        if (rsiData.commitment) {
            profile.rsiCommitment = rsiData.commitment;
        }
        if (rsiData.roleplay !== undefined) {
            const rp = rsiData.roleplay.toLowerCase().trim();
            profile.rsiRolePlay = rp === 'yes' || rp === 'true';
        }
        if (rsiData.recruiting !== undefined) {
            const recruiting = rsiData.recruiting.toLowerCase().trim();
            if (recruiting.includes('yes') || recruiting.includes('open')) {
                profile.isRecruiting = true;
            }
        }
        if (rsiData.exclusive !== undefined) {
            const excl = rsiData.exclusive.toLowerCase().trim();
            profile.rsiExclusive = excl === 'yes' || excl === 'exclusive' || excl === 'true';
        }
    }
    async syncOrgEntityFromRsi(organizationId, profile, rsiData) {
        const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
        if (!org) {
            return;
        }
        if (rsiData.logo) {
            org.logoUrl = rsiData.logo;
            await this.organizationRepository.save(org);
        }
        if (org.rsiVerified && !profile.isVerified) {
            profile.isVerified = true;
        }
    }
    applyDirectoryFilters(qb, filters) {
        if (filters.primaryFocuses && filters.primaryFocuses.length > 0) {
            qb.andWhere('profile.primaryFocus IN (:...primaryFocuses)', {
                primaryFocuses: filters.primaryFocuses,
            });
        }
        else if (filters.primaryFocus) {
            qb.andWhere('profile.primaryFocus = :primaryFocus', { primaryFocus: filters.primaryFocus });
        }
        if (filters.activityLevels && filters.activityLevels.length > 0) {
            qb.andWhere('profile.activityLevel IN (:...activityLevels)', {
                activityLevels: filters.activityLevels,
            });
        }
        else if (filters.activityLevel) {
            qb.andWhere('profile.activityLevel = :activityLevel', {
                activityLevel: filters.activityLevel,
            });
        }
        if (filters.isRecruiting !== undefined) {
            qb.andWhere('profile.isRecruiting = :isRecruiting', { isRecruiting: filters.isRecruiting });
        }
        if (filters.isVerified !== undefined) {
            qb.andWhere('profile.isVerified = :isVerified', { isVerified: filters.isVerified });
        }
        if (filters.minMemberCount !== undefined) {
            qb.andWhere('profile.memberCount >= :minMemberCount', {
                minMemberCount: filters.minMemberCount,
            });
        }
        if (filters.maxMemberCount !== undefined) {
            qb.andWhere('profile.memberCount <= :maxMemberCount', {
                maxMemberCount: filters.maxMemberCount,
            });
        }
        if (filters.languages && filters.languages.length > 0) {
            qb.andWhere('profile.languages ?| :languages', { languages: filters.languages });
        }
        if (filters.timezone) {
            qb.andWhere('profile.timezone = :timezone', { timezone: filters.timezone });
        }
        if (filters.searchTerm) {
            const escaped = filters.searchTerm
                .replaceAll('%', String.raw `\%`)
                .replaceAll('_', String.raw `\_`);
            qb.andWhere('(org.name ILIKE :search OR org.description ILIKE :search OR profile.tagline ILIKE :search)', { search: `%${escaped}%` });
        }
    }
    mapRsiFocusToEnum(rsiFocus) {
        const mapping = {
            'bounty hunting': PublicOrgProfile_1.OrgPrimaryFocus.BOUNTY_HUNTING,
            exploration: PublicOrgProfile_1.OrgPrimaryFocus.EXPLORATION,
            freelancing: PublicOrgProfile_1.OrgPrimaryFocus.MIXED,
            infiltration: PublicOrgProfile_1.OrgPrimaryFocus.SECURITY,
            medical: PublicOrgProfile_1.OrgPrimaryFocus.MEDICAL,
            piracy: PublicOrgProfile_1.OrgPrimaryFocus.PIRACY,
            resources: PublicOrgProfile_1.OrgPrimaryFocus.MINING,
            scouting: PublicOrgProfile_1.OrgPrimaryFocus.EXPLORATION,
            security: PublicOrgProfile_1.OrgPrimaryFocus.SECURITY,
            smuggling: PublicOrgProfile_1.OrgPrimaryFocus.TRADING,
            social: PublicOrgProfile_1.OrgPrimaryFocus.SOCIAL,
            trading: PublicOrgProfile_1.OrgPrimaryFocus.TRADING,
            transport: PublicOrgProfile_1.OrgPrimaryFocus.TRANSPORT,
        };
        const key = rsiFocus.toLowerCase().trim();
        return mapping[key] ?? null;
    }
    async setVerificationStatus(organizationId, isVerified) {
        const profile = await this.getOrCreateProfile(organizationId);
        profile.isVerified = isVerified;
        const saved = await this.profileRepository.save(profile);
        (0, cacheInvalidation_1.invalidateDirectoryStatsCache)();
        return saved;
    }
    async deleteProfile(organizationId) {
        const result = await this.profileRepository.delete({ organizationId });
        const deleted = (result.affected || 0) > 0;
        if (deleted) {
            (0, cacheInvalidation_1.invalidateDirectoryStatsCache)();
        }
        return deleted;
    }
    async syncSlug(organizationId, newName) {
        const profile = await this.profileRepository.findOne({
            where: { organizationId },
        });
        if (!profile) {
            return null;
        }
        const { slugify } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
        const slug = await this.generateUniqueSlug(slugify(newName), profile.id);
        profile.slug = slug;
        const updated = await this.profileRepository.save(profile);
        logger_1.logger.info(`Synced slug for organization ${organizationId} to "${slug}"`);
        return updated;
    }
    async generateUniqueSlug(baseSlug, excludeProfileId) {
        const MAX_SUFFIX = 100;
        let slug = baseSlug;
        let suffix = 2;
        while (suffix <= MAX_SUFFIX + 1) {
            const existing = await this.profileRepository.findOne({ where: { slug } });
            if (!existing || existing.id === excludeProfileId) {
                return slug;
            }
            slug = `${baseSlug}-${suffix}`;
            suffix++;
        }
        throw new Error(`Unable to generate unique slug for "${baseSlug}" after ${MAX_SUFFIX} attempts`);
    }
    getFocusOptions() {
        return Object.values(PublicOrgProfile_1.OrgPrimaryFocus);
    }
    getActivityLevelOptions() {
        return Object.values(PublicOrgProfile_1.ActivityLevel);
    }
    async getDirectoryStats() {
        const cacheKey = 'public:directory:stats';
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const stats = await this.profileRepository
            .createQueryBuilder('profile')
            .select('COUNT(*)::int', 'total')
            .addSelect('SUM(CASE WHEN profile.isRecruiting = true THEN 1 ELSE 0 END)::int', 'recruiting')
            .addSelect('SUM(CASE WHEN profile.isVerified = true THEN 1 ELSE 0 END)::int', 'verified')
            .where('profile.isPublic = :isPublic', { isPublic: true })
            .getRawOne();
        const focusCounts = await this.profileRepository
            .createQueryBuilder('profile')
            .select('profile.primaryFocus', 'focus')
            .addSelect('COUNT(*)::int', 'count')
            .where('profile.isPublic = :isPublic', { isPublic: true })
            .groupBy('profile.primaryFocus')
            .getRawMany();
        const byFocus = {};
        for (const row of focusCounts) {
            if (row.focus) {
                byFocus[row.focus] = row.count;
            }
        }
        const result = {
            totalOrganizations: stats?.total ?? 0,
            recruitingOrganizations: stats?.recruiting ?? 0,
            verifiedOrganizations: stats?.verified ?? 0,
            byFocus,
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
}
exports.PublicOrgDirectoryService = PublicOrgDirectoryService;
//# sourceMappingURL=PublicOrgDirectoryService.js.map