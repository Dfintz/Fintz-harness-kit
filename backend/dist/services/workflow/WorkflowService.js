"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = exports.WorkflowAuditAction = void 0;
const database_1 = require("../../config/database");
const WorkflowDefinition_1 = require("../../models/WorkflowDefinition");
const WorkflowExecution_1 = require("../../models/WorkflowExecution");
const apiErrors_1 = require("../../utils/apiErrors");
const AuditService_1 = require("../audit/AuditService");
var WorkflowAuditAction;
(function (WorkflowAuditAction) {
    WorkflowAuditAction["WORKFLOW_CREATED"] = "WORKFLOW_CREATED";
    WorkflowAuditAction["WORKFLOW_UPDATED"] = "WORKFLOW_UPDATED";
    WorkflowAuditAction["WORKFLOW_DELETED"] = "WORKFLOW_DELETED";
    WorkflowAuditAction["WORKFLOW_EXECUTED"] = "WORKFLOW_EXECUTED";
    WorkflowAuditAction["WORKFLOW_ENABLED"] = "WORKFLOW_ENABLED";
    WorkflowAuditAction["WORKFLOW_DISABLED"] = "WORKFLOW_DISABLED";
})(WorkflowAuditAction || (exports.WorkflowAuditAction = WorkflowAuditAction = {}));
class WorkflowService {
    workflowRepo = database_1.AppDataSource.getRepository(WorkflowDefinition_1.WorkflowDefinition);
    executionRepo = database_1.AppDataSource.getRepository(WorkflowExecution_1.WorkflowExecution);
    audit(action, organizationId, userId, resourceId, details) {
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action,
            message: `${action}: workflow ${resourceId}`,
            userId,
            organizationId,
            resource: `workflow:${resourceId}`,
            metadata: details,
        });
    }
    async listWorkflows(organizationId, filters) {
        const qb = this.workflowRepo
            .createQueryBuilder('wf')
            .where('wf.organizationId = :organizationId', { organizationId })
            .orderBy('wf.createdAt', 'DESC');
        if (filters?.type) {
            qb.andWhere('wf.type = :type', { type: filters.type });
        }
        if (filters?.enabled !== undefined) {
            qb.andWhere('wf.enabled = :enabled', { enabled: filters.enabled });
        }
        if (filters?.status) {
            qb.andWhere('wf.status = :status', { status: filters.status });
        }
        const [workflows, total] = await qb.getManyAndCount();
        return { workflows, total };
    }
    async getWorkflow(workflowId, organizationId) {
        return this.workflowRepo.findOne({ where: { id: workflowId, organizationId } });
    }
    async createWorkflow(organizationId, createdBy, data) {
        if (!data.name?.trim()) {
            throw new apiErrors_1.ValidationError('Workflow name is required');
        }
        if (!data.type?.trim()) {
            throw new apiErrors_1.ValidationError('Workflow type is required');
        }
        if (!data.actions || data.actions.length === 0) {
            throw new apiErrors_1.ValidationError('Workflow must have at least one action');
        }
        for (const action of data.actions) {
            if (!action.type?.trim()) {
                throw new apiErrors_1.ValidationError('Each workflow action must have a type');
            }
        }
        const workflow = this.workflowRepo.create({
            ...data,
            name: data.name.trim(),
            type: data.type.trim(),
            organizationId,
            createdBy,
            enabled: data.enabled !== false,
            status: WorkflowDefinition_1.WorkflowStatus.ACTIVE,
        });
        const saved = await this.workflowRepo.save(workflow);
        this.audit(WorkflowAuditAction.WORKFLOW_CREATED, organizationId, createdBy, saved.id, {
            name: saved.name,
            type: saved.type,
            actionCount: data.actions.length,
        });
        return saved;
    }
    async updateWorkflow(workflowId, organizationId, userId, data) {
        if (data.name !== undefined && !data.name.trim()) {
            throw new apiErrors_1.ValidationError('Workflow name cannot be empty');
        }
        if (data.actions !== undefined && data.actions?.length === 0) {
            throw new apiErrors_1.ValidationError('Workflow must have at least one action');
        }
        const workflow = await this.workflowRepo.findOne({
            where: { id: workflowId, organizationId },
        });
        if (!workflow) {
            throw new apiErrors_1.NotFoundError('Workflow', workflowId);
        }
        Object.assign(workflow, data);
        const saved = await this.workflowRepo.save(workflow);
        this.audit(WorkflowAuditAction.WORKFLOW_UPDATED, organizationId, userId, workflowId, {
            updatedFields: Object.keys(data),
        });
        return saved;
    }
    async deleteWorkflow(workflowId, organizationId, userId) {
        const workflow = await this.workflowRepo.findOne({
            where: { id: workflowId, organizationId },
        });
        if (!workflow) {
            throw new apiErrors_1.NotFoundError('Workflow', workflowId);
        }
        await this.workflowRepo.remove(workflow);
        this.audit(WorkflowAuditAction.WORKFLOW_DELETED, organizationId, userId, workflowId, {
            name: workflow.name,
        });
    }
    async executeWorkflow(workflowId, organizationId, executedBy, parameters, dryRun = false) {
        const workflow = await this.workflowRepo.findOne({
            where: { id: workflowId, organizationId },
        });
        if (!workflow) {
            throw new apiErrors_1.NotFoundError('Workflow', workflowId);
        }
        if (!workflow.enabled) {
            throw new apiErrors_1.ValidationError('Workflow is disabled and cannot be executed');
        }
        const execution = this.executionRepo.create({
            workflowId,
            organizationId,
            executedBy,
            parameters,
            dryRun,
            status: dryRun ? WorkflowExecution_1.ExecutionStatus.COMPLETED : WorkflowExecution_1.ExecutionStatus.PENDING,
            result: dryRun ? { simulated: true, actions: workflow.actions } : undefined,
            completedAt: dryRun ? new Date() : undefined,
        });
        const saved = await this.executionRepo.save(execution);
        this.audit(WorkflowAuditAction.WORKFLOW_EXECUTED, organizationId, executedBy, workflowId, {
            executionId: saved.id,
            dryRun,
            workflowName: workflow.name,
        });
        return saved;
    }
    async getExecutions(workflowId, organizationId) {
        const [executions, total] = await this.executionRepo.findAndCount({
            where: { workflowId, organizationId },
            order: { startedAt: 'DESC' },
        });
        return { executions, total };
    }
    async setEnabled(workflowId, organizationId, userId, enabled) {
        const workflow = await this.workflowRepo.findOne({
            where: { id: workflowId, organizationId },
        });
        if (!workflow) {
            throw new apiErrors_1.NotFoundError('Workflow', workflowId);
        }
        workflow.enabled = enabled;
        workflow.status = enabled ? WorkflowDefinition_1.WorkflowStatus.ACTIVE : WorkflowDefinition_1.WorkflowStatus.INACTIVE;
        const saved = await this.workflowRepo.save(workflow);
        this.audit(enabled ? WorkflowAuditAction.WORKFLOW_ENABLED : WorkflowAuditAction.WORKFLOW_DISABLED, organizationId, userId, workflowId, { name: workflow.name });
        return saved;
    }
}
exports.WorkflowService = WorkflowService;
//# sourceMappingURL=WorkflowService.js.map