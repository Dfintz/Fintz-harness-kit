"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningOperationService = void 0;
const database_1 = require("../../config/database");
const MiningOperation_1 = require("../../models/MiningOperation");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
class MiningOperationService {
    repository;
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(MiningOperation_1.MiningOperation);
    }
    async create(dto) {
        logger_1.logger.debug('MiningOperationService.create', { name: dto.name });
        const operation = this.repository.create({
            id: crypto.randomUUID(),
            name: dto.name,
            description: dto.description,
            location: dto.location,
            coordinatorId: dto.coordinatorId,
            scheduledDate: new Date(dto.scheduledDate),
            notes: dto.notes,
            status: MiningOperation_1.MiningOperationStatus.PLANNED,
            crew: [],
            resourcesFound: [],
            totalValue: 0,
        });
        await this.repository.save(operation);
        return operation;
    }
    async findAll(pagination) {
        return (0, pagination_1.paginateRepository)(this.repository, pagination, undefined, 'createdAt');
    }
    async findById(id) {
        const operation = await this.repository.findOne({ where: { id } });
        if (!operation) {
            throw new apiErrors_1.NotFoundError('Mining operation');
        }
        return operation;
    }
    async update(id, updates) {
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
    async updateStatus(id, status) {
        if (!Object.values(MiningOperation_1.MiningOperationStatus).includes(status)) {
            throw new apiErrors_1.ValidationError(`Invalid mining operation status: ${status}`);
        }
        const operation = await this.findById(id);
        operation.status = status;
        if (status === MiningOperation_1.MiningOperationStatus.COMPLETED) {
            operation.completedDate = new Date();
        }
        await this.repository.save(operation);
        return operation;
    }
    async addCrewMember(id, member) {
        const operation = await this.findById(id);
        operation.crew.push(member);
        await this.repository.save(operation);
        return operation;
    }
    async recordResources(id, resource) {
        const operation = await this.findById(id);
        operation.resourcesFound.push(resource);
        operation.totalValue += resource.value;
        await this.repository.save(operation);
        return operation;
    }
    async delete(id) {
        const operation = await this.findById(id);
        await this.repository.remove(operation);
    }
}
exports.MiningOperationService = MiningOperationService;
//# sourceMappingURL=MiningOperationService.js.map