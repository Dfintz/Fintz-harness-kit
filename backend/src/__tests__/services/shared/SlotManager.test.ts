import { SlotManager } from '../../../services/shared/SlotManager';
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/apiErrors';

interface TestMember {
  userId: string;
  role?: string;
  assignedAt?: Date;
}

describe('SlotManager', () => {
  describe('isFull', () => {
    it('should return false when max is 0 (unlimited)', () => {
      expect(SlotManager.isFull({ current: 100, max: 0 })).toBe(false);
    });

    it('should return false when max is undefined', () => {
      expect(SlotManager.isFull({ current: 5 })).toBe(false);
    });

    it('should return false when below capacity', () => {
      expect(SlotManager.isFull({ current: 3, max: 5 })).toBe(false);
    });

    it('should return true when at capacity', () => {
      expect(SlotManager.isFull({ current: 5, max: 5 })).toBe(true);
    });

    it('should return true when over capacity', () => {
      expect(SlotManager.isFull({ current: 6, max: 5 })).toBe(true);
    });
  });

  describe('meetsMinimum', () => {
    it('should return true when no minimum set', () => {
      expect(SlotManager.meetsMinimum({ current: 0 })).toBe(true);
    });

    it('should return false when below minimum', () => {
      expect(SlotManager.meetsMinimum({ current: 1, min: 3 })).toBe(false);
    });

    it('should return true when at minimum', () => {
      expect(SlotManager.meetsMinimum({ current: 3, min: 3 })).toBe(true);
    });
  });

  describe('hasMember / findMember', () => {
    const members: TestMember[] = [
      { userId: 'user-1', role: 'pilot' },
      { userId: 'user-2', role: 'gunner' },
    ];

    it('should find existing member', () => {
      expect(SlotManager.hasMember(members, 'user-1')).toBe(true);
      expect(SlotManager.findMember(members, 'user-1')?.role).toBe('pilot');
    });

    it('should not find missing member', () => {
      expect(SlotManager.hasMember(members, 'user-999')).toBe(false);
      expect(SlotManager.findMember(members, 'user-999')).toBeUndefined();
    });
  });

  describe('addMember', () => {
    it('should add a new member', () => {
      const members: TestMember[] = [{ userId: 'user-1', role: 'pilot' }];
      const newMember: TestMember = { userId: 'user-2', role: 'gunner' };

      const result = SlotManager.addMember(members, newMember);

      expect(result.members).toHaveLength(2);
      expect(result.added.userId).toBe('user-2');
    });

    it('should throw ConflictError for duplicate', () => {
      const members: TestMember[] = [{ userId: 'user-1', role: 'pilot' }];
      const duplicate: TestMember = { userId: 'user-1', role: 'gunner' };

      expect(() => SlotManager.addMember(members, duplicate)).toThrow(ConflictError);
    });

    it('should throw ValidationError when at capacity', () => {
      const members: TestMember[] = [{ userId: 'user-1' }, { userId: 'user-2' }];
      const newMember: TestMember = { userId: 'user-3' };

      expect(() => SlotManager.addMember(members, newMember, { current: 2, max: 2 })).toThrow(
        ValidationError
      );
    });

    it('should allow adding when capacity not specified', () => {
      const members: TestMember[] = [];
      const newMember: TestMember = { userId: 'user-1' };

      const result = SlotManager.addMember(members, newMember);
      expect(result.members).toHaveLength(1);
    });

    it('should not mutate the original array', () => {
      const members: TestMember[] = [{ userId: 'user-1' }];
      const newMember: TestMember = { userId: 'user-2' };

      SlotManager.addMember(members, newMember);
      expect(members).toHaveLength(1); // original unchanged
    });
  });

  describe('removeMember', () => {
    it('should remove an existing member', () => {
      const members: TestMember[] = [
        { userId: 'user-1', role: 'pilot' },
        { userId: 'user-2', role: 'gunner' },
      ];

      const result = SlotManager.removeMember(members, 'user-1');

      expect(result.members).toHaveLength(1);
      expect(result.removed.userId).toBe('user-1');
      expect(result.members[0].userId).toBe('user-2');
    });

    it('should throw NotFoundError for missing member', () => {
      const members: TestMember[] = [{ userId: 'user-1' }];

      expect(() => SlotManager.removeMember(members, 'user-999')).toThrow(NotFoundError);
    });

    it('should not mutate the original array', () => {
      const members: TestMember[] = [{ userId: 'user-1' }, { userId: 'user-2' }];

      SlotManager.removeMember(members, 'user-1');
      expect(members).toHaveLength(2); // original unchanged
    });
  });

  describe('updateMember', () => {
    it('should update member fields', () => {
      const members: TestMember[] = [{ userId: 'user-1', role: 'pilot' }];

      const result = SlotManager.updateMember(members, 'user-1', { role: 'captain' });

      expect(result[0].role).toBe('captain');
      expect(result[0].userId).toBe('user-1');
    });

    it('should throw NotFoundError for missing member', () => {
      const members: TestMember[] = [{ userId: 'user-1' }];

      expect(() => SlotManager.updateMember(members, 'user-999', { role: 'x' })).toThrow(
        NotFoundError
      );
    });
  });

  describe('fillRoleSlot', () => {
    it('should fill an empty role slot', () => {
      const slot = { role: 'gunner', total: 2, filled: 0 };

      const result = SlotManager.fillRoleSlot(slot, 'user-1', 'Alice');

      expect(result.filled).toBe(1);
      expect(result.assignedUserIds).toEqual(['user-1']);
      expect(result.assignedUserNames).toEqual(['Alice']);
    });

    it('should fill a partially-filled slot', () => {
      const slot = {
        role: 'gunner',
        total: 2,
        filled: 1,
        assignedUserIds: ['user-1'],
        assignedUserNames: ['Alice'],
      };

      const result = SlotManager.fillRoleSlot(slot, 'user-2', 'Bob');

      expect(result.filled).toBe(2);
      expect(result.assignedUserIds).toEqual(['user-1', 'user-2']);
    });

    it('should throw ConflictError for duplicate user in slot', () => {
      const slot = {
        role: 'gunner',
        total: 2,
        filled: 1,
        assignedUserIds: ['user-1'],
      };

      expect(() => SlotManager.fillRoleSlot(slot, 'user-1')).toThrow(ConflictError);
    });

    it('should throw ValidationError when slot is full', () => {
      const slot = {
        role: 'gunner',
        total: 1,
        filled: 1,
        assignedUserIds: ['user-1'],
      };

      expect(() => SlotManager.fillRoleSlot(slot, 'user-2')).toThrow(ValidationError);
    });
  });

  describe('unfillRoleSlot', () => {
    it('should remove user from slot', () => {
      const slot = {
        role: 'gunner',
        total: 2,
        filled: 2,
        assignedUserIds: ['user-1', 'user-2'],
        assignedUserNames: ['Alice', 'Bob'],
      };

      const result = SlotManager.unfillRoleSlot(slot, 'user-1');

      expect(result).not.toBeNull();
      expect(result!.filled).toBe(1);
      expect(result!.assignedUserIds).toEqual(['user-2']);
      expect(result!.assignedUserNames).toEqual(['Bob']);
    });

    it('should return null if user not in slot', () => {
      const slot = { role: 'gunner', total: 2, filled: 0 };

      expect(SlotManager.unfillRoleSlot(slot, 'user-999')).toBeNull();
    });
  });

  describe('isUserAssignedToAnySlot', () => {
    const slots = [
      { role: 'pilot', total: 1, filled: 1, assignedUserIds: ['user-1'] },
      { role: 'gunner', total: 2, filled: 1, assignedUserIds: ['user-2'] },
    ];

    it('should return true for assigned user', () => {
      expect(SlotManager.isUserAssignedToAnySlot(slots, 'user-1')).toBe(true);
    });

    it('should return false for unassigned user', () => {
      expect(SlotManager.isUserAssignedToAnySlot(slots, 'user-999')).toBe(false);
    });
  });

  describe('totalSlotCapacity', () => {
    it('should sum capacity across slots', () => {
      const slots = [
        { role: 'pilot', total: 1, filled: 1 },
        { role: 'gunner', total: 3, filled: 2 },
      ];

      const cap = SlotManager.totalSlotCapacity(slots);

      expect(cap.max).toBe(4);
      expect(cap.current).toBe(3);
    });
  });

  describe('countByRole', () => {
    const members: TestMember[] = [
      { userId: 'u1', role: 'pilot' },
      { userId: 'u2', role: 'gunner' },
      { userId: 'u3', role: 'gunner' },
    ];

    it('should count members with role', () => {
      expect(SlotManager.countByRole(members, 'gunner')).toBe(2);
    });

    it('should return 0 for missing role', () => {
      expect(SlotManager.countByRole(members, 'medic')).toBe(0);
    });
  });
});
