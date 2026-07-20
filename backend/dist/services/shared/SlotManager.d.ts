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
export declare class SlotManager {
    static isFull(capacity: SlotCapacity): boolean;
    static meetsMinimum(capacity: SlotCapacity): boolean;
    static hasMember<T extends SlotMember>(members: T[], userId: string): boolean;
    static findMember<T extends SlotMember>(members: T[], userId: string): T | undefined;
    static addMember<T extends SlotMember>(members: T[], newMember: T, capacity?: SlotCapacity): AddMemberResult<T>;
    static removeMember<T extends SlotMember>(members: T[], userId: string): RemoveMemberResult<T>;
    static updateMember<T extends SlotMember>(members: T[], userId: string, updates: Partial<T>): T[];
    static fillRoleSlot(slot: RoleSlot, userId: string, userName?: string): RoleSlot;
    static unfillRoleSlot(slot: RoleSlot, userId: string): RoleSlot | null;
    static isUserAssignedToAnySlot(slots: RoleSlot[], userId: string): boolean;
    static totalSlotCapacity(slots: RoleSlot[]): SlotCapacity;
    static getOpenSlots(slots: RoleSlot[]): RoleSlot[];
    static countByRole<T extends SlotMember>(members: T[], role: string): number;
}
//# sourceMappingURL=SlotManager.d.ts.map