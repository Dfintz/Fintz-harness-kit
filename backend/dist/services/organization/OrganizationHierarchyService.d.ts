import { Organization } from '../../models/Organization';
interface HierarchyValidation {
    valid: boolean;
    errors: string[];
}
export declare class OrganizationHierarchyService {
    private readonly organizationRepository;
    private readonly MAX_DEPTH;
    createSubOrganization(parentId: string, orgData: Partial<Organization>): Promise<Organization>;
    private determineTypeByLevel;
    getAncestors(orgId: string): Promise<Organization[]>;
    getDescendants(orgId: string, maxDepth?: number): Promise<Organization[]>;
    getChildren(orgId: string): Promise<Organization[]>;
    getRoot(orgId: string): Promise<Organization>;
    getRootOrganizations(): Promise<Organization[]>;
    getSiblings(orgId: string, includeSelf?: boolean): Promise<Organization[]>;
    getTree(rootId: string): Promise<Organization & {
        children?: Organization[];
    }>;
    private buildTree;
    moveOrganization(orgId: string, newParentId: string | null): Promise<Organization>;
    detachFromParent(orgId: string): Promise<Organization>;
    deleteOrganization(orgId: string, deleteDescendants?: boolean): Promise<void>;
    private updateDescendantPaths;
    private updateChildCount;
    validateHierarchy(orgId: string): Promise<HierarchyValidation>;
    repairHierarchy(orgId: string): Promise<{
        repaired: boolean;
        fixes: string[];
    }>;
    getHierarchyStats(orgId: string): Promise<{
        depth: number;
        totalDescendants: number;
        directChildren: number;
        totalMembers: number;
        organizationsByLevel: Record<number, number>;
    }>;
}
export {};
//# sourceMappingURL=OrganizationHierarchyService.d.ts.map