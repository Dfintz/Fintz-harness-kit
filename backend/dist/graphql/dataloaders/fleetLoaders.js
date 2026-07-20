"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFleetByIdLoader = createFleetByIdLoader;
exports.createFleetsByOrganizationIdLoader = createFleetsByOrganizationIdLoader;
exports.createFleetsByLeaderIdLoader = createFleetsByLeaderIdLoader;
const dataloader_1 = __importDefault(require("dataloader"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Fleet_1 = require("../../models/Fleet");
const logger_1 = require("../../utils/logger");
const types_1 = require("./types");
function createFleetByIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (fleetIds) => {
        try {
            const fleetRepository = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
            const fleets = await fleetRepository.find({
                where: { id: (0, typeorm_1.In)([...fleetIds]) },
            });
            const fleetMap = new Map();
            fleets.forEach((fleet) => fleetMap.set(fleet.id, fleet));
            return fleetIds.map((id) => fleetMap.get(id) ?? null);
        }
        catch (error) {
            logger_1.logger.error('Error in fleetByIdLoader:', error);
            return fleetIds.map(() => null);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createFleetsByOrganizationIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (organizationIds) => {
        try {
            const fleetRepository = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
            const fleets = await fleetRepository.find({
                where: { organizationId: (0, typeorm_1.In)([...organizationIds]) },
                order: { createdAt: 'DESC' },
            });
            const fleetsByOrgId = new Map();
            organizationIds.forEach((id) => fleetsByOrgId.set(id, []));
            fleets.forEach((fleet) => {
                const fleetList = fleetsByOrgId.get(fleet.organizationId);
                if (fleetList) {
                    fleetList.push(fleet);
                }
            });
            return organizationIds.map((id) => fleetsByOrgId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in fleetsByOrganizationIdLoader:', error);
            return organizationIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createFleetsByLeaderIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (leaderIds) => {
        try {
            const fleetRepository = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
            const fleets = await fleetRepository.find({
                where: { leaderId: (0, typeorm_1.In)([...leaderIds]) },
                order: { createdAt: 'DESC' },
            });
            const fleetsByLeaderId = new Map();
            leaderIds.forEach((id) => fleetsByLeaderId.set(id, []));
            fleets.forEach((fleet) => {
                if (fleet.leaderId) {
                    const fleetList = fleetsByLeaderId.get(fleet.leaderId);
                    if (fleetList) {
                        fleetList.push(fleet);
                    }
                }
            });
            return leaderIds.map((id) => fleetsByLeaderId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in fleetsByLeaderIdLoader:', error);
            return leaderIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
//# sourceMappingURL=fleetLoaders.js.map