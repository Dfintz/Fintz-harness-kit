"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgApplicationController = void 0;
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const OrgApplication_1 = require("../models/OrgApplication");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const OrgApplicationService_1 = require("../services/organization/OrgApplicationService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class OrgApplicationController extends BaseController_1.BaseController {
    service = new OrgApplicationService_1.OrgApplicationService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    async verifyReviewPermission(userId, orgId) {
        const result = await this.permissionService.checkPermission(userId, orgId, OrganizationPermission_1.ResourceType.RECRUITMENT, OrganizationPermission_1.PermissionAction.APPROVE);
        if (!result.allowed) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to manage applications');
        }
    }
    getApplicationMode = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            const modeInfo = await this.service.getApplicationMode(orgId);
            return { success: true, data: modeInfo };
        });
    };
    submitApplication = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const { message, formResponses, source } = req.body;
            const application = await this.service.apply(orgId, user.id, message, formResponses, source);
            return { success: true, data: application };
        }, 201);
    };
    getApplications = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            await this.verifyReviewPermission(user.id, orgId);
            const rawStatus = req.query.status;
            const status = rawStatus && Object.values(OrgApplication_1.OrgApplicationStatus).includes(rawStatus)
                ? rawStatus
                : undefined;
            const page = Number.parseInt(req.query.page, 10) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 200);
            const result = await this.service.getApplicationsForOrg(orgId, {
                status,
                page,
                limit,
            });
            res.json({
                success: true,
                data: result.data,
                meta: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages,
                },
            });
        });
    };
    getMyApplications = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const applications = await this.service.getMyApplications(user.id);
            res.json({
                success: true,
                data: applications,
            });
        });
    };
    reviewApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, id } = req.params;
            await this.verifyReviewPermission(user.id, orgId);
            const { decision, note } = req.body;
            const updated = await this.service.reviewApplication(id, orgId, user.id, decision, note);
            res.json({
                success: true,
                message: `Application ${decision}`,
                data: updated,
            });
        });
    };
    withdrawApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { id } = req.params;
            const updated = await this.service.withdrawApplication(id, user.id);
            res.json({
                success: true,
                message: 'Application withdrawn',
                data: updated,
            });
        });
    };
    checkActiveApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const [hasActive, isMember] = await Promise.all([
                this.service.hasActiveApplication(orgId, user.id),
                this.service.isMember(orgId, user.id),
            ]);
            res.json({
                success: true,
                data: { hasActiveApplication: hasActive, isMember },
            });
        });
    };
}
exports.OrgApplicationController = OrgApplicationController;
//# sourceMappingURL=orgApplicationController.js.map