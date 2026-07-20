"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipController = void 0;
const database_1 = require("../config/database");
const Ship_1 = require("../models/Ship");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class ShipController extends BaseController_1.BaseController {
    shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
    getAllShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            const { manufacturer, size, role, search, isVehicle, status, isActive = true, sortBy = 'name', sortOrder = 'ASC', } = req.query;
            const queryBuilder = this.shipRepository.createQueryBuilder('ship');
            const normalizeBoolean = (value, defaultValue) => {
                if (value === undefined) {
                    return defaultValue;
                }
                if (typeof value === 'string') {
                    return value.toLowerCase() === 'true';
                }
                return Boolean(value);
            };
            const normalizedIsVehicle = normalizeBoolean(isVehicle);
            const normalizedIsActive = normalizeBoolean(isActive, true);
            if (manufacturer) {
                queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
            }
            if (size) {
                queryBuilder.andWhere('ship.size = :size', { size });
            }
            if (role) {
                queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` });
            }
            if (search) {
                queryBuilder.andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${search}%` });
            }
            if (normalizedIsVehicle !== undefined) {
                queryBuilder.andWhere('ship.isVehicle = :isVehicle', { isVehicle: normalizedIsVehicle });
            }
            if (status) {
                queryBuilder.andWhere('ship.status = :status', { status });
            }
            if (normalizedIsActive !== undefined) {
                queryBuilder.andWhere('ship.isActive = :isActive', { isActive: normalizedIsActive });
            }
            queryBuilder.orderBy(`ship.${sortBy}`, sortOrder);
            return (0, pagination_1.paginateQueryBuilder)(queryBuilder, paginationOptions);
        });
    };
    getShipById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const ship = await this.shipRepository.findOne({
                where: { id, isActive: true },
            });
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Ship');
            }
            return ship;
        });
    };
    getManufacturers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const manufacturers = await this.shipRepository
                .createQueryBuilder('ship')
                .select('DISTINCT ship.manufacturer', 'manufacturer')
                .where('ship.isActive = :isActive', { isActive: true })
                .orderBy('ship.manufacturer', 'ASC')
                .getRawMany();
            return manufacturers.map(m => m.manufacturer).filter(Boolean);
        });
    };
    getRoles = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const roles = await this.shipRepository
                .createQueryBuilder('ship')
                .select('DISTINCT ship.role', 'role')
                .where('ship.isActive = :isActive', { isActive: true })
                .andWhere('ship.role IS NOT NULL')
                .orderBy('ship.role', 'ASC')
                .getRawMany();
            return roles.map(r => r.role).filter(Boolean);
        });
    };
    getVehicles = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            const { manufacturer, search } = req.query;
            const queryBuilder = this.shipRepository.createQueryBuilder('ship');
            queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: true });
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
            if (manufacturer) {
                queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
            }
            if (search) {
                queryBuilder.andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${search}%` });
            }
            queryBuilder.orderBy('ship.name', 'ASC');
            return (0, pagination_1.paginateQueryBuilder)(queryBuilder, paginationOptions);
        });
    };
    getSpacecraft = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            const { manufacturer, size, role, search } = req.query;
            const queryBuilder = this.shipRepository.createQueryBuilder('ship');
            queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: false });
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
            if (manufacturer) {
                queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
            }
            if (size) {
                queryBuilder.andWhere('ship.size = :size', { size });
            }
            if (role) {
                queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` });
            }
            if (search) {
                queryBuilder.andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${search}%` });
            }
            queryBuilder.orderBy('ship.name', 'ASC');
            return (0, pagination_1.paginateQueryBuilder)(queryBuilder, paginationOptions);
        });
    };
    createShip = async (req, res) => {
        await this.execute(req, res, async () => {
            const shipData = req.body;
            if (!shipData.id) {
                shipData.id = `${shipData.manufacturer.toLowerCase().replace(/\s+/g, '-')}-${shipData.name.toLowerCase().replace(/\s+/g, '-')}`;
            }
            const ship = this.shipRepository.create(shipData);
            const savedShip = await this.shipRepository.save(ship);
            const finalShip = Array.isArray(savedShip) ? savedShip[0] : savedShip;
            res.status(201).json(finalShip);
        });
    };
    updateShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const updateData = req.body;
            const ship = await this.shipRepository.findOne({ where: { id } });
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Ship');
            }
            Object.assign(ship, updateData);
            return this.shipRepository.save(ship);
        });
    };
    deleteShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const ship = await this.shipRepository.findOne({ where: { id } });
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Ship');
            }
            ship.isActive = false;
            await this.shipRepository.save(ship);
            return { message: 'Ship deleted successfully' };
        });
    };
    getStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const totalShips = await this.shipRepository.count({
                where: { isActive: true, isVehicle: false },
            });
            const totalVehicles = await this.shipRepository.count({
                where: { isActive: true, isVehicle: true },
            });
            const byManufacturer = await this.shipRepository
                .createQueryBuilder('ship')
                .select('ship.manufacturer', 'manufacturer')
                .addSelect('COUNT(*)', 'count')
                .where('ship.isActive = :isActive', { isActive: true })
                .groupBy('ship.manufacturer')
                .orderBy('count', 'DESC')
                .limit(10)
                .getRawMany();
            const bySize = await this.shipRepository
                .createQueryBuilder('ship')
                .select('ship.size', 'size')
                .addSelect('COUNT(*)', 'count')
                .where('ship.isActive = :isActive', { isActive: true })
                .andWhere('ship.isVehicle = :isVehicle', { isVehicle: false })
                .groupBy('ship.size')
                .getRawMany();
            return {
                totalShips,
                totalVehicles,
                total: totalShips + totalVehicles,
                byManufacturer,
                bySize,
            };
        });
    };
}
exports.ShipController = ShipController;
//# sourceMappingURL=shipDataController.js.map