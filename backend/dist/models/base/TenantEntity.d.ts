import { Organization } from '../Organization';
export declare abstract class TenantEntity {
    organizationId: string;
    organization: Organization;
    sharedWithOrgs?: string[];
    deletedAt?: Date | null;
    deletedBy?: string;
    isSharedWith(targetOrgId: string): boolean;
    canAccessFromOrg(requestingOrgId: string, accessLevel: 'read' | 'write' | 'delete'): boolean;
    addSharedOrg(targetOrgId: string): void;
    removeSharedOrg(targetOrgId: string): void;
    isOwnedBy(organizationId: string): boolean;
    getAccessibleOrgs(): string[];
    isSoftDeleted(): boolean;
    isNotDeleted(): boolean;
}
//# sourceMappingURL=TenantEntity.d.ts.map