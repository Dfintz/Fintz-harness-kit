import { AppDataSource } from '../../config/database';
import { Equipment, EquipmentStatus } from '../../models/Equipment';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditCategory, auditService } from '../audit/AuditService';

/**
 * Equipment audit action types
 */
export enum EquipmentAuditAction {
  EQUIPMENT_CREATED = 'EQUIPMENT_CREATED',
  EQUIPMENT_UPDATED = 'EQUIPMENT_UPDATED',
  EQUIPMENT_DELETED = 'EQUIPMENT_DELETED',
  EQUIPMENT_TRANSFERRED = 'EQUIPMENT_TRANSFERRED',
  EQUIPMENT_COMPATIBILITY_CHECKED = 'EQUIPMENT_COMPATIBILITY_CHECKED',
}

export class EquipmentService {
  private readonly equipmentRepo = AppDataSource.getRepository(Equipment);

  private audit(
    action: EquipmentAuditAction,
    organizationId: string,
    userId: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): void {
    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action,
      message: `${action}: equipment ${resourceId}`,
      userId,
      organizationId,
      resource: `equipment:${resourceId}`,
      metadata: details,
    });
  }

  async listEquipment(
    organizationId: string,
    filters?: { type?: string; status?: string; ownerId?: string; shipId?: string }
  ): Promise<{ equipment: Equipment[]; total: number }> {
    const qb = this.equipmentRepo
      .createQueryBuilder('eq')
      .where('eq.organizationId = :organizationId', { organizationId })
      .orderBy('eq.createdAt', 'DESC');

    if (filters?.type) {
      qb.andWhere('eq.type = :type', { type: filters.type });
    }
    if (filters?.status) {
      qb.andWhere('eq.status = :status', { status: filters.status });
    }
    if (filters?.ownerId) {
      qb.andWhere('eq.ownerId = :ownerId', { ownerId: filters.ownerId });
    }
    if (filters?.shipId) {
      qb.andWhere('eq.shipId = :shipId', { shipId: filters.shipId });
    }

    const [equipment, total] = await qb.getManyAndCount();
    return { equipment, total };
  }

  async getEquipment(equipmentId: string, organizationId: string): Promise<Equipment | null> {
    return this.equipmentRepo.findOne({ where: { id: equipmentId, organizationId } });
  }

  async createEquipment(
    organizationId: string,
    ownerId: string,
    data: {
      name: string;
      type: string;
      rarity?: string;
      description?: string;
      shipId?: string;
      quantity?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Equipment> {
    if (!data.name?.trim()) {
      throw new ValidationError('Equipment name is required');
    }
    if (!data.type?.trim()) {
      throw new ValidationError('Equipment type is required');
    }
    if (data.quantity !== undefined && data.quantity < 1) {
      throw new ValidationError('Equipment quantity must be at least 1');
    }

    const equipment = this.equipmentRepo.create({
      ...data,
      name: data.name.trim(),
      type: data.type.trim(),
      organizationId,
      ownerId,
      status: EquipmentStatus.AVAILABLE,
    });
    const saved = await this.equipmentRepo.save(equipment);

    this.audit(EquipmentAuditAction.EQUIPMENT_CREATED, organizationId, ownerId, saved.id, {
      name: saved.name,
      type: saved.type,
    });

    return saved;
  }

  async updateEquipment(
    equipmentId: string,
    organizationId: string,
    userId: string,
    data: Partial<
      Pick<
        Equipment,
        'name' | 'type' | 'rarity' | 'description' | 'shipId' | 'status' | 'quantity' | 'metadata'
      >
    >
  ): Promise<Equipment> {
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Equipment name cannot be empty');
    }
    if (data.quantity !== undefined && data.quantity < 1) {
      throw new ValidationError('Equipment quantity must be at least 1');
    }

    const equipment = await this.equipmentRepo.findOne({
      where: { id: equipmentId, organizationId },
    });
    if (!equipment) {
      throw new NotFoundError('Equipment', equipmentId);
    }

    const previousValues = { name: equipment.name, status: equipment.status };
    Object.assign(equipment, data);
    const saved = await this.equipmentRepo.save(equipment);

    this.audit(EquipmentAuditAction.EQUIPMENT_UPDATED, organizationId, userId, equipmentId, {
      previousValues,
      newValues: data,
    });

    return saved;
  }

  async deleteEquipment(
    equipmentId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: equipmentId, organizationId },
    });
    if (!equipment) {
      throw new NotFoundError('Equipment', equipmentId);
    }
    await this.equipmentRepo.remove(equipment);

    this.audit(EquipmentAuditAction.EQUIPMENT_DELETED, organizationId, userId, equipmentId, {
      name: equipment.name,
      type: equipment.type,
    });
  }

  async checkCompatibility(
    equipmentId: string,
    shipId: string,
    organizationId: string
  ): Promise<{ compatible: boolean; reasons: string[] }> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: equipmentId, organizationId },
    });
    if (!equipment) {
      throw new NotFoundError('Equipment', equipmentId);
    }
    // Basic compatibility check — can be extended with ship-type matching
    const reasons: string[] = [];
    if (equipment.status === EquipmentStatus.DESTROYED) {
      reasons.push('Equipment is destroyed and cannot be mounted');
    }
    if (equipment.status === EquipmentStatus.IN_TRANSIT) {
      reasons.push('Equipment is currently in transit');
    }
    return { compatible: reasons.length === 0, reasons };
  }

  async getUserInventory(
    organizationId: string,
    userId: string
  ): Promise<{ equipment: Equipment[]; total: number }> {
    const [equipment, total] = await this.equipmentRepo.findAndCount({
      where: { organizationId, ownerId: userId },
      order: { createdAt: 'DESC' },
    });
    return { equipment, total };
  }

  async transfer(
    equipmentId: string,
    organizationId: string,
    fromUserId: string,
    toUserId: string
  ): Promise<Equipment> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: equipmentId, organizationId, ownerId: fromUserId },
    });
    if (!equipment) {
      throw new NotFoundError('Equipment', equipmentId);
    }
    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new ValidationError(`Cannot transfer equipment in status: ${equipment.status}`);
    }
    if (fromUserId === toUserId) {
      throw new ValidationError('Cannot transfer equipment to the same user');
    }

    equipment.ownerId = toUserId;
    equipment.status = EquipmentStatus.IN_TRANSIT;
    const saved = await this.equipmentRepo.save(equipment);

    this.audit(
      EquipmentAuditAction.EQUIPMENT_TRANSFERRED,
      organizationId,
      fromUserId,
      equipmentId,
      {
        fromUserId,
        toUserId,
        equipmentName: equipment.name,
      }
    );

    return saved;
  }
}

