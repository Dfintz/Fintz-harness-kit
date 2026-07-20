"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleRequestController = void 0;
const RoleRequestService_1 = require("../../services/organization/RoleRequestService");
const BaseController_1 = require("../BaseController");
class RoleRequestController extends BaseController_1.BaseController {
    roleRequestService;
    constructor() {
        super();
        this.roleRequestService = new RoleRequestService_1.RoleRequestService();
    }
    listPending = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const approvals = await this.roleRequestService.listPendingForApprover(organizationId, user.id);
            res.json({ success: true, data: approvals });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { roleId, reason } = req.body;
            const approval = await this.roleRequestService.requestRoleChange(organizationId, user.id, roleId, reason);
            res.status(201).json({ success: true, data: approval });
        });
    };
    approve = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { approvalId } = req.params;
            const { comment } = req.body;
            const approval = await this.roleRequestService.approveRoleChange(organizationId, approvalId, user.id, comment);
            res.json({ success: true, data: approval });
        });
    };
    reject = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { approvalId } = req.params;
            const { reason } = req.body;
            const approval = await this.roleRequestService.rejectRoleChange(organizationId, approvalId, user.id, reason);
            res.json({ success: true, data: approval });
        });
    };
}
exports.RoleRequestController = RoleRequestController;
//# sourceMappingURL=roleRequestController.js.map