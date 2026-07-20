import { RbacPermissions, RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RoleSyncPreview } from './rsiRoleSyncPreview';
export interface RoleMappingTemplate {
    name: string;
    description: string;
    mappings: Array<{
        rsiRank: string;
        rbacPermissions: RbacPermissions;
        priority: number;
        internalRoleName?: string;
        autoAssignTeamNames?: string[];
    }>;
}
export interface CreateRoleMappingInput {
    organizationId: string;
    rsiRank: string;
    discordRoleId?: string;
    rbacPermissions?: RbacPermissions;
    isActive?: boolean;
    priority?: number;
    description?: string;
    internalRoleId?: string;
    autoAssignTeamIds?: string[];
}
export interface UpdateRoleMappingInput {
    discordRoleId?: string;
    rbacPermissions?: RbacPermissions;
    isActive?: boolean;
    priority?: number;
    description?: string;
    internalRoleId?: string;
    autoAssignTeamIds?: string[];
}
export interface BulkMappingResult {
    created: number;
    updated: number;
    failed: number;
    errors: string[];
}
export declare class RsiRoleMappingService {
    private roleMappingRepository;
    static readonly RSI_ROLE_TYPES: readonly ["Founder", "Officer", "Recruitment", "Marketing"];
    static readonly RSI_DEFAULT_STAR_RANKS: Record<number, string>;
    static readonly DEFAULT_TEMPLATES: RoleMappingTemplate[];
    constructor();
    getDiscoveredRanks(organizationId: string): Promise<{
        roles: string[];
        ranks: number[];
        rankMap: Array<{
            stars: number;
            name: string;
            count: number;
        }>;
        orgRoles: string[];
    }>;
    getDiscoveredOrgRoles(organizationId: string): Promise<Array<{
        role: string;
        members: string[];
    }>>;
    createMapping(input: CreateRoleMappingInput): Promise<RsiRoleMapping>;
    getMappingById(id: string, organizationId?: string): Promise<RsiRoleMapping | null>;
    getMappingsByOrganization(organizationId: string, includeInactive?: boolean): Promise<RsiRoleMapping[]>;
    buildSyncPreview(organizationId: string): Promise<RoleSyncPreview>;
    getMappingByRank(organizationId: string, rsiRank: string): Promise<RsiRoleMapping | null>;
    getMappingsByDiscordRole(organizationId: string, discordRoleId: string): Promise<RsiRoleMapping[]>;
    updateMapping(id: string, updates: UpdateRoleMappingInput, organizationId?: string): Promise<RsiRoleMapping | null>;
    deleteMapping(id: string, deletedBy?: string, organizationId?: string): Promise<boolean>;
    permanentlyDeleteMapping(id: string): Promise<boolean>;
    applyTemplate(organizationId: string, templateName: string, discordRoleMappings?: Record<string, string>): Promise<BulkMappingResult>;
    upsertMappings(organizationId: string, mappings: Array<{
        rsiRank: string;
        discordRoleId?: string;
        rbacPermissions?: RbacPermissions;
        priority?: number;
        description?: string;
    }>): Promise<BulkMappingResult>;
    deleteAllMappings(organizationId: string, deletedBy?: string): Promise<number>;
    getAvailableTemplates(): Array<{
        name: string;
        description: string;
        rankCount: number;
    }>;
    getTemplateDetails(templateName: string): RoleMappingTemplate | null;
    isValidDiscordRoleId(roleId: string): boolean;
    getOrganizationMappingSummary(organizationId: string): Promise<{
        totalMappings: number;
        activeMappings: number;
        withDiscordRole: number;
        withRbacPermissions: number;
        ranks: string[];
    }>;
    getEffectivePermissions(organizationId: string, rsiRank: string): Promise<RbacPermissions | null>;
    getDiscordRoleForRank(organizationId: string, rsiRank: string): Promise<string | null>;
    cloneMappings(sourceOrgId: string, targetOrgId: string, includeDiscordRoles?: boolean): Promise<BulkMappingResult>;
}
export declare const rsiRoleMappingService: RsiRoleMappingService;
//# sourceMappingURL=RsiRoleMappingService.d.ts.map