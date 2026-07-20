export interface ProvisionStarCommsInput {
    activityId: string;
    integrationId: string;
    userId: string;
    userName: string;
    organizationId: string;
    dryRun?: boolean;
}
export interface ProvisionStarCommsResult {
    activityId: string;
    integrationId: string;
    dryRun: boolean;
    operation: {
        success: boolean;
        operationId?: string;
        message?: string;
    };
    assignments: {
        synced: boolean;
        participantCount: number;
        message?: string;
    };
}
export declare class ActivityStarCommsOrchestrationService {
    private readonly activityService;
    private readonly participantService;
    private readonly integrationService;
    private readonly fleetService;
    private readonly starCommsAdapter;
    provisionFromActivity(input: ProvisionStarCommsInput): Promise<ProvisionStarCommsResult>;
    private requireActivityInOrganization;
    private requireManagePermission;
    private requireStarCommsIntegration;
    private buildOperationPayload;
}
//# sourceMappingURL=ActivityStarCommsOrchestrationService.d.ts.map