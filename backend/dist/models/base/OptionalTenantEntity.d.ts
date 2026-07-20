import { Organization } from '../Organization';
export declare abstract class OptionalTenantEntity {
    organizationId: string | null;
    organization?: Organization | null;
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
//# sourceMappingURL=OptionalTenantEntity.d.ts.map