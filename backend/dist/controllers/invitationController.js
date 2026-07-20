"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationController = void 0;
const data_source_1 = require("../data-source");
const Invitation_1 = require("../models/Invitation");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const InvitationService_1 = require("../services/invitation/InvitationService");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const permissionHelpers_1 = require("../utils/permissionHelpers");
const roleUtils_1 = require("../utils/roleUtils");
const BaseController_1 = require("./BaseController");
class InvitationController extends BaseController_1.BaseController {
    service = new InvitationService_1.InvitationService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    async verifyInvitePermission(userId, orgId) {
        await (0, permissionHelpers_1.requirePermission)(this.permissionService, orgId, userId, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.MANAGE, {
            customMessage: 'Insufficient permissions to manage invitations',
        });
    }
    async getInviterRole(userId, orgId) {
        const membership = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).findOne({
            where: { organizationId: orgId, userId, isActive: true },
        });
        return (0, roleUtils_1.getRoleName)(membership?.role) || 'member';
    }
    sendInvitation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const { inviteeUserId, message } = req.body;
            const inviterRole = await this.getInviterRole(user.id, orgId);
            const invitation = await this.service.invite(orgId, inviteeUserId, user.id, inviterRole, message);
            const { token: _token, ...safeInvitation } = invitation;
            return { success: true, data: safeInvitation };
        }, 201);
    };
    getInvitations = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            await this.verifyInvitePermission(user.id, orgId);
            const rawStatus = req.query.status;
            const status = rawStatus && Object.values(Invitation_1.InvitationStatus).includes(rawStatus)
                ? rawStatus
                : undefined;
            const page = Number.parseInt(req.query.page, 10) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 200);
            const result = await this.service.getInvitationsForOrg(orgId, {
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
    getMyInvitations = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const invitations = await this.service.getMyInvitations(user.id);
            res.json({
                success: true,
                data: invitations,
            });
        });
    };
    approveInvitation = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, id } = req.params;
            await this.verifyInvitePermission(user.id, orgId);
            const updated = await this.service.approveInvitation(id, orgId, user.id);
            const { token: _token, ...safeData } = updated;
            res.json({
                success: true,
                message: 'Invitation approved',
                data: safeData,
            });
        });
    };
    rejectInvitation = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, id } = req.params;
            await this.verifyInvitePermission(user.id, orgId);
            const updated = await this.service.rejectInvitation(id, orgId, user.id);
            const { token: _token, ...safeData } = updated;
            res.json({
                success: true,
                message: 'Invitation rejected',
                data: safeData,
            });
        });
    };
    acceptInvitation = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { token } = req.params;
            const updated = await this.service.acceptByToken(token, user.id);
            const { token: _token, ...safeData } = updated;
            res.json({
                success: true,
                message: 'Invitation accepted — you have been added as a member',
                data: safeData,
            });
        });
    };
    acceptInvitationByCode = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { code } = req.params;
            const updated = await this.service.acceptByCode(code, user.id);
            const { token: _token, ...safeData } = updated;
            res.json({
                success: true,
                message: 'Invitation accepted — you have been added as a member',
                data: safeData,
            });
        });
    };
    declineInvitation = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { token } = req.params;
            const updated = await this.service.declineByToken(token, user.id);
            const { token: _token, ...safeData } = updated;
            res.json({
                success: true,
                message: 'Invitation declined',
                data: safeData,
            });
        });
    };
    declineInvitationByCode = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { code } = req.params;
            const updated = await this.service.declineByCode(code, user.id);
            const { token: _token, ...safeData } = updated;
            res.json({
                success: true,
                message: 'Invitation declined',
                data: safeData,
            });
        });
    };
}
exports.InvitationController = InvitationController;
//# sourceMappingURL=invitationController.js.map