import { Equipment } from '../../models/Equipment';
export declare enum EquipmentAuditAction {
    EQUIPMENT_CREATED = "EQUIPMENT_CREATED",
    EQUIPMENT_UPDATED = "EQUIPMENT_UPDATED",
    EQUIPMENT_DELETED = "EQUIPMENT_DELETED",
    EQUIPMENT_TRANSFERRED = "EQUIPMENT_TRANSFERRED",
    EQUIPMENT_COMPATIBILITY_CHECKED = "EQUIPMENT_COMPATIBILITY_CHECKED"
}
export declare class EquipmentService {
    private readonly equipmentRepo;
    private audit;
    listEquipment(organizationId: string, filters?: {
        type?: string;
        status?: string;
        ownerId?: string;
        shipId?: string;
    }): Promise<{
        equipment: Equipment[];
        total: number;
    }>;
    getEquipment(equipmentId: string, organizationId: string): Promise<Equipment | null>;
    createEquipment(organizationId: string, ownerId: string, data: {
        name: string;
        type: string;
        rarity?: string;
        description?: string;
        shipId?: string;
        quantity?: number;
        metadata?: Record<string, unknown>;
    }): Promise<Equipment>;
    updateEquipment(equipmentId: string, organizationId: string, userId: string, data: Partial<Pick<Equipment, 'name' | 'type' | 'rarity' | 'description' | 'shipId' | 'status' | 'quantity' | 'metadata'>>): Promise<Equipment>;
    deleteEquipment(equipmentId: string, organizationId: string, userId: string): Promise<void>;
    checkCompatibility(equipmentId: string, shipId: string, organizationId: string): Promise<{
        compatible: boolean;
        reasons: string[];
    }>;
    getUserInventory(organizationId: string, userId: string): Promise<{
        equipment: Equipment[];
        total: number;
    }>;
    transfer(equipmentId: string, organizationId: string, fromUserId: string, toUserId: string): Promise<Equipment>;
}
//# sourceMappingURL=EquipmentService.d.ts.map