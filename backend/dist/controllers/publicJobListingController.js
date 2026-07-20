"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicJobListingController = void 0;
const data_source_1 = require("../data-source");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const PublicJobListing_1 = require("../models/PublicJobListing");
const PublicOrgProfile_1 = require("../models/PublicOrgProfile");
const OrganizationFederationService_1 = require("../services/organization/OrganizationFederationService");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const PublicJobListingService_1 = require("../services/organization/PublicJobListingService");
const apiErrors_1 = require("../utils/apiErrors");
const controllerHelpers_1 = require("../utils/controllerHelpers");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
function parseCommaSeparated(value) {
    if (!value) {
        return [];
    }
    return typeof value === 'string' ? value.split(',').map(v => v.trim()) : value;
}
function parseJobListingFilters(query) {
    const filters = {};
    if (query.organizationId) {
        filters.organizationId = query.organizationId;
    }
    if (query.allianceId) {
        filters.allianceId = query.allianceId;
    }
    if (query.ownerType) {
        filters.ownerType = query.ownerType;
    }
    if (query.jobTypes) {
        filters.jobTypes = parseCommaSeparated(query.jobTypes);
    }
    if (query.focuses) {
        filters.focuses = parseCommaSeparated(query.focuses);
    }
    if (query.payTypes) {
        filters.payTypes = parseCommaSeparated(query.payTypes);
    }
    if (query.minPay) {
        filters.minPay = Number.parseInt(query.minPay, 10);
    }
    if (query.maxPay) {
        filters.maxPay = Number.parseInt(query.maxPay, 10);
    }
    if (query.maxExperienceLevel) {
        filters.maxExperienceLevel = Number.parseInt(query.maxExperienceLevel, 10);
    }
    const searchTerm = (0, controllerHelpers_1.parseSearchTerm)(query);
    if (searchTerm) {
        filters.searchTerm = searchTerm;
    }
    if (query.isActive !== undefined) {
        filters.isActive = query.isActive === 'true';
    }
    if (query.includeExpired !== undefined) {
        filters.includeExpired = query.includeExpired === 'true';
    }
    if (query.listingCategory) {
        filters.listingCategory = query.listingCategory;
    }
    return filters;
}
const JOB_LISTING_ALLOWED_FIELDS = [
    'title',
    'description',
    'jobType',
    'focus',
    'payType',
    'payMin',
    'payMax',
    'experienceLevel',
    'expiresAt',
    'contactInfo',
    'timezone',
    'languages',
    'tags',
    'listingCategory',
    'shipRequirementType',
    'requiredShips',
    'crewSpotsTotal',
];
class PublicJobListingController extends BaseController_1.BaseController {
    jobService = new PublicJobListingService_1.PublicJobListingService();
    federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    async verifyJobPermission(userId, organizationId, action, errorMessage) {
        if (!userId) {
            throw new apiErrors_1.UnauthorizedError('Authentication required');
        }
        const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.RECRUITMENT, action);
        if (!hasPermission.allowed) {
            throw new apiErrors_1.ForbiddenError(errorMessage);
        }
    }
    async getJobAndVerifyPermission(jobId, userId, action, errorMessage) {
        if (!userId) {
            throw new apiErrors_1.UnauthorizedError('Authentication required');
        }
        const existingJob = await this.jobService.getJobListing(jobId);
        if (!existingJob) {
            throw new apiErrors_1.NotFoundError('Job listing');
        }
        if (existingJob.ownerType === PublicJobListing_1.ListingOwnerType.ORGANIZATION && existingJob.organizationId) {
            await this.verifyJobPermission(userId, existingJob.organizationId, action, errorMessage);
        }
        return existingJob;
    }
    getJobListings = async (req, res) => {
        await this.execute(req, res, async () => {
            const filters = parseJobListingFilters(req.query);
            const pagination = (0, controllerHelpers_1.parsePaginationParams)(req.query);
            const result = await this.jobService.getPublicJobListings(filters, pagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    getJobListing = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const job = await this.jobService.getJobListing(jobId);
            if (!job) {
                throw new apiErrors_1.NotFoundError('Job listing');
            }
            res.json({
                success: true,
                data: job,
            });
        });
    };
    getJobStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const stats = await this.jobService.getJobListingStats();
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    getFilterOptions = async (req, res) => {
        await this.execute(req, res, async () => {
            res.json({
                success: true,
                data: {
                    jobTypeOptions: this.jobService.getJobTypeOptions(),
                    payTypeOptions: this.jobService.getPayTypeOptions(),
                    focusOptions: Object.values(PublicOrgProfile_1.OrgPrimaryFocus),
                    ownerTypeOptions: Object.values(PublicJobListing_1.ListingOwnerType),
                },
            });
        });
    };
    getOrganizationJobCount = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const count = await this.jobService.getOrganizationJobCount(organizationId);
            res.json({
                success: true,
                data: { organizationId, count },
            });
        });
    };
    getAllianceJobCount = async (req, res) => {
        await this.execute(req, res, async () => {
            const { federationId } = req.params;
            const count = await this.jobService.getAllianceJobCount(federationId);
            res.json({
                success: true,
                data: { allianceId: federationId, count },
            });
        });
    };
    createOrganizationJob = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const userId = req.user?.id;
            await this.verifyJobPermission(userId, organizationId, OrganizationPermission_1.PermissionAction.EDIT, 'Insufficient permissions to create job listings');
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, JOB_LISTING_ALLOWED_FIELDS);
            const input = {
                ...safeBody,
                organizationId,
                ownerType: PublicJobListing_1.ListingOwnerType.ORGANIZATION,
                createdBy: userId,
            };
            const job = await this.jobService.createJobListing(input);
            res.status(201).json({
                success: true,
                message: 'Job listing created successfully',
                data: job,
            });
        });
    };
    createAllianceJob = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: allianceId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const alliance = await this.federationService.getFederation(allianceId);
            if (!alliance) {
                throw new apiErrors_1.NotFoundError('Alliance');
            }
            const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
            const userMemberships = await membershipRepo.find({
                where: { userId, isActive: true },
                select: ['organizationId'],
            });
            const userOrgIds = new Set(userMemberships.map(m => m.organizationId));
            const leaderMembers = alliance.members.filter(m => ['founder', 'leader', 'council'].includes(m.role));
            const userIsLeader = leaderMembers.some(member => userOrgIds.has(member.organizationId));
            if (!userIsLeader) {
                throw new apiErrors_1.ForbiddenError('Only leaders of member organizations can create alliance job listings');
            }
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, JOB_LISTING_ALLOWED_FIELDS);
            const input = {
                ...safeBody,
                allianceId,
                ownerType: PublicJobListing_1.ListingOwnerType.ALLIANCE,
                createdBy: userId,
            };
            const job = await this.jobService.createJobListing(input);
            res.status(201).json({
                success: true,
                message: 'Alliance job listing created successfully',
                data: job,
            });
        });
    };
    createUserJob = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, JOB_LISTING_ALLOWED_FIELDS);
            const input = {
                ...safeBody,
                ownerType: PublicJobListing_1.ListingOwnerType.USER,
                createdBy: userId,
            };
            const job = await this.jobService.createJobListing(input);
            res.status(201).json({
                success: true,
                message: 'Job listing created successfully',
                data: job,
            });
        });
    };
    getOrganizationJobs = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const { includeInactive } = req.query;
            const userId = req.user?.id;
            await this.verifyJobPermission(userId, organizationId, OrganizationPermission_1.PermissionAction.VIEW, 'Insufficient permissions to view job listings');
            const jobs = await this.jobService.getOrganizationListings(organizationId, includeInactive === 'true');
            res.json({
                success: true,
                data: jobs,
            });
        });
    };
    updateJobListing = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const userId = req.user?.id;
            await this.getJobAndVerifyPermission(jobId, userId, OrganizationPermission_1.PermissionAction.EDIT, 'Insufficient permissions to update job listing');
            const input = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, JOB_LISTING_ALLOWED_FIELDS);
            const job = await this.jobService.updateJobListing(jobId, input);
            res.json({
                success: true,
                message: 'Job listing updated successfully',
                data: job,
            });
        });
    };
    deleteJobListing = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const userId = req.user?.id;
            await this.getJobAndVerifyPermission(jobId, userId, OrganizationPermission_1.PermissionAction.DELETE, 'Insufficient permissions to delete job listing');
            await this.jobService.deleteJobListing(jobId);
            res.json({
                success: true,
                message: 'Job listing deleted successfully',
            });
        });
    };
    assignCrewRole = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const authUserId = req.user?.id;
            await this.getJobAndVerifyPermission(jobId, authUserId, OrganizationPermission_1.PermissionAction.EDIT, 'Insufficient permissions to assign crew');
            const { shipIndex, roleIndex, userId, userName } = req.body;
            if (shipIndex === undefined || roleIndex === undefined || !userId || !userName) {
                throw new Error('shipIndex, roleIndex, userId, and userName are required');
            }
            const updated = await this.jobService.assignCrewRole(jobId, shipIndex, roleIndex, userId, userName);
            res.json({
                success: true,
                message: 'Crew role assigned successfully',
                data: updated,
            });
        });
    };
    unassignCrewRole = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const authUserId = req.user?.id;
            await this.getJobAndVerifyPermission(jobId, authUserId, OrganizationPermission_1.PermissionAction.EDIT, 'Insufficient permissions to unassign crew');
            const { shipIndex, roleIndex } = req.body;
            if (shipIndex === undefined || roleIndex === undefined) {
                throw new Error('shipIndex and roleIndex are required');
            }
            const updated = await this.jobService.unassignCrewRole(jobId, shipIndex, roleIndex);
            res.json({
                success: true,
                message: 'Crew role unassigned successfully',
                data: updated,
            });
        });
    };
    cancelJobListing = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const userId = req.user?.id;
            await this.getJobAndVerifyPermission(jobId, userId, OrganizationPermission_1.PermissionAction.EDIT, 'Insufficient permissions to cancel job listing');
            await this.jobService.deactivateJobListing(jobId);
            res.json({
                success: true,
                message: 'Job listing cancelled successfully',
            });
        });
    };
}
exports.PublicJobListingController = PublicJobListingController;
//# sourceMappingURL=publicJobListingController.js.map