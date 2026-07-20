import { OrganizationDeletionRequest } from '../../models/OrganizationDeletionRequest';
export interface DeletionPreview {
    organizationId: string;
    organizationName: string;
    descendantCount: number;
    memberCount: number;
    shipCount: number;
    estimatedDataSize: string;
    willDeleteDescendants: boolean;
}
export interface OrganizationExportData {
    exportMetadata: {
        exportDate: string;
        requestId: string;
        organizationId: string;
        organizationName: string;
        exportVersion: string;
    };
    organization: {
        id: string;
        name: string;
        description?: string;
        type?: string;
        status?: string;
        settings?: Record<string, unknown>;
        createdAt?: string;
        updatedAt?: string;
        [key: string]: unknown;
    };
    members: Array<{
        userId: string;
        role: string;
        title?: string;
        joinedAt?: string;
        permissions?: string[];
        [key: string]: unknown;
    }>;
    ships: Array<{
        id: string;
        shipName?: string;
        shipType?: string;
        [key: string]: unknown;
    }>;
    fleets: Array<{
        id: string;
        name: string;
        description?: string;
        status: string;
        type: string;
        leaderId?: string;
        members: string[];
        shipIds: string[];
        [key: string]: unknown;
    }>;
    teamMembers: Array<{
        id: string;
        userId: string;
        teamId: string;
        rank?: string;
        role: string;
        status: string;
        [key: string]: unknown;
    }>;
    tradingRoutes: Array<{
        id: string;
        name: string;
        description: string;
        stops: Array<Record<string, unknown>>;
        estimatedProfit?: number;
        visibility: string;
        [key: string]: unknown;
    }>;
    organizationInventory: Array<{
        id: string;
        itemName: string;
        category: string;
        quantity: number;
        unit?: string;
        unitValue: number;
        totalValue: number;
        [key: string]: unknown;
    }>;
    fleetInventory: Array<{
        id: string;
        fleetId: string;
        itemName: string;
        category: string;
        quantity: number;
        unit: string;
        [key: string]: unknown;
    }>;
    activities: Array<{
        action: string;
        actorId?: string;
        description?: string;
        timestamp: string;
        [key: string]: unknown;
    }>;
    relationships: Array<{
        relatedOrgId: string;
        relationshipType?: string;
        [key: string]: unknown;
    }>;
    settings: Record<string, unknown>;
    descendants?: Array<{
        id: string;
        name: string;
        type?: string;
        [key: string]: unknown;
    }>;
}
export declare class OrganizationDeletionService {
    private static encryptionKeyWarningLogged;
    private readonly deletionRequestRepository;
    private readonly organizationRepository;
    private readonly membershipRepository;
    private readonly shipRepository;
    private readonly userRepository;
    private readonly archiveService;
    private readonly hierarchyService;
    private readonly activityService;
    private readonly notificationService;
    private readonly blobService;
    private readonly encryptionAlgorithm;
    private readonly encryptionKey;
    private readonly hasValidEncryptionKey;
    constructor();
    createDeletionRequest(organizationId: string, requestedBy: string, options?: {
        reason?: string;
        deleteDescendants?: boolean;
        gracePeriodDays?: number;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<OrganizationDeletionRequest>;
    approveDeletionRequest(requestId: string, approvedBy: string, options?: {
        notes?: string;
        generateExport?: boolean;
    }): Promise<OrganizationDeletionRequest>;
    rejectDeletionRequest(requestId: string, rejectedBy: string, reason: string): Promise<OrganizationDeletionRequest>;
    cancelDeletionRequest(requestId: string, cancelledBy: string, reason?: string): Promise<OrganizationDeletionRequest>;
    executeDeletion(requestId: string): Promise<void>;
    generateDeletionPreview(organizationId: string, deleteDescendants: boolean): Promise<DeletionPreview>;
    generateDataExport(request: OrganizationDeletionRequest): Promise<string>;
    private aggregateOrganizationData;
    private encryptData;
    private uploadExportToBlob;
    private generateSasToken;
    private sendExportNotificationEmail;
    private buildExportEmailContent;
    getPendingRequests(): Promise<OrganizationDeletionRequest[]>;
    getRequestsReadyForExecution(): Promise<OrganizationDeletionRequest[]>;
    getRequestById(requestId: string): Promise<OrganizationDeletionRequest | null>;
    getRequestsForOrganization(organizationId: string): Promise<OrganizationDeletionRequest[]>;
    trackExportDownload(requestId: string): Promise<void>;
    sendEmailVerification(requestId: string): Promise<void>;
    verifyEmailConfirmation(token: string): Promise<OrganizationDeletionRequest>;
    private buildVerificationEmailContent;
}
//# sourceMappingURL=OrganizationDeletionService.d.ts.map