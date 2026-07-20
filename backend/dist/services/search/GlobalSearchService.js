"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalSearchService = void 0;
const logger_1 = require("../../utils/logger");
const OrganizationFederationService_1 = require("../organization/OrganizationFederationService");
const PublicOrgDirectoryService_1 = require("../organization/PublicOrgDirectoryService");
const UserSearchService_1 = require("../user/UserSearchService");
class GlobalSearchService {
    directoryService = new PublicOrgDirectoryService_1.PublicOrgDirectoryService();
    federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    userSearchService = new UserSearchService_1.UserSearchService();
    async search(options) {
        const { query, limit = 5 } = options;
        const types = options.types ?? ['organization', 'federation', 'user'];
        const searches = [];
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
        const results = [];
        for (const settled of settledResults) {
            if (settled.status === 'fulfilled') {
                results.push(...settled.value);
            }
            else {
                logger_1.logger.warn('Global search partial failure', { reason: String(settled.reason) });
            }
        }
        return results;
    }
    async searchOrganizations(query, limit) {
        const result = await this.directoryService.getPublicDirectory({ searchTerm: query }, { page: 1, limit });
        return result.data.map(org => ({
            id: org.organizationId || org.id,
            type: 'organization',
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
    async searchFederations(query, limit) {
        const result = await this.federationService.getPublicFederations({ name: query }, { page: 1, limit });
        return result.data.map(fed => ({
            id: fed.id,
            type: 'federation',
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
    async searchUsers(query, limit) {
        const result = await this.userSearchService.searchUsers(query, {}, { page: 1, limit });
        return result.data.map(user => ({
            id: user.id,
            type: 'user',
            title: user.displayName ?? user.username,
            subtitle: user.displayName && user.username !== user.displayName
                ? `@${user.username}`
                : undefined,
            avatarUrl: user.avatar,
            url: `/profile/${user.id}`,
        }));
    }
}
exports.GlobalSearchService = GlobalSearchService;
//# sourceMappingURL=GlobalSearchService.js.map