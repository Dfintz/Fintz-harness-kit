"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const OrganizationFederationService_1 = require("../../services/organization/OrganizationFederationService");
const PublicOrgDirectoryService_1 = require("../../services/organization/PublicOrgDirectoryService");
const SeoHtmlRenderer_1 = require("../../services/seo/SeoHtmlRenderer");
const SeoService_1 = require("../../services/seo/SeoService");
const api_1 = require("../../types/api");
const logger_1 = require("../../utils/logger");
function parseMultiSelect(value) {
    return typeof value === 'string' ? value.split(',').map(s => s.trim()) : value;
}
function buildOrganizationFilters(query) {
    const filters = {};
    if (query.primaryFocuses) {
        filters.primaryFocuses = parseMultiSelect(query.primaryFocuses);
    }
    else if (query.primaryFocus) {
        filters.primaryFocus = query.primaryFocus;
    }
    if (query.activityLevels) {
        filters.activityLevels = parseMultiSelect(query.activityLevels);
    }
    else if (query.activityLevel) {
        filters.activityLevel = query.activityLevel;
    }
    if (query.isRecruiting !== undefined) {
        filters.isRecruiting = query.isRecruiting === 'true';
    }
    if (query.isVerified !== undefined) {
        filters.isVerified = query.isVerified === 'true';
    }
    const minMember = Number.parseInt(query.minMemberCount, 10);
    if (!Number.isNaN(minMember)) {
        filters.minMemberCount = minMember;
    }
    const maxMember = Number.parseInt(query.maxMemberCount, 10);
    if (!Number.isNaN(maxMember)) {
        filters.maxMemberCount = maxMember;
    }
    if (query.languages) {
        filters.languages = parseMultiSelect(query.languages);
    }
    if (query.timezone) {
        filters.timezone = query.timezone;
    }
    if (query.search) {
        filters.searchTerm = query.search;
    }
    return filters;
}
function buildPagination(query) {
    return {
        page: Number.parseInt(query.page, 10) || 1,
        limit: Number.parseInt(query.limit, 10) || 20,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
    };
}
class DirectoryControllerV2 {
    directoryService = new PublicOrgDirectoryService_1.PublicOrgDirectoryService();
    federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    seoService = new SeoService_1.SeoService();
    static DIRECTORY_ROUTE_REGEX = /^\/directory$/i;
    static DIRECTORY_ORGANIZATIONS_ROUTE_REGEX = /^\/directory\/organizations$/i;
    static DIRECTORY_ALLIANCES_ROUTE_REGEX = /^\/directory\/alliances$/i;
    static DIRECTORY_OPPORTUNITIES_ROUTE_REGEX = /^\/directory\/opportunities$/i;
    static ORGANIZATION_ROUTE_REGEX = /^\/directory\/organizations\/([^/]+)$/i;
    static FEDERATION_ROUTE_REGEX = /^\/directory\/federations\/([^/]+)$/i;
    static JOB_ROUTE_REGEX = /^\/directory\/jobs\/([^/]+)$/i;
    static PUBLIC_ACTIVITY_ROUTE_REGEX = /^\/opportunities\/activities\/([^/]+)$/i;
    static JOIN_ACTIVITY_ROUTE_REGEX = /^\/join\/activity\/([^/]+)$/i;
    static JOIN_SHORT_ROUTE_REGEX = /^\/j\/([^/]+)$/i;
    static LEGACY_ORGANIZATION_ROUTE_REGEX = /^\/directory\/([^/]+)$/i;
    static HOME_ROUTE_REGEX = /^\/$/i;
    static WELCOME_ROUTE_REGEX = /^\/welcome$/i;
    static OPPORTUNITIES_ROUTE_REGEX = /^\/opportunities$/i;
    static PUBLIC_STATS_ROUTE_REGEX = /^\/public\/stats$/i;
    static CHANGELOG_ROUTE_REGEX = /^\/changelog$/i;
    static MOBILE_ROUTE_REGEX = /^\/mobile$/i;
    static HELP_ROUTE_REGEX = /^\/help$/i;
    static BOT_COMMANDS_ROUTE_REGEX = /^\/bot-commands$/i;
    static FLEET_LANDING_ROUTE_REGEX = /^\/star-citizen-fleet-management$/i;
    static ORG_LANDING_ROUTE_REGEX = /^\/star-citizen-org-management$/i;
    static TRADE_LANDING_ROUTE_REGEX = /^\/star-citizen-trade-logistics-tools$/i;
    static DISCORD_LANDING_ROUTE_REGEX = /^\/star-citizen-discord-integration-tools$/i;
    extractRouteParam(path, routeRegex) {
        const match = routeRegex.exec(path);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    async resolveOrganizationMeta(path) {
        const organizationIdentifier = this.extractRouteParam(path, DirectoryControllerV2.ORGANIZATION_ROUTE_REGEX) ??
            this.extractRouteParam(path, DirectoryControllerV2.LEGACY_ORGANIZATION_ROUTE_REGEX);
        if (!organizationIdentifier) {
            return null;
        }
        const profile = await this.directoryService.getPublicProfile(organizationIdentifier);
        if (!profile) {
            return null;
        }
        return this.seoService.getOrganizationMeta(profile.organizationId);
    }
    async resolveFederationMeta(path) {
        const federationIdentifier = this.extractRouteParam(path, DirectoryControllerV2.FEDERATION_ROUTE_REGEX);
        if (!federationIdentifier) {
            return null;
        }
        const federation = await this.federationService.getPublicFederation(federationIdentifier);
        if (!federation) {
            return null;
        }
        return this.seoService.getFederationMeta(federation.id);
    }
    async resolveJobMeta(path) {
        const jobIdentifier = this.extractRouteParam(path, DirectoryControllerV2.JOB_ROUTE_REGEX);
        if (!jobIdentifier) {
            return null;
        }
        return this.seoService.getJobListingMeta(jobIdentifier);
    }
    async resolvePublicActivityMeta(path) {
        const activityId = this.extractRouteParam(path, DirectoryControllerV2.PUBLIC_ACTIVITY_ROUTE_REGEX);
        if (!activityId) {
            return null;
        }
        return this.seoService.getPublicActivityMeta(activityId);
    }
    async resolveJoinMeta(path) {
        const joinToken = this.extractRouteParam(path, DirectoryControllerV2.JOIN_ACTIVITY_ROUTE_REGEX) ??
            this.extractRouteParam(path, DirectoryControllerV2.JOIN_SHORT_ROUTE_REGEX);
        if (!joinToken) {
            return null;
        }
        return this.seoService.getJoinActivityMeta(joinToken);
    }
    resolveStaticPageMeta(path) {
        if (DirectoryControllerV2.DIRECTORY_ORGANIZATIONS_ROUTE_REGEX.test(path)) {
            return this.seoService.getDirectoryOrganizationsMeta();
        }
        if (DirectoryControllerV2.DIRECTORY_ALLIANCES_ROUTE_REGEX.test(path)) {
            return this.seoService.getDirectoryAlliancesMeta();
        }
        if (DirectoryControllerV2.DIRECTORY_OPPORTUNITIES_ROUTE_REGEX.test(path)) {
            return this.seoService.getDirectoryOpportunitiesMeta();
        }
        if (DirectoryControllerV2.OPPORTUNITIES_ROUTE_REGEX.test(path)) {
            return this.seoService.getOpportunitiesListMeta();
        }
        if (DirectoryControllerV2.PUBLIC_STATS_ROUTE_REGEX.test(path)) {
            return this.seoService.getPublicStatsPageMeta();
        }
        if (DirectoryControllerV2.CHANGELOG_ROUTE_REGEX.test(path)) {
            return this.seoService.getChangelogPageMeta();
        }
        if (DirectoryControllerV2.MOBILE_ROUTE_REGEX.test(path)) {
            return this.seoService.getMobileDownloadPageMeta();
        }
        if (DirectoryControllerV2.HELP_ROUTE_REGEX.test(path)) {
            return this.seoService.getHelpPageMeta();
        }
        if (DirectoryControllerV2.BOT_COMMANDS_ROUTE_REGEX.test(path)) {
            return this.seoService.getBotCommandsPageMeta();
        }
        if (DirectoryControllerV2.FLEET_LANDING_ROUTE_REGEX.test(path)) {
            return this.seoService.getFleetManagementLandingMeta();
        }
        if (DirectoryControllerV2.ORG_LANDING_ROUTE_REGEX.test(path)) {
            return this.seoService.getOrgManagementLandingMeta();
        }
        if (DirectoryControllerV2.TRADE_LANDING_ROUTE_REGEX.test(path)) {
            return this.seoService.getTradeLogisticsLandingMeta();
        }
        if (DirectoryControllerV2.DISCORD_LANDING_ROUTE_REGEX.test(path)) {
            return this.seoService.getDiscordIntegrationLandingMeta();
        }
        return null;
    }
    async resolveSeoMetaByPath(path) {
        const normalizedPath = (path.split('?')[0] || '/').trim();
        if (DirectoryControllerV2.HOME_ROUTE_REGEX.test(normalizedPath)) {
            return this.seoService.getHomePageMeta();
        }
        if (DirectoryControllerV2.WELCOME_ROUTE_REGEX.test(normalizedPath)) {
            return this.seoService.getWelcomePageMeta();
        }
        if (DirectoryControllerV2.DIRECTORY_ROUTE_REGEX.test(normalizedPath)) {
            return this.seoService.getDirectoryHomeMeta();
        }
        const organizationMeta = await this.resolveOrganizationMeta(normalizedPath);
        if (organizationMeta) {
            return organizationMeta;
        }
        const federationMeta = await this.resolveFederationMeta(normalizedPath);
        if (federationMeta) {
            return federationMeta;
        }
        const jobMeta = await this.resolveJobMeta(normalizedPath);
        if (jobMeta) {
            return jobMeta;
        }
        const publicActivityMeta = await this.resolvePublicActivityMeta(normalizedPath);
        if (publicActivityMeta) {
            return publicActivityMeta;
        }
        const joinMeta = await this.resolveJoinMeta(normalizedPath);
        if (joinMeta) {
            return joinMeta;
        }
        const staticPageMeta = this.resolveStaticPageMeta(normalizedPath);
        if (staticPageMeta) {
            return staticPageMeta;
        }
        return this.seoService.getHomePageMeta();
    }
    async listOrganizations(req, res) {
        try {
            const filters = buildOrganizationFilters(req.query);
            const pagination = buildPagination(req.query);
            const result = await this.directoryService.getPublicDirectory(filters, pagination);
            const offset = (pagination.page - 1) * pagination.limit;
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/directory/organizations', offset, pagination.limit, result.pagination.total);
            res.paginated(result.data, {
                total: result.pagination.total,
                limit: pagination.limit,
                offset: (pagination.page - 1) * pagination.limit,
                page: pagination.page,
                totalPages: result.pagination.totalPages,
                hasNext: result.pagination.hasNext,
                hasPrevious: result.pagination.hasPrev,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error listing organizations:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to list organizations', 500);
        }
    }
    async getOrganization(req, res) {
        try {
            const { organizationId } = req.params;
            const profile = await this.directoryService.getPublicProfile(organizationId);
            if (!profile) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Public organization profile not found', 404);
            }
            res.success(profile);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error getting organization:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get organization', 500);
        }
    }
    async getOrganizationFederations(req, res) {
        try {
            const { organizationId } = req.params;
            const federations = await this.federationService.getPublicFederationsForOrg(organizationId);
            res.success(federations);
        }
        catch (error) {
            logger_1.logger.error('Error getting organization federations:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get organization federations', 500);
        }
    }
    async getOrganizationStats(req, res) {
        try {
            const stats = await this.directoryService.getDirectoryStats();
            res.success(stats);
        }
        catch (error) {
            logger_1.logger.error('Error getting organization stats:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get organization statistics', 500);
        }
    }
    async listFederations(req, res) {
        try {
            const { name, tags, minMembers, maxMembers } = req.query;
            const filters = {};
            if (name) {
                filters.name = name;
            }
            if (tags) {
                filters.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
            }
            if (minMembers) {
                const parsed = Number.parseInt(minMembers, 10);
                if (!Number.isNaN(parsed)) {
                    filters.minMembers = parsed;
                }
            }
            if (maxMembers) {
                const parsed = Number.parseInt(maxMembers, 10);
                if (!Number.isNaN(parsed)) {
                    filters.maxMembers = parsed;
                }
            }
            const pagination = {
                page: Number.parseInt(req.query.page, 10) || 1,
                limit: Math.min(Number.parseInt(req.query.limit, 10) || 20, 200),
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
            };
            const result = await this.federationService.getPublicFederations(filters, pagination);
            const offset = (pagination.page - 1) * pagination.limit;
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/directory/federations', offset, pagination.limit, result.pagination.total);
            res.paginated(result.data, {
                total: result.pagination.total,
                limit: pagination.limit,
                offset: (pagination.page - 1) * pagination.limit,
                page: pagination.page,
                totalPages: result.pagination.totalPages,
                hasNext: result.pagination.hasNext,
                hasPrevious: result.pagination.hasPrev,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error listing federations:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to list federations', 500);
        }
    }
    async getFederation(req, res) {
        try {
            const { federationId } = req.params;
            const federation = await this.federationService.getPublicFederation(federationId);
            if (!federation) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Public federation not found', 404);
            }
            res.success(federation);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error getting federation:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get federation', 500);
        }
    }
    async getFederationStats(req, res) {
        try {
            const stats = await this.federationService.getPublicFederationStats();
            res.success(stats);
        }
        catch (error) {
            logger_1.logger.error('Error getting federation stats:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get federation statistics', 500);
        }
    }
    async getDirectorySeoMeta(req, res) {
        try {
            const meta = this.seoService.getDirectoryHomeMeta();
            res.success(meta);
        }
        catch (error) {
            logger_1.logger.error('Error getting directory SEO meta:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get SEO metadata', 500);
        }
    }
    async getOrganizationSeoMeta(req, res) {
        try {
            const { organizationId } = req.params;
            const meta = await this.seoService.getOrganizationMeta(organizationId);
            if (!meta) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Organization SEO metadata not found', 404);
            }
            res.success(meta);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error getting organization SEO meta:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get SEO metadata', 500);
        }
    }
    async getFederationSeoMeta(req, res) {
        try {
            const { federationId } = req.params;
            const meta = await this.seoService.getFederationMeta(federationId);
            if (!meta) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Federation SEO metadata not found', 404);
            }
            res.success(meta);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error getting federation SEO meta:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to get SEO metadata', 500);
        }
    }
    async renderSeoHtml(req, res) {
        try {
            const path = req.query.path || '/directory';
            const meta = await this.resolveSeoMetaByPath(path);
            const html = (0, SeoHtmlRenderer_1.renderSeoHtmlDocument)(meta);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.status(200).send(html);
        }
        catch (error) {
            logger_1.logger.error('Error rendering SEO HTML:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to render SEO HTML', 500);
        }
    }
    async getSitemap(req, res) {
        try {
            const xml = await this.seoService.generateSitemapXml();
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.status(200).send(xml);
        }
        catch (error) {
            logger_1.logger.error('Error generating sitemap XML:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to generate sitemap', 500);
        }
    }
}
exports.DirectoryControllerV2 = DirectoryControllerV2;
//# sourceMappingURL=directoryController.js.map