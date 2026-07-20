import { WorkflowDefinition } from '../../models/WorkflowDefinition';
import { WorkflowExecution } from '../../models/WorkflowExecution';
export declare enum WorkflowAuditAction {
    WORKFLOW_CREATED = "WORKFLOW_CREATED",
    WORKFLOW_UPDATED = "WORKFLOW_UPDATED",
    WORKFLOW_DELETED = "WORKFLOW_DELETED",
    WORKFLOW_EXECUTED = "WORKFLOW_EXECUTED",
    WORKFLOW_ENABLED = "WORKFLOW_ENABLED",
    WORKFLOW_DISABLED = "WORKFLOW_DISABLED"
}
export declare class WorkflowService {
    private readonly workflowRepo;
    private readonly executionRepo;
    private audit;
    listWorkflows(organizationId: string, filters?: {
        type?: string;
        enabled?: boolean;
        status?: string;
    }): Promise<{
        workflows: WorkflowDefinition[];
        total: number;
    }>;
    getWorkflow(workflowId: string, organizationId: string): Promise<WorkflowDefinition | null>;
    createWorkflow(organizationId: string, createdBy: string, data: {
        name: string;
        type: string;
        description?: string;
        trigger?: Record<string, unknown>;
        actions: Array<{
            type: string;
            config?: Record<string, unknown>;
            order?: number;
        }>;
        enabled?: boolean;
    }): Promise<WorkflowDefinition>;
    updateWorkflow(workflowId: string, organizationId: string, userId: string, data: Partial<Pick<WorkflowDefinition, 'name' | 'type' | 'description' | 'trigger' | 'actions' | 'enabled'>>): Promise<WorkflowDefinition>;
    deleteWorkflow(workflowId: string, organizationId: string, userId: string): Promise<void>;
    executeWorkflow(workflowId: string, organizationId: string, executedBy: string, parameters?: Record<string, unknown>, dryRun?: boolean): Promise<WorkflowExecution>;
    getExecutions(workflowId: string, organizationId: string): Promise<{
        executions: WorkflowExecution[];
        total: number;
    }>;
    setEnabled(workflowId: string, organizationId: string, userId: string, enabled: boolean): Promise<WorkflowDefinition>;
}
//# sourceMappingURL=WorkflowService.d.ts.map