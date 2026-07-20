"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShipByIdLoader = createShipByIdLoader;
exports.createShipsByUserIdLoader = createShipsByUserIdLoader;
exports.createShipsByOrganizationIdLoader = createShipsByOrganizationIdLoader;
exports.createShipsByFleetIdLoader = createShipsByFleetIdLoader;
const dataloader_1 = __importDefault(require("dataloader"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Fleet_1 = require("../../models/Fleet");
const Ship_1 = require("../../models/Ship");
const UserShip_1 = require("../../models/UserShip");
const logger_1 = require("../../utils/logger");
const types_1 = require("./types");
function createShipByIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (shipIds) => {
        try {
            const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
            const ships = await shipRepository.find({
                where: { id: (0, typeorm_1.In)([...shipIds]) },
            });
            const shipMap = new Map();
            ships.forEach(ship => shipMap.set(ship.id, ship));
            return shipIds.map(id => shipMap.get(id) ?? null);
        }
        catch (error) {
            logger_1.logger.error('Error in shipByIdLoader:', error);
            return shipIds.map(() => null);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createShipsByUserIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (userIds) => {
        try {
            const userShipRepository = database_1.AppDataSource.getRepository(UserShip_1.UserShip);
            const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
            const userShips = await userShipRepository
                .createQueryBuilder('userShip')
                .where('userShip.userId IN (:...userIds)', {
                userIds: [...userIds],
            })
                .getMany();
            const shipIds = [...new Set(userShips.map(us => us.shipId).filter((id) => !!id))];
            const ships = shipIds.length > 0 ? await shipRepository.find({ where: { id: (0, typeorm_1.In)(shipIds) } }) : [];
            const shipMap = new Map();
            ships.forEach(ship => shipMap.set(ship.id, ship));
            const shipsByUserId = new Map();
            userIds.forEach(id => shipsByUserId.set(id, []));
            userShips.forEach(userShip => {
                if (!userShip.shipId) {
                    return;
                }
                const ship = shipMap.get(userShip.shipId);
                if (ship) {
                    const userShipList = shipsByUserId.get(userShip.userId);
                    if (userShipList) {
                        userShipList.push(ship);
                    }
                }
            });
            return userIds.map(id => shipsByUserId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in shipsByUserIdLoader:', error);
            return userIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createShipsByOrganizationIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (organizationIds) => {
        try {
            const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
            const ships = await shipRepository.find({
                where: { organizationId: (0, typeorm_1.In)([...organizationIds]) },
                order: { createdAt: 'DESC' },
            });
            const shipsByOrgId = new Map();
            organizationIds.forEach(id => shipsByOrgId.set(id, []));
            ships.forEach(ship => {
                if (ship.organizationId) {
                    const shipList = shipsByOrgId.get(ship.organizationId);
                    if (shipList) {
                        shipList.push(ship);
                    }
                }
            });
            return organizationIds.map(id => shipsByOrgId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in shipsByOrganizationIdLoader:', error);
            return organizationIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createShipsByFleetIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (fleetIds) => {
        try {
            const fleetRepository = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
            const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
            const fleets = await fleetRepository.find({
                where: { id: (0, typeorm_1.In)([...fleetIds]) },
                select: ['id', 'shipIds'],
            });
            const allShipIds = new Set();
            const fleetShipIdsMap = new Map();
            fleets.forEach(fleet => {
                const shipIds = fleet.shipIds || [];
                fleetShipIdsMap.set(fleet.id, shipIds);
                shipIds.forEach(id => allShipIds.add(id));
            });
            const ships = allShipIds.size > 0
                ? await shipRepository.find({ where: { id: (0, typeorm_1.In)([...allShipIds]) } })
                : [];
            const shipMap = new Map();
            ships.forEach(ship => shipMap.set(ship.id, ship));
            const shipsByFleetId = new Map();
            fleetIds.forEach(id => shipsByFleetId.set(id, []));
            fleetIds.forEach(fleetId => {
                const shipIds = fleetShipIdsMap.get(fleetId) || [];
                const fleetShips = shipIds
                    .map(shipId => shipMap.get(shipId))
                    .filter((ship) => ship !== undefined);
                shipsByFleetId.set(fleetId, fleetShips);
            });
            return fleetIds.map(id => shipsByFleetId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in shipsByFleetIdLoader:', error);
            return fleetIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
//# sourceMappingURL=shipLoaders.js.map