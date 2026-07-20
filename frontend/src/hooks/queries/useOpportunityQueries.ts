import { type UseQueryOptions, useQuery } from '@tanstack/react-query';

import { opportunityKeys } from '@/hooks/queries/queryKeys';
import {
  type OpportunitySearchFilters,
  type OpportunitySearchResponse,
  searchOpportunities,
} from '@/services/opportunityService';

/**
 * Hook for searching unified opportunities (jobs + activities)
 * Sprint 19-G: Unified Opportunity Pool
 */
export function useOpportunitySearch(
  filters: OpportunitySearchFilters = {},
  page = 1,
  limit = 20,
  sortBy = 'postedAt',
  sortOrder: 'ASC' | 'DESC' = 'DESC',
  options?: Omit<UseQueryOptions<OpportunitySearchResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: opportunityKeys.search({
      ...filters,
      page,
      limit,
      sortBy,
      sortOrder,
    } as Record<string, unknown>),
    queryFn: () => searchOpportunities(filters, page, limit, sortBy, sortOrder),
    ...options,
  });
}
