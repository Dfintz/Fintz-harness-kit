/**
 * Crew Assignment types — shared between frontend and backend.
 *
 * CrewMember implements the SlotMember pattern from membership.ts,
 * making crew operations compatible with the shared SlotManager utility.
 */

import type { SlotMember } from './membership.js';

export enum CrewRole {
  CAPTAIN = 'captain',
  PILOT = 'pilot',
  ENGINEER = 'engineer',
  GUNNER = 'gunner',
  MEDIC = 'medic',
  CARGO = 'cargo',
  NAVIGATOR = 'navigator',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
}

/**
 * Valid status transitions for crew assignments.
 * Mirrors CREW_TRANSITIONS in backend MembershipWorkflow.
 */
export const CREW_STATUS_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  [AssignmentStatus.ACTIVE]: [AssignmentStatus.INACTIVE, AssignmentStatus.COMPLETED],
  [AssignmentStatus.INACTIVE]: [AssignmentStatus.ACTIVE, AssignmentStatus.COMPLETED],
  [AssignmentStatus.COMPLETED]: [], // terminal
};

/**
 * A crew member assigned to a ship — extends shared SlotMember.
 */
export interface CrewMember extends SlotMember {
  userId: string;
  role: CrewRole | string;
  assignedAt: Date | string;
  station?: string;
  /** Populated by API — display name */
  username?: string;
  /** Populated by API — user profile avatar URL */
  avatarUrl?: string;
}

export interface CrewAssignment {
  id: string;
  organizationId: string;
  shipId: string;
  missionId?: string;
  assignerId: string;
  crew: CrewMember[];
  startDate?: Date | string;
  endDate?: Date | string;
  status: AssignmentStatus;
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateCrewAssignmentInput {
  shipId: string;
  crew: Array<{
    userId: string;
    role: string;
    station?: string;
  }>;
  missionId?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface AddCrewMemberInput {
  userId: string;
  role: string;
  station?: string;
}
