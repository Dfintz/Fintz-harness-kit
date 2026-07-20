import { type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import type { TeamJoinPolicy, TeamType } from '../../models/Team';
import { Team } from '../../models/Team';
import type { TeamMemberRole, TeamMemberStatus } from '../../models/TeamMember';
import { TeamMember } from '../../models/TeamMember';
import type { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export interface TeamTreeNode {
    id: string;
    name: string;
    description?: string;
    type: TeamType;
    parentTeamId?: string;
    level: number;
    sortOrder: number;
    maxMembers: number;
    isActive: boolean;
    joinPolicy: TeamJoinPolicy;
    emblem?: string | null;
    memberCount: number;
    children: TeamTreeNode[];
}
export interface TeamMemberFilterOptions extends PaginationOptions {
    teamId?: string;
    userId?: string;
    role?: TeamMemberRole;
    shipType?: string;
    status?: TeamMemberStatus | TeamMemberStatus[];
    joinedAfter?: Date;
    joinedBefore?: Date;
    lastActiveAfter?: Date;
    lastActiveBefore?: Date;
    searchTerm?: string;
}
export declare class TeamService extends TenantService<Team> {
    private readonly memberRepo;
    private readonly starCommsContextSyncService;
    constructor();
    createTeam(organizationId: string, data: {
        name: string;
        description?: string;
        type?: TeamType;
        parentTeamId?: string | null;
        maxMembers?: number;
        joinPolicy?: TeamJoinPolicy;
        emblem?: string | null;
    }): Promise<Team>;
    updateTeam(organizationId: string, teamId: string, data: {
        name?: string;
        description?: string;
        type?: TeamType;
        parentTeamId?: string | null;
        maxMembers?: number;
        isActive?: boolean;
        joinPolicy?: TeamJoinPolicy;
        emblem?: string | null;
    }): Promise<Team>;
    deleteTeam(organizationId: string, teamId: string): Promise<void>;
    getTeamTree(organizationId: string): Promise<TeamTreeNode[]>;
    moveTeam(organizationId: string, teamId: string, newParentId: string | null): Promise<Team>;
    reorderTeams(organizationId: string, orderedIds: string[], _parentTeamId: string | null): Promise<void>;
    private isDescendantOf;
    private updateDescendantLevels;
    getTeamMembers(organizationId: string, teamId: string): Promise<TeamMember[]>;
    static toParticipantInfo(member: TeamMember): ParticipantInfo;
    toParticipantInfo(member: TeamMember): ParticipantInfo;
    addMember(organizationId: string, teamId: string, userId: string, role?: TeamMemberRole, personnelData?: {
        rank?: string;
        shipType?: string;
        specialization?: string;
        certifications?: string[];
        additionalRoles?: string[];
    }): Promise<TeamMember>;
    updateMember(organizationId: string, teamId: string, memberId: string, data: {
        role?: TeamMemberRole;
        status?: TeamMemberStatus;
        rank?: string;
        shipType?: string;
        specialization?: string;
        stats?: {
            missionsCompleted?: number;
            hoursFlown?: number;
            creditsEarned?: number;
        };
        certifications?: string[];
        additionalRoles?: string[];
        lastActiveAt?: string | null;
        departureReason?: string;
    }): Promise<TeamMember>;
    removeMember(organizationId: string, teamId: string, memberId: string): Promise<void>;
    getTeamMembersFiltered(organizationId: string, filters: TeamMemberFilterOptions): Promise<PaginatedResponse<TeamMember>>;
    getTeamMemberById(organizationId: string, memberId: string): Promise<TeamMember | null>;
    findByUser(organizationId: string, userId: string): Promise<TeamMember[]>;
    isMember(organizationId: string, teamId: string, userId: string): Promise<boolean>;
    getMembership(organizationId: string, teamId: string, userId: string): Promise<TeamMember | null>;
    assignTeamToShip(organizationId: string, teamId: string, shipId: string, autoNest?: boolean): Promise<Team>;
    unassignTeamFromShip(organizationId: string, teamId: string): Promise<Team>;
    assignTeamToDivision(organizationId: string, teamId: string, divisionId: string, autoNest?: boolean): Promise<Team>;
    populateCrewFromAssignment(organizationId: string, crewTeamId: string, shipId: string): Promise<{
        added: number;
        skipped: number;
    }>;
    bulkAddMembers(organizationId: string, teamId: string, members: Array<{
        userId: string;
        role?: TeamMemberRole;
        rank?: string;
        shipType?: string;
        specialization?: string;
        certifications?: string[];
        additionalRoles?: string[];
    }>): Promise<TeamMember[]>;
    bulkUpdateMembers(organizationId: string, updates: Array<{
        id: string;
        data: Partial<Pick<TeamMember, 'role' | 'status' | 'rank' | 'shipType' | 'specialization' | 'stats' | 'certifications' | 'additionalRoles' | 'lastActiveAt' | 'departureReason'>>;
    }>): Promise<TeamMember[]>;
    bulkDeleteMembers(organizationId: string, teamId: string, memberIds: string[]): Promise<void>;
    bulkUpdateStatus(organizationId: string, teamId: string, memberIds: string[], status: TeamMemberStatus): Promise<void>;
    getTeamMemberCount(organizationId: string, teamId: string): Promise<number>;
    getActiveCount(organizationId: string, teamId: string): Promise<number>;
    getMembersByRole(organizationId: string, teamId: string): Promise<Record<string, number>>;
    getMembersByShipType(organizationId: string, teamId: string): Promise<Record<string, number>>;
    getTeamStatistics(organizationId: string, teamId: string): Promise<{
        totalMembers: number;
        byRole: Record<string, number>;
    }>;
    getUserTeamCount(organizationId: string, userId: string): Promise<number>;
    getTeamsByOrg(organizationId: string): Promise<Team[]>;
    getTeamById(organizationId: string, teamId: string): Promise<Team | null>;
    getRootTeams(organizationId: string): Promise<Team[]>;
    removeUserFromAllTeams(organizationId: string, userId: string): Promise<number>;
}
//# sourceMappingURL=TeamService.d.ts.map