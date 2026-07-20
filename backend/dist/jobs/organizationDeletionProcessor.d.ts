export declare class OrganizationDeletionProcessorJob {
    private readonly deletionService;
    constructor();
    execute(): Promise<void>;
    private executeUnlocked;
    getStats(): Promise<{
        pendingApproval: number;
        readyForExecution: number;
    }>;
}
export declare const organizationDeletionProcessor: OrganizationDeletionProcessorJob;
export declare function runOrganizationDeletionProcessor(): Promise<void>;
export interface OrgDeletionProcessorJobHandle {
    cleanup: () => void;
}
export declare function scheduleOrgDeletionProcessor(): OrgDeletionProcessorJobHandle;
//# sourceMappingURL=organizationDeletionProcessor.d.ts.map