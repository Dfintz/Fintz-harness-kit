import { Response } from 'express';

import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { Ship } from '../models/Ship';
import { NotFoundError } from '../utils/apiErrors';
import { extractPaginationOptions, paginateQueryBuilder } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * Controller for ship data operations
 * Extends BaseController for standardized error handling
 */
export class ShipController extends BaseController {
  private shipRepository = AppDataSource.getRepository(Ship);

  /**
   * GET /api/ships
   * Get all ships with filtering and pagination
   */
  getAllShips = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const paginationOptions = extractPaginationOptions(req);
      const {
        manufacturer,
        size,
        role,
        search,
        isVehicle,
        status,
        isActive = true,
        sortBy = 'name',
        sortOrder = 'ASC',
      } = req.query as Record<string, unknown>;

      const queryBuilder = this.shipRepository.createQueryBuilder('ship');

      const normalizeBoolean = (value: unknown, defaultValue?: boolean) => {
        if (value === undefined) {return defaultValue;}
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      };

      const normalizedIsVehicle = normalizeBoolean(isVehicle);
      const normalizedIsActive = normalizeBoolean(isActive, true);

      // Apply filters
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
        queryBuilder.andWhere(
          '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
          { search: `%${search}%` }
        );
      }

      if (normalizedIsVehicle !== undefined) {
        queryBuilder.andWhere('ship.isVehicle = :isVehicle', { isVehicle: normalizedIsVehicle });
      }

      if (status) {
        queryBuilder.andWhere('ship.status = :status', { status });
      }

      // Only show active ships by default unless explicitly overridden
      if (normalizedIsActive !== undefined) {
        queryBuilder.andWhere('ship.isActive = :isActive', { isActive: normalizedIsActive });
      }

      // Apply sorting (validated via Joi)
      queryBuilder.orderBy(`ship.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      return paginateQueryBuilder(queryBuilder, paginationOptions);
    });
  };

  /**
   * GET /api/ships/:id
   * Get ship by ID
   */
  getShipById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;

      const ship = await this.shipRepository.findOne({
        where: { id, isActive: true },
      });

      if (!ship) {
        throw new NotFoundError('Ship');
      }

      return ship;
    });
  };

  /**
   * GET /api/ships/manufacturers
   * Get list of all manufacturers
   */
  getManufacturers = async (req: AuthRequest, res: Response): Promise<void> => {
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

  /**
   * GET /api/ships/roles
   * Get list of all ship roles
   */
  getRoles = async (req: AuthRequest, res: Response): Promise<void> => {
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

  /**
   * GET /api/ships/vehicles
   * Get all vehicles/landcraft
   */
  getVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const paginationOptions = extractPaginationOptions(req);
      const { manufacturer, search } = req.query as Record<string, string>;

      const queryBuilder = this.shipRepository.createQueryBuilder('ship');
      queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: true });
      queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });

      if (manufacturer) {
        queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
      }

      if (search) {
        queryBuilder.andWhere(
          '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
          { search: `%${search}%` }
        );
      }

      queryBuilder.orderBy('ship.name', 'ASC');

      return paginateQueryBuilder(queryBuilder, paginationOptions);
    });
  };

  /**
   * GET /api/ships/spacecraft
   * Get all spacecraft (non-vehicles)
   */
  getSpacecraft = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const paginationOptions = extractPaginationOptions(req);
      const { manufacturer, size, role, search } = req.query as Record<string, string>;

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
        queryBuilder.andWhere(
          '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
          { search: `%${search}%` }
        );
      }

      queryBuilder.orderBy('ship.name', 'ASC');

      return paginateQueryBuilder(queryBuilder, paginationOptions);
    });
  };

  /**
   * POST /api/ships
   * Create a new ship (admin only)
   */
  createShip = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const shipData = req.body;

      // Generate ID if not provided
      if (!shipData.id) {
        shipData.id = `${shipData.manufacturer.toLowerCase().replace(/\s+/g, '-')}-${shipData.name.toLowerCase().replace(/\s+/g, '-')}`;
      }

      const ship = this.shipRepository.create(shipData);
      const savedShip = await this.shipRepository.save(ship);
      const finalShip = Array.isArray(savedShip) ? savedShip[0] : savedShip;

      res.status(201).json(finalShip);
    });
  };

  /**
   * PUT /api/ships/:id
   * Update a ship (admin only)
   */
  updateShip = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      const updateData = req.body;

      const ship = await this.shipRepository.findOne({ where: { id } });

      if (!ship) {
        throw new NotFoundError('Ship');
      }

      Object.assign(ship, updateData);
      return this.shipRepository.save(ship);
    });
  };

  /**
   * DELETE /api/ships/:id
   * Soft delete a ship (admin only)
   */
  deleteShip = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;

      const ship = await this.shipRepository.findOne({ where: { id } });

      if (!ship) {
        throw new NotFoundError('Ship');
      }

      // Soft delete by marking as inactive
      ship.isActive = false;
      await this.shipRepository.save(ship);

      return { message: 'Ship deleted successfully' };
    });
  };

  /**
   * GET /api/ships/stats
   * Get ship statistics
   */
  getStats = async (req: AuthRequest, res: Response): Promise<void> => {
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
