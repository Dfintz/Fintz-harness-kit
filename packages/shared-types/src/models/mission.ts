/**
 * Mission types — shared between frontend and backend
 *
 * Per ADR-004, each vocabulary is exposed as a runtime-introspectable `as const`
 * array plus a derived union type, so the values can be enumerated at runtime and
 * verified against the backend `Mission` enums by a contract test. Each set has
 * exact parity with its backend enum (no client-only exclusions).
 */

/**
 * Canonical Mission type values (runtime source set for {@link MissionType}).
 */
export const MISSION_TYPE_VALUES = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'logistics',
  'rescue',
  'reconnaissance',
  'escort',
  'salvage',
  'custom',
] as const;

/**
 * Mission type classification.
 */
export type MissionType = (typeof MISSION_TYPE_VALUES)[number];

/**
 * Canonical Mission status values (runtime source set for {@link MissionStatus}).
 */
export const MISSION_STATUS_VALUES = [
  'draft',
  'planned',
  'briefed',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
] as const;

/**
 * Mission lifecycle status.
 */
export type MissionStatus = (typeof MISSION_STATUS_VALUES)[number];

/**
 * Canonical Mission difficulty values (runtime source set for {@link MissionDifficulty}).
 */
export const MISSION_DIFFICULTY_VALUES = ['trivial', 'easy', 'medium', 'hard', 'extreme'] as const;

/**
 * Mission difficulty level.
 */
export type MissionDifficulty = (typeof MISSION_DIFFICULTY_VALUES)[number];

/**
 * Canonical Mission priority values (runtime source set for {@link MissionPriority}).
 */
export const MISSION_PRIORITY_VALUES = ['low', 'normal', 'high', 'critical'] as const;

/**
 * Mission priority level.
 */
export type MissionPriority = (typeof MISSION_PRIORITY_VALUES)[number];

/**
 * Individual mission objective
 */
export interface MissionObjective {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  optional?: boolean;
  order: number;
}

/**
 * Mission participant with role
 */
export interface MissionParticipant {
  userId: string;
  role: 'leader' | 'member' | 'support' | 'reserve';
  joinedAt: string | Date;
  status: 'confirmed' | 'pending' | 'declined';
}

/**
 * Mission entity — represents a planned or active mission
 */
export interface Mission {
  id: string;
  title: string;
  description?: string;
  missionType: MissionType;
  status: MissionStatus;
  difficulty: MissionDifficulty;
  priority: MissionPriority;
  organizationId: string;
  createdBy: string;
  assignedTo?: string;
  fleetId?: string;
  linkedActivityId?: string;
  location?: string;
  objectives: MissionObjective[];
  participants: MissionParticipant[];
  tags: string[];
  reward?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  completedAt?: string | Date;
  notes?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Request payload for creating a mission
 */
export interface CreateMissionRequest {
  title: string;
  description?: string;
  missionType: MissionType;
  difficulty?: MissionDifficulty;
  priority?: MissionPriority;
  fleetId?: string;
  location?: string;
  objectives?: Omit<MissionObjective, 'id'>[];
  tags?: string[];
  reward?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

/**
 * Request payload for updating a mission
 */
export interface UpdateMissionRequest {
  title?: string;
  description?: string;
  missionType?: MissionType;
  difficulty?: MissionDifficulty;
  priority?: MissionPriority;
  fleetId?: string | null;
  assignedTo?: string | null;
  location?: string;
  objectives?: MissionObjective[];
  tags?: string[];
  reward?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
}

/**
 * Request payload for assigning a mission
 */
export interface AssignMissionRequest {
  userId: string;
  role?: 'leader' | 'member' | 'support' | 'reserve';
}

/**
 * Request payload for completing a mission
 */
export interface CompleteMissionRequest {
  status: 'completed' | 'failed';
  notes?: string;
}

/**
 * Authoritative mission status transition map.
 * Shared between frontend and backend to guarantee consistent lifecycle rules.
 */
export const MISSION_STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['briefed', 'in_progress', 'cancelled'],
  briefed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};
