import { TenantEntity } from './base/TenantEntity';
import { Role } from './Role';
export interface RbacPermissions {
    fleetView?: boolean;
    fleetEdit?: boolean;
    fleetManage?: boolean;
    orgView?: boolean;
    orgEdit?: boolean;
    orgManage?: boolean;
    eventView?: boolean;
    eventManage?: boolean;
    intelView?: boolean;
    intelManage?: boolean;
    admin?: boolean;
    custom?: Record<string, boolean>;
}
export declare class RsiRoleMapping extends TenantEntity {
    id: string;
    rsiRank: string;
    discordRoleId?: string;
    internalRoleId?: string;
    internalRole?: Role;
    autoAssignTeamIds?: string[];
    rbacPermissions?: RbacPermissions;
    isActive: boolean;
    priority: number;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    hasDiscordRole(): boolean;
    hasInternalRole(): boolean;
    hasAutoAssignTeams(): boolean;
    hasRbacPermissions(): boolean;
    isAdmin(): boolean;
    getEnabledPermissions(): string[];
    hasPermission(permission: keyof RbacPermissions | string): boolean;
    getSummary(): {
        rsiRank: string;
        hasDiscordRole: boolean;
        discordRoleId: string | null;
        hasInternalRole: boolean;
        hasAutoAssignTeams: boolean;
        permissionCount: number;
        isActive: boolean;
        priority: number;
    };
}
//# sourceMappingURL=RsiRoleMapping.d.ts.map