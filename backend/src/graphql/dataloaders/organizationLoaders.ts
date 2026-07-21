/**
 * Organization DataLoaders
 * 
 * DataLoader implementations for batching and caching Organization entity queries
 */

import DataLoader from 'dataloader';
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { logger } from '../../utils/logger';

import { DataLoaderOptions, DEFAULT_DATALOADER_OPTIONS } from './types';

/**
 * Create a DataLoader for loading organizations by ID
 * 
 * Batches multiple organization ID lookups into a single query
 */
export function createOrganizationByIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Organization | null> {
  return new DataLoader<string, Organization | null>(
    async (organizationIds: readonly string[]) => {
      try {
        const organizationRepository = AppDataSource.getRepository(Organization);
        const organizations = await organizationRepository.find({
          where: { id: In([...organizationIds]) },
        });

        // Create a map for O(1) lookup
        const orgMap = new Map<string, Organization>();
        organizations.forEach((org) => orgMap.set(org.id, org));

        // Return organizations in the same order as requested IDs
        return organizationIds.map((id) => orgMap.get(id) ?? null);
      } catch (error) {
        logger.error('Error in organizationByIdLoader:', error);
        return organizationIds.map(() => null);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading organizations by user ID
 * 
 * Batches queries to get all organizations a user belongs to
 */
export function createOrganizationsByUserIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Organization[]> {
  return new DataLoader<string, Organization[]>(
    async (userIds: readonly string[]) => {
      try {
        const membershipRepository = AppDataSource.getRepository(OrganizationMembership);
        
        // Get all memberships for the requested users
        const memberships = await membershipRepository
          .createQueryBuilder('membership')
          .leftJoinAndSelect('membership.organization', 'organization')
          .where('membership.userId IN (:...userIds)', {
            userIds: [...userIds],
          })
          .andWhere('membership.status = :status', { status: 'active' })
          .getMany();

        // Group organizations by user ID
        const orgsByUserId = new Map<string, Organization[]>();
        userIds.forEach((id) => orgsByUserId.set(id, []));

        memberships.forEach((membership) => {
          if (membership.organization) {
            const orgs = orgsByUserId.get(membership.userId);
            if (orgs) {
              orgs.push(membership.organization);
            }
          }
        });

        // Return organizations in the same order as requested user IDs
        return userIds.map((id) => orgsByUserId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in organizationsByUserIdLoader:', error);
        return userIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}
