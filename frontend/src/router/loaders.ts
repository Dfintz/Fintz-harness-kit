/**
 * Route Loaders
 *
 * Data loaders for React Router that prefetch data before navigation.
 * These integrate with TanStack Query for caching and deduplication.
 *
 * @module router/loaders
 */

import { QueryClient } from '@tanstack/react-query';
import { LoaderFunctionArgs } from 'react-router-dom';

import { activityKeys, fleetKeys, organizationKeys } from '@/hooks/queries';
import { userShipKeys } from '@/hooks/queries/queryKeys';
import { fetchUserShips } from '@/hooks/queries/useUserShipQueries';
import {
    buildPersonalHangarQueryFilters,
    parsePersonalHangarFilters,
} from '@/pages/personalHangarFilters';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { fleetServiceV2 } from '@/services/fleetServiceV2';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { logger } from '@/utils/logger';

/**
 * Loader for the fleet detail page
 * Prefetches fleet data before navigation
 */
export function createFleetDetailLoader(queryClient: QueryClient) {
  return async ({ params }: LoaderFunctionArgs) => {
    const { fleetId } = params;

    if (!fleetId) {
      throw new Response('Fleet ID is required', { status: 400 });
    }

    // Check cache first
    const cachedData = queryClient.getQueryData(fleetKeys.detail(fleetId));
    if (cachedData) {
      return cachedData;
    }

    // Fetch and cache the data
    try {
      const fleet = await queryClient.fetchQuery({
        queryKey: fleetKeys.detail(fleetId),
        queryFn: () => fleetServiceV2.getFleetById(fleetId),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      return fleet;
    } catch (error) {
      throw new Response('Fleet not found', { status: 404 });
    }
  };
}

/**
 * Loader for the activity detail page
 * Prefetches activity data before navigation
 */
export function createActivityDetailLoader(queryClient: QueryClient) {
  return async ({ params }: LoaderFunctionArgs) => {
    const { id } = params;

    if (!id) {
      throw new Response('Activity ID is required', { status: 400 });
    }

    // Check cache first
    const cachedData = queryClient.getQueryData(activityKeys.detail(id));
    if (cachedData) {
      return cachedData;
    }

    // Fetch and cache the data
    try {
      const activity = await queryClient.fetchQuery({
        queryKey: activityKeys.detail(id),
        queryFn: () => activityServiceV2.getActivityById(id),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      return activity;
    } catch (error) {
      throw new Response('Activity not found', { status: 404 });
    }
  };
}

/**
 * Loader for the organization ships page
 * Prefetches organization overview data before navigation
 */
export function createOrganizationShipsLoader(queryClient: QueryClient) {
  return async ({ params }: LoaderFunctionArgs) => {
    const { orgId } = params;

    if (!orgId) {
      throw new Response('Organization ID is required', { status: 400 });
    }

    // Check cache first
    const cachedData = queryClient.getQueryData(organizationKeys.detail(orgId));
    if (cachedData) {
      return cachedData;
    }

    // Fetch and cache the organization overview
    try {
      const overview = await queryClient.fetchQuery({
        queryKey: organizationKeys.detail(orgId),
        queryFn: () => organizationServiceV2.getOverview(orgId),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      return overview;
    } catch (error) {
      throw new Response('Organization not found', { status: 404 });
    }
  };
}

/**
 * Loader for the Personal Hangar page (`/hangar`).
 *
 * Phase 3 of the architectural rework: filter state lives in the URL, so the
 * loader can read it during navigation and warm the React Query cache before
 * the component mounts. Uses the same `buildPersonalHangarQueryFilters` and
 * `fetchUserShips` as the page's `useUserShips` hook so the cache key matches
 * exactly — without that, the prefetch is wasted and the page refetches.
 *
 * Failure is non-fatal: if prefetch errors (network, 401, etc.), the page
 * still renders and `useUserShips` retries. We never throw a `Response` here
 * because there is no "not found" state — an empty hangar is valid.
 */
export function createPersonalHangarLoader(queryClient: QueryClient) {
  return async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const filters = parsePersonalHangarFilters(url.searchParams);
    const queryFilters = buildPersonalHangarQueryFilters(filters);

    try {
      await queryClient.ensureQueryData({
        queryKey: userShipKeys.list(queryFilters),
        queryFn: () => fetchUserShips(queryFilters),
        staleTime: 30 * 1000,
      });
    } catch (error) {
      logger.warn(
        'Personal hangar loader prefetch failed; component will retry',
        error instanceof Error ? { message: error.message } : { error }
      );
    }

    return { filters };
  };
}

/**
 * Loader for user ships page
 */
export function createUserShipsLoader(_queryClient: QueryClient) {
  return async ({ params }: LoaderFunctionArgs) => {
    const { userId } = params;

    if (!userId) {
      throw new Response('User ID is required', { status: 400 });
    }

    // For user ships, we return the userId and let the component
    // handle the data fetching with its own query hooks
    // This allows for better integration with auth state
    return { userId };
  };
}

/**
 * Loader for fleet list page
 * Prefetches fleet list data before navigation
 */
export function createFleetListLoader(_queryClient: QueryClient) {
  return async () => {
    // Note: Fleet list requires organizationId which is not available in the loader.
    // Let the component handle data fetching with its own query hooks.
    return null;
  };
}

/**
 * Loader for organizations list page
 * Prefetches organization list data before navigation
 */
export function createOrganizationsListLoader(_queryClient: QueryClient) {
  return async () => {
    // Note: Organization list fetching is handled by individual components
    // since the service requires specific organization context.
    return null;
  };
}

/**
 * Loader for activities list page
 * Prefetches activity list data before navigation
 */
export function createActivitiesListLoader(_queryClient: QueryClient) {
  return async () => {
    // Note: We don't prefetch here because the ActivityManagement component
    // handles data fetching with its own logic including organization context
    // This prevents issues with missing organizationId
    return null;
  };
}

/**
 * Generic error boundary handler for loaders
 */
export function handleLoaderError(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  logger.error('Loader error:', error instanceof Error ? error : new Error(String(error)));
  return new Response('An error occurred while loading data', { status: 500 });
}
