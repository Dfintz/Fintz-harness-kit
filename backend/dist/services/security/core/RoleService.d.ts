import { Role } from '../../../models/Role';
export declare class RoleService {
    private readonly roleRepository;
    private readonly roleCache;
    private readonly roleCacheByName;
    constructor();
    getRoleById(roleId: string): Promise<Role | null>;
    getRoleByName(name: string, organizationId?: string | null): Promise<Role | null>;
    getRoleIdByName(name: string, organizationId?: string | null): Promise<string | null>;
    getOrCreateRole(name: string, organizationId: string | null, description?: string, permissions?: string[], priority?: number): Promise<Role>;
    getDefaultMemberRole(organizationId: string): Promise<Role>;
    getFallbackMemberRoleId(organizationId: string): Promise<string | null>;
    resolveRoleIdWithDefaultFallback(name: string, organizationId: string): Promise<string | null>;
    getOwnerRole(organizationId: string): Promise<Role>;
    getAdminRole(organizationId: string): Promise<Role>;
    getRecruitRole(organizationId: string): Promise<Role>;
    roleNameEquals(role: Role | string | undefined, targetName: string): boolean;
    seedDefaultRolePermissions(organizationId: string, role: Role): Promise<number>;
    seedAllRolePermissions(organizationId: string): Promise<number>;
    getOrganizationRolesWithCounts(organizationId: string): Promise<Array<Role & {
        memberCount: number;
    }>>;
    clearCache(): void;
    initializeOrganizationRoles(organizationId: string): Promise<{
        founder: Role;
        admin: Role;
        senior_officer: Role;
        officer: Role;
        member: Role;
        recruit: Role;
    }>;
}
export declare function getRoleService(): RoleService;
//# sourceMappingURL=RoleService.d.ts.map