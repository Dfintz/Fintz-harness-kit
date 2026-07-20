import { Organization, OrganizationStatus, OrganizationType } from '../../models/Organization';
interface BulkOperationResult<T = unknown> {
    successful: number;
    failed: number;
    errors: Array<{
        item: T;
        error: string;
    }>;
    details?: unknown[];
}
export type BulkOperationProgressCallback = (progress: {
    completed: number;
    total: number;
    percentage: number;
    currentItem?: unknown;
    status: 'processing' | 'completed' | 'error';
}) => void;
export interface BulkOperationOptions {
    progressCallback?: BulkOperationProgressCallback;
    batchSize?: number;
    delayBetweenBatches?: number;
}
export declare class OrganizationBulkService {
    private static readonly DEFAULT_BATCH_SIZE;
    private static readonly DEFAULT_BATCH_DELAY_MS;
    private static readonly MIN_MEMBER_COUNT_FOR_DELETION;
    private organizationRepository;
    private membershipRepository;
    private permissionRepository;
    private activityRepository;
    private userRepository;
    private readonly orgPermissionService;
    constructor();
    bulkAddMembers(organizationId: string, members: Array<{
        userId: string;
        role: string;
        permissions?: string[];
        metadata?: Record<string, unknown>;
    }>, actorId: string): Promise<BulkOperationResult>;
    bulkRemoveMembers(organizationId: string, userIds: string[], actorId: string): Promise<BulkOperationResult>;
    bulkUpdateRoles(organizationId: string, updates: Array<{
        userId: string;
        role: string;
    }>, actorId: string): Promise<BulkOperationResult>;
    bulkGrantPermissions(organizationId: string, grants: Array<{
        userId: string;
        permissions: string[];
    }>, actorId: string): Promise<BulkOperationResult>;
    bulkRevokePermissions(organizationId: string, revocations: Array<{
        userId: string;
        permissions: string[];
    }>, actorId: string): Promise<BulkOperationResult>;
    importMembersFromCSV(organizationId: string, csvContent: string, actorId: string): Promise<BulkOperationResult>;
    exportMembersToCSV(organizationId: string): Promise<string>;
    bulkUpdateMetadata(organizationId: string, updates: Array<{
        userId: string;
        metadata: Record<string, unknown>;
    }>, _actorId: string): Promise<BulkOperationResult>;
    bulkCreateOrganizations(orgsData: Array<{
        name: string;
        type?: OrganizationType;
        description?: string;
        status?: OrganizationStatus;
        metadata?: Record<string, unknown>;
    }>, creatorId: string): Promise<{
        success: boolean;
        created: Organization[];
        errors: Array<{
            item: (typeof orgsData)[0];
            error: string;
        }>;
    }>;
    bulkUpdateOrganizations(updates: Array<{
        id: string;
        data: Partial<{
            name?: string;
            description?: string;
            status?: OrganizationStatus;
            metadata?: Record<string, unknown>;
        }>;
    }>): Promise<{
        success: boolean;
        updated: number;
        errors: Array<{
            id: string;
            error: string;
        }>;
    }>;
    bulkDeleteOrganizations(orgIds: string[]): Promise<{
        success: boolean;
        deleted: number;
        errors: Array<{
            id: string;
            error: string;
        }>;
    }>;
    getBulkOperationStats(organizationId: string): Promise<{
        totalMembers: number;
        membersByRole: Record<string, number>;
        recentBulkOperations: number;
        averageOperationSize: number;
    }>;
    private logActivity;
    private recordFailure;
    private processBatch;
    bulkAddMembersWithProgress(organizationId: string, members: Array<{
        userId: string;
        role: string;
        permissions?: string[];
        metadata?: Record<string, unknown>;
    }>, actorId: string, options?: BulkOperationOptions): Promise<BulkOperationResult>;
    bulkInviteMembers(organizationId: string, members: Array<{
        userId: string;
        role: string;
        permissions?: string[];
        metadata?: Record<string, unknown>;
    }>, actorId: string, options?: BulkOperationOptions): Promise<BulkOperationResult>;
}
export {};
//# sourceMappingURL=OrganizationBulkService.d.ts.map