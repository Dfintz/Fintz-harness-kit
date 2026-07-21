import { logger } from '../../utils/logger';
import { OrganizationFederationService } from '../organization/OrganizationFederationService';
import { PublicOrgDirectoryService } from '../organization/PublicOrgDirectoryService';
import { UserSearchService } from '../user/UserSearchService';

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

export interface GlobalSearchOptions {
  query: string;
  types?: GlobalSearchResultType[];
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * GlobalSearchService
 *
 * Aggregates search results from public organization directory,
 * public federation directory, and user search. Returns a unified
 * result set sorted by relevance.
 */
export class GlobalSearchService {
  private readonly directoryService = new PublicOrgDirectoryService();
  private readonly federationService = OrganizationFederationService.getInstance();
  private readonly userSearchService = new UserSearchService();

  /**
   * Search across organizations, federations, and users.
   * All queries target public data only — no PII is returned.
   */
  async search(options: GlobalSearchOptions): Promise<GlobalSearchResult[]> {
    const { query, limit = 5 } = options;
    const types = options.types ?? ['organization', 'federation', 'user'];

    const searches: Promise<GlobalSearchResult[]>[] = [];

    if (types.includes('organization')) {
      searches.push(this.searchOrganizations(query, limit));
    }
    if (types.includes('federation')) {
      searches.push(this.searchFederations(query, limit));
    }
    if (types.includes('user')) {
      searches.push(this.searchUsers(query, limit));
    }

    const settledResults = await Promise.allSettled(searches);

    const results: GlobalSearchResult[] = [];
    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        results.push(...settled.value);
      } else {
        logger.warn('Global search partial failure', { reason: String(settled.reason) });
      }
    }

    return results;
  }

  // ── Organization Search ──────────────────────────────────────────────────

  private async searchOrganizations(
    query: string,
    limit: number
  ): Promise<GlobalSearchResult[]> {
    const result = await this.directoryService.getPublicDirectory(
      { searchTerm: query },
      { page: 1, limit }
    );

    return result.data.map(org => ({
      id: org.organizationId || org.id,
      type: 'organization' as const,
      title: org.organizationName,
      subtitle: org.tagline ?? org.organizationDescription,
      avatarUrl: org.organizationLogoUrl,
      url: `/directory/${org.slug || org.organizationId || org.id}`,
      metadata: {
        memberCount: org.memberCount,
        primaryFocus: org.primaryFocus,
        isVerified: org.isVerified,
        isRecruiting: org.isRecruiting,
      },
    }));
  }

  // ── Federation Search ────────────────────────────────────────────────────

  private async searchFederations(
    query: string,
    limit: number
  ): Promise<GlobalSearchResult[]> {
    const result = await this.federationService.getPublicFederations(
      { name: query },
      { page: 1, limit }
    );

    return result.data.map(fed => ({
      id: fed.id,
      type: 'federation' as const,
      title: fed.name,
      subtitle: fed.description,
      avatarUrl: fed.logoUrl ?? undefined,
      url: `/federations/${fed.id}`,
      metadata: {
        memberCount: fed.memberCount,
        tags: fed.tags,
      },
    }));
  }

  // ── User Search ──────────────────────────────────────────────────────────

  private async searchUsers(
    query: string,
    limit: number
  ): Promise<GlobalSearchResult[]> {
    const result = await this.userSearchService.searchUsers(
      query,
      {},
      { page: 1, limit }
    );

    // Strip PII — only return public-safe fields
    return result.data.map(user => ({
      id: user.id,
      type: 'user' as const,
      title: user.displayName ?? user.username,
      subtitle: user.displayName && user.username !== user.displayName
        ? `@${user.username}`
        : undefined,
      avatarUrl: user.avatar,
      url: `/profile/${user.id}`,
    }));
  }
}

