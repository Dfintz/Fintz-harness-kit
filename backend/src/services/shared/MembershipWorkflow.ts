/**
 * MembershipWorkflow — Status transition state machine for membership lifecycles.
 *
 * Defines and enforces valid status transitions across domains:
 * - Crew Assignments: active → inactive → completed
 * - Job Applications: pending → approved/rejected/waitlisted → withdrawn
 * - Activity Participants: invited → accepted/declined, standby
 * - LFG Sessions: open → full → in-progress → completed/cancelled
 *
 * Each domain defines its OWN transition map — this module provides the
 * engine to validate and execute transitions.
 */

import { ValidationError } from '../../utils/apiErrors';

// ─── Types ───────────────────────────────────────────────────────────

export type Actor = 'member' | 'admin' | 'system';

export interface TransitionDef<S extends string = string> {
  to: S;
  actor: Actor;
  /** Optional guard label for audit / UI */
  label?: string;
}

/**
 * A transition map: for each status, defines which statuses it can move to
 * and who is allowed to trigger the transition.
 *
 * Example:
 * ```ts
 * const CREW_TRANSITIONS: TransitionMap<CrewStatus> = {
 *   active:    [{ to: 'inactive', actor: 'admin' }, { to: 'completed', actor: 'admin' }],
 *   inactive:  [{ to: 'active', actor: 'admin' }, { to: 'completed', actor: 'admin' }],
 *   completed: [],  // terminal
 * };
 * ```
 */
export type TransitionMap<S extends string = string> = Record<S, TransitionDef<S>[]>;

// ─── Pre-Built Transition Maps ───────────────────────────────────────

/**
 * Crew Assignment status transitions.
 * Simple 3-state model matching AssignmentStatus enum.
 */
export const CREW_TRANSITIONS: TransitionMap<'active' | 'inactive' | 'completed'> = {
  active: [
    { to: 'inactive', actor: 'admin', label: 'Deactivate' },
    { to: 'completed', actor: 'admin', label: 'Complete' },
  ],
  inactive: [
    { to: 'active', actor: 'admin', label: 'Reactivate' },
    { to: 'completed', actor: 'admin', label: 'Complete' },
  ],
  completed: [], // terminal
};

/**
 * Job Application status transitions.
 * Matches the existing JobApplicationService workflow.
 */
export const JOB_APPLICATION_TRANSITIONS: TransitionMap<
  'pending' | 'approved' | 'rejected' | 'waitlisted' | 'withdrawn'
> = {
  pending: [
    { to: 'approved', actor: 'admin', label: 'Approve' },
    { to: 'rejected', actor: 'admin', label: 'Reject' },
    { to: 'waitlisted', actor: 'admin', label: 'Waitlist' },
    { to: 'withdrawn', actor: 'member', label: 'Withdraw' },
  ],
  waitlisted: [
    { to: 'approved', actor: 'admin', label: 'Approve from waitlist' },
    { to: 'rejected', actor: 'admin', label: 'Reject' },
    { to: 'withdrawn', actor: 'member', label: 'Withdraw' },
  ],
  approved: [{ to: 'withdrawn', actor: 'member', label: 'Leave' }],
  rejected: [], // terminal
  withdrawn: [], // terminal
};

/**
 * Unified Application status transitions.
 * Covers both user→org and org→alliance join requests.
 * Simplified 4-state model (no waitlist).
 */
export const APPLICATION_TRANSITIONS: TransitionMap<
  'pending' | 'approved' | 'rejected' | 'withdrawn'
> = {
  pending: [
    { to: 'approved', actor: 'admin', label: 'Approve' },
    { to: 'rejected', actor: 'admin', label: 'Reject' },
    { to: 'withdrawn', actor: 'member', label: 'Withdraw' },
  ],
  approved: [], // terminal — member was added
  rejected: [], // terminal — can re-apply later
  withdrawn: [], // terminal — can re-apply later
};

/**
 * @deprecated Use APPLICATION_TRANSITIONS instead
 */
export const ORG_APPLICATION_TRANSITIONS: TransitionMap<
  'pending' | 'approved' | 'rejected' | 'withdrawn'
> = APPLICATION_TRANSITIONS;

/**
 * Invitation status transitions (push-based join workflow).
 *
 * Flow:
 *   pending → approved (admin approves member-sent invite)
 *           → rejected (admin rejects member-sent invite)
 *           → expired  (TTL reached)
 *   approved → accepted (invitee accepts)
 *           → declined (invitee declines)
 *           → expired  (TTL reached)
 *   accepted / rejected / declined / expired → terminal
 *
 * Officer-sent invites skip to 'approved' status immediately.
 */
export const INVITATION_TRANSITIONS: TransitionMap<
  'pending' | 'approved' | 'accepted' | 'rejected' | 'declined' | 'expired'
> = {
  pending: [
    { to: 'approved', actor: 'admin', label: 'Approve invite' },
    { to: 'rejected', actor: 'admin', label: 'Reject invite' },
    { to: 'expired', actor: 'system', label: 'Expire' },
  ],
  approved: [
    { to: 'accepted', actor: 'member', label: 'Accept invite' },
    { to: 'declined', actor: 'member', label: 'Decline invite' },
    { to: 'expired', actor: 'system', label: 'Expire' },
  ],
  accepted: [], // terminal — member was added
  rejected: [], // terminal
  declined: [], // terminal
  expired: [], // terminal
};

/**
 * Activity Participant status transitions.
 */
export const ACTIVITY_PARTICIPANT_TRANSITIONS: TransitionMap<
  'invited' | 'accepted' | 'declined' | 'standby' | 'withdrawn'
> = {
  invited: [
    { to: 'accepted', actor: 'member', label: 'Accept invite' },
    { to: 'declined', actor: 'member', label: 'Decline invite' },
  ],
  accepted: [
    { to: 'withdrawn', actor: 'member', label: 'Leave' },
    { to: 'standby', actor: 'admin', label: 'Move to standby' },
  ],
  standby: [
    { to: 'accepted', actor: 'admin', label: 'Promote to active' },
    { to: 'withdrawn', actor: 'member', label: 'Leave' },
  ],
  declined: [], // terminal
  withdrawn: [], // terminal
};

// ─── MembershipWorkflow Engine ───────────────────────────────────────

export class MembershipWorkflow {
  /**
   * Check whether a transition from `currentStatus` to `newStatus` is valid
   * for the given actor type.
   */
  static canTransition<S extends string>(
    map: TransitionMap<S>,
    currentStatus: S,
    newStatus: S,
    actor: Actor
  ): boolean {
    const allowed = map[currentStatus];
    if (!allowed) {
      return false;
    }
    return allowed.some(t => t.to === newStatus && t.actor === actor);
  }

  /**
   * Get all valid next statuses from the current status.
   * Optionally filter by actor.
   */
  static getValidTransitions<S extends string>(
    map: TransitionMap<S>,
    currentStatus: S,
    actor?: Actor
  ): TransitionDef<S>[] {
    const allowed = map[currentStatus] ?? [];
    if (!actor) {
      return allowed;
    }
    return allowed.filter(t => t.actor === actor);
  }

  /**
   * Validate and return the new status if the transition is allowed.
   *
   * @throws ValidationError if the transition is invalid
   */
  static validateTransition<S extends string>(
    map: TransitionMap<S>,
    currentStatus: S,
    newStatus: S,
    actor: Actor
  ): S {
    if (currentStatus === newStatus) {
      return newStatus;
    } // no-op

    if (!MembershipWorkflow.canTransition(map, currentStatus, newStatus, actor)) {
      // Build a helpful error message
      const validTargets = MembershipWorkflow.getValidTransitions(map, currentStatus, actor);

      if (validTargets.length === 0) {
        throw new ValidationError(
          `Cannot change status from "${currentStatus}" — it is a terminal state`
        );
      }

      const validNames = validTargets.map(t => `"${t.to}"`).join(', ');
      throw new ValidationError(
        `Cannot transition from "${currentStatus}" to "${newStatus}" as ${actor}. Valid targets: ${validNames}`
      );
    }

    return newStatus;
  }

  /**
   * Check if a status is terminal (no outgoing transitions).
   */
  static isTerminal<S extends string>(map: TransitionMap<S>, status: S): boolean {
    const allowed = map[status];
    return !allowed || allowed.length === 0;
  }
}

