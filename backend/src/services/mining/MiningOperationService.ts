import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import {
  MiningOperation,
  MiningOperationStatus,
  type MiningCrew,
  type ResourceYield,
} from '../../models/MiningOperation';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions, paginateRepository } from '../../utils/pagination';

export interface CreateMiningOperationDto {
  name: string;
  description?: string;
  location: string;
  coordinatorId: string;
  scheduledDate: string;
  notes?: string;
}

export class MiningOperationService {
  private readonly repository: Repository<MiningOperation>;

  constructor() {
    this.repository = AppDataSource.getRepository(MiningOperation);
  }

  async create(dto: CreateMiningOperationDto): Promise<MiningOperation> {
    logger.debug('MiningOperationService.create', { name: dto.name });

    const operation = this.repository.create({
      id: crypto.randomUUID(),
      name: dto.name,
      description: dto.description,
      location: dto.location,
      coordinatorId: dto.coordinatorId,
      scheduledDate: new Date(dto.scheduledDate),
      notes: dto.notes,
      status: MiningOperationStatus.PLANNED,
      crew: [],
      resourcesFound: [],
      totalValue: 0,
    });

    await this.repository.save(operation);
    return operation;
  }

  async findAll(pagination: PaginationOptions): Promise<PaginatedResponse<MiningOperation>> {
    return paginateRepository(this.repository, pagination, undefined, 'createdAt');
  }

  async findById(id: string): Promise<MiningOperation> {
    const operation = await this.repository.findOne({ where: { id } });
    if (!operation) {
      throw new NotFoundError('Mining operation');
    }
    return operation;
  }

  async update(
    id: string,
    updates: { location?: string; resourceType?: string; notes?: string; description?: string }
  ): Promise<MiningOperation> {
    const operation = await this.findById(id);

    if (updates.location !== undefined) {
      operation.location = updates.location;
    }
    if (updates.resourceType !== undefined) {
      operation.name = updates.resourceType;
    }
    if (updates.notes !== undefined) {
      operation.notes = updates.notes;
    }
    if (updates.description !== undefined) {
      operation.description = updates.description;
    }

    await this.repository.save(operation);
    return operation;
  }

  async updateStatus(id: string, status: MiningOperationStatus): Promise<MiningOperation> {
    if (!Object.values(MiningOperationStatus).includes(status)) {
      throw new ValidationError(`Invalid mining operation status: ${status}`);
    }
    const operation = await this.findById(id);
    operation.status = status;

    if (status === MiningOperationStatus.COMPLETED) {
      operation.completedDate = new Date();
    }

    await this.repository.save(operation);
    return operation;
  }

  async addCrewMember(id: string, member: MiningCrew): Promise<MiningOperation> {
    const operation = await this.findById(id);
    operation.crew.push(member);
    await this.repository.save(operation);
    return operation;
  }

  async recordResources(id: string, resource: ResourceYield): Promise<MiningOperation> {
    const operation = await this.findById(id);
    operation.resourcesFound.push(resource);
    operation.totalValue += resource.value;
    await this.repository.save(operation);
    return operation;
  }

  async delete(id: string): Promise<void> {
    const operation = await this.findById(id);
    await this.repository.remove(operation);
  }
}

