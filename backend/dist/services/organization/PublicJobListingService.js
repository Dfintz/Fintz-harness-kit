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
exports.PublicJobListingService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const PublicJobListing_1 = require("../../models/PublicJobListing");
const logger_1 = require("../../utils/logger");
const fullTextSearch_1 = require("../../utils/query/fullTextSearch");
const ShipService_1 = require("../ship/ShipService");
class PublicJobListingService {
    jobRepository;
    organizationRepository;
    shipService;
    constructor() {
        this.jobRepository = data_source_1.AppDataSource.getRepository(PublicJobListing_1.PublicJobListing);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.shipService = new ShipService_1.ShipService();
    }
    async withJobLock(jobId, callback) {
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const job = await queryRunner.manager.findOne(PublicJobListing_1.PublicJobListing, {
                where: { id: jobId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!job) {
                throw new Error('Job listing not found');
            }
            const result = await callback(job, queryRunner);
            await queryRunner.commitTransaction();
            return result;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    getAssignedUserIds(role) {
        if (role.assignedUserIds && Array.isArray(role.assignedUserIds)) {
            return role.assignedUserIds;
        }
        if (role.assignedUserId) {
            return [role.assignedUserId];
        }
        return [];
    }
    async enrichWithShipStats(item) {
        await this.enrichMultipleWithShipStats([item]);
        return item;
    }
    async enrichMultipleWithShipStats(items) {
        const allShipNames = [];
        for (const item of items) {
            if (item.shipCrewBreakdown) {
                for (const entry of item.shipCrewBreakdown) {
                    allShipNames.push(entry.shipName);
                }
            }
        }
        if (allShipNames.length === 0) {
            return items;
        }
        const specs = await this.shipService.batchGetShipSpecsByNames(allShipNames);
        for (const item of items) {
            this.applyShipStatsToItem(item, specs);
        }
        return items;
    }
    applyShipStatsToItem(item, specs) {
        if (!item.shipCrewBreakdown || item.shipCrewBreakdown.length === 0) {
            return;
        }
        let totalScu = 0;
        let totalQf = 0;
        let shipCount = 0;
        for (const entry of item.shipCrewBreakdown) {
            const spec = specs.get(entry.shipName.toLowerCase());
            if (spec) {
                entry.cargo = spec.cargo;
                entry.quantumFuelCapacity = spec.quantumFuelCapacity;
                totalScu += spec.cargo;
                if (spec.quantumFuelCapacity > 0) {
                    totalQf += spec.quantumFuelCapacity;
                    shipCount++;
                }
            }
        }
        item.totalScu = totalScu;
        item.averageQuantumFuel = shipCount > 0 ? Math.round(totalQf / shipCount) : 0;
    }
    applyJobFilters(queryBuilder, filters) {
        if (filters?.isActive !== false) {
            queryBuilder.andWhere('job.isActive = :isActive', { isActive: true });
        }
        if (!filters?.includeExpired) {
            queryBuilder.andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now: new Date() });
        }
        if (!filters) {
            return;
        }
        if (filters.organizationId) {
            queryBuilder.andWhere('job.organizationId = :organizationId', {
                organizationId: filters.organizationId,
            });
        }
        if (filters.allianceId) {
            queryBuilder.andWhere('job.allianceId = :allianceId', {
                allianceId: filters.allianceId,
            });
        }
        if (filters.ownerType) {
            queryBuilder.andWhere('job.ownerType = :ownerType', {
                ownerType: filters.ownerType,
            });
        }
        if (filters.listingCategory) {
            queryBuilder.andWhere('job.listingCategory = :listingCategory', {
                listingCategory: filters.listingCategory,
            });
        }
        this.applyArrayFilters(queryBuilder, filters);
        this.applyRangeAndTextFilters(queryBuilder, filters);
    }
    applyArrayFilters(queryBuilder, filters) {
        if (filters.jobTypes && filters.jobTypes.length > 0) {
            queryBuilder.andWhere('job.jobType IN (:...jobTypes)', { jobTypes: filters.jobTypes });
        }
        if (filters.focuses && filters.focuses.length > 0) {
            queryBuilder.andWhere('job.focus IN (:...focuses)', { focuses: filters.focuses });
        }
        if (filters.payTypes && filters.payTypes.length > 0) {
            queryBuilder.andWhere('job.payType IN (:...payTypes)', { payTypes: filters.payTypes });
        }
    }
    applyRangeAndTextFilters(queryBuilder, filters) {
        if (filters.minPay !== undefined) {
            queryBuilder.andWhere('(job.payMin >= :minPay OR job.payMax >= :minPay)', {
                minPay: filters.minPay,
            });
        }
        if (filters.maxPay !== undefined) {
            queryBuilder.andWhere('(job.payMax <= :maxPay OR job.payMin <= :maxPay)', {
                maxPay: filters.maxPay,
            });
        }
        if (filters.maxExperienceLevel !== undefined) {
            queryBuilder.andWhere('job.experienceLevel <= :maxExperience', {
                maxExperience: filters.maxExperienceLevel,
            });
        }
        if (filters.searchTerm) {
            (0, fullTextSearch_1.addFullTextSearch)(queryBuilder, 'job', filters.searchTerm, ['title', 'description'], 'search_vector', 'jobSearch');
        }
    }
    async getPublicJobListings(filters, pagination) {
        const queryBuilder = this.jobRepository
            .createQueryBuilder('job')
            .leftJoinAndSelect('job.organization', 'org');
        this.applyJobFilters(queryBuilder, filters);
        const page = pagination?.page ?? 1;
        const limit = pagination?.limit ?? 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        const sortBy = pagination?.sortBy ?? 'postedAt';
        const sortOrder = pagination?.sortOrder ?? 'DESC';
        const allowedSortFields = ['postedAt', 'title', 'jobType', 'experienceLevel', 'payMin'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'postedAt';
        if (filters?.searchTerm) {
            queryBuilder.addOrderBy(`job.${safeSortBy}`, sortOrder);
        }
        else {
            queryBuilder.orderBy(`job.${safeSortBy}`, sortOrder);
        }
        const [jobs, total] = await queryBuilder.getManyAndCount();
        const data = jobs.map(job => ({
            id: job.id,
            organizationId: job.organizationId,
            organizationName: job.organization?.name,
            organizationLogoUrl: job.organization?.logoUrl,
            allianceId: job.allianceId,
            allianceName: undefined,
            ownerType: job.ownerType,
            listingCategory: job.listingCategory,
            title: job.title,
            description: job.description,
            jobType: job.jobType,
            focus: job.focus,
            payType: job.payType,
            payMin: job.payMin,
            payMax: job.payMax,
            payDisplay: job.getPayDisplay(),
            experienceLevel: job.experienceLevel,
            isActive: job.isActive,
            postedAt: job.postedAt,
            expiresAt: job.expiresAt,
            contactInfo: job.contactInfo,
            timezone: job.timezone,
            languages: job.languages,
            tags: job.tags,
            crewSpotsTotal: job.crewSpotsTotal,
            crewSpotsFilled: job.crewSpotsFilled ?? 0,
            requiredShips: job.requiredShips,
            shipRequirementType: job.shipRequirementType ?? 'none',
            shipCrewBreakdown: job.shipCrewBreakdown ?? [],
            approvedVehicles: job.approvedVehicles ?? [],
        }));
        await this.enrichMultipleWithShipStats(data);
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
    async getJobListing(identifier) {
        const { isUUID } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
        let job;
        if (isUUID(identifier)) {
            job = await this.jobRepository.findOne({
                where: { id: identifier },
                relations: ['organization'],
            });
        }
        else {
            job =
                (await this.jobRepository
                    .createQueryBuilder('job')
                    .leftJoinAndSelect('job.organization', 'organization')
                    .where('job.isActive = :isActive', { isActive: true })
                    .andWhere(String.raw `LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(job.title), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'), '-+', '-', 'g'))) = LOWER(:slug)`, { slug: identifier })
                    .getOne()) ?? null;
        }
        if (!job?.isVisible()) {
            return null;
        }
        const item = {
            id: job.id,
            organizationId: job.organizationId,
            organizationName: job.organization?.name,
            organizationLogoUrl: job.organization?.logoUrl,
            allianceId: job.allianceId,
            allianceName: undefined,
            ownerType: job.ownerType,
            listingCategory: job.listingCategory,
            title: job.title,
            description: job.description,
            jobType: job.jobType,
            focus: job.focus,
            payType: job.payType,
            payMin: job.payMin,
            payMax: job.payMax,
            payDisplay: job.getPayDisplay(),
            experienceLevel: job.experienceLevel,
            isActive: job.isActive,
            postedAt: job.postedAt,
            expiresAt: job.expiresAt,
            contactInfo: job.contactInfo,
            timezone: job.timezone,
            languages: job.languages,
            tags: job.tags,
            crewSpotsTotal: job.crewSpotsTotal,
            crewSpotsFilled: job.crewSpotsFilled ?? 0,
            requiredShips: job.requiredShips,
            shipRequirementType: job.shipRequirementType ?? 'none',
            shipCrewBreakdown: job.shipCrewBreakdown ?? [],
            approvedVehicles: job.approvedVehicles ?? [],
            createdBy: job.createdBy,
        };
        return this.enrichWithShipStats(item);
    }
    async getJobListingInternal(jobId) {
        return this.jobRepository.findOne({
            where: { id: jobId },
            relations: ['organization'],
        });
    }
    async createJobListing(input) {
        if (input.ownerType === PublicJobListing_1.ListingOwnerType.ORGANIZATION && !input.organizationId) {
            throw new Error('Organization ID is required for organization listings');
        }
        if (input.ownerType === PublicJobListing_1.ListingOwnerType.ALLIANCE && !input.allianceId) {
            throw new Error('Alliance ID is required for alliance listings');
        }
        if (input.organizationId) {
            const org = await this.organizationRepository.findOne({
                where: { id: input.organizationId },
            });
            if (!org) {
                throw new Error('Organization not found');
            }
        }
        if (input.requiredShips?.length && !input.crewSpotsTotal) {
            const totalCrew = PublicJobListingService.calculateCrewTotal(input.requiredShips);
            if (totalCrew > 0) {
                input.crewSpotsTotal = totalCrew;
            }
        }
        const job = this.jobRepository.create({
            ...input,
            isActive: true,
            postedAt: new Date(),
            experienceLevel: input.experienceLevel ?? 0,
        });
        const saved = await this.jobRepository.save(job);
        logger_1.logger.info(`Created job listing: ${saved.title}`, {
            jobId: saved.id,
            organizationId: saved.organizationId,
            allianceId: saved.allianceId,
        });
        return saved;
    }
    async updateJobListing(jobId, input) {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            return null;
        }
        const updatableFields = [
            'listingCategory',
            'title',
            'description',
            'jobType',
            'focus',
            'payType',
            'payMin',
            'payMax',
            'experienceLevel',
            'isActive',
            'expiresAt',
            'contactInfo',
            'timezone',
            'languages',
            'tags',
        ];
        const patch = {};
        for (const field of updatableFields) {
            if (input[field] !== undefined) {
                patch[field] = input[field];
            }
        }
        Object.assign(job, patch);
        const updated = await this.jobRepository.save(job);
        logger_1.logger.info(`Updated job listing: ${updated.title}`, { jobId: updated.id });
        return updated;
    }
    async deleteJobListing(jobId) {
        const result = await this.jobRepository.delete({ id: jobId });
        const deleted = (result.affected ?? 0) > 0;
        if (deleted) {
            logger_1.logger.info(`Deleted job listing`, { jobId });
        }
        return deleted;
    }
    async deactivateJobListing(jobId) {
        return this.updateJobListing(jobId, { isActive: false });
    }
    async getOrganizationJobCount(organizationId) {
        return this.jobRepository.count({
            where: {
                organizationId,
                isActive: true,
            },
        });
    }
    async getAllianceJobCount(allianceId) {
        return this.jobRepository.count({
            where: {
                allianceId,
                isActive: true,
            },
        });
    }
    async getOrganizationJobCounts(organizationIds) {
        if (!organizationIds || organizationIds.length === 0) {
            return new Map();
        }
        const results = await this.jobRepository
            .createQueryBuilder('job')
            .select('job.organizationId', 'organizationId')
            .addSelect('COUNT(*)', 'count')
            .where('job.organizationId IN (:...organizationIds)', { organizationIds })
            .andWhere('job.isActive = :isActive', { isActive: true })
            .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now: new Date() })
            .groupBy('job.organizationId')
            .getRawMany();
        const counts = new Map();
        for (const row of results) {
            counts.set(row.organizationId, Number.parseInt(row.count, 10));
        }
        return counts;
    }
    async getAllianceJobCounts(allianceIds) {
        if (!allianceIds || allianceIds.length === 0) {
            return new Map();
        }
        const results = await this.jobRepository
            .createQueryBuilder('job')
            .select('job.allianceId', 'allianceId')
            .addSelect('COUNT(*)', 'count')
            .where('job.allianceId IN (:...allianceIds)', { allianceIds })
            .andWhere('job.isActive = :isActive', { isActive: true })
            .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now: new Date() })
            .groupBy('job.allianceId')
            .getRawMany();
        const counts = new Map();
        for (const row of results) {
            counts.set(row.allianceId, Number.parseInt(row.count, 10));
        }
        return counts;
    }
    async getOrganizationListings(organizationId, includeInactive = false) {
        const where = { organizationId };
        if (!includeInactive) {
            where.isActive = true;
        }
        return this.jobRepository.find({ where, order: { postedAt: 'DESC' } });
    }
    async getAllianceListings(allianceId, includeInactive = false) {
        const where = { allianceId };
        if (!includeInactive) {
            where.isActive = true;
        }
        return this.jobRepository.find({ where, order: { postedAt: 'DESC' } });
    }
    async getJobListingStats() {
        const now = new Date();
        const [total, active, orgListings, allianceListings, userListings, jobCategoryCount, serviceCategoryCount,] = await Promise.all([
            this.jobRepository.count(),
            this.jobRepository.count({
                where: { isActive: true },
            }),
            this.jobRepository.count({
                where: { ownerType: PublicJobListing_1.ListingOwnerType.ORGANIZATION, isActive: true },
            }),
            this.jobRepository.count({
                where: { ownerType: PublicJobListing_1.ListingOwnerType.ALLIANCE, isActive: true },
            }),
            this.jobRepository.count({
                where: { ownerType: PublicJobListing_1.ListingOwnerType.USER, isActive: true },
            }),
            this.jobRepository.count({
                where: { listingCategory: PublicJobListing_1.ListingCategory.JOB, isActive: true },
            }),
            this.jobRepository.count({
                where: { listingCategory: PublicJobListing_1.ListingCategory.SERVICE, isActive: true },
            }),
        ]);
        const jobTypeCounts = await this.jobRepository
            .createQueryBuilder('job')
            .select('job.jobType', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('job.isActive = :isActive', { isActive: true })
            .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now })
            .groupBy('job.jobType')
            .getRawMany();
        const byJobType = {};
        for (const row of jobTypeCounts) {
            byJobType[row.type] = Number.parseInt(row.count, 10);
        }
        const focusCounts = await this.jobRepository
            .createQueryBuilder('job')
            .select('job.focus', 'focus')
            .addSelect('COUNT(*)', 'count')
            .where('job.isActive = :isActive', { isActive: true })
            .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now })
            .groupBy('job.focus')
            .getRawMany();
        const byFocus = {};
        for (const row of focusCounts) {
            byFocus[row.focus] = Number.parseInt(row.count, 10);
        }
        return {
            totalListings: total,
            activeListings: active,
            organizationListings: orgListings,
            allianceListings,
            userListings,
            jobListings: jobCategoryCount,
            serviceListings: serviceCategoryCount,
            byJobType,
            byFocus,
        };
    }
    getJobTypeOptions() {
        return Object.values(PublicJobListing_1.JobType);
    }
    getPayTypeOptions() {
        return Object.values(PublicJobListing_1.PayType);
    }
    async cleanupExpiredListings() {
        const result = await this.jobRepository
            .createQueryBuilder()
            .update(PublicJobListing_1.PublicJobListing)
            .set({ isActive: false })
            .where('expiresAt < :now', { now: new Date() })
            .andWhere('isActive = :isActive', { isActive: true })
            .execute();
        const affected = result.affected ?? 0;
        if (affected > 0) {
            logger_1.logger.info(`Deactivated ${affected} expired job listings`);
        }
        return affected;
    }
    static toParticipantInfo(listing, options) {
        const isExpired = !!listing.expiresAt && listing.expiresAt.getTime() < Date.now();
        return {
            userId: listing.createdBy ?? 'unknown-provider',
            organizationId: listing.organizationId,
            username: options?.username ?? listing.createdBy ?? 'unknown-provider',
            displayName: options?.displayName,
            roles: [shared_types_1.SystemRole.JOB_PROVIDER],
            primaryRole: 'provider',
            status: listing.isActive && !isExpired ? 'active' : 'inactive',
            joinedAt: listing.postedAt,
            source: 'manual',
            metadata: {
                listingId: listing.id,
            },
        };
    }
    toParticipantInfo(listing, options) {
        return PublicJobListingService.toParticipantInfo(listing, options);
    }
    async assignCrewRole(jobId, shipIndex, roleIndex, userId, userName) {
        return this.withJobLock(jobId, async (job, queryRunner) => {
            if (!job.shipCrewBreakdown || job.shipCrewBreakdown.length === 0) {
                throw new Error('Job listing has no ship crew breakdown');
            }
            if (shipIndex < 0 || shipIndex >= job.shipCrewBreakdown.length) {
                throw new Error('Invalid ship index');
            }
            const ship = job.shipCrewBreakdown[shipIndex];
            if (roleIndex < 0 || roleIndex >= ship.roles.length) {
                throw new Error('Invalid role index');
            }
            const role = ship.roles[roleIndex];
            if (role.filled >= role.total) {
                throw new Error('This role is already filled to capacity');
            }
            role.assignedUserIds ??= [];
            role.assignedUserNames ??= [];
            if (role.assignedUserIds.includes(userId)) {
                throw new Error('User is already assigned to this role');
            }
            let userAlreadyAssigned = false;
            for (const s of job.shipCrewBreakdown) {
                for (const r of s.roles) {
                    const assignedIds = this.getAssignedUserIds(r);
                    if (assignedIds.includes(userId)) {
                        userAlreadyAssigned = true;
                        break;
                    }
                }
                if (userAlreadyAssigned) {
                    break;
                }
            }
            if (userAlreadyAssigned) {
                throw new Error('User is already assigned to a crew position. A user can only crew one position.');
            }
            role.assignedUserIds.push(userId);
            role.assignedUserNames.push(userName);
            role.filled = role.assignedUserIds.length;
            if (role.assignedUserIds.length === 1) {
                role.assignedUserId = userId;
                role.assignedUserName = userName;
            }
            const totalFilled = job.shipCrewBreakdown.reduce((sum, s) => sum + s.roles.reduce((rs, r) => rs + r.filled, 0), 0);
            job.crewSpotsFilled = totalFilled;
            const saved = await queryRunner.manager.save(PublicJobListing_1.PublicJobListing, job);
            logger_1.logger.info(`Assigned crew role: ${userName} as ${role.role} on ${ship.shipName}`, {
                jobId,
                shipIndex,
                roleIndex,
                userId,
            });
            return saved;
        });
    }
    async unassignCrewRole(jobId, shipIndex, roleIndex) {
        return this.withJobLock(jobId, async (job, queryRunner) => {
            if (!job.shipCrewBreakdown || job.shipCrewBreakdown.length === 0) {
                throw new Error('Job listing has no ship crew breakdown');
            }
            const ship = job.shipCrewBreakdown[shipIndex];
            if (!ship) {
                throw new Error('Invalid ship index');
            }
            const role = ship.roles[roleIndex];
            if (!role) {
                throw new Error('Invalid role index');
            }
            role.assignedUserIds ??= [];
            role.assignedUserNames ??= [];
            role.assignedUserIds = [];
            role.assignedUserNames = [];
            role.filled = 0;
            role.assignedUserId = null;
            role.assignedUserName = null;
            const totalFilled = job.shipCrewBreakdown.reduce((sum, s) => sum + s.roles.reduce((rs, r) => rs + r.filled, 0), 0);
            job.crewSpotsFilled = totalFilled;
            const saved = await queryRunner.manager.save(PublicJobListing_1.PublicJobListing, job);
            logger_1.logger.info(`Unassigned crew role: ${role.role} on ${ship.shipName}`, {
                jobId,
                shipIndex,
                roleIndex,
            });
            return saved;
        });
    }
    async markShipAsLoaner(jobId, shipIndex, contributorUserId, contributorUserName) {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            throw new Error('Job listing not found');
        }
        if (!job.shipCrewBreakdown) {
            throw new Error('No ship crew breakdown');
        }
        const ship = job.shipCrewBreakdown[shipIndex];
        if (!ship) {
            throw new Error('Invalid ship index');
        }
        ship.isLoaner = true;
        ship.contributedByUserId = contributorUserId;
        ship.contributedByUserName = contributorUserName;
        const saved = await this.jobRepository.save(job);
        logger_1.logger.info(`Marked ship as loaner: ${ship.shipName} by ${contributorUserName}`, {
            jobId,
            shipIndex,
        });
        return saved;
    }
    static calculateCrewTotal(requirements) {
        let totalCrew = 0;
        for (const req of requirements) {
            if (req.requirementType === 'specific') {
                totalCrew += req.count * (req.crewPerShip || 1);
            }
            else if (req.requirementType === 'role') {
                totalCrew += req.count * (req.avgCrewPerShip || 1);
            }
        }
        return totalCrew;
    }
}
exports.PublicJobListingService = PublicJobListingService;
//# sourceMappingURL=PublicJobListingService.js.map