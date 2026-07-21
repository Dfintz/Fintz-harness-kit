/**
 * Shared types for Teams/Squadrons System (Wave 2.6)
 */

export type TeamType = 'squadron' | 'division' | 'crew' | 'platoon' | 'custom';
export type TeamJoinPolicy = 'open' | 'closed';

export type TeamMemberRole = 'leader' | 'officer' | 'member';

export type TeamMemberStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'removed'
  | 'on_leave'
  | 'probation'
  | 'deployed';

/** Aggregated performance stats for a team member */
export interface TeamMemberStats {
  missionsCompleted?: number;
  hoursFlown?: number;
  creditsEarned?: number;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: TeamType;
  parentTeamId?: string | null;
  /** Ship this team is stationed on (squadron on capital, platoon on dropship) */
  assignedShipId?: string | null;
  /** Division this team is functionally assigned to (for dynamic grouping) */
  assignedDivisionId?: string | null;
  level: number;
  sortOrder: number;
  maxMembers: number;
  isActive: boolean;
  /** 'open' = anyone can join, 'closed' = requires approval */
  joinPolicy: TeamJoinPolicy;
  /** URL to team emblem/logo image (synced to linked fleets) */
  emblem?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  organizationId: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt?: string;
  leftAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Personnel fields (Sprint 12 — Personnel Unification) */
  rank?: string;
  shipType?: string;
  specialization?: string;
  stats?: TeamMemberStats;
  certifications?: string[];
  additionalRoles?: string[];
  lastActiveAt?: string | null;
  departureReason?: string;
  /** Populated via the `user` relation on the backend */
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface TeamTreeNode extends Team {
  children: TeamTreeNode[];
  memberCount: number;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  type: TeamType;
  parentTeamId?: string | null;
  maxMembers?: number;
  joinPolicy?: TeamJoinPolicy;
  emblem?: string | null;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  type?: TeamType;
  parentTeamId?: string | null;
  maxMembers?: number;
  isActive?: boolean;
  joinPolicy?: TeamJoinPolicy;
  emblem?: string | null;
}

export interface AddTeamMemberRequest {
  userId: string;
  role?: TeamMemberRole;
  rank?: string;
  shipType?: string;
  specialization?: string;
  certifications?: string[];
  additionalRoles?: string[];
}

export interface UpdateTeamMemberRequest {
  role?: TeamMemberRole;
  status?: TeamMemberStatus;
  rank?: string;
  shipType?: string;
  specialization?: string;
  stats?: TeamMemberStats;
  certifications?: string[];
  additionalRoles?: string[];
  lastActiveAt?: string | null;
  departureReason?: string;
}
