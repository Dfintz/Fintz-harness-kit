/**
 * SlotManager — Pure utility for managing members in a slot-based group.
 *
 * This is a stateless helper. It operates on arrays of SlotMember objects
 * and returns results — it does NOT touch the database.
 *
 * Consumers (CrewAssignmentService, ActivityParticipantService, JobApplicationService)
 * call SlotManager methods, then persist the result themselves.
 *
 * Design rationale: Each domain stores members differently (simple-json array,
 * JSONB per-ship breakdown, Redis list). A stateless utility avoids coupling
 * to any specific storage mechanism.
 */

import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';

// ─── Types ───────────────────────────────────────────────────────────

export interface SlotMember {
  userId: string;
  role?: string;
  assignedAt?: Date | string;
}

export interface RoleSlot {
  role: string;
  total: number;
  filled: number;
  required?: boolean;
  assignedUserIds?: string[];
  assignedUserNames?: string[];
}

export interface SlotCapacity {
  current: number;
  max?: number;
  min?: number;
}

export interface AddMemberResult<T extends SlotMember> {
  members: T[];
  added: T;
}

export interface RemoveMemberResult<T extends SlotMember> {
  members: T[];
  removed: T;
}

// ─── SlotManager ─────────────────────────────────────────────────────

export class SlotManager {
  /**
   * Check whether the group is at maximum capacity.
   */
  static isFull(capacity: SlotCapacity): boolean {
    if (!capacity.max || capacity.max <= 0) {
      return false;
    }
    return capacity.current >= capacity.max;
  }

  /**
   * Check whether the group meets minimum requirements to proceed.
   */
  static meetsMinimum(capacity: SlotCapacity): boolean {
    if (!capacity.min || capacity.min <= 0) {
      return true;
    }
    return capacity.current >= capacity.min;
  }

  /**
   * Check if a user is already present in the members array.
   */
  static hasMember<T extends SlotMember>(members: T[], userId: string): boolean {
    return members.some(m => m.userId === userId);
  }

  /**
   * Find a member by userId.
   */
  static findMember<T extends SlotMember>(members: T[], userId: string): T | undefined {
    return members.find(m => m.userId === userId);
  }

  /**
   * Add a member to the group, enforcing capacity and duplicate checks.
   *
   * @throws ConflictError if already present
   * @throws ValidationError if at capacity
   * @returns New members array + the added member
   */
  static addMember<T extends SlotMember>(
    members: T[],
    newMember: T,
    capacity?: SlotCapacity
  ): AddMemberResult<T> {
    // Duplicate check
    if (SlotManager.hasMember(members, newMember.userId)) {
      throw new ConflictError('User is already a member of this group');
    }

    // Capacity check
    if (capacity && SlotManager.isFull(capacity)) {
      throw new ValidationError(`Group is at maximum capacity (${capacity.max})`);
    }

    const updated = [...members, newMember];
    return { members: updated, added: newMember };
  }

  /**
   * Remove a member from the group.
   *
   * @throws NotFoundError if not present
   * @returns New members array + the removed member
   */
  static removeMember<T extends SlotMember>(members: T[], userId: string): RemoveMemberResult<T> {
    const member = SlotManager.findMember(members, userId);
    if (!member) {
      throw new NotFoundError('Member not found in group');
    }

    const updated = members.filter(m => m.userId !== userId);
    return { members: updated, removed: member };
  }

  /**
   * Replace a member's entry (e.g. change role or metadata).
   * @throws NotFoundError if not present
   */
  static updateMember<T extends SlotMember>(
    members: T[],
    userId: string,
    updates: Partial<T>
  ): T[] {
    const idx = members.findIndex(m => m.userId === userId);
    if (idx === -1) {
      throw new NotFoundError('Member not found in group');
    }

    const updated = [...members];
    updated[idx] = { ...updated[idx], ...updates };
    return updated;
  }

  // ─── Role Slot Operations ───────────────────────────────────────

  /**
   * Fill a typed role slot (e.g. "Gunner" slot 2 of 3).
   * Used by Job Listings and Activity ship crew breakdowns.
   *
   * @throws ConflictError if user already assigned to this role
   * @throws ValidationError if role is at capacity
   */
  static fillRoleSlot(slot: RoleSlot, userId: string, userName?: string): RoleSlot {
    const ids = slot.assignedUserIds ?? [];
    const names = slot.assignedUserNames ?? [];

    if (ids.includes(userId)) {
      throw new ConflictError(`User is already assigned to the ${slot.role} role`);
    }

    if (slot.filled >= slot.total) {
      throw new ValidationError(
        `The ${slot.role} role is already filled (${slot.total}/${slot.total})`
      );
    }

    const updatedIds = [...ids, userId];
    const updatedNames = userName ? [...names, userName] : names;

    return {
      ...slot,
      assignedUserIds: updatedIds,
      assignedUserNames: updatedNames,
      filled: updatedIds.length,
    };
  }

  /**
   * Remove a user from a role slot.
   *
   * @returns Updated slot, or null if user was not in this slot
   */
  static unfillRoleSlot(slot: RoleSlot, userId: string): RoleSlot | null {
    const ids = slot.assignedUserIds ?? [];
    if (!ids.includes(userId)) {
      return null;
    }

    const idx = ids.indexOf(userId);
    const updatedIds = ids.filter((_, i) => i !== idx);
    const updatedNames = (slot.assignedUserNames ?? []).filter((_, i) => i !== idx);

    return {
      ...slot,
      assignedUserIds: updatedIds,
      assignedUserNames: updatedNames,
      filled: updatedIds.length,
    };
  }

  /**
   * Check if a user is assigned to ANY role slot across a list of slots.
   * Useful for enforcing "one position per user" rules.
   */
  static isUserAssignedToAnySlot(slots: RoleSlot[], userId: string): boolean {
    return slots.some(slot => (slot.assignedUserIds ?? []).includes(userId));
  }

  /**
   * Calculate total capacity across a list of role slots.
   */
  static totalSlotCapacity(slots: RoleSlot[]): SlotCapacity {
    const total = slots.reduce((sum, s) => sum + s.total, 0);
    const filled = slots.reduce((sum, s) => sum + s.filled, 0);
    return { current: filled, max: total };
  }

  /**
   * Get unfilled role slots from a list.
   */
  static getOpenSlots(slots: RoleSlot[]): RoleSlot[] {
    return slots.filter(s => s.filled < s.total);
  }

  /**
   * Get count of members with a specific role.
   */
  static countByRole<T extends SlotMember>(members: T[], role: string): number {
    return members.filter(m => m.role === role).length;
  }
}

