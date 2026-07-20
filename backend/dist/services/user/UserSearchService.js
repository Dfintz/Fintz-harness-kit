"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSearchService = void 0;
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
class UserSearchService {
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    async searchUsers(query, filters, pagination = {}, sort) {
        const { page = 1, limit = 20 } = pagination;
        const skip = (page - 1) * limit;
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        if (query) {
            queryBuilder.where('(user.username ILIKE :query OR user.email ILIKE :query OR user.displayName ILIKE :query)', { query: `%${query}%` });
        }
        this.applyFilters(queryBuilder, filters);
        const sortField = sort?.field || 'createdAt';
        const sortOrder = sort?.order || 'DESC';
        queryBuilder.orderBy(`user.${sortField}`, sortOrder);
        queryBuilder.skip(skip).take(limit);
        const [users, total] = await queryBuilder.getManyAndCount();
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
    async findUsersByUsername(usernamePattern, limit = 50) {
        return this.userRepository
            .createQueryBuilder('user')
            .where('user.username ILIKE :pattern', { pattern: `%${usernamePattern}%` })
            .orderBy('user.username', 'ASC')
            .take(limit)
            .getMany();
    }
    async findUsersByEmail(emailPattern, limit = 50) {
        return this.userRepository
            .createQueryBuilder('user')
            .where('user.email ILIKE :pattern', { pattern: `%${emailPattern}%` })
            .orderBy('user.email', 'ASC')
            .take(limit)
            .getMany();
    }
    async searchUsersAdvanced(query, contextUserId, filters, pagination = {}) {
        const { page = 1, limit = 20 } = pagination;
        const skip = (page - 1) * limit;
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        const searchConditions = [
            `(user.username ILIKE '%${query}%')`,
            `(user.email ILIKE '%${query}%')`,
            `(user.displayName ILIKE '%${query}%')`,
            `(user.firstName ILIKE '%${query}%')`,
            `(user.lastName ILIKE '%${query}%')`,
        ];
        queryBuilder.where(`(${searchConditions.join(' OR ')})`);
        this.applyFilters(queryBuilder, filters);
        const scoreExpression = this.buildRelevanceScore(query);
        queryBuilder.addSelect(scoreExpression, 'relevance_score');
        queryBuilder.orderBy('relevance_score', 'DESC');
        queryBuilder.addOrderBy('user.username', 'ASC');
        queryBuilder.skip(skip).take(limit);
        const [users, total] = await queryBuilder.getManyAndCount();
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
    async findSimilarUsers(userId, limit = 10) {
        const baseUser = await this.userRepository.findOne({ where: { id: userId } });
        if (!baseUser) {
            throw new Error('User not found');
        }
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        queryBuilder.where('user.id != :userId', { userId });
        const similarityConditions = [];
        if (baseUser.activeOrgId) {
            similarityConditions.push('user.activeOrgId = :activeOrgId');
        }
        if (baseUser.location) {
            similarityConditions.push('user.location = :location');
        }
        if (baseUser.timezone) {
            similarityConditions.push('user.timezone = :timezone');
        }
        if (similarityConditions.length > 0) {
            queryBuilder.andWhere(`(${similarityConditions.join(' OR ')})`, {
                activeOrgId: baseUser.activeOrgId,
                location: baseUser.location,
                timezone: baseUser.timezone,
            });
        }
        const users = await queryBuilder.orderBy('user.createdAt', 'DESC').take(limit).getMany();
        return users.map(user => this.addSearchMetadata(user));
    }
    async getRecentlyJoinedUsers(limit = 10, activeOrgId) {
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        if (activeOrgId) {
            queryBuilder.where('user.activeOrgId = :activeOrgId', { activeOrgId });
        }
        return queryBuilder.orderBy('user.createdAt', 'DESC').take(limit).getMany();
    }
    async getMostActiveUsers(limit = 10, activeOrgId) {
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        if (activeOrgId) {
            queryBuilder.where('user.activeOrgId = :activeOrgId', { activeOrgId });
        }
        return queryBuilder.orderBy('user.lastLoginAt', 'DESC').take(limit).getMany();
    }
    async getUsersByRole(role, searchQuery, pagination = {}) {
        const { page = 1, limit = 50 } = pagination;
        const skip = (page - 1) * limit;
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        if (Array.isArray(role)) {
            queryBuilder.where('user.role IN (:...roles)', { roles: role });
        }
        else {
            queryBuilder.where('user.role = :role', { role });
        }
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
    async searchUsersInOrganization(organizationId, query, pagination = {}) {
        const filters = {
            activeOrgId: organizationId,
        };
        return this.searchUsers(query, filters, pagination);
    }
    async findUnaffiliatedUsers(query, pagination = {}) {
        const filters = {
            activeOrgId: undefined,
        };
        return this.searchUsers(query, filters, pagination);
    }
    applyFilters(queryBuilder, filters) {
        if (!filters) {
            return;
        }
        if (filters.role) {
            if (Array.isArray(filters.role)) {
                queryBuilder.andWhere('user.role IN (:...roles)', { roles: filters.role });
            }
            else {
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
    buildRelevanceScore(query) {
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
    addSearchMetadata(user, query, _filters) {
        const result = user;
        if (query) {
            result.matchedFields = this.getMatchedFields(user, query);
            result.relevanceScore = this.calculateRelevanceScore(user, query);
        }
        return result;
    }
    async enhanceSearchResults(users, query, contextUserId, filters) {
        return users.map(user => {
            const result = this.addSearchMetadata(user, query, filters);
            if (contextUserId) {
                result.organizationInfo = {
                    isInSameOrg: user.activeOrgId === filters?.activeOrgId,
                    sharedOrganizations: [],
                };
            }
            return result;
        });
    }
    getMatchedFields(user, query) {
        const fields = [];
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
    calculateRelevanceScore(user, query) {
        let score = 0;
        const lowerQuery = query.toLowerCase();
        if (user.username?.toLowerCase() === lowerQuery) {
            score += 50;
        }
        else if (user.username?.toLowerCase().startsWith(lowerQuery)) {
            score += 30;
        }
        else if (user.username?.toLowerCase().includes(lowerQuery)) {
            score += 15;
        }
        if (user.displayName?.toLowerCase() === lowerQuery) {
            score += 25;
        }
        else if (user.displayName?.toLowerCase().includes(lowerQuery)) {
            score += 10;
        }
        if (user.email?.toLowerCase().includes(lowerQuery)) {
            score += 5;
        }
        return Math.min(score, 100);
    }
    async getUsernameSuggestions(prefix, limit = 10, excludeIds) {
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
    async getSearchSuggestions(input, limit = 5) {
        const suggestions = [];
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
    async browseCommunityMembers(requestingUserId, params) {
        const { search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC', rsiVerifiedOnly, hasOrganization, } = params;
        const skip = (page - 1) * limit;
        const qb = this.userRepository.createQueryBuilder('user');
        const VISIBILITY_EXPR = `CASE
      WHEN user.preferences LIKE '%"profileVisibility":"private"%' THEN 'private'
      WHEN user.preferences LIKE '%"profileVisibility":"organization"%' THEN 'organization'
      ELSE 'public'
    END`;
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
        qb.addSelect(`NOT (COALESCE(user.preferences, '') LIKE '%"showBio":false%')`, 'privacy_showBio');
        qb.addSelect(`NOT (COALESCE(user.preferences, '') LIKE '%"showRsiInfo":false%')`, 'privacy_showRsiInfo');
        qb.addSelect(`NOT (COALESCE(user.preferences, '') LIKE '%"showVerifiedBadge":false%')`, 'privacy_showVerifiedBadge');
        qb.addSelect(`NOT (COALESCE(user.preferences, '') LIKE '%"showOrganizations":false%')`, 'privacy_showOrganizations');
        const orgSubquery = this.userRepository.manager
            .getRepository(OrganizationMembership_1.OrganizationMembership)
            .createQueryBuilder('m1')
            .select('1')
            .where('m1."userId" = user.id')
            .andWhere('m1."isActive" = true')
            .andWhere(qb2 => {
            const innerSub = qb2
                .subQuery()
                .select('m2."organizationId"')
                .from(OrganizationMembership_1.OrganizationMembership, 'm2')
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
        qb.andWhere('user.id != :requestingUserId', { requestingUserId });
        if (search) {
            qb.andWhere(`(
        user.username ILIKE :search
        OR user."displayName" ILIKE :search
        OR (
          user."rsiHandle" ILIKE :search
          AND NOT (COALESCE(user.preferences, '') LIKE '%"showRsiInfo":false%')
        )
      )`, {
                search: `%${search}%`,
            });
        }
        if (rsiVerifiedOnly) {
            qb.andWhere('user.rsiVerified = :rsiVerifiedValue', { rsiVerifiedValue: true });
            qb.andWhere(`NOT (COALESCE(user.preferences, '') LIKE '%"showVerifiedBadge":false%')`);
        }
        if (hasOrganization) {
            const orgMemberSubquery = this.userRepository.manager
                .getRepository(OrganizationMembership_1.OrganizationMembership)
                .createQueryBuilder('om_filter')
                .select('1')
                .where('om_filter."userId" = user.id')
                .andWhere('om_filter."isActive" = true');
            qb.andWhere(`EXISTS (${orgMemberSubquery.getQuery()})`);
            qb.andWhere(`NOT (COALESCE(user.preferences, '') LIKE '%"showOrganizations":false%')`);
        }
        const safeSort = ['createdAt', 'username', 'displayName'].includes(sortBy)
            ? sortBy
            : 'createdAt';
        qb.orderBy(`user.${safeSort}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
        const total = await qb.getCount();
        qb.skip(skip).take(limit);
        const rawRows = await qb.getRawMany();
        const userIds = rawRows.map(r => r.user_id);
        const orgMembershipMap = new Map();
        if (userIds.length > 0) {
            const rawMemberships = await this.userRepository.manager
                .getRepository(OrganizationMembership_1.OrganizationMembership)
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
                .andWhere(`(
          org.settings IS NULL
          OR org.settings->>'visibility' IS NULL
          OR org.settings->>'visibility' = 'public'
        )`)
                .andWhere('org.isArchived = :orgArchived', { orgArchived: false })
                .orderBy('role.priority', 'DESC')
                .getRawMany();
            for (const row of rawMemberships) {
                const userId = row.mem_userId;
                if (!orgMembershipMap.has(userId)) {
                    orgMembershipMap.set(userId, []);
                }
                orgMembershipMap.get(userId).push({
                    orgId: row.mem_organizationId,
                    orgName: row.org_name,
                    orgLogo: row.org_logoUrl ?? undefined,
                    roleName: row.role_name ?? 'Member',
                });
            }
        }
        const isTruthy = (v) => v !== false && v !== 'false' && v !== 0;
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
                organizations: showOrganizations ? (orgMembershipMap.get(raw.user_id) ?? []) : [],
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
exports.UserSearchService = UserSearchService;
//# sourceMappingURL=UserSearchService.js.map