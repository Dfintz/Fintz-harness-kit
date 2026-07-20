import { Organization } from '../../models/Organization';
export declare class OrganizationArchiveService {
    private static instance;
    private organizationRepository;
    private userOrgRepository;
    private constructor();
    static getInstance(): OrganizationArchiveService;
    archiveOrganization(organizationId: string, archivedBy: string, reason?: string): Promise<Organization>;
    restoreOrganization(organizationId: string, restoredBy: string): Promise<Organization>;
    permanentlyDelete(organizationId: string, deletedBy: string, minimumArchiveDays?: number): Promise<void>;
    getArchivedOrganizations(): Promise<Organization[]>;
    getOrganizationsPendingDeletion(minimumArchiveDays?: number): Promise<Organization[]>;
    cleanupOldArchivedOrganizations(daysBeforeDeletion?: number, systemUserId?: string): Promise<number>;
}
//# sourceMappingURL=OrganizationArchiveService.d.ts.map