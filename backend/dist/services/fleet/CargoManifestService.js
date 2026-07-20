"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoManifestService = void 0;
const database_1 = require("../../config/database");
const CargoManifest_1 = require("../../models/CargoManifest");
const Ship_1 = require("../../models/Ship");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
class CargoManifestService {
    repository;
    shipRepository;
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(CargoManifest_1.CargoManifest);
        this.shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
    }
    scopedManifestQuery(organizationId) {
        return this.repository
            .createQueryBuilder('manifest')
            .innerJoin(Ship_1.Ship, 'ship', 'ship.id = manifest.shipId')
            .where('ship.organizationId = :organizationId', { organizationId });
    }
    async create(dto, organizationId, ownerId) {
        logger_1.logger.debug('CargoManifestService.create', { shipId: dto.shipId });
        const shipExists = await this.shipRepository
            .createQueryBuilder('ship')
            .select('ship.id')
            .where('ship.id = :shipId', { shipId: dto.shipId })
            .andWhere('ship.organizationId = :organizationId', { organizationId })
            .getRawOne();
        if (!shipExists) {
            throw new apiErrors_1.NotFoundError('Ship');
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
            status: CargoManifest_1.ManifestStatus.LOADING,
        });
        await this.repository.save(manifest);
        return manifest;
    }
    async findAll(pagination, organizationId) {
        const query = this.scopedManifestQuery(organizationId).orderBy('manifest.createdAt', 'DESC');
        return (0, pagination_1.paginateQueryBuilder)(query, pagination);
    }
    async findById(id, organizationId) {
        const manifest = await this.scopedManifestQuery(organizationId)
            .andWhere('manifest.id = :id', { id })
            .getOne();
        if (!manifest) {
            throw new apiErrors_1.NotFoundError('Cargo manifest');
        }
        return manifest;
    }
    async addCargoItem(id, organizationId, item) {
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
    async updateStatus(id, organizationId, status) {
        if (!Object.values(CargoManifest_1.ManifestStatus).includes(status)) {
            throw new apiErrors_1.ValidationError(`Invalid manifest status: ${status}`);
        }
        const manifest = await this.findById(id, organizationId);
        manifest.status = status;
        if (status === CargoManifest_1.ManifestStatus.IN_TRANSIT && !manifest.departureDate) {
            manifest.departureDate = new Date();
        }
        if (status === CargoManifest_1.ManifestStatus.DELIVERED) {
            manifest.arrivalDate = new Date();
        }
        await this.repository.save(manifest);
        return manifest;
    }
    async updateSharing(id, organizationId, sharing) {
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
exports.CargoManifestService = CargoManifestService;
//# sourceMappingURL=CargoManifestService.js.map