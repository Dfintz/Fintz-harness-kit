import { WorkflowDefinition } from './WorkflowDefinition';
export declare enum ExecutionStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare class WorkflowExecution {
    id: string;
    workflowId: string;
    workflow?: WorkflowDefinition;
    organizationId: string;
    executedBy: string;
    status: string;
    dryRun: boolean;
    parameters?: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
}
//# sourceMappingURL=WorkflowExecution.d.ts.map