/**
 * DataLoaders Index
 *
 * Central factory for creating all DataLoaders needed for GraphQL resolvers.
 * Each request gets its own set of DataLoaders to ensure proper batching
 * and caching per request.
 */

import { Activity } from '../../models/Activity';
import { Fleet } from '../../models/Fleet';
import { Organization } from '../../models/Organization';
import { Ship } from '../../models/Ship';
import { User } from '../../models/User';

import {
  createActivitiesByOrganizationIdLoader,
  createActivitiesByUserIdLoader,
  createActivityByIdLoader,
} from './activityLoaders';
import {
  createFleetByIdLoader,
  createFleetsByLeaderIdLoader,
  createFleetsByOrganizationIdLoader,
} from './fleetLoaders';
import {
  createOrganizationByIdLoader,
  createOrganizationsByUserIdLoader,
} from './organizationLoaders';
import {
  createShipByIdLoader,
  createShipsByFleetIdLoader,
  createShipsByOrganizationIdLoader,
  createShipsByUserIdLoader,
} from './shipLoaders';
import { DataLoaderOptions, DataLoaders, DEFAULT_DATALOADER_OPTIONS } from './types';
import { createUserByIdLoader, createUsersByOrganizationIdLoader } from './userLoaders';

// Re-export types
export { DEFAULT_DATALOADER_OPTIONS } from './types';
export type { DataLoaderOptions, DataLoaders } from './types';

/**
 * Create a fresh set of DataLoaders for a new request
 *
 * This should be called once per GraphQL request to ensure that:
 * 1. Each request has its own cache (preventing stale data between requests)
 * 2. Batching is scoped to the request (optimal query batching)
 * 3. Memory is properly released after the request completes
 *
 * @param options - Optional configuration for DataLoader behavior
 * @returns A complete set of DataLoaders for all entity types
 *
 * @example
 * ```typescript
 * // In context creation
 * const loaders = createDataLoaders();
 *
 * // In a resolver
 * const user = await context.loaders.userById.load(userId);
 * const ships = await context.loaders.shipsByUserId.load(userId);
 * ```
 */
export function createDataLoaders(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): DataLoaders {
  return {
    // Entity loaders by ID
    userById: createUserByIdLoader(options),
    organizationById: createOrganizationByIdLoader(options),
    fleetById: createFleetByIdLoader(options),
    shipById: createShipByIdLoader(options),
    activityById: createActivityByIdLoader(options),

    // Relationship loaders - users
    usersByOrganizationId: createUsersByOrganizationIdLoader(options),

    // Relationship loaders - organizations
    organizationsByUserId: createOrganizationsByUserIdLoader(options),

    // Relationship loaders - fleets
    fleetsByOrganizationId: createFleetsByOrganizationIdLoader(options),
    fleetsByLeaderId: createFleetsByLeaderIdLoader(options),

    // Relationship loaders - ships
    shipsByUserId: createShipsByUserIdLoader(options),
    shipsByOrganizationId: createShipsByOrganizationIdLoader(options),
    shipsByFleetId: createShipsByFleetIdLoader(options),

    // Relationship loaders - activities
    activitiesByOrganizationId: createActivitiesByOrganizationIdLoader(options),
    activitiesByUserId: createActivitiesByUserIdLoader(options),
  };
}

/**
 * Create DataLoaders with cache priming
 *
 * This is useful when you have entities already loaded from another source
 * (e.g., from an initial query) and want to prime the DataLoader cache.
 *
 * @param options - DataLoader configuration options
 * @returns DataLoaders with a prime function
 *
 * @example
 * ```typescript
 * const { loaders, prime } = createDataLoadersWithPriming();
 *
 * // Prime the cache with existing data
 * prime.users([user1, user2, user3]);
 *
 * // Subsequent loads will hit cache
 * const user = await loaders.userById.load(user1.id); // From cache
 * ```
 */
export function createDataLoadersWithPriming(
  options: DataLoaderOptions = DEFAULT_DATALOADER_OPTIONS
): {
  loaders: DataLoaders;
  prime: {
    users: (users: User[]) => void;
    organizations: (orgs: Organization[]) => void;
    fleets: (fleets: Fleet[]) => void;
    ships: (ships: Ship[]) => void;
    activities: (activities: Activity[]) => void;
  };
} {
  const loaders = createDataLoaders(options);

  return {
    loaders,
    prime: {
      users: users => {
        users.forEach(user => {
          loaders.userById.prime(user.id, user);
        });
      },
      organizations: orgs => {
        orgs.forEach(org => {
          loaders.organizationById.prime(org.id, org);
        });
      },
      fleets: fleets => {
        fleets.forEach(fleet => {
          loaders.fleetById.prime(fleet.id, fleet);
        });
      },
      ships: ships => {
        ships.forEach(ship => {
          loaders.shipById.prime(ship.id, ship);
        });
      },
      activities: activities => {
        activities.forEach(activity => {
          loaders.activityById.prime(activity.id, activity);
        });
      },
    },
  };
}
