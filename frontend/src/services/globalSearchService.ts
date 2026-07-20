import { apiClient } from './apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlobalSearchResultType = 'organization' | 'federation' | 'user';

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Search across public organizations, federations, and users.
 */
export async function searchGlobal(
  query: string,
  types?: GlobalSearchResultType[],
  limit?: number
): Promise<GlobalSearchResult[]> {
  const params: Record<string, string> = { q: query };
  if (types?.length) {
    params.types = types.join(',');
  }
  if (limit) {
    params.limit = String(limit);
  }

  const response = await apiClient.get<GlobalSearchResult[]>('/api/v2/search/global', {
    params,
  });
  return response.data;
}
