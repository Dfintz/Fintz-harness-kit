import { AppDataSource } from '../../config/database';
import { WorkflowDefinition, WorkflowStatus } from '../../models/WorkflowDefinition';
import { ExecutionStatus, WorkflowExecution } from '../../models/WorkflowExecution';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditCategory, auditService } from '../audit/AuditService';

/**
 * Workflow audit action types
 */
export enum WorkflowAuditAction {
  WORKFLOW_CREATED = 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED = 'WORKFLOW_UPDATED',
  WORKFLOW_DELETED = 'WORKFLOW_DELETED',
  WORKFLOW_EXECUTED = 'WORKFLOW_EXECUTED',
  WORKFLOW_ENABLED = 'WORKFLOW_ENABLED',
  WORKFLOW_DISABLED = 'WORKFLOW_DISABLED',
}

export class WorkflowService {
  private readonly workflowRepo = AppDataSource.getRepository(WorkflowDefinition);
  private readonly executionRepo = AppDataSource.getRepository(WorkflowExecution);

  private audit(
    action: WorkflowAuditAction,
    organizationId: string,
    userId: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): void {
    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action,
      message: `${action}: workflow ${resourceId}`,
      userId,
      organizationId,
      resource: `workflow:${resourceId}`,
      metadata: details,
    });
  }

  async listWorkflows(
    organizationId: string,
    filters?: { type?: string; enabled?: boolean; status?: string }
  ): Promise<{ workflows: WorkflowDefinition[]; total: number }> {
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

  async getWorkflow(
    workflowId: string,
    organizationId: string
  ): Promise<WorkflowDefinition | null> {
    return this.workflowRepo.findOne({ where: { id: workflowId, organizationId } });
  }

  async createWorkflow(
    organizationId: string,
    createdBy: string,
    data: {
      name: string;
      type: string;
      description?: string;
      trigger?: Record<string, unknown>;
      actions: Array<{ type: string; config?: Record<string, unknown>; order?: number }>;
      enabled?: boolean;
    }
  ): Promise<WorkflowDefinition> {
    if (!data.name?.trim()) {
      throw new ValidationError('Workflow name is required');
    }
    if (!data.type?.trim()) {
      throw new ValidationError('Workflow type is required');
    }
    if (!data.actions || data.actions.length === 0) {
      throw new ValidationError('Workflow must have at least one action');
    }
    for (const action of data.actions) {
      if (!action.type?.trim()) {
        throw new ValidationError('Each workflow action must have a type');
      }
    }

    const workflow = this.workflowRepo.create({
      ...data,
      name: data.name.trim(),
      type: data.type.trim(),
      organizationId,
      createdBy,
      enabled: data.enabled !== false,
      status: WorkflowStatus.ACTIVE,
    });
    const saved = await this.workflowRepo.save(workflow);

    this.audit(WorkflowAuditAction.WORKFLOW_CREATED, organizationId, createdBy, saved.id, {
      name: saved.name,
      type: saved.type,
      actionCount: data.actions.length,
    });

    return saved;
  }

  async updateWorkflow(
    workflowId: string,
    organizationId: string,
    userId: string,
    data: Partial<
      Pick<WorkflowDefinition, 'name' | 'type' | 'description' | 'trigger' | 'actions' | 'enabled'>
    >
  ): Promise<WorkflowDefinition> {
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Workflow name cannot be empty');
    }
    if (data.actions !== undefined && data.actions?.length === 0) {
      throw new ValidationError('Workflow must have at least one action');
    }

    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId, organizationId },
    });
    if (!workflow) {
      throw new NotFoundError('Workflow', workflowId);
    }
    Object.assign(workflow, data);
    const saved = await this.workflowRepo.save(workflow);

    this.audit(WorkflowAuditAction.WORKFLOW_UPDATED, organizationId, userId, workflowId, {
      updatedFields: Object.keys(data),
    });

    return saved;
  }

  async deleteWorkflow(workflowId: string, organizationId: string, userId: string): Promise<void> {
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId, organizationId },
    });
    if (!workflow) {
      throw new NotFoundError('Workflow', workflowId);
    }
    await this.workflowRepo.remove(workflow);

    this.audit(WorkflowAuditAction.WORKFLOW_DELETED, organizationId, userId, workflowId, {
      name: workflow.name,
    });
  }

  async executeWorkflow(
    workflowId: string,
    organizationId: string,
    executedBy: string,
    parameters?: Record<string, unknown>,
    dryRun: boolean = false
  ): Promise<WorkflowExecution> {
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId, organizationId },
    });
    if (!workflow) {
      throw new NotFoundError('Workflow', workflowId);
    }
    if (!workflow.enabled) {
      throw new ValidationError('Workflow is disabled and cannot be executed');
    }

    const execution = this.executionRepo.create({
      workflowId,
      organizationId,
      executedBy,
      parameters,
      dryRun,
      status: dryRun ? ExecutionStatus.COMPLETED : ExecutionStatus.PENDING,
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

  async getExecutions(
    workflowId: string,
    organizationId: string
  ): Promise<{ executions: WorkflowExecution[]; total: number }> {
    const [executions, total] = await this.executionRepo.findAndCount({
      where: { workflowId, organizationId },
      order: { startedAt: 'DESC' },
    });
    return { executions, total };
  }

  async setEnabled(
    workflowId: string,
    organizationId: string,
    userId: string,
    enabled: boolean
  ): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId, organizationId },
    });
    if (!workflow) {
      throw new NotFoundError('Workflow', workflowId);
    }
    workflow.enabled = enabled;
    workflow.status = enabled ? WorkflowStatus.ACTIVE : WorkflowStatus.INACTIVE;
    const saved = await this.workflowRepo.save(workflow);

    this.audit(
      enabled ? WorkflowAuditAction.WORKFLOW_ENABLED : WorkflowAuditAction.WORKFLOW_DISABLED,
      organizationId,
      userId,
      workflowId,
      { name: workflow.name }
    );

    return saved;
  }
}

