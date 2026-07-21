/**
 * Activity DataLoaders
 *
 * DataLoader implementations for batching and caching Activity entity queries
 */

import DataLoader from 'dataloader';
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Activity } from '../../models/Activity';
import { logger } from '../../utils/logger';

import { DataLoaderOptions, DEFAULT_DATALOADER_OPTIONS } from './types';

/**
 * Create a DataLoader for loading activities by ID
 *
 * Batches multiple activity ID lookups into a single query
 */
export function createActivityByIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Activity | null> {
  return new DataLoader<string, Activity | null>(
    async (activityIds: readonly string[]) => {
      try {
        const activityRepository = AppDataSource.getRepository(Activity);
        const activities = await activityRepository.find({
          where: { id: In([...activityIds]) },
        });

        // Create a map for O(1) lookup
        const activityMap = new Map<string, Activity>();
        activities.forEach(activity => activityMap.set(activity.id, activity));

        // Return activities in the same order as requested IDs
        return activityIds.map(id => activityMap.get(id) ?? null);
      } catch (error) {
        logger.error('Error in activityByIdLoader:', error);
        return activityIds.map(() => null);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}

/**
 * Create a DataLoader for loading activities by organization ID
 *
 * Batches queries to get all activities for specific organizations
 */
export function createActivitiesByOrganizationIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Activity[]> {
  return new DataLoader<string, Activity[]>(
    async (organizationIds: readonly string[]) => {
      try {
        const activityRepository = AppDataSource.getRepository(Activity);

        const activities = await activityRepository.find({
          where: { organizationId: In([...organizationIds]) },
          order: { scheduledStartDate: 'DESC' },
        });

        // Group activities by organization ID
        const activitiesByOrgId = new Map<string, Activity[]>();
        organizationIds.forEach(id => activitiesByOrgId.set(id, []));

        activities.forEach(activity => {
          const activityList = activity.organizationId
            ? activitiesByOrgId.get(activity.organizationId)
            : undefined;
          if (activityList) {
            activityList.push(activity);
          }
        });

        // Return activities in the same order as requested organization IDs
        return organizationIds.map(id => activitiesByOrgId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in activitiesByOrganizationIdLoader:', error);
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
 * Create a DataLoader for loading activities by user ID (participant or creator)
 *
 * Batches queries to get all activities a user is participating in or has created
 */
export function createActivitiesByUserIdLoader(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoader<string, Activity[]> {
  return new DataLoader<string, Activity[]>(
    async (userIds: readonly string[]) => {
      try {
        const activityRepository = AppDataSource.getRepository(Activity);

        // Query activities where user is a creator
        const activities = await activityRepository
          .createQueryBuilder('activity')
          .where('activity.creatorId IN (:...userIds)', { userIds: [...userIds] })
          .orderBy('activity.scheduledStartDate', 'DESC')
          .getMany();

        // Group activities by user ID (creator)
        const activitiesByUserId = new Map<string, Activity[]>();
        userIds.forEach(id => activitiesByUserId.set(id, []));

        activities.forEach(activity => {
          // Check if user is creator
          if (activity.creatorId && userIds.includes(activity.creatorId)) {
            const activityList = activitiesByUserId.get(activity.creatorId);
            if (activityList) {
              activityList.push(activity);
            }
          }
        });

        // Return activities in the same order as requested user IDs
        return userIds.map(id => activitiesByUserId.get(id) ?? []);
      } catch (error) {
        logger.error('Error in activitiesByUserIdLoader:', error);
        return userIds.map(() => []);
      }
    },
    {
      cache: options.cache ?? true,
      maxBatchSize: options.maxBatchSize ?? 100,
    }
  );
}
