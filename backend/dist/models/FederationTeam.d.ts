import { Federation } from './Federation';
export type FederationTeamType = 'task_force' | 'diplomatic_mission' | 'joint_operation' | 'trade_convoy' | 'custom';
export type FederationTeamStatus = 'active' | 'disbanded';
export interface FederationTeamMember {
    userId: string;
    userName: string;
    organizationId: string;
    organizationName: string;
    role: string;
}
export declare class FederationTeam {
    id: string;
    federationId: string;
    federation?: Federation;
    name: string;
    description: string | null;
    type: FederationTeamType;
    leaderId: string | null;
    leaderName: string | null;
    leaderOrgId: string | null;
    members: FederationTeamMember[];
    status: FederationTeamStatus;
    maxMembers: number;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=FederationTeam.d.ts.map