"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowController = void 0;
const WorkflowService_1 = require("../../services/workflow/WorkflowService");
const BaseController_1 = require("../BaseController");
class WorkflowController extends BaseController_1.BaseController {
    workflowService;
    constructor() {
        super();
        this.workflowService = new WorkflowService_1.WorkflowService();
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { type, enabled, status } = req.query;
            const { page, limit } = this.getPaginationParams(req);
            const { workflows, total } = await this.workflowService.listWorkflows(organizationId, {
                type,
                enabled: enabled === undefined ? undefined : enabled === 'true',
                status,
            });
            res.json({
                success: true,
                ...this.createPaginatedResponse(workflows, total, page, limit),
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const workflow = await this.workflowService.createWorkflow(organizationId, userId, req.body);
            res.status(201).json({ success: true, data: workflow });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { workflowId } = req.params;
            const workflow = await this.workflowService.getWorkflow(workflowId, organizationId);
            if (!workflow) {
                res.status(404).json({ success: false, error: 'Workflow not found' });
                return;
            }
            res.json({ success: true, data: workflow });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { workflowId } = req.params;
            const workflow = await this.workflowService.updateWorkflow(workflowId, organizationId, userId, req.body);
            res.json({ success: true, data: workflow });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { workflowId } = req.params;
            await this.workflowService.deleteWorkflow(workflowId, organizationId, userId);
            res.json({ success: true, message: `Workflow ${workflowId} deleted` });
        });
    };
    execute_ = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { workflowId } = req.params;
            const { parameters, dryRun } = req.body;
            const execution = await this.workflowService.executeWorkflow(workflowId, organizationId, userId, parameters, dryRun ?? false);
            res.json({ success: true, data: execution });
        });
    };
    getExecutions = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { workflowId } = req.params;
            const { executions, total } = await this.workflowService.getExecutions(workflowId, organizationId);
            res.json({ success: true, data: executions, meta: { total } });
        });
    };
    enable = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { workflowId } = req.params;
            const workflow = await this.workflowService.setEnabled(workflowId, organizationId, userId, true);
            res.json({ success: true, data: workflow });
        });
    };
    disable = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { workflowId } = req.params;
            const workflow = await this.workflowService.setEnabled(workflowId, organizationId, userId, false);
            res.json({ success: true, data: workflow });
        });
    };
}
exports.WorkflowController = WorkflowController;
//# sourceMappingURL=workflowController.js.map