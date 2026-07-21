/**
 * Shared membership & slot types — reusable across Crew, Activity, Job, and LFG systems.
 *
 * These types define the common patterns for "assigning people to typed slots
 * in a group context" that appear across:
 * - Crew Assignments (ship crew rostering)
 * - Job Listings (per-ship crew breakdown slots)
 * - Activities (participant + ship crew positions)
 * - LFG Sessions (player slots in a group)
 */

// ─── Membership Status ───────────────────────────────────────────────

/**
 * Universal membership status that covers all systems.
 * Not every system uses every status — pick the subset relevant to your domain.
 *
 * Workflow:
 *   PENDING → ACCEPTED | REJECTED | WAITLISTED
 *   WAITLISTED → ACCEPTED | REJECTED | WITHDRAWN
 *   ACCEPTED → WITHDRAWN | REMOVED
 *   INVITED → ACCEPTED | DECLINED
 *
 * Terminal states: REJECTED, WITHDRAWN, REMOVED, DECLINED
 */
export enum MembershipStatus {
  /** Awaiting review/approval */
  PENDING = 'pending',
  /** Actively assigned/participating */
  ACCEPTED = 'accepted',
  /** Denied by an admin/owner */
  REJECTED = 'rejected',
  /** On the waitlist (group full at time of request) */
  WAITLISTED = 'waitlisted',
  /** Self-removed by the member */
  WITHDRAWN = 'withdrawn',
  /** Removed by an admin/owner */
  REMOVED = 'removed',
  /** Sent an invite, awaiting response */
  INVITED = 'invited',
  /** Declined an invitation */
  DECLINED = 'declined',
  /** Participation completed normally */
  COMPLETED = 'completed',
}

/** Statuses that indicate "no longer active" — safe to re-apply after these */
export const TERMINAL_STATUSES: ReadonlySet<MembershipStatus> = new Set([
  MembershipStatus.REJECTED,
  MembershipStatus.WITHDRAWN,
  MembershipStatus.REMOVED,
  MembershipStatus.DECLINED,
  MembershipStatus.COMPLETED,
]);

/** Statuses that count toward capacity / "occupied slot" */
export const ACTIVE_STATUSES: ReadonlySet<MembershipStatus> = new Set([
  MembershipStatus.ACCEPTED,
  MembershipStatus.PENDING,
  MembershipStatus.WAITLISTED,
  MembershipStatus.INVITED,
]);

// ─── Slot Member ─────────────────────────────────────────────────────

/**
 * Minimal shape every slot-member must have.
 * Domain-specific types extend this (CrewMember, ActivityParticipant, etc).
 */
export interface SlotMember {
  userId: string;
  role?: string;
  status?: MembershipStatus | string;
  assignedAt?: Date | string;
}

// ─── Role Slot ───────────────────────────────────────────────────────

/**
 * A typed slot with capacity — e.g., "2 Gunners needed, 1 filled".
 * Used by Job Listings (ShipCrewRoleSlot) and Activity (RoleRequirement).
 */
export interface RoleSlot {
  role: string;
  /** Total slots available for this role */
  total: number;
  /** Currently filled count */
  filled: number;
  /** Whether this role is required (vs optional) */
  required?: boolean;
  /** User IDs occupying slots */
  assignedUserIds?: string[];
  /** Display names for assigned users */
  assignedUserNames?: string[];
}

/**
 * Capacity info for a group/container.
 * Used to enforce max-member limits.
 */
export interface SlotCapacity {
  /** Current member count (filled slots) */
  current: number;
  /** Maximum allowed (0 or undefined = unlimited) */
  max?: number;
  /** Minimum required to start/proceed */
  min?: number;
}

// ─── Status Transitions ──────────────────────────────────────────────

/**
 * A status transition definition.
 * Used by MembershipWorkflow to define valid state machine transitions.
 */
export interface StatusTransition<S extends string = string> {
  from: S;
  to: S;
  /** Who can trigger this: 'member' = self, 'admin' = owner/manager, 'system' = automatic */
  actor: 'member' | 'admin' | 'system';
  /** Optional label for UI */
  label?: string;
}

// ─── Membership Request ──────────────────────────────────────────────

/**
 * Shape for requesting to join a group / apply for a slot.
 * Domain services extend with specific fields.
 */
export interface MembershipRequest {
  userId: string;
  /** The group/container being joined */
  targetId: string;
  role?: string;
  message?: string;
}

// ─── Review Input ────────────────────────────────────────────────────

/**
 * Shape for an admin reviewing a membership request.
 * Mirrors JobApplication's ReviewApplicationInput / Activity invite response.
 */
export interface MembershipReviewInput {
  status: MembershipStatus;
  reviewerId: string;
  reviewNote?: string;
}
