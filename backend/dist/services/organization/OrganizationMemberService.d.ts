import { EntityManager } from 'typeorm';
import { MembershipAcquisitionSource, OrganizationMembership } from '../../models/OrganizationMembership';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface MemberInvitation {
    email: string;
    role: string;
    title?: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
}
export interface MemberStats {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    membersByRole: Record<string, number>;
    membersByAcquisition: Record<string, number>;
    recentJoins: number;
    recentDepartures: number;
}
export declare class OrganizationMemberService {
    private readonly membershipRepository;
    private readonly organizationRepository;
    private readonly userRepository;
    private readonly invitationRepository;
    private readonly roleService;
    private readonly orgPermissionService;
    addMember(orgId: string, userId: string, role?: string, title?: string, metadata?: Record<string, unknown>, manager?: EntityManager, options?: {
        acquisitionSource?: MembershipAcquisitionSource;
        acquisitionRefId?: string;
    }): Promise<OrganizationMembership>;
    removeMember(orgId: string, userId: string, permanent?: boolean): Promise<void>;
    leaveOrganization(orgId: string, userId: string, authenticatedUserId: string): Promise<void>;
    updateMemberRole(orgId: string, userId: string, newRole?: string, newRoleId?: string): Promise<OrganizationMembership>;
    updateMemberTitle(orgId: string, userId: string, title: string): Promise<OrganizationMembership>;
    updateMemberPermissions(orgId: string, userId: string, permissions: string[]): Promise<OrganizationMembership>;
    updateMemberMetadata(orgId: string, userId: string, metadata: Record<string, unknown>): Promise<OrganizationMembership>;
    getMember(orgId: string, userId: string): Promise<OrganizationMembership | null>;
    getMembers(orgId: string, includeInactive?: boolean, pagination?: PaginationOptions): Promise<PaginatedResponse<OrganizationMembership>>;
    getMembersByRole(orgId: string, role: string): Promise<OrganizationMembership[]>;
    isMember(orgId: string, userId: string): Promise<boolean>;
    getUserOrganizations(userId: string, includeInactive?: boolean): Promise<OrganizationMembership[]>;
    transferMember(fromOrgId: string, toOrgId: string, userId: string, newRole?: string, keepMembership?: boolean): Promise<OrganizationMembership>;
    bulkTransferMembers(fromOrgId: string, toOrgId: string, userIds: string[], newRole?: string): Promise<OrganizationMembership[]>;
    searchMembers(orgId: string, filters: {
        query?: string;
        role?: string;
        roles?: string[];
        joinedAfter?: Date;
        joinedBefore?: Date;
        hasPermission?: string;
    }, pagination?: PaginationOptions): Promise<PaginatedResponse<OrganizationMembership>>;
    getMemberStats(orgId: string, daysBack?: number): Promise<MemberStats>;
    getMemberRetention(orgId: string, periodDays?: number): Promise<number>;
    private updateMemberCount;
    validateMemberExists(orgId: string, userId: string): Promise<void>;
    getMemberCount(orgId: string): Promise<number>;
    batchAddMembers(orgId: string, members: Array<{
        userId: string;
        role?: string;
        title?: string;
        metadata?: Record<string, unknown>;
        acquisitionSource?: MembershipAcquisitionSource;
        acquisitionRefId?: string;
    }>): Promise<OrganizationMembership[]>;
    batchRemoveMembers(orgId: string, userIds: string[], permanent?: boolean): Promise<void>;
    batchUpdateMemberRoles(orgId: string, updates: Array<{
        userId: string;
        role: string;
    }>): Promise<OrganizationMembership[]>;
}
//# sourceMappingURL=OrganizationMemberService.d.ts.map