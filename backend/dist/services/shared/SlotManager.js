"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotManager = void 0;
const apiErrors_1 = require("../../utils/apiErrors");
class SlotManager {
    static isFull(capacity) {
        if (!capacity.max || capacity.max <= 0) {
            return false;
        }
        return capacity.current >= capacity.max;
    }
    static meetsMinimum(capacity) {
        if (!capacity.min || capacity.min <= 0) {
            return true;
        }
        return capacity.current >= capacity.min;
    }
    static hasMember(members, userId) {
        return members.some(m => m.userId === userId);
    }
    static findMember(members, userId) {
        return members.find(m => m.userId === userId);
    }
    static addMember(members, newMember, capacity) {
        if (SlotManager.hasMember(members, newMember.userId)) {
            throw new apiErrors_1.ConflictError('User is already a member of this group');
        }
        if (capacity && SlotManager.isFull(capacity)) {
            throw new apiErrors_1.ValidationError(`Group is at maximum capacity (${capacity.max})`);
        }
        const updated = [...members, newMember];
        return { members: updated, added: newMember };
    }
    static removeMember(members, userId) {
        const member = SlotManager.findMember(members, userId);
        if (!member) {
            throw new apiErrors_1.NotFoundError('Member not found in group');
        }
        const updated = members.filter(m => m.userId !== userId);
        return { members: updated, removed: member };
    }
    static updateMember(members, userId, updates) {
        const idx = members.findIndex(m => m.userId === userId);
        if (idx === -1) {
            throw new apiErrors_1.NotFoundError('Member not found in group');
        }
        const updated = [...members];
        updated[idx] = { ...updated[idx], ...updates };
        return updated;
    }
    static fillRoleSlot(slot, userId, userName) {
        const ids = slot.assignedUserIds ?? [];
        const names = slot.assignedUserNames ?? [];
        if (ids.includes(userId)) {
            throw new apiErrors_1.ConflictError(`User is already assigned to the ${slot.role} role`);
        }
        if (slot.filled >= slot.total) {
            throw new apiErrors_1.ValidationError(`The ${slot.role} role is already filled (${slot.total}/${slot.total})`);
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
    static unfillRoleSlot(slot, userId) {
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
    static isUserAssignedToAnySlot(slots, userId) {
        return slots.some(slot => (slot.assignedUserIds ?? []).includes(userId));
    }
    static totalSlotCapacity(slots) {
        const total = slots.reduce((sum, s) => sum + s.total, 0);
        const filled = slots.reduce((sum, s) => sum + s.filled, 0);
        return { current: filled, max: total };
    }
    static getOpenSlots(slots) {
        return slots.filter(s => s.filled < s.total);
    }
    static countByRole(members, role) {
        return members.filter(m => m.role === role).length;
    }
}
exports.SlotManager = SlotManager;
//# sourceMappingURL=SlotManager.js.map