import { FederationTeamMember, FederationTeamStatus, FederationTeamType } from '../../models/FederationTeam';
export interface FederationTeamData {
    id: string;
    federationId: string;
    name: string;
    description: string | null;
    type: FederationTeamType;
    leaderId: string | null;
    leaderName: string | null;
    leaderOrgId: string | null;
    members: FederationTeamMember[];
    memberCount: number;
    status: FederationTeamStatus;
    maxMembers: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FederationTeamService {
    private static instance;
    private readonly teamRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationTeamService;
    private toData;
    private requireHRPermission;
    private requireViewAccess;
    createTeam(federationId: string, userId: string, data: {
        name: string;
        description?: string;
        type?: FederationTeamType;
        maxMembers?: number;
        leaderId?: string;
        leaderName?: string;
        leaderOrgId?: string;
    }): Promise<FederationTeamData>;
    listTeams(federationId: string, userId: string): Promise<FederationTeamData[]>;
    getTeam(federationId: string, userId: string, teamId: string): Promise<FederationTeamData>;
    updateTeam(federationId: string, userId: string, teamId: string, data: {
        name?: string;
        description?: string | null;
        type?: FederationTeamType;
        maxMembers?: number;
        leaderId?: string | null;
        leaderName?: string | null;
        leaderOrgId?: string | null;
        status?: FederationTeamStatus;
    }): Promise<FederationTeamData>;
    addMember(federationId: string, userId: string, teamId: string, member: FederationTeamMember): Promise<FederationTeamData>;
    removeMember(federationId: string, userId: string, teamId: string, memberUserId: string): Promise<FederationTeamData>;
    deleteTeam(federationId: string, userId: string, teamId: string): Promise<void>;
}
//# sourceMappingURL=FederationTeamService.d.ts.map