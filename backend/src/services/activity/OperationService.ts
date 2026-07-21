import { Repository } from 'typeorm';

import { Operation, OperationType, OperationStatus } from '../../models/Operation';
import { TenantService } from '../base/TenantService';

// DTO placeholders - expand later.
export interface CreateOperationDTO {
  type: OperationType;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  participants?: string[];
}

export class OperationService extends TenantService<Operation> {
  constructor(repository: Repository<Operation>) {
    super(repository, { enableCache: true, cacheTTL: 300 });
  }

  async createOperation(orgId: string, data: CreateOperationDTO, userId: string): Promise<Operation> {
    // Basic validation
    if (!data.name || !data.type) {
      throw new Error('name and type are required');
    }
    return this.create(orgId, {
      type: data.type,
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      participants: data.participants || [],
      status: OperationStatus.PLANNED,
      createdBy: userId
    });
  }

  async getOperationsByType(orgId: string, type: OperationType): Promise<Operation[]> {
    return this.findAll(orgId, { where: { type } });
  }

  async updateOperationStatus(orgId: string, opId: string, status: OperationStatus): Promise<Operation | null> {
    const op = await this.findById(orgId, opId);
    if (!op) {return null;}
    op.status = status;
    return this.update(orgId, opId, op);
  }

  async getActiveOperations(orgId: string): Promise<Operation[]> {
    return this.findAll(orgId, { where: { status: OperationStatus.IN_PROGRESS } });
  }
}

