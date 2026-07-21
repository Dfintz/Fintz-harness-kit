/**
 * Canonical Activity type values (runtime source set for {@link ActivityType}).
 *
 * Per ADR-004, shared-types exposes string-literal sets as `as const` arrays so
 * the values can be enumerated at runtime and verified against the backend
 * `ActivityType` enum by a contract test.
 *
 * NOTE: This is the client-facing subset. The backend enum additionally
 * includes the internal-only `recruitment` value, intentionally excluded here
 * (see ADR-004 and `backend/src/__tests__/contracts/sharedTypesActivityParity.test.ts`).
 */
export const ACTIVITY_TYPE_VALUES = [
  'mission',
  'contract',
  'bounty',
  'event',
  'lfg',
  'operation',
  'job_listing',
] as const;

/**
 * Activity types — matches backend ActivityType enum (lowercase).
 */
export type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];

/**
 * Canonical Activity status values (runtime source set for {@link ActivityStatus}).
 * See ADR-004.
 */
export const ACTIVITY_STATUS_VALUES = [
  'draft',
  'open',
  'planning',
  'recruiting',
  'ready',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const;

/**
 * Activity status — matches backend ActivityStatus enum (lowercase).
 */
export type ActivityStatus = (typeof ACTIVITY_STATUS_VALUES)[number];

/**
 * Canonical Activity visibility values (runtime source set for
 * {@link ActivityVisibility}). See ADR-004.
 */
export const ACTIVITY_VISIBILITY_VALUES = [
  'public',
  'organization',
  'cross_org',
  'alliance',
  'private',
  'listed',
] as const;

/**
 * Activity visibility — controls who can see the activity.
 */
export type ActivityVisibility = (typeof ACTIVITY_VISIBILITY_VALUES)[number];

/**
 * Canonical participant role values (runtime source set for
 * {@link ParticipantRole}). See ADR-004.
 */
export const PARTICIPANT_ROLE_VALUES = [
  'leader',
  'co_leader',
  'commander',
  'pilot',
  'gunner',
  'engineer',
  'medic',
  'scout',
  'tank',
  'dps',
  'support',
  'contractor',
  'client',
  'hunter',
  'member',
  'any',
] as const;

/**
 * Participant role within an activity.
 */
export type ParticipantRole = (typeof PARTICIPANT_ROLE_VALUES)[number];

/**
 * Canonical crew-position values used for activity ship assignments.
 * Keep this list in sync with backend Joi validation and frontend selectors.
 */
export const ACTIVITY_CREW_POSITIONS = [
  'pilot',
  'copilot',
  'gunner',
  'engineer',
  'navigator',
  'cargo',
  'medical',
] as const;

export type ActivityCrewPosition = (typeof ACTIVITY_CREW_POSITIONS)[number];

export const ACTIVITY_CREW_POSITION_LABELS: Readonly<Record<ActivityCrewPosition, string>> = {
  pilot: 'Pilot',
  copilot: 'Co-Pilot',
  gunner: 'Gunner',
  engineer: 'Engineer',
  navigator: 'Navigator',
  cargo: 'Cargo',
  medical: 'Medical',
};

/**
 * Canonical passenger-role values for non-crew personnel carried by a ship
 * (e.g. marines in a dropship). Passengers are tracked separately from crew
 * and do NOT count toward crew capacity totals.
 * Keep in sync with backend Joi validation and frontend selectors.
 */
export const ACTIVITY_PASSENGER_ROLES = [
  'passenger',
  'marine',
  'security',
  'medic',
  'guest',
  'vip',
] as const;

export type ActivityPassengerRole = (typeof ACTIVITY_PASSENGER_ROLES)[number];

export const ACTIVITY_PASSENGER_ROLE_LABELS: Readonly<Record<ActivityPassengerRole, string>> = {
  passenger: 'Passenger',
  marine: 'Marine',
  security: 'Security',
  medic: 'Medic',
  guest: 'Guest',
  vip: 'VIP',
};

/**
 * A typed crew slot on a ship: how many seats of a given crew position exist.
 * The actual occupants live in `ShipAssignment.crewMembers`; a role's filled
 * count is derived by counting crew members whose position matches `role`.
 */
export interface CrewSlot {
  /** Crew position — one of ACTIVITY_CREW_POSITIONS. */
  role: string;
  /** Number of seats for this role. */
  capacity: number;
}

/**
 * Derive a default set of crew slots from a ship's total crew complement,
 * using a "pilot + balanced mix" heuristic (the catalogue has no per-role
 * breakdown, so this is an editable starting point):
 *   - 1 Pilot
 *   - 1 Co-Pilot when the ship seats 2+
 *   - remaining seats split across Gunner / Engineer (gunner takes the odd one)
 */
export function deriveDefaultCrewSlots(maxCrew: number): CrewSlot[] {
  const total = Math.max(1, Math.floor(maxCrew) || 1);
  const slots: CrewSlot[] = [{ role: 'pilot', capacity: 1 }];
  if (total >= 2) {
    slots.push({ role: 'copilot', capacity: 1 });
  }
  const used = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  const remaining = total - used;
  if (remaining > 0) {
    const gunner = Math.ceil(remaining / 2);
    const engineer = remaining - gunner;
    if (gunner > 0) {
      slots.push({ role: 'gunner', capacity: gunner });
    }
    if (engineer > 0) {
      slots.push({ role: 'engineer', capacity: engineer });
    }
  }
  return slots;
}

/**
 * Participation status — matches backend Activity model (lowercase)
 */
export type ParticipationStatus = 'invited' | 'accepted' | 'declined' | 'standby';

/**
 * Activity entity - represents an event or mission
 */
export interface Activity {
  id: string;
  title: string;
  description?: string;
  type: ActivityType;
  status: ActivityStatus;
  organizationId: string;
  creatorId: string;
  /** Optional team/squad this activity is assigned to */
  teamId?: string;
  /** Populated team summary (when joined) */
  team?: { id: string; name: string; type?: string };
  scheduledStartDate?: Date | string;
  scheduledEndDate?: Date | string;
  actualStartDate?: Date | string;
  actualEndDate?: Date | string;
  timezone?: string;
  location?: string;
  maxParticipants?: number;
  isPublic: boolean;
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Extended activity with participant count (v2)
 */
export interface ActivityV2 extends Activity {
  participantCount: number;
  requirements?: ActivityRequirements;
  rewards?: ActivityRewards;
}

/**
 * Activity requirements
 */
export interface ActivityRequirements {
  minRank?: string;
  requiredShipTypes?: string[];
  requiredRoles?: string[];
}

/**
 * Activity rewards
 */
export interface ActivityRewards {
  aUEC?: number;
  reputation?: number;
  items?: string[];
}

/**
 * Activity participant
 */
export interface ActivityParticipant {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: string;
  status: ParticipationStatus;
  shipType?: string;
  joinedAt: Date | string;
  confirmedAt?: Date | string;
}

/**
 * Request to create a new activity
 */
export interface CreateActivityRequest {
  title: string;
  description?: string;
  type: ActivityType;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  location?: string;
  maxParticipants?: number;
  isPublic?: boolean;
  tags?: string[];
  /** Optional team/squad assignment */
  teamId?: string;
}

/**
 * Request to update an existing activity
 */
export interface UpdateActivityRequest extends Partial<CreateActivityRequest> {
  status?: ActivityStatus;
}
