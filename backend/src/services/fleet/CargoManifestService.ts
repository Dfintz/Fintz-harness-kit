import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { CargoManifest, ManifestStatus } from '../../models/CargoManifest';
import { Ship } from '../../models/Ship';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions, paginateQueryBuilder } from '../../utils/pagination';

export interface CreateManifestDto {
  shipId: string;
  ownerId?: string;
  cargo?: CargoManifest['cargo'];
  origin?: string;
  destination?: string;
  sharedWithFleet?: boolean;
  sharedWithAlliance?: boolean;
  notes?: string;
}

export class CargoManifestService {
  private readonly repository: Repository<CargoManifest>;
  private readonly shipRepository: Repository<Ship>;

  constructor() {
    this.repository = AppDataSource.getRepository(CargoManifest);
    this.shipRepository = AppDataSource.getRepository(Ship);
  }

  private scopedManifestQuery(organizationId: string) {
    return this.repository
      .createQueryBuilder('manifest')
      .innerJoin(Ship, 'ship', 'ship.id = manifest.shipId')
      .where('ship.organizationId = :organizationId', { organizationId });
  }

  async create(
    dto: CreateManifestDto,
    organizationId: string,
    ownerId: string
  ): Promise<CargoManifest> {
    logger.debug('CargoManifestService.create', { shipId: dto.shipId });

    const shipExists = await this.shipRepository
      .createQueryBuilder('ship')
      .select('ship.id')
      .where('ship.id = :shipId', { shipId: dto.shipId })
      .andWhere('ship.organizationId = :organizationId', { organizationId })
      .getRawOne();
    if (!shipExists) {
      throw new NotFoundError('Ship');
    }

    const manifest = this.repository.create({
      id: crypto.randomUUID(),
      shipId: dto.shipId,
      ownerId,
      cargo: dto.cargo || [],
      origin: dto.origin,
      destination: dto.destination,
      sharedWithFleet: dto.sharedWithFleet || false,
      sharedWithAlliance: dto.sharedWithAlliance || false,
      notes: dto.notes,
      status: ManifestStatus.LOADING,
    });

    await this.repository.save(manifest);
    return manifest;
  }

  async findAll(
    pagination: PaginationOptions,
    organizationId: string
  ): Promise<PaginatedResponse<CargoManifest>> {
    const query = this.scopedManifestQuery(organizationId).orderBy('manifest.createdAt', 'DESC');
    return paginateQueryBuilder(query, pagination);
  }

  async findById(id: string, organizationId: string): Promise<CargoManifest> {
    const manifest = await this.scopedManifestQuery(organizationId)
      .andWhere('manifest.id = :id', { id })
      .getOne();

    if (!manifest) {
      throw new NotFoundError('Cargo manifest');
    }
    return manifest;
  }

  async addCargoItem(
    id: string,
    organizationId: string,
    item: { itemName: string; quantity: number; unitValue?: number }
  ): Promise<CargoManifest> {
    const manifest = await this.findById(id, organizationId);
    const totalValue = item.unitValue ? item.unitValue * item.quantity : undefined;

    manifest.cargo.push({
      itemName: item.itemName,
      quantity: item.quantity,
      unitValue: item.unitValue,
      totalValue,
    });

    await this.repository.save(manifest);
    return manifest;
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: ManifestStatus
  ): Promise<CargoManifest> {
    if (!Object.values(ManifestStatus).includes(status)) {
      throw new ValidationError(`Invalid manifest status: ${status}`);
    }
    const manifest = await this.findById(id, organizationId);
    manifest.status = status;

    if (status === ManifestStatus.IN_TRANSIT && !manifest.departureDate) {
      manifest.departureDate = new Date();
    }
    if (status === ManifestStatus.DELIVERED) {
      manifest.arrivalDate = new Date();
    }

    await this.repository.save(manifest);
    return manifest;
  }

  async updateSharing(
    id: string,
    organizationId: string,
    sharing: { sharedWithFleet?: boolean; sharedWithAlliance?: boolean }
  ): Promise<CargoManifest> {
    const manifest = await this.findById(id, organizationId);

    if (sharing.sharedWithFleet !== undefined) {
      manifest.sharedWithFleet = sharing.sharedWithFleet;
    }
    if (sharing.sharedWithAlliance !== undefined) {
      manifest.sharedWithAlliance = sharing.sharedWithAlliance;
    }

    await this.repository.save(manifest);
    return manifest;
  }
}

