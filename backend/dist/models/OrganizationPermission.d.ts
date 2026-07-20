import { Organization } from './Organization';
import { User } from './User';
export declare enum PermissionScope {
    ORGANIZATION = "organization",
    DIVISION = "division",
    DEPARTMENT = "department",
    TEAM = "team",
    CUSTOM = "custom"
}
export declare enum ResourceType {
    FLEET = "fleet",
    SHIP = "ship",
    MEMBER = "member",
    MEMBERS = "members",
    EVENT = "event",
    FINANCE = "finance",
    TREASURY = "treasury",
    COMMISSARY = "commissary",
    LOOT = "loot",
    CONTRACT = "contract",
    RECRUITMENT = "recruitment",
    LOGISTICS = "logistics",
    SETTINGS = "settings",
    PERMISSIONS = "permissions",
    HIERARCHY = "hierarchy",
    ANALYTICS = "analytics",
    INTEL = "intel",
    CUSTOM = "custom"
}
export declare enum PermissionAction {
    VIEW = "view",
    CREATE = "create",
    EDIT = "edit",
    DELETE = "delete",
    APPROVE = "approve",
    MANAGE = "manage",
    ADMIN = "admin",
    ALL = "all"
}
export declare class OrganizationPermission {
    id: string;
    organizationId: string;
    organization: Organization;
    userId?: string;
    user?: User;
    roleId?: string;
    resource: ResourceType;
    resourceId?: string;
    actions: PermissionAction[];
    scope: PermissionScope;
    inheritable: boolean;
    inherited: boolean;
    inheritedFrom?: string;
    priority: number;
    conditions?: {
        timeRestriction?: {
            startTime?: string;
            endTime?: string;
            daysOfWeek?: number[];
        };
        ipRestriction?: {
            allowedIPs?: string[];
            blockedIPs?: string[];
        };
        resourceConditions?: Record<string, unknown>;
    };
    metadata?: Record<string, unknown>;
    isActive: boolean;
    expiresAt?: Date;
    grantedBy?: string;
    reason?: string;
    createdAt: Date;
    updatedAt: Date;
    isExpired(): boolean;
    isValid(): boolean;
    allowsAction(action: PermissionAction): boolean;
    appliesToResource(resourceId?: string): boolean;
    matchesTimeRestrictions(): boolean;
    matchesIPRestrictions(requestIP?: string): boolean;
}
export declare const PermissionTemplates: {
    OWNER: {
        name: string;
        description: string;
        permissions: {
            resource: ResourceType;
            actions: PermissionAction[];
            scope: PermissionScope;
        }[];
    };
    ADMIN: {
        name: string;
        description: string;
        permissions: {
            resource: ResourceType;
            actions: PermissionAction[];
            scope: PermissionScope;
        }[];
    };
    MANAGER: {
        name: string;
        description: string;
        permissions: {
            resource: ResourceType;
            actions: PermissionAction[];
            scope: PermissionScope;
        }[];
    };
    MEMBER: {
        name: string;
        description: string;
        permissions: {
            resource: ResourceType;
            actions: PermissionAction[];
            scope: PermissionScope;
        }[];
    };
    VIEWER: {
        name: string;
        description: string;
        permissions: {
            resource: ResourceType;
            actions: PermissionAction[];
            scope: PermissionScope;
        }[];
    };
};
//# sourceMappingURL=OrganizationPermission.d.ts.map