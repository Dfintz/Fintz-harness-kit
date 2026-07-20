"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalController = void 0;
const ApprovalRequest_1 = require("../../models/ApprovalRequest");
const ApprovalService_1 = require("../../services/approval/ApprovalService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
const ROLE_CHANGE_TYPE = ApprovalRequest_1.ApprovalRequestType.ROLE_CHANGE;
class ApprovalController extends BaseController_1.BaseController {
    approvalService;
    constructor() {
        super();
        this.approvalService = new ApprovalService_1.ApprovalService();
    }
    async assertNotRoleChange(organizationId, approvalId) {
        const approval = await this.approvalService.getApproval(approvalId, organizationId);
        if (approval?.type === ROLE_CHANGE_TYPE) {
            throw new apiErrors_1.ForbiddenError('Role change requests must be managed via /api/v2/role-requests');
        }
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { status, type, assignedTo } = req.query;
            const { page, limit } = this.getPaginationParams(req);
            const { approvals, total } = await this.approvalService.listApprovals(organizationId, {
                status,
                type,
                assignedTo,
            });
            res.json({
                success: true,
                ...this.createPaginatedResponse(approvals, total, page, limit),
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const approval = await this.approvalService.createApproval(organizationId, user.id, req.body);
            res.status(201).json({ success: true, data: approval });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { approvalId } = req.params;
            const approval = await this.approvalService.getApproval(approvalId, organizationId);
            if (!approval) {
                res.status(404).json({ success: false, error: 'Approval request not found' });
                return;
            }
            res.json({ success: true, data: approval });
        });
    };
    approve = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { approvalId } = req.params;
            const { comment } = req.body;
            await this.assertNotRoleChange(organizationId, approvalId);
            const approval = await this.approvalService.approve(approvalId, organizationId, user.id, comment);
            res.json({ success: true, data: approval });
        });
    };
    reject = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { approvalId } = req.params;
            const { reason } = req.body;
            await this.assertNotRoleChange(organizationId, approvalId);
            const approval = await this.approvalService.reject(approvalId, organizationId, user.id, reason);
            res.json({ success: true, data: approval });
        });
    };
    delegate = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { approvalId } = req.params;
            const { userId } = req.body;
            await this.assertNotRoleChange(organizationId, approvalId);
            const approval = await this.approvalService.delegate(approvalId, organizationId, user.id, userId);
            res.json({ success: true, data: approval });
        });
    };
    getHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { approvalId } = req.params;
            const approval = await this.approvalService.getApproval(approvalId, organizationId);
            if (!approval) {
                res.status(404).json({ success: false, error: 'Approval request not found' });
                return;
            }
            res.json({
                success: true,
                data: { approvalId, history: approval.history ?? [] },
            });
        });
    };
    getPending = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const pending = await this.approvalService.getPending(organizationId, user.id);
            res.json({ success: true, data: pending });
        });
    };
}
exports.ApprovalController = ApprovalController;
//# sourceMappingURL=approvalController.js.map