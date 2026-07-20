import { userShipKeys } from '@/hooks/queries/queryKeys';
import { fetchUserShips } from '@/hooks/queries/useUserShipQueries';
import {
  buildPersonalHangarQueryFilters,
  PERSONAL_HANGAR_FILTER_DEFAULTS,
} from '@/pages/personalHangarFilters';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { fleetServiceV2 } from '@/services/fleetServiceV2';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import type { QueryClient } from '@tanstack/react-query';
import { prefetchNavigationIntent } from '../navigationIntentPrefetch';

jest.mock('@/services/fleetServiceV2', () => ({
  fleetServiceV2: {
    getFleets: jest.fn().mockResolvedValue({ items: [], pagination: { total: 0 } }),
    getFleetStatistics: jest.fn().mockResolvedValue({ totalFleets: 0 }),
  },
}));

jest.mock('@/services/activityServiceV2', () => ({
  activityServiceV2: {
    getActivities: jest.fn().mockResolvedValue({ items: [], pagination: { total: 0 } }),
  },
}));

jest.mock('@/services/organizationServiceV2', () => ({
  organizationServiceV2: {
    getOverview: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/hooks/queries/useUserShipQueries', () => ({
  fetchUserShips: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('navigationIntentPrefetch', () => {
  const prefetchQuery = jest.fn(
    async ({ queryFn }: { queryFn?: () => Promise<unknown> }) => await queryFn?.()
  );
  const mockQueryClient = { prefetchQuery } as unknown as QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefetches fleet list and stats for org-scoped fleet route', async () => {
    await prefetchNavigationIntent(mockQueryClient, '/fleet', { organizationId: 'org-123' });

    expect(prefetchQuery).toHaveBeenCalledTimes(2);
    expect(fleetServiceV2.getFleets).toHaveBeenCalledWith('org-123');
    expect(fleetServiceV2.getFleetStatistics).toHaveBeenCalledWith('org-123');
  });

  it('skips org-scoped prefetch when no organization context exists', async () => {
    await prefetchNavigationIntent(mockQueryClient, '/activities');

    expect(prefetchQuery).not.toHaveBeenCalled();
    expect(activityServiceV2.getActivities).not.toHaveBeenCalled();
  });

  it('prefetches personal hangar data with default URL-backed filters', async () => {
    await prefetchNavigationIntent(mockQueryClient, '/hangar');

    const expectedFilters = buildPersonalHangarQueryFilters(PERSONAL_HANGAR_FILTER_DEFAULTS);

    expect(prefetchQuery).toHaveBeenCalledTimes(1);
    expect(fetchUserShips).toHaveBeenCalledWith(expectedFilters);

    const firstCall = prefetchQuery.mock.calls[0]?.[0] as { queryKey: readonly unknown[] };
    expect(firstCall.queryKey).toEqual(userShipKeys.list(expectedFilters));
  });

  it('ignores unknown routes without prefetch work', async () => {
    await prefetchNavigationIntent(mockQueryClient, '/unknown-route');

    expect(prefetchQuery).not.toHaveBeenCalled();
    expect(organizationServiceV2.getOverview).not.toHaveBeenCalled();
  });
});
