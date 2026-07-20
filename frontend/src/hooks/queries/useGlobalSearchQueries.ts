import { useQuery } from '@tanstack/react-query';

import {
    searchGlobal,
    type GlobalSearchResult,
    type GlobalSearchResultType,
} from '@/services/globalSearchService';
import { globalSearchKeys } from './queryKeys';

/**
 * React Query hook for global search across organizations, federations, and users.
 * Debouncing should be handled by the caller — this hook fires the query when
 * the provided query string is >= 2 characters.
 */
export function useGlobalSearchQuery(
  query: string,
  types?: GlobalSearchResultType[],
  limit?: number
) {
  return useQuery<GlobalSearchResult[]>({
    queryKey: globalSearchKeys.search(query, types),
    queryFn: () => searchGlobal(query, types, limit),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000, // 30s — search results are ephemeral
    gcTime: 2 * 60 * 1000, // 2 min GC
  });
}
