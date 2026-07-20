"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobApplicationController = void 0;
const JobApplication_1 = require("../models/JobApplication");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const PublicJobListing_1 = require("../models/PublicJobListing");
const JobApplicationService_1 = require("../services/organization/JobApplicationService");
const OrganizationFederationService_1 = require("../services/organization/OrganizationFederationService");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const PublicJobListingService_1 = require("../services/organization/PublicJobListingService");
const apiErrors_1 = require("../utils/apiErrors");
const permissionHelpers_1 = require("../utils/permissionHelpers");
const BaseController_1 = require("./BaseController");
class JobApplicationController extends BaseController_1.BaseController {
    appService = new JobApplicationService_1.JobApplicationService();
    jobService = new PublicJobListingService_1.PublicJobListingService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    getAuthenticatedUserId(req) {
        const userId = req.user?.id;
        if (!userId) {
            throw new apiErrors_1.UnauthorizedError('Authentication required');
        }
        return userId;
    }
    applyToJob = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const { jobId } = req.params;
            const { applicationType, message, shipIndex, roleIndex, passengerShipIndex, passengerRole, vehicleName, formResponses, } = req.body;
            const displayName = req.user?.username ?? 'Unknown';
            const input = {
                jobListingId: jobId,
                applicantUserId: userId,
                applicantDisplayName: displayName,
                applicationType: applicationType,
                message,
                shipIndex,
                roleIndex,
                passengerShipIndex,
                passengerRole,
                vehicleName,
                formResponses,
            };
            const application = await this.appService.apply(input);
            res.status(201).json({
                success: true,
                message: application.status === JobApplication_1.JobApplicationStatus.WAITLISTED
                    ? 'You have been added to the waitlist'
                    : 'Application submitted successfully',
                data: application,
            });
        });
    };
    reviewApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const { jobId, applicationId } = req.params;
            await this.requireListingAccess(userId, jobId);
            const { status, reviewNote } = req.body;
            const input = {
                status: status,
                reviewedBy: userId,
                reviewNote,
            };
            const updated = await this.appService.reviewApplication(applicationId, input);
            res.json({
                success: true,
                message: `Application ${status}`,
                data: updated,
            });
        });
    };
    withdrawApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const { applicationId } = req.params;
            const updated = await this.appService.withdrawApplication(applicationId, userId);
            res.json({
                success: true,
                message: 'Application withdrawn',
                data: updated,
            });
        });
    };
    getApplicationsForJob = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const { jobId } = req.params;
            await this.requireListingAccess(userId, jobId);
            const statusFilter = req.query.status;
            const applications = await this.appService.getApplicationsForJob(jobId, statusFilter);
            res.json({
                success: true,
                data: applications,
            });
        });
    };
    getMyApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const { jobId } = req.params;
            const application = await this.appService.hasUserApplied(userId, jobId);
            res.json({
                success: true,
                data: application,
            });
        });
    };
    getMyApplications = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const applications = await this.appService.getApplicationsByUser(userId);
            res.json({
                success: true,
                data: applications,
            });
        });
    };
    getWaitlist = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthenticatedUserId(req);
            const { jobId } = req.params;
            await this.requireListingAccess(userId, jobId);
            const waitlist = await this.appService.getWaitlist(jobId);
            res.json({
                success: true,
                data: waitlist,
            });
        });
    };
    async requireListingAccess(userId, jobId) {
        const job = await this.jobService.getJobListingInternal(jobId);
        if (!job) {
            throw new apiErrors_1.NotFoundError('Job listing');
        }
        if (job.ownerType === PublicJobListing_1.ListingOwnerType.ORGANIZATION && job.organizationId) {
            await (0, permissionHelpers_1.requirePermission)(this.permissionService, job.organizationId, userId, OrganizationPermission_1.ResourceType.RECRUITMENT, OrganizationPermission_1.PermissionAction.EDIT, {
                customMessage: 'Insufficient permissions to manage applications',
            });
            return;
        }
        if (job.ownerType === PublicJobListing_1.ListingOwnerType.ALLIANCE && job.allianceId) {
            const hasAllianceManageAccess = await this.federationService.hasAllianceManageAccess(job.allianceId, userId);
            if (!hasAllianceManageAccess) {
                throw new apiErrors_1.ForbiddenError('Only leaders of active member organizations can manage alliance job applications');
            }
            return;
        }
        if (job.createdBy !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the listing creator can manage applications');
        }
    }
}
exports.JobApplicationController = JobApplicationController;
//# sourceMappingURL=jobApplicationController.js.map