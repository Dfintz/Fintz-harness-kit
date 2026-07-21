/**
 * DataLoader Type Definitions
 * 
 * Common types used across DataLoader implementations
 */

import DataLoader from 'dataloader';

import { Activity } from '../../models/Activity';
import { Fleet } from '../../models/Fleet';
import { Organization } from '../../models/Organization';
import { Ship } from '../../models/Ship';
import { User } from '../../models/User';

/**
 * Interface for all DataLoaders available in GraphQL context
 */
export interface DataLoaders {
  // Entity loaders by ID
  userById: DataLoader<string, User | null>;
  organizationById: DataLoader<string, Organization | null>;
  fleetById: DataLoader<string, Fleet | null>;
  shipById: DataLoader<string, Ship | null>;
  activityById: DataLoader<string, Activity | null>;

  // Relationship loaders - users
  usersByOrganizationId: DataLoader<string, User[]>;
  
  // Relationship loaders - organizations
  organizationsByUserId: DataLoader<string, Organization[]>;
  
  // Relationship loaders - fleets
  fleetsByOrganizationId: DataLoader<string, Fleet[]>;
  fleetsByLeaderId: DataLoader<string, Fleet[]>;
  
  // Relationship loaders - ships
  shipsByUserId: DataLoader<string, Ship[]>;
  shipsByOrganizationId: DataLoader<string, Ship[]>;
  shipsByFleetId: DataLoader<string, Ship[]>;
  
  // Relationship loaders - activities
  activitiesByOrganizationId: DataLoader<string, Activity[]>;
  activitiesByUserId: DataLoader<string, Activity[]>;
}

/**
 * Options for creating DataLoaders with caching configuration
 */
export interface DataLoaderOptions {
  /**
   * Whether to cache loaded values (default: true)
   * Should be true for per-request DataLoaders
   */
  cache?: boolean;
  
  /**
   * Maximum batch size for batching queries
   */
  maxBatchSize?: number;
  
  /**
   * Whether to batch requests (default: true)
   */
  batch?: boolean;
}

/**
 * Default DataLoader options optimized for GraphQL requests
 */
export const DEFAULT_DATALOADER_OPTIONS: DataLoaderOptions = {
  cache: true,
  maxBatchSize: 100,
  batch: true,
};
