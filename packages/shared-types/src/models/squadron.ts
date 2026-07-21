/**
 * Squadron types — people-grouping within fleets
 *
 * A "squadron" is a Fleet used for people management.
 * SquadronMember maps to the FleetMember entity on the backend.
 */

export enum SquadronMemberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  PROBATION = 'probation',
  DEPLOYED = 'deployed',
}

export interface SquadronMember {
  id: string;
  userId: string;
  fleetId: string;
  organizationId: string;
  rank: string;
  role?: string;
  shipType?: string;
  status: SquadronMemberStatus;
  specialization?: string;
  joinedAt?: string | Date;
  lastActiveAt?: string | Date;
  leftAt?: string | Date;
  departureReason?: string;
  stats?: {
    missionsCompleted?: number;
    hoursFlown?: number;
    creditsEarned?: number;
  };
  roles?: string[];
  certifications?: string[];
  isLeader: boolean;
  notes?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: {
    id: string;
    username?: string;
    displayName?: string;
    avatar?: string;
  };
  fleet?: {
    id: string;
    name: string;
  };
}

export interface SquadronRoleStats {
  role: string;
  count: number;
}

export interface SquadronShipStats {
  shipType: string;
  count: number;
}

export interface SquadronStatistics {
  totalMembers: number;
  activeMembers: number;
  byRole: SquadronRoleStats[];
  byShipType: SquadronShipStats[];
}
