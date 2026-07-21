import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

/**
 * User search filters
 */
export interface UserSearchFilters {
  username?: string;
  email?: string;
  role?: string | string[];
  discordId?: string;
  activeOrgId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  hasAvatar?: boolean;
  emailVerified?: boolean;
  isOnline?: boolean;
  organizationId?: string;
  memberOfOrg?: string;
  excludeIds?: string[];
}

/**
 * User sort options
 */
export interface UserSortOptions {
  field?: 'username' | 'email' | 'role' | 'createdAt' | 'updatedAt' | 'lastLoginAt';
  order?: 'ASC' | 'DESC';
}

/**
 * Search result with metadata
 */
export interface UserSearchResult extends User {
  relevanceScore?: number;
  matchedFields?: string[];
  organizationInfo?: {
    isInSameOrg: boolean;
    sharedOrganizations: string[];
  };
}

/**
 * User Search Service
 * Handles user discovery, search, and filtering operations
 */
export class UserSearchService {
  private readonly userRepository = AppDataSource.getRepository(User);

  // ==================== BASIC SEARCH OPERATIONS ====================

  /**
   * Search users with flexible criteria
   * @param query Search query (searches username, email, displayName)
   * @param filters Optional additional filters
   * @param pagination Pagination options
   * @param sort Sort options
   * @returns Paginated search results
   */
  async searchUsers(
    query?: string,
    filters?: UserSearchFilters,
    pagination: PaginationOptions = {},
    sort?: UserSortOptions
  ): Promise<PaginatedResponse<UserSearchResult>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Add text search if query provided
    if (query) {
      queryBuilder.where(
        '(user.username ILIKE :query OR user.email ILIKE :query OR user.displayName ILIKE :query)',
        { query: `%${query}%` }
      );
    }

    // Apply filters
    this.applyFilters(queryBuilder, filters);

    // Apply sorting
    const sortField = sort?.field || 'createdAt';
    const sortOrder = sort?.order || 'DESC';
    queryBuilder.orderBy(`user.${sortField}`, sortOrder);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [users, total] = await queryBuilder.getManyAndCount();

    // Add search metadata to results
    const results = users.map(user => this.addSearchMetadata(user, query, filters));

    return {
      data: results,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find users by username pattern
   * @param usernamePattern Username pattern (supports wildcards)
   * @param limit Maximum results to return
   * @returns Array of matching users
   */
  async findUsersByUsername(usernamePattern: string, limit: number = 50): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.username ILIKE :pattern', { pattern: `%${usernamePattern}%` })
      .orderBy('user.username', 'ASC')
      .take(limit)
      .getMany();
  }

  /**
   * Find users by email pattern
   * @param emailPattern Email pattern (supports wildcards)
   * @param limit Maximum results to return
   * @returns Array of matching users
   */
  async findUsersByEmail(emailPattern: string, limit: number = 50): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email ILIKE :pattern', { pattern: `%${emailPattern}%` })
      .orderBy('user.email', 'ASC')
      .take(limit)
      .getMany();
  }

  // ==================== ADVANCED SEARCH OPERATIONS ====================

  /**
   * Search users with advanced scoring and ranking
   * @param query Search query
   * @param contextUserId User performing the search (for personalization)
   * @param filters Search filters
   * @param pagination Pagination options
   * @returns Ranked search results
   */
  async searchUsersAdvanced(
    query: string,
    contextUserId?: string,
    filters?: UserSearchFilters,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<UserSearchResult>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Build complex search query with scoring
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Multi-field search with relevance scoring
    const searchConditions = [
      `(user.username ILIKE '%${query}%')`,
      `(user.email ILIKE '%${query}%')`,
      `(user.displayName ILIKE '%${query}%')`,
      `(user.firstName ILIKE '%${query}%')`,
      `(user.lastName ILIKE '%${query}%')`,
    ];

    queryBuilder.where(`(${searchConditions.join(' OR ')})`);

    // Apply filters
    this.applyFilters(queryBuilder, filters);

    // Add relevance scoring
    const scoreExpression = this.buildRelevanceScore(query);
    queryBuilder.addSelect(scoreExpression, 'relevance_score');

    // Order by relevance, then by username
    queryBuilder.orderBy('relevance_score', 'DESC');
    queryBuilder.addOrderBy('user.username', 'ASC');

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [users, total] = await queryBuilder.getManyAndCount();

    // Enhance results with metadata
    const enhancedResults = await this.enhanceSearchResults(users, query, contextUserId, filters);

    return {
      data: enhancedResults,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find similar users based on profile characteristics
   * @param userId Base user ID
   * @param limit Maximum results to return
   * @returns Array of similar users
   */
  async findSimilarUsers(userId: string, limit: number = 10): Promise<UserSearchResult[]> {
    const baseUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!baseUser) {
      throw new Error('User not found');
    }

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Exclude the base user
    queryBuilder.where('user.id != :userId', { userId });

    // Find users with similar characteristics
    const similarityConditions: string[] = [];

    if (baseUser.activeOrgId) {
      similarityConditions.push('user.activeOrgId = :activeOrgId');
    }

    if ((baseUser as unknown as Record<string, unknown>).location) {
      similarityConditions.push('user.location = :location');
    }

    if ((baseUser as unknown as Record<string, unknown>).timezone) {
      similarityConditions.push('user.timezone = :timezone');
    }

    if (similarityConditions.length > 0) {
      queryBuilder.andWhere(`(${similarityConditions.join(' OR ')})`, {
        activeOrgId: baseUser.activeOrgId,
        location: (baseUser as unknown as Record<string, unknown>).location as string,
        timezone: (baseUser as unknown as Record<string, unknown>).timezone as string,
      });
    }

    const users = await queryBuilder.orderBy('user.createdAt', 'DESC').take(limit).getMany();

    return users.map(user => this.addSearchMetadata(user));
  }

  // ==================== DISCOVERY OPERATIONS ====================

  /**
   * Get recently joined users
   * @param limit Maximum results to return
   * @param activeOrgId Optional organization filter
   * @returns Array of recently joined users
   */
  async getRecentlyJoinedUsers(limit: number = 10, activeOrgId?: string): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (activeOrgId) {
      queryBuilder.where('user.activeOrgId = :activeOrgId', { activeOrgId });
    }

    return queryBuilder.orderBy('user.createdAt', 'DESC').take(limit).getMany();
  }

  /**
   * Get most active users
   * @param limit Maximum results to return
   * @param activeOrgId Optional organization filter
   * @returns Array of most active users
   */
  async getMostActiveUsers(limit: number = 10, activeOrgId?: string): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (activeOrgId) {
      queryBuilder.where('user.activeOrgId = :activeOrgId', { activeOrgId });
    }

    return queryBuilder.orderBy('user.lastLoginAt', 'DESC').take(limit).getMany();
  }

  /**
   * Get users by role with search capabilities
   * @param role Role or array of roles
   * @param searchQuery Optional search query within role
   * @param pagination Pagination options
   * @returns Paginated users by role
   */
  async getUsersByRole(
    role: string | string[],
    searchQuery?: string,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<User>> {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Role filter
    if (Array.isArray(role)) {
      queryBuilder.where('user.role IN (:...roles)', { roles: role });
    } else {
      queryBuilder.where('user.role = :role', { role });
    }

    // Optional search within role
    if (searchQuery) {
      queryBuilder.andWhere('(user.username ILIKE :query OR user.email ILIKE :query)', {
        query: `%${searchQuery}%`,
      });
    }

    const [users, total] = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // ==================== ORGANIZATION-BASED SEARCH ====================

  /**
   * Search users within organization
   * @param organizationId Organization ID
   * @param query Search query
   * @param pagination Pagination options
   * @returns Users in organization matching query
   */
  async searchUsersInOrganization(
    organizationId: string,
    query?: string,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<User>> {
    const filters: UserSearchFilters = {
      activeOrgId: organizationId,
    };

    return this.searchUsers(query, filters, pagination);
  }

  /**
   * Find users not in any organization
   * @param query Optional search query
   * @param pagination Pagination options
   * @returns Users without organization
   */
  async findUnaffiliatedUsers(
    query?: string,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<User>> {
    const filters: UserSearchFilters = {
      activeOrgId: undefined, // Users without active organization
    };

    return this.searchUsers(query, filters, pagination);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Apply search filters to query builder
   * @param queryBuilder TypeORM query builder
   * @param filters Search filters
   */
  private applyFilters(
    queryBuilder: ReturnType<typeof this.userRepository.createQueryBuilder>,
    filters?: UserSearchFilters
  ): void {
    if (!filters) {
      return;
    }

    if (filters.role) {
      if (Array.isArray(filters.role)) {
        queryBuilder.andWhere('user.role IN (:...roles)', { roles: filters.role });
      } else {
        queryBuilder.andWhere('user.role = :role', { role: filters.role });
      }
    }

    if (filters.activeOrgId) {
      queryBuilder.andWhere('user.activeOrgId = :activeOrgId', {
        activeOrgId: filters.activeOrgId,
      });
    }

    if (filters.discordId) {
      queryBuilder.andWhere('user.discordId = :discordId', {
        discordId: filters.discordId,
      });
    }

    if (filters.createdAfter) {
      queryBuilder.andWhere('user.createdAt >= :createdAfter', {
        createdAfter: filters.createdAfter,
      });
    }

    if (filters.createdBefore) {
      queryBuilder.andWhere('user.createdAt <= :createdBefore', {
        createdBefore: filters.createdBefore,
      });
    }

    if (filters.excludeIds && filters.excludeIds.length > 0) {
      queryBuilder.andWhere('user.id NOT IN (:...excludeIds)', {
        excludeIds: filters.excludeIds,
      });
    }

    if (filters.emailVerified !== undefined) {
      queryBuilder.andWhere('user.emailVerified = :emailVerified', {
        emailVerified: filters.emailVerified,
      });
    }
  }

  /**
   * Build relevance score expression for search ranking
   * @param query Search query
   * @returns SQL expression for relevance scoring
   */
  private buildRelevanceScore(query: string): string {
    const escapedQuery = query.replaceAll("'", "''");

    return `
            CASE 
                WHEN user.username ILIKE '${escapedQuery}%' THEN 10
                WHEN user.username ILIKE '%${escapedQuery}%' THEN 8
                WHEN user.displayName ILIKE '${escapedQuery}%' THEN 7
                WHEN user.displayName ILIKE '%${escapedQuery}%' THEN 5
                WHEN user.email ILIKE '${escapedQuery}%' THEN 6
                WHEN user.email ILIKE '%${escapedQuery}%' THEN 4
                WHEN user.firstName ILIKE '${escapedQuery}%' THEN 5
                WHEN user.firstName ILIKE '%${escapedQuery}%' THEN 3
                WHEN user.lastName ILIKE '${escapedQuery}%' THEN 5
                WHEN user.lastName ILIKE '%${escapedQuery}%' THEN 3
                ELSE 1
            END
        `;
  }

  /**
   * Add search metadata to user result
   * @param user User object
   * @param query Search query
   * @param filters Search filters
   * @returns Enhanced user result
   */
  private addSearchMetadata(
    user: User,
    query?: string,
    _filters?: UserSearchFilters
  ): UserSearchResult {
    const result = user as UserSearchResult;

    if (query) {
      result.matchedFields = this.getMatchedFields(user, query);
      result.relevanceScore = this.calculateRelevanceScore(user, query);
    }

    return result;
  }

  /**
   * Enhance search results with additional metadata
   * @param users Array of users
   * @param query Search query
   * @param contextUserId User performing search
   * @param filters Search filters
   * @returns Enhanced results
   */
  private async enhanceSearchResults(
    users: User[],
    query: string,
    contextUserId?: string,
    filters?: UserSearchFilters
  ): Promise<UserSearchResult[]> {
    return users.map(user => {
      const result = this.addSearchMetadata(user, query, filters);

      // Add organization info if context user provided
      if (contextUserId) {
        result.organizationInfo = {
          isInSameOrg: user.activeOrgId === filters?.activeOrgId,
          sharedOrganizations: [], // This would be calculated from memberships
        };
      }

      return result;
    });
  }

  /**
   * Get fields that matched the search query
   * @param user User object
   * @param query Search query
   * @returns Array of matched field names
   */
  private getMatchedFields(user: User, query: string): string[] {
    const fields: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (user.username?.toLowerCase().includes(lowerQuery)) {
      fields.push('username');
    }

    if (user.email?.toLowerCase().includes(lowerQuery)) {
      fields.push('email');
    }

    if (user.displayName?.toLowerCase().includes(lowerQuery)) {
      fields.push('displayName');
    }

    return fields;
  }

  /**
   * Calculate relevance score for search result
   * @param user User object
   * @param query Search query
   * @returns Relevance score (0-100)
   */
  private calculateRelevanceScore(user: User, query: string): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    // Exact username match gets highest score
    if (user.username?.toLowerCase() === lowerQuery) {
      score += 50;
    } else if (user.username?.toLowerCase().startsWith(lowerQuery)) {
      score += 30;
    } else if (user.username?.toLowerCase().includes(lowerQuery)) {
      score += 15;
    }

    // Display name matches
    if (user.displayName?.toLowerCase() === lowerQuery) {
      score += 25;
    } else if (user.displayName?.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    // Email matches (lower priority for privacy)
    if (user.email?.toLowerCase().includes(lowerQuery)) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  // ==================== SUGGESTIONS AND AUTOCOMPLETE ====================

  /**
   * Get username suggestions for autocomplete
   * @param prefix Username prefix
   * @param limit Maximum suggestions
   * @param excludeIds User IDs to exclude
   * @returns Array of username suggestions
   */
  async getUsernameSuggestions(
    prefix: string,
    limit: number = 10,
    excludeIds?: string[]
  ): Promise<string[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select('user.username')
      .where('user.username ILIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.username', 'ASC')
      .take(limit);

    if (excludeIds && excludeIds.length > 0) {
      queryBuilder.andWhere('user.id NOT IN (:...excludeIds)', { excludeIds });
    }

    const results = await queryBuilder.getMany();
    return results.map(user => user.username);
  }

  /**
   * Get user search suggestions based on partial input
   * @param input Partial search input
   * @param limit Maximum suggestions
   * @returns Array of search suggestions
   */
  async getSearchSuggestions(
    input: string,
    limit: number = 5
  ): Promise<
    Array<{
      type: 'username' | 'email' | 'displayName';
      value: string;
      userId: string;
    }>
  > {
    const suggestions: Array<{
      type: 'username' | 'email' | 'displayName';
      value: string;
      userId: string;
    }> = [];

    // Get username suggestions
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.username ILIKE :input OR user.displayName ILIKE :input', {
        input: `%${input}%`,
      })
      .take(limit)
      .getMany();

    for (const user of users) {
      if (user.username.toLowerCase().includes(input.toLowerCase())) {
        suggestions.push({
          type: 'username',
          value: user.username,
          userId: user.id,
        });
      }

      if (user.displayName?.toLowerCase().includes(input.toLowerCase())) {
        suggestions.push({
          type: 'displayName',
          value: user.displayName,
          userId: user.id,
        });
      }
    }

    return suggestions.slice(0, limit);
  }

  // ==================== COMMUNITY MEMBERS DIRECTORY ====================

  /**
   * Browse community members with privacy-aware filtering.
   *
   * Privacy tiers (enforced in SQL):
   * - `public`: visible to all authenticated users
   * - `organization`: visible only to users sharing >= 1 org (subquery, not IN-clause)
   * - `private`: excluded from results
   * - NULL/undefined: treated as `public` (opt-in default)
   *
   * Per-field toggles applied in result mapping (showBio, showRsiInfo, etc.)
   */
  async browseCommunityMembers(
    requestingUserId: string,
    params: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: 'createdAt' | 'username' | 'displayName';
      sortOrder?: 'ASC' | 'DESC';
      rsiVerifiedOnly?: boolean;
      hasOrganization?: boolean;
    }
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const {
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      rsiVerifiedOnly,
      hasOrganization,
    } = params;
    const skip = (page - 1) * limit;

    const qb = this.userRepository.createQueryBuilder('user');

    // ── Privacy extraction via LIKE matching on TEXT column ──────
    // The preferences column is simple-json (TEXT). Instead of casting to
    // ::jsonb (which crashes on malformed values), use LIKE-based extraction.
    // This is crash-proof regardless of the data format.
    const VISIBILITY_EXPR = `CASE
      WHEN user.preferences LIKE '%"profileVisibility":"private"%' THEN 'private'
      WHEN user.preferences LIKE '%"profileVisibility":"organization"%' THEN 'organization'
      ELSE 'public'
    END`;

    // Select safe entity fields — do NOT include user.preferences because TypeORM's
    // simple-json transformer calls JSON.parse() during hydration, which crashes for
    // empty-string or malformed values. Privacy flags are extracted via LIKE instead.
    qb.select([
      'user.id',
      'user.username',
      'user.displayName',
      'user.avatar',
      'user.bio',
      'user.rsiHandle',
      'user.rsiVerified',
      'user.createdAt',
    ]);

    // Extract per-field privacy toggles via LIKE matching (safe from JSON.parse crash)
    // Default to true (public) unless explicitly set to false
    qb.addSelect(
      `NOT (COALESCE(user.preferences, '') LIKE '%"showBio":false%')`,
      'privacy_showBio'
    );
    qb.addSelect(
      `NOT (COALESCE(user.preferences, '') LIKE '%"showRsiInfo":false%')`,
      'privacy_showRsiInfo'
    );
    qb.addSelect(
      `NOT (COALESCE(user.preferences, '') LIKE '%"showVerifiedBadge":false%')`,
      'privacy_showVerifiedBadge'
    );
    qb.addSelect(
      `NOT (COALESCE(user.preferences, '') LIKE '%"showOrganizations":false%')`,
      'privacy_showOrganizations'
    );

    // ── Privacy tier filtering (SQL-level) ──────────────────────
    // Exclude private profiles. Include public profiles. For 'organization' visibility,
    // use a subquery to check shared org membership (AP-2 — no IN-clause bomb).
    const orgSubquery = this.userRepository.manager
      .getRepository(OrganizationMembership)
      .createQueryBuilder('m1')
      .select('1')
      .where('m1."userId" = user.id')
      .andWhere('m1."isActive" = true')
      .andWhere(qb2 => {
        const innerSub = qb2
          .subQuery()
          .select('m2."organizationId"')
          .from(OrganizationMembership, 'm2')
          .where('m2."userId" = :requestingUserId')
          .andWhere('m2."isActive" = true')
          .getQuery();
        return `m1."organizationId" IN ${innerSub}`;
      });

    qb.where(`(
      (${VISIBILITY_EXPR}) = 'public'
      OR (
        (${VISIBILITY_EXPR}) = 'organization'
        AND EXISTS (${orgSubquery.getQuery()})
      )
    )`);
    qb.setParameter('requestingUserId', requestingUserId);

    // Exclude self
    qb.andWhere('user.id != :requestingUserId', { requestingUserId });

    // ── Text search ─────────────────────────────────────────────
    // Search username, displayName, and rsiHandle (only if showRsiInfo is not disabled)
    if (search) {
      qb.andWhere(
        `(
        user.username ILIKE :search
        OR user."displayName" ILIKE :search
        OR (
          user."rsiHandle" ILIKE :search
          AND NOT (COALESCE(user.preferences, '') LIKE '%"showRsiInfo":false%')
        )
      )`,
        {
          search: `%${search}%`,
        }
      );
    }

    // ── Additional filters ──────────────────────────────────────
    // Note: filters also respect per-field privacy toggles so the rendered
    // cards match the filter criteria. A user who hides their verified badge
    // is excluded from "RSI Verified" results; a user who hides their orgs
    // is excluded from "Has Organization" results.
    if (rsiVerifiedOnly) {
      qb.andWhere('user.rsiVerified = :rsiVerifiedValue', { rsiVerifiedValue: true });
      qb.andWhere(
        `NOT (COALESCE(user.preferences, '') LIKE '%"showVerifiedBadge":false%')`
      );
    }

    if (hasOrganization) {
      const orgMemberSubquery = this.userRepository.manager
        .getRepository(OrganizationMembership)
        .createQueryBuilder('om_filter')
        .select('1')
        .where('om_filter."userId" = user.id')
        .andWhere('om_filter."isActive" = true');
      qb.andWhere(`EXISTS (${orgMemberSubquery.getQuery()})`);
      qb.andWhere(
        `NOT (COALESCE(user.preferences, '') LIKE '%"showOrganizations":false%')`
      );
    }

    // ── Sort + paginate ─────────────────────────────────────────
    const safeSort = ['createdAt', 'username', 'displayName'].includes(sortBy)
      ? sortBy
      : 'createdAt';
    qb.orderBy(`user.${safeSort}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');

    // Get total count BEFORE applying skip/take (getCount strips them internally,
    // but running it first avoids any state coupling with the data query).
    const total = await qb.getCount();

    qb.skip(skip).take(limit);

    // Use getRawMany to avoid entity hydration entirely — prevents the simple-json
    // transformer from calling JSON.parse on malformed preferences values.
    const rawRows = await qb.getRawMany();

    // ── Load public organization memberships for returned users ──
    const userIds = rawRows.map(r => r.user_id as string);
    const orgMembershipMap = new Map<
      string,
      Array<{ orgId: string; orgName: string; orgLogo?: string; roleName: string }>
    >();

    if (userIds.length > 0) {
      // Use getRawMany to avoid entity hydration — the Role entity has
      // eager: true and a simple-json `permissions` column whose transformer
      // calls JSON.parse(), which crashes on empty-string or malformed values.
      const rawMemberships = await this.userRepository.manager
        .getRepository(OrganizationMembership)
        .createQueryBuilder('mem')
        .innerJoin('mem.organization', 'org')
        .innerJoin('mem.role', 'role')
        .select('mem.userId', 'mem_userId')
        .addSelect('mem.organizationId', 'mem_organizationId')
        .addSelect('org.name', 'org_name')
        .addSelect('org.logoUrl', 'org_logoUrl')
        .addSelect('role.name', 'role_name')
        .addSelect('role.priority', 'role_priority')
        .where('mem.userId IN (:...userIds)', { userIds })
        .andWhere('mem.isActive = :memActive', { memActive: true })
        .andWhere(
          `(
          org.settings IS NULL
          OR org.settings->>'visibility' IS NULL
          OR org.settings->>'visibility' = 'public'
        )`
        )
        .andWhere('org.isArchived = :orgArchived', { orgArchived: false })
        .orderBy('role.priority', 'DESC')
        .getRawMany();

      for (const row of rawMemberships) {
        const userId = row.mem_userId as string;
        if (!orgMembershipMap.has(userId)) {
          orgMembershipMap.set(userId, []);
        }
        orgMembershipMap.get(userId)!.push({
          orgId: row.mem_organizationId as string,
          orgName: row.org_name as string,
          orgLogo: (row.org_logoUrl as string) ?? undefined,
          roleName: (row.role_name as string) ?? 'Member',
        });
      }
    }

    // ── Apply per-field privacy toggles from raw SQL columns ───
    // NOTE: PostgreSQL may return NOT(...LIKE...) as boolean or string depending
    // on the pg driver version. Guard against both 'false' and false.
    const isTruthy = (v: unknown): boolean => v !== false && v !== 'false' && v !== 0;

    const data = rawRows.map(raw => {
      const showBio = isTruthy(raw.privacy_showBio);
      const showRsiInfo = isTruthy(raw.privacy_showRsiInfo);
      const showVerifiedBadge = isTruthy(raw.privacy_showVerifiedBadge);
      const showOrganizations = isTruthy(raw.privacy_showOrganizations);

      return {
        id: raw.user_id,
        username: raw.user_username,
        displayName: raw.user_displayName ?? undefined,
        avatar: raw.user_avatar ?? undefined,
        bio: showBio ? (raw.user_bio ?? undefined) : undefined,
        rsiHandle: showRsiInfo ? (raw.user_rsiHandle ?? undefined) : undefined,
        rsiVerified: showVerifiedBadge ? raw.user_rsiVerified : undefined,
        createdAt: raw.user_createdAt ? new Date(raw.user_createdAt).toISOString() : undefined,
        organizations: showOrganizations ? (orgMembershipMap.get(raw.user_id as string) ?? []) : [],
      };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }
}

