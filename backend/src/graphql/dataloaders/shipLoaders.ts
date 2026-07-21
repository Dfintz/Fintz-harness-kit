/**
 * Ship DataLoaders
 *
 * DataLoader implementations for batching and caching Ship entity queries
 */

import DataLoader from 'dataloader';
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Fleet } from '../../models/Fleet';
import { Ship } from '../../models/Ship';
import { UserShip } from '../../models/UserShip';
import { logger } from '../../utils/logger';

import { DataLoaderOptions, DEFAULT_DATALOADER_OPTIONS } from './types';

/**
 * Create a DataLoader for loading ships by ID
 *
 * Batches multiple ship ID lookups into a single query
 */
export function createShipByIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Ship | null> {
  return new DataLoader<string, Ship | null>(
    async (shipIds: readonly string[]) => {
      try {
        const shipRepository = AppDataSource.getRepository(Ship);
        const ships = await shipRepository.find({
          where: { id: In([...shipIds]) },
        });

        // Create a map for O(1) lookup
        const shipMap = new Map<string, Ship>();
        ships.forEach(ship => shipMap.set(ship.id, ship));

        // Return ships in the same order as requested IDs
        return shipIds.map(id => shipMap.get(id) ?? null);
      } catch (error) {
        logger.error('Error in shipByIdLoader:', error);
        return shipIds.map(() => null);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading ships by user ID
 *
 * Batches queries to get all ships owned by specific users
 */
export function createShipsByUserIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Ship[]> {
  return new DataLoader<string, Ship[]>(
    async (userIds: readonly string[]) => {
      try {
        const userShipRepository = AppDataSource.getRepository(UserShip);
        const shipRepository = AppDataSource.getRepository(Ship);

        // Get user-ship associations
        const userShips = await userShipRepository
          .createQueryBuilder('userShip')
          .where('userShip.userId IN (:...userIds)', {
            userIds: [...userIds],
          })
          .getMany();

        // Get unique ship IDs, filtering out any undefined/null values
        const shipIds = [...new Set(userShips.map(us => us.shipId).filter((id): id is string => !!id))];

        // Fetch ships in a batch
        const ships =
          shipIds.length > 0 ? await shipRepository.find({ where: { id: In(shipIds) } }) : [];

        // Create ship lookup map
        const shipMap = new Map<string, Ship>();
        ships.forEach(ship => shipMap.set(ship.id, ship));

        // Group ships by user ID
        const shipsByUserId = new Map<string, Ship[]>();
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

        // Return ships in the same order as requested user IDs
        return userIds.map(id => shipsByUserId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in shipsByUserIdLoader:', error);
        return userIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading ships by organization ID
 *
 * Batches queries to get all ships belonging to specific organizations
 */
export function createShipsByOrganizationIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Ship[]> {
  return new DataLoader<string, Ship[]>(
    async (organizationIds: readonly string[]) => {
      try {
        const shipRepository = AppDataSource.getRepository(Ship);

        const ships = await shipRepository.find({
          where: { organizationId: In([...organizationIds]) },
          order: { createdAt: 'DESC' },
        });

        // Group ships by organization ID
        const shipsByOrgId = new Map<string, Ship[]>();
        organizationIds.forEach(id => shipsByOrgId.set(id, []));

        ships.forEach(ship => {
          if (ship.organizationId) {
            const shipList = shipsByOrgId.get(ship.organizationId);
            if (shipList) {
              shipList.push(ship);
            }
          }
        });

        // Return ships in the same order as requested organization IDs
        return organizationIds.map(id => shipsByOrgId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in shipsByOrganizationIdLoader:', error);
        return organizationIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading ships by fleet ID
 *
 * Batches queries to get all ships assigned to specific fleets
 * Ships are stored as shipIds array in the Fleet entity
 */
export function createShipsByFleetIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Ship[]> {
  return new DataLoader<string, Ship[]>(
    async (fleetIds: readonly string[]) => {
      try {
        const fleetRepository = AppDataSource.getRepository(Fleet);
        const shipRepository = AppDataSource.getRepository(Ship);

        // Get fleets to retrieve their shipIds
        const fleets = await fleetRepository.find({
          where: { id: In([...fleetIds]) },
          select: ['id', 'shipIds'],
        });

        // Collect all unique ship IDs from all fleets
        const allShipIds = new Set<string>();
        const fleetShipIdsMap = new Map<string, string[]>();

        fleets.forEach(fleet => {
          const shipIds = fleet.shipIds || [];
          fleetShipIdsMap.set(fleet.id, shipIds);
          shipIds.forEach(id => allShipIds.add(id));
        });

        // Batch load all ships
        const ships =
          allShipIds.size > 0
            ? await shipRepository.find({ where: { id: In([...allShipIds]) } })
            : [];

        // Create ship lookup map
        const shipMap = new Map<string, Ship>();
        ships.forEach(ship => shipMap.set(ship.id, ship));

        // Group ships by fleet ID
        const shipsByFleetId = new Map<string, Ship[]>();
        fleetIds.forEach(id => shipsByFleetId.set(id, []));

        fleetIds.forEach(fleetId => {
          const shipIds = fleetShipIdsMap.get(fleetId) || [];
          const fleetShips = shipIds
            .map(shipId => shipMap.get(shipId))
            .filter((ship): ship is Ship => ship !== undefined);
          shipsByFleetId.set(fleetId, fleetShips);
        });

        // Return ships in the same order as requested fleet IDs
        return fleetIds.map(id => shipsByFleetId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in shipsByFleetIdLoader:', error);
        return fleetIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}
