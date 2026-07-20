import { Organization } from './Organization';
import { WorkflowExecution } from './WorkflowExecution';
export declare enum WorkflowStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    ARCHIVED = "archived"
}
export interface WorkflowAction {
    type: string;
    config?: Record<string, unknown>;
    order?: number;
}
export declare class WorkflowDefinition {
    id: string;
    organizationId: string;
    organization?: Organization;
    name: string;
    type: string;
    description?: string;
    trigger?: Record<string, unknown>;
    actions: WorkflowAction[];
    enabled: boolean;
    status: string;
    createdBy: string;
    executions?: WorkflowExecution[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=WorkflowDefinition.d.ts.map