/**
 * User DataLoaders
 * 
 * DataLoader implementations for batching and caching User entity queries
 */

import DataLoader from 'dataloader';
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';

import { DataLoaderOptions, DEFAULT_DATALOADER_OPTIONS } from './types';

/**
 * Create a DataLoader for loading users by ID
 * 
 * This batches multiple user ID lookups into a single query,
 * preventing N+1 queries when resolving user references.
 */
export function createUserByIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, User | null> {
  return new DataLoader<string, User | null>(
    async (userIds: readonly string[]) => {
      try {
        const userRepository = AppDataSource.getRepository(User);
        const users = await userRepository.find({
          where: { id: In([...userIds]) },
        });

        // Create a map for O(1) lookup
        const userMap = new Map<string, User>();
        users.forEach((user) => userMap.set(user.id, user));

        // Return users in the same order as requested IDs
        // Return null for any IDs that weren't found
        return userIds.map((id) => userMap.get(id) ?? null);
      } catch (error) {
        logger.error('Error in userByIdLoader:', error);
        // Return null for all IDs on error
        return userIds.map(() => null);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading users by organization ID
 * 
 * Batches queries to get all users belonging to multiple organizations
 */
export function createUsersByOrganizationIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, User[]> {
  return new DataLoader<string, User[]>(
    async (organizationIds: readonly string[]) => {
      try {
        const membershipRepository = AppDataSource.getRepository(OrganizationMembership);
        
        // Get all memberships for the requested organizations
        const memberships = await membershipRepository
          .createQueryBuilder('membership')
          .leftJoinAndSelect('membership.user', 'user')
          .where('membership.organizationId IN (:...organizationIds)', {
            organizationIds: [...organizationIds],
          })
          .andWhere('membership.status = :status', { status: 'active' })
          .getMany();

        // Group users by organization ID
        const usersByOrgId = new Map<string, User[]>();
        organizationIds.forEach((id) => usersByOrgId.set(id, []));

        memberships.forEach((membership) => {
          if (membership.user) {
            const users = usersByOrgId.get(membership.organizationId);
            if (users) {
              users.push(membership.user);
            }
          }
        });

        // Return users in the same order as requested organization IDs
        return organizationIds.map((id) => usersByOrgId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in usersByOrganizationIdLoader:', error);
        return organizationIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}
