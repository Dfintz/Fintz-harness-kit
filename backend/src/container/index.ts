/**
 * Dependency Injection Container
 * 
 * This module sets up the tsyringe dependency injection container
 * for the backend services. It provides centralized dependency
 * registration and resolution.
 * 
 * @module container
 */

import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';

import { AppDataSource } from '../config/database';
import { logger } from '../utils/logger';

// Injection tokens for repositories and services
export const TOKENS = {
  // Database
  DATA_SOURCE: 'DataSource',
  
  // Repositories (lazy registration after DB init)
  FLEET_REPOSITORY: 'FleetRepository',
  USER_REPOSITORY: 'UserRepository',
  ORGANIZATION_REPOSITORY: 'OrganizationRepository',
  SHIP_REPOSITORY: 'ShipRepository',
  ACTIVITY_REPOSITORY: 'ActivityRepository',
  
  // Core Services
  LOGGER: 'Logger',
  CACHE_SERVICE: 'CacheService',
  
  // Domain Services
  FLEET_SERVICE: 'FleetService',
  USER_SERVICE: 'UserService',
  ORGANIZATION_SERVICE: 'OrganizationService',
  ACTIVITY_SERVICE: 'ActivityService',
  SHIP_SERVICE: 'ShipService',
} as const;

/**
 * Register core dependencies that don't require database
 */
function registerCoreDependencies(container: DependencyContainer): void {
  // Register logger as singleton
  container.register(TOKENS.LOGGER, {
    useValue: logger
  });
  
  logger.info('Core dependencies registered');
}

/**
 * Register database-dependent dependencies
 * Call this after database initialization
 */
export function registerDatabaseDependencies(): void {
  if (!AppDataSource.isInitialized) {
    logger.warn('Cannot register database dependencies - DataSource not initialized');
    return;
  }
  
  // Register DataSource
  container.register(TOKENS.DATA_SOURCE, {
    useValue: AppDataSource
  });
  
  logger.info('Database dependencies registered');
}

/**
 * Initialize the dependency injection container
 */
export function initializeContainer(): DependencyContainer {
  registerCoreDependencies(container);
  return container;
}

/**
 * Get the container instance
 */
export function getContainer(): DependencyContainer {
  return container;
}

/**
 * Resolve a dependency from the container
 */
export function resolve<T>(token: string): T {
  return container.resolve<T>(token);
}

// Export the container instance
export { container };
