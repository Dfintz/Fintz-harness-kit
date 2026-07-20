"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgTrustScoreService = void 0;
const data_source_1 = require("../../data-source");
const LFGUserReputation_1 = require("../../models/LFGUserReputation");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const RsiUserLink_1 = require("../../models/RsiUserLink");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const WEIGHT_VERIFIED_MEMBERS = 0.2;
const WEIGHT_MEMBER_REPUTATION = 0.25;
const WEIGHT_ORG_VERIFIED = 0.2;
const WEIGHT_RELATIONSHIP_TRUST = 0.2;
const WEIGHT_CATEGORY_RATINGS = 0.15;
const CACHE_TTL_MS = 5 * 60 * 1000;
function getTierLabel(score) {
    if (score >= 90) {
        return 'Platinum';
    }
    if (score >= 75) {
        return 'Gold';
    }
    if (score >= 60) {
        return 'Silver';
    }
    if (score >= 40) {
        return 'Bronze';
    }
    return 'Unranked';
}
class OrgTrustScoreService {
    membershipRepo;
    rsiLinkRepo;
    reputationRepo;
    relationshipRepo;
    orgRepo;
    scoreCache = new Map();
    constructor() {
        this.membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.rsiLinkRepo = data_source_1.AppDataSource.getRepository(RsiUserLink_1.RsiUserLink);
        this.reputationRepo = data_source_1.AppDataSource.getRepository(LFGUserReputation_1.LFGUserReputation);
        this.relationshipRepo = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
        this.orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    }
    async getTrustScore(organizationId) {
        const cacheKey = `org:${organizationId}:trust:score`;
        const redisCached = await redis_1.cache.get(cacheKey);
        if (redisCached) {
            return redisCached;
        }
        const cached = this.scoreCache.get(organizationId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        const result = await this.computeTrustScore(organizationId);
        await redis_1.cache.set(cacheKey, result, 900);
        this.scoreCache.set(organizationId, {
            data: result,
            expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return result;
    }
    async computeTrustScore(organizationId) {
        const [totalMembers, org, relationships] = await Promise.all([
            this.membershipRepo.count({ where: { organizationId } }),
            this.orgRepo.findOne({ where: { id: organizationId } }),
            this.relationshipRepo.find({
                where: [
                    { organizationId, status: OrganizationRelationship_1.RelationshipStatus.ACTIVE },
                    { targetOrganizationId: organizationId, status: OrganizationRelationship_1.RelationshipStatus.ACTIVE },
                ],
            }),
        ]);
        const rsiLinks = totalMembers > 0
            ? await this.rsiLinkRepo.find({ where: { organizationId } })
            : [];
        const memberSubquery = this.membershipRepo
            .createQueryBuilder('m')
            .select('m.userId')
            .where('m.organizationId = :orgId')
            .getQuery();
        const repAgg = totalMembers > 0
            ? await this.reputationRepo
                .createQueryBuilder('r')
                .select('AVG(r."overallScore")', 'avgScore')
                .where(`r."userId" IN (${memberSubquery})`)
                .setParameter('orgId', organizationId)
                .getRawOne()
            : null;
        const reputations = totalMembers > 0
            ? await this.reputationRepo
                .createQueryBuilder('r')
                .where(`r."userId" IN (${memberSubquery})`)
                .setParameter('orgId', organizationId)
                .getMany()
            : [];
        const verifiedLinks = rsiLinks.filter(link => link.isVerified());
        const verifiedMemberCount = verifiedLinks.length;
        const verifiedMemberRate = totalMembers > 0 ? (verifiedMemberCount / totalMembers) * 100 : 0;
        const avgMemberReputation = repAgg?.avgScore ? Number(repAgg.avgScore) : 50;
        const orgRsiVerified = org?.rsiVerified ?? false;
        const activeRelationships = relationships.length;
        const avgRelationshipTrust = activeRelationships > 0
            ? relationships.reduce((sum, r) => sum + Number(r.trustScore), 0) / activeRelationships
            : 50;
        const categoryAverages = this.computeCategoryAverages(reputations);
        const categoryAvg = this.averageOfCategories(categoryAverages) * 20;
        const orgVerifiedScore = orgRsiVerified ? 100 : 0;
        const compositeScore = Math.round(verifiedMemberRate * WEIGHT_VERIFIED_MEMBERS +
            avgMemberReputation * WEIGHT_MEMBER_REPUTATION +
            orgVerifiedScore * WEIGHT_ORG_VERIFIED +
            avgRelationshipTrust * WEIGHT_RELATIONSHIP_TRUST +
            categoryAvg * WEIGHT_CATEGORY_RATINGS);
        const score = Math.min(100, Math.max(0, compositeScore));
        const result = {
            organizationId,
            score,
            tier: getTierLabel(score),
            breakdown: {
                verifiedMemberRate: Math.round(verifiedMemberRate * 100) / 100,
                verifiedMemberCount,
                totalMembers,
                avgMemberReputation: Math.round(avgMemberReputation * 100) / 100,
                categoryAverages,
                orgRsiVerified,
                avgRelationshipTrust: Math.round(avgRelationshipTrust * 100) / 100,
                activeRelationships,
            },
            computedAt: new Date().toISOString(),
        };
        logger_1.logger.debug(`Computed trust score for org ${organizationId}: ${score} (${result.tier})`);
        return result;
    }
    computeCategoryAverages(reputations) {
        const defaults = { communication: 0, teamwork: 0, skill: 0, reliability: 0, leadership: 0 };
        if (reputations.length === 0) {
            return defaults;
        }
        const sums = { ...defaults };
        let count = 0;
        for (const rep of reputations) {
            if (rep.categoryAverages) {
                sums.communication += rep.categoryAverages.communication ?? 0;
                sums.teamwork += rep.categoryAverages.teamwork ?? 0;
                sums.skill += rep.categoryAverages.skill ?? 0;
                sums.reliability += rep.categoryAverages.reliability ?? 0;
                sums.leadership += rep.categoryAverages.leadership ?? 0;
                count++;
            }
        }
        if (count === 0) {
            return defaults;
        }
        return {
            communication: Math.round((sums.communication / count) * 100) / 100,
            teamwork: Math.round((sums.teamwork / count) * 100) / 100,
            skill: Math.round((sums.skill / count) * 100) / 100,
            reliability: Math.round((sums.reliability / count) * 100) / 100,
            leadership: Math.round((sums.leadership / count) * 100) / 100,
        };
    }
    averageOfCategories(cats) {
        const values = [
            cats.communication,
            cats.teamwork,
            cats.skill,
            cats.reliability,
            cats.leadership,
        ];
        const nonZero = values.filter(v => v > 0);
        if (nonZero.length === 0) {
            return 50;
        }
        return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    }
}
exports.OrgTrustScoreService = OrgTrustScoreService;
//# sourceMappingURL=OrgTrustScoreService.js.map