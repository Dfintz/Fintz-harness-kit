"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpportunitySearchService = void 0;
const Activity_1 = require("../../models/Activity");
const logger_1 = require("../../utils/logger");
const ActivityService_1 = require("../activity/ActivityService");
const PublicJobListingService_1 = require("../organization/PublicJobListingService");
const ReputationService_1 = require("../social/ReputationService");
class OpportunitySearchService {
    jobListingService;
    activityService;
    reputationService;
    constructor(jobListingService, activityService) {
        this.jobListingService = jobListingService ?? new PublicJobListingService_1.PublicJobListingService();
        this.activityService = activityService ?? new ActivityService_1.ActivityService();
        this.reputationService = new ReputationService_1.ReputationService();
    }
    async searchOpportunities(filters, pagination = {}) {
        const page = pagination.page ?? 1;
        const limit = pagination.limit ?? 20;
        const sourceType = filters.sourceType ?? 'all';
        const includeJobs = sourceType === 'all' || sourceType === 'job';
        const includeActivities = sourceType === 'all' || sourceType === 'activity';
        const fetchLimit = limit * 2;
        const [jobResults, activityResults] = await Promise.all([
            includeJobs
                ? this.fetchJobs(filters, { ...pagination, page: 1, limit: fetchLimit })
                : Promise.resolve({ data: [], totalJobs: 0 }),
            includeActivities
                ? this.fetchActivities(filters, fetchLimit)
                : Promise.resolve({ activities: [], totalActivities: 0 }),
        ]);
        const normalizedJobs = jobResults.data.map(job => this.normalizeJob(job));
        let allItems = [...normalizedJobs, ...activityResults.activities];
        const sortBy = pagination.sortBy ?? 'postedAt';
        const sortOrder = pagination.sortOrder ?? 'DESC';
        this.sortItems(allItems, sortBy, sortOrder);
        const hasAdvancedFilters = filters.minReputationScore !== undefined ||
            filters.reputationTiers !== undefined ||
            filters.minSuccessRate !== undefined;
        if (hasAdvancedFilters) {
            allItems = await this.enrichAndFilterByReputation(allItems, filters);
        }
        const total = hasAdvancedFilters
            ? allItems.length
            : jobResults.totalJobs + activityResults.totalActivities;
        const skip = (page - 1) * limit;
        const paginatedItems = allItems.slice(skip, skip + limit);
        const totalPages = Math.ceil(total / limit);
        return {
            data: paginatedItems,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async countOpportunities(filters = {}) {
        const sourceType = filters.sourceType ?? 'all';
        const includeJobs = sourceType === 'all' || sourceType === 'job';
        const includeActivities = sourceType === 'all' || sourceType === 'activity';
        const [jobResults, activityResults] = await Promise.all([
            includeJobs
                ? this.fetchJobs(filters, { page: 1, limit: 1 })
                : Promise.resolve({ data: [], totalJobs: 0 }),
            includeActivities
                ? this.fetchActivities(filters, 1)
                : Promise.resolve({ activities: [], totalActivities: 0 }),
        ]);
        return jobResults.totalJobs + activityResults.totalActivities;
    }
    async fetchJobs(filters, pagination) {
        try {
            const jobFilters = {
                searchTerm: filters.searchTerm,
                organizationId: filters.organizationId,
                jobTypes: filters.jobTypes,
                payTypes: filters.payTypes,
                listingCategory: filters.listingCategory,
                minPay: filters.minPay,
                maxPay: filters.maxPay,
                isActive: true,
            };
            const result = await this.jobListingService.getPublicJobListings(jobFilters, pagination);
            return { data: result.data, totalJobs: result.pagination.total };
        }
        catch (error) {
            logger_1.logger.error('OpportunitySearchService: Failed to fetch jobs', { error });
            return { data: [], totalJobs: 0 };
        }
    }
    async fetchActivities(filters, limit) {
        try {
            const activityFilters = {
                searchTerm: filters.searchTerm,
                organizationId: filters.organizationId,
                visibility: Activity_1.ActivityVisibility.PUBLIC,
                tags: filters.tags,
                activityType: filters.activityTypes,
                status: filters.activityStatus ?? [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.IN_PROGRESS],
                hasOpenSlots: filters.hasOpenSlots,
                isFeatured: filters.isFeatured,
                startDate: filters.startDate,
                endDate: filters.endDate,
            };
            const result = await this.activityService.searchActivities(activityFilters, 1, limit);
            const normalized = result.activities.map(a => this.normalizeActivity(a));
            return { activities: normalized, totalActivities: result.total };
        }
        catch (error) {
            logger_1.logger.error('OpportunitySearchService: Failed to fetch activities', {
                error,
            });
            return { activities: [], totalActivities: 0 };
        }
    }
    normalizeJob(job) {
        return {
            id: job.id,
            sourceType: 'job',
            title: job.title,
            description: job.description,
            organizationId: job.organizationId,
            organizationName: job.organizationName,
            organizationLogoUrl: job.organizationLogoUrl,
            tags: job.tags,
            postedAt: job.postedAt,
            expiresAt: job.expiresAt,
            isActive: job.isActive,
            jobType: job.jobType,
            payDisplay: job.payDisplay,
            payMin: job.payMin,
            payMax: job.payMax,
            experienceLevel: job.experienceLevel,
            listingCategory: job.listingCategory,
            crewSpotsTotal: job.crewSpotsTotal,
            crewSpotsFilled: job.crewSpotsFilled,
            shipCrewBreakdown: job.shipCrewBreakdown ?? [],
            requiredShips: job.requiredShips ?? [],
            shipRequirementType: job.shipRequirementType ?? 'none',
            ownerType: job.ownerType,
            allianceName: job.allianceName,
            focus: job.focus,
        };
    }
    normalizeActivity(activity) {
        if ('sourceType' in activity && activity.sourceType === 'activity') {
            return activity;
        }
        const a = activity;
        const status = a.status;
        const isActive = status === Activity_1.ActivityStatus.OPEN || status === Activity_1.ActivityStatus.IN_PROGRESS;
        return {
            id: a.id,
            sourceType: 'activity',
            title: a.title,
            description: a.description,
            organizationId: a.organizationId,
            organizationName: a.organizationName,
            tags: a.tags,
            postedAt: a.createdAt ?? new Date(),
            expiresAt: a.scheduledEndDate,
            isActive,
            activityType: a.activityType,
            activityStatus: status,
            scheduledStartDate: a.scheduledStartDate,
            currentParticipants: a.currentParticipants,
            maxParticipants: a.maxParticipants,
            location: a.location,
            difficulty: a.difficulty,
        };
    }
    async enrichAndFilterByReputation(items, filters) {
        const orgIds = [...new Set(items.map(i => i.organizationId).filter(Boolean))];
        const reputationMap = new Map();
        await Promise.all(orgIds.map(async (orgId) => {
            try {
                const rep = await this.reputationService.getUnifiedReputation(orgId);
                reputationMap.set(orgId, {
                    score: rep.combinedScore,
                    tier: rep.userReputation.tier,
                    successRate: rep.userReputation.successRate,
                });
            }
            catch {
                reputationMap.set(orgId, { score: 0, tier: 'Unknown', successRate: 0 });
            }
        }));
        const enriched = items.map(item => {
            if (item.organizationId && reputationMap.has(item.organizationId)) {
                const rep = reputationMap.get(item.organizationId);
                return {
                    ...item,
                    creatorReputationScore: rep.score,
                    creatorReputationTier: rep.tier,
                    creatorSuccessRate: rep.successRate,
                };
            }
            return item;
        });
        return enriched.filter(item => {
            if (filters.minReputationScore !== undefined) {
                if ((item.creatorReputationScore ?? 0) < filters.minReputationScore) {
                    return false;
                }
            }
            if (filters.reputationTiers && filters.reputationTiers.length > 0) {
                const tier = item.creatorReputationTier ?? '';
                if (!filters.reputationTiers.some(t => tier.toLowerCase().includes(t.toLowerCase()))) {
                    return false;
                }
            }
            if (filters.minSuccessRate !== undefined) {
                if ((item.creatorSuccessRate ?? 0) < filters.minSuccessRate) {
                    return false;
                }
            }
            return true;
        });
    }
    sortItems(items, sortBy, sortOrder) {
        const allowedSortFields = ['postedAt', 'title'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'postedAt';
        const order = sortOrder === 'ASC' ? 1 : -1;
        items.sort((a, b) => {
            if (safeSortBy === 'title') {
                return order * (a.title ?? '').localeCompare(b.title ?? '');
            }
            const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
            const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
            return order * (dateA - dateB);
        });
    }
}
exports.OpportunitySearchService = OpportunitySearchService;
//# sourceMappingURL=OpportunitySearchService.js.map