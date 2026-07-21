/**
 * Fleet DataLoaders
 * 
 * DataLoader implementations for batching and caching Fleet entity queries
 */

import DataLoader from 'dataloader';
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Fleet } from '../../models/Fleet';
import { logger } from '../../utils/logger';

import { DataLoaderOptions, DEFAULT_DATALOADER_OPTIONS } from './types';

/**
 * Create a DataLoader for loading fleets by ID
 * 
 * Batches multiple fleet ID lookups into a single query
 */
export function createFleetByIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Fleet | null> {
  return new DataLoader<string, Fleet | null>(
    async (fleetIds: readonly string[]) => {
      try {
        const fleetRepository = AppDataSource.getRepository(Fleet);
        const fleets = await fleetRepository.find({
          where: { id: In([...fleetIds]) },
        });

        // Create a map for O(1) lookup
        const fleetMap = new Map<string, Fleet>();
        fleets.forEach((fleet) => fleetMap.set(fleet.id, fleet));

        // Return fleets in the same order as requested IDs
        return fleetIds.map((id) => fleetMap.get(id) ?? null);
      } catch (error) {
        logger.error('Error in fleetByIdLoader:', error);
        return fleetIds.map(() => null);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading fleets by organization ID
 * 
 * Batches queries to get all fleets belonging to multiple organizations
 */
export function createFleetsByOrganizationIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Fleet[]> {
  return new DataLoader<string, Fleet[]>(
    async (organizationIds: readonly string[]) => {
      try {
        const fleetRepository = AppDataSource.getRepository(Fleet);
        
        const fleets = await fleetRepository.find({
          where: { organizationId: In([...organizationIds]) },
          order: { createdAt: 'DESC' },
        });

        // Group fleets by organization ID
        const fleetsByOrgId = new Map<string, Fleet[]>();
        organizationIds.forEach((id) => fleetsByOrgId.set(id, []));

        fleets.forEach((fleet) => {
          const fleetList = fleetsByOrgId.get(fleet.organizationId);
          if (fleetList) {
            fleetList.push(fleet);
          }
        });

        // Return fleets in the same order as requested organization IDs
        return organizationIds.map((id) => fleetsByOrgId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in fleetsByOrganizationIdLoader:', error);
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
 * Create a DataLoader for loading fleets by leader ID
 * 
 * Batches queries to get all fleets led by specific users
 */
export function createFleetsByLeaderIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Fleet[]> {
  return new DataLoader<string, Fleet[]>(
    async (leaderIds: readonly string[]) => {
      try {
        const fleetRepository = AppDataSource.getRepository(Fleet);
        
        const fleets = await fleetRepository.find({
          where: { leaderId: In([...leaderIds]) },
          order: { createdAt: 'DESC' },
        });

        // Group fleets by leader ID
        const fleetsByLeaderId = new Map<string, Fleet[]>();
        leaderIds.forEach((id) => fleetsByLeaderId.set(id, []));

        fleets.forEach((fleet) => {
          if (fleet.leaderId) {
            const fleetList = fleetsByLeaderId.get(fleet.leaderId);
            if (fleetList) {
              fleetList.push(fleet);
            }
          }
        });

        // Return fleets in the same order as requested leader IDs
        return leaderIds.map((id) => fleetsByLeaderId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in fleetsByLeaderIdLoader:', error);
        return leaderIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}
