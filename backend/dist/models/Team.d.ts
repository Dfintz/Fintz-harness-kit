import { TenantEntity } from './base/TenantEntity';
import type { TeamMember } from './TeamMember';
export type TeamType = 'squadron' | 'division' | 'crew' | 'platoon' | 'custom';
export type TeamJoinPolicy = 'open' | 'closed';
export declare class Team extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    type: TeamType;
    emblem?: string | null;
    assignedShipId?: string;
    assignedDivisionId?: string;
    parentTeamId?: string;
    parent?: Team;
    children?: Team[];
    level: number;
    sortOrder: number;
    maxMembers: number;
    isActive: boolean;
    joinPolicy: TeamJoinPolicy;
    members?: TeamMember[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Team.d.ts.map