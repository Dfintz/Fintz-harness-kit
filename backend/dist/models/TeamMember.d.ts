import { TenantEntity } from './base/TenantEntity';
import type { Team } from './Team';
import { User } from './User';
export type TeamMemberRole = 'leader' | 'officer' | 'member';
export type TeamMemberStatus = 'active' | 'inactive' | 'pending' | 'removed' | 'on_leave' | 'probation' | 'deployed';
export declare class TeamMember extends TenantEntity {
    id: string;
    teamId: string;
    team: Team;
    userId: string;
    user: User;
    role: TeamMemberRole;
    status: TeamMemberStatus;
    joinedAt?: Date;
    leftAt?: Date;
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
    lastActiveAt?: Date;
    departureReason?: string;
    assignedShipId?: string;
    crewRole?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=TeamMember.d.ts.map