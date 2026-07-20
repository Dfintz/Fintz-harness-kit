import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { PermissionAction, ResourceType } from '../../models/OrganizationPermission';
export interface InviteMemberParams {
    organizationId: string;
    userId: string;
    invitedBy: string;
    role?: string;
    title?: string;
    permissions?: Array<{
        resource: ResourceType;
        actions: PermissionAction[];
    }>;
    message?: string;
    sendNotification?: boolean;
}
export interface OrganizationSetupParams {
    name: string;
    ownerId: string;
    description?: string;
    defaultPermissions?: Array<{
        resource: ResourceType;
        actions: PermissionAction[];
    }>;
    settings?: {
        allowPublicJoin?: boolean;
        requireApproval?: boolean;
        maxMembers?: number;
    };
}
export declare class OrganizationAggregatorService {
    private organizationService;
    private memberService;
    private permissionService;
    private settingsService;
    private userService;
    private notificationService;
    constructor();
    inviteAndOnboardMember(params: InviteMemberParams): Promise<{
        member: OrganizationMembership;
        permissions: Array<Awaited<ReturnType<OrganizationAggregatorService['permissionService']['grantPermission']>>>;
        notification?: Record<string, unknown>;
    }>;
    offboardMember(organizationId: string, userId: string, offboardedBy: string, reason?: string): Promise<{
        success: boolean;
        permissionsRevoked: number;
    }>;
    bulkInviteMembers(organizationId: string, invitations: Array<{
        userId: string;
        role?: string;
        permissions?: Array<{
            resource: ResourceType;
            actions: PermissionAction[];
        }>;
    }>, invitedBy: string): Promise<{
        successful: Array<{
            userId: string;
            member: OrganizationMembership;
        }>;
        failed: Array<{
            userId: string;
            error: string;
        }>;
    }>;
    setupNewOrganization(params: OrganizationSetupParams): Promise<{
        organization: Organization;
        ownerMember: OrganizationMembership;
        settings: Record<string, unknown>;
        permissions: Array<Awaited<ReturnType<OrganizationAggregatorService['permissionService']['grantPermission']>>>;
    }>;
    getOrganizationOverview(organizationId: string): Promise<{
        organization: Organization | null;
        memberCount: number;
        memberStats: {
            activeMembers: number;
            pendingInvitations: number;
        };
        recentMembers: OrganizationMembership[];
        settings: Record<string, unknown>;
    }>;
}
//# sourceMappingURL=OrganizationAggregatorService.d.ts.map