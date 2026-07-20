/**
 * Router Module
 * 
 * Exports router configuration and utilities for React Router v6
 * with data loaders for prefetching.
 * 
 * @module router
 */

export {
    createActivitiesListLoader, createActivityDetailLoader, createFleetDetailLoader,
    createFleetListLoader, createOrganizationShipsLoader,
    createOrganizationsListLoader,
    createPersonalHangarLoader,
    createUserShipsLoader,
    handleLoaderError
} from './loaders';
export { createAppRouter, createRoutes } from './routes';

