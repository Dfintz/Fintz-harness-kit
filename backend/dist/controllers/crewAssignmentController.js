"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrewAssignmentController = void 0;
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const crew_1 = require("../services/crew");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const permissionHelpers_1 = require("../utils/permissionHelpers");
const BaseController_1 = require("./BaseController");
class CrewAssignmentController extends BaseController_1.BaseController {
    service = new crew_1.CrewAssignmentService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    constructor() {
        super();
    }
    async verifyFleetPermission(userId, organizationId, action = OrganizationPermission_1.PermissionAction.MANAGE) {
        const actionText = action === OrganizationPermission_1.PermissionAction.VIEW ? 'view' : 'manage';
        await (0, permissionHelpers_1.requirePermission)(this.permissionService, organizationId, userId, OrganizationPermission_1.ResourceType.FLEET, action, {
            customMessage: `You do not have permission to ${actionText} crew assignments`,
        });
    }
    getOrgId(req) {
        const orgId = req.user?.currentOrganizationId;
        if (!orgId) {
            throw new apiErrors_1.ForbiddenError('No active organization selected');
        }
        return orgId;
    }
    getUserId(req) {
        const userId = req.user?.id;
        if (!userId) {
            throw new apiErrors_1.UnauthorizedError('Authentication required');
        }
        return userId;
    }
    createAssignment = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrgId(authReq);
            const userId = this.getUserId(authReq);
            await this.verifyFleetPermission(userId, organizationId);
            const input = req.body;
            const assignment = await this.service.createAssignment(organizationId, userId, input);
            return assignment;
        }, 201);
    };
    getAssignments = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrgId(authReq);
            const userId = this.getUserId(authReq);
            await this.verifyFleetPermission(userId, organizationId, OrganizationPermission_1.PermissionAction.VIEW);
            const pagination = (0, pagination_1.extractPaginationOptions)(req);
            return this.service.getAssignments(organizationId, pagination);
        });
    };
    getAssignmentById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrgId(authReq);
            const userId = this.getUserId(authReq);
            await this.verifyFleetPermission(userId, organizationId, OrganizationPermission_1.PermissionAction.VIEW);
            return this.service.getAssignmentById(organizationId, req.params.id);
        });
    };
    addCrewMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrgId(authReq);
            await this.verifyFleetPermission(this.getUserId(authReq), organizationId);
            const input = req.body;
            return this.service.addCrewMember(organizationId, req.params.id, input);
        });
    };
    removeCrewMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrgId(authReq);
            await this.verifyFleetPermission(this.getUserId(authReq), organizationId);
            return this.service.removeCrewMember(organizationId, req.params.id, req.params.userId);
        });
    };
    updateStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrgId(authReq);
            await this.verifyFleetPermission(this.getUserId(authReq), organizationId);
            const { status } = req.body;
            return this.service.updateStatus(organizationId, req.params.id, status);
        });
    };
}
exports.CrewAssignmentController = CrewAssignmentController;
//# sourceMappingURL=crewAssignmentController.js.map