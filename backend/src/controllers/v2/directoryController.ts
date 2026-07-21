/**
 * Directory Controller V2
 * Handles public directory endpoints with standardized v2 responses
 * Provides public organization and federation listings
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { OrganizationFederationService } from '../../services/organization/OrganizationFederationService';
import { PublicOrgDirectoryService } from '../../services/organization/PublicOrgDirectoryService';
import { renderSeoHtmlDocument } from '../../services/seo/SeoHtmlRenderer';
import { SEOMetadata, SeoService } from '../../services/seo/SeoService';
import { ApiErrorCode } from '../../types/api';
import { logger } from '../../utils/logger';

/**
 * Parse a multi-select query param that may be a comma-separated string or array.
 */
function parseMultiSelect(value: unknown): string[] {
  return typeof value === 'string' ? value.split(',').map(s => s.trim()) : (value as string[]);
}

/**
 * Build organization directory filters from query params.
 */
function buildOrganizationFilters(query: Request['query']): Record<string, unknown> {
  const filters: Record<string, unknown> = {};

  if (query.primaryFocuses) {
    filters.primaryFocuses = parseMultiSelect(query.primaryFocuses);
  } else if (query.primaryFocus) {
    filters.primaryFocus = query.primaryFocus;
  }

  if (query.activityLevels) {
    filters.activityLevels = parseMultiSelect(query.activityLevels);
  } else if (query.activityLevel) {
    filters.activityLevel = query.activityLevel;
  }

  if (query.isRecruiting !== undefined) {
    filters.isRecruiting = query.isRecruiting === 'true';
  }
  if (query.isVerified !== undefined) {
    filters.isVerified = query.isVerified === 'true';
  }

  const minMember = Number.parseInt(query.minMemberCount as string, 10);
  if (!Number.isNaN(minMember)) {
    filters.minMemberCount = minMember;
  }

  const maxMember = Number.parseInt(query.maxMemberCount as string, 10);
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

/**
 * Build pagination object from query params.
 */
function buildPagination(query: Request['query']) {
  return {
    page: Number.parseInt(query.page as string, 10) || 1,
    limit: Number.parseInt(query.limit as string, 10) || 20,
    sortBy: query.sortBy as string,
    sortOrder: query.sortOrder as 'ASC' | 'DESC',
  };
}

export class DirectoryControllerV2 {
  private readonly directoryService = new PublicOrgDirectoryService();
  private readonly federationService = OrganizationFederationService.getInstance();
  private readonly seoService = new SeoService();

  private static readonly DIRECTORY_ROUTE_REGEX = /^\/directory$/i;
  private static readonly DIRECTORY_ORGANIZATIONS_ROUTE_REGEX = /^\/directory\/organizations$/i;
  private static readonly DIRECTORY_ALLIANCES_ROUTE_REGEX = /^\/directory\/alliances$/i;
  private static readonly DIRECTORY_OPPORTUNITIES_ROUTE_REGEX = /^\/directory\/opportunities$/i;
  private static readonly ORGANIZATION_ROUTE_REGEX = /^\/directory\/organizations\/([^/]+)$/i;
  private static readonly FEDERATION_ROUTE_REGEX = /^\/directory\/federations\/([^/]+)$/i;
  private static readonly JOB_ROUTE_REGEX = /^\/directory\/jobs\/([^/]+)$/i;
  private static readonly PUBLIC_ACTIVITY_ROUTE_REGEX = /^\/opportunities\/activities\/([^/]+)$/i;
  private static readonly JOIN_ACTIVITY_ROUTE_REGEX = /^\/join\/activity\/([^/]+)$/i;
  private static readonly JOIN_SHORT_ROUTE_REGEX = /^\/j\/([^/]+)$/i;
  private static readonly LEGACY_ORGANIZATION_ROUTE_REGEX = /^\/directory\/([^/]+)$/i;
  private static readonly HOME_ROUTE_REGEX = /^\/$/i;
  private static readonly WELCOME_ROUTE_REGEX = /^\/welcome$/i;
  private static readonly OPPORTUNITIES_ROUTE_REGEX = /^\/opportunities$/i;
  private static readonly PUBLIC_STATS_ROUTE_REGEX = /^\/public\/stats$/i;
  private static readonly CHANGELOG_ROUTE_REGEX = /^\/changelog$/i;
  private static readonly MOBILE_ROUTE_REGEX = /^\/mobile$/i;
  private static readonly HELP_ROUTE_REGEX = /^\/help$/i;
  private static readonly BOT_COMMANDS_ROUTE_REGEX = /^\/bot-commands$/i;
  private static readonly FLEET_LANDING_ROUTE_REGEX = /^\/star-citizen-fleet-management$/i;
  private static readonly ORG_LANDING_ROUTE_REGEX = /^\/star-citizen-org-management$/i;
  private static readonly TRADE_LANDING_ROUTE_REGEX = /^\/star-citizen-trade-logistics-tools$/i;
  private static readonly DISCORD_LANDING_ROUTE_REGEX =
    /^\/star-citizen-discord-integration-tools$/i;

  private extractRouteParam(path: string, routeRegex: RegExp): string | null {
    const match = routeRegex.exec(path);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }

  private async resolveOrganizationMeta(path: string): Promise<SEOMetadata | null> {
    const organizationIdentifier =
      this.extractRouteParam(path, DirectoryControllerV2.ORGANIZATION_ROUTE_REGEX) ??
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

  private async resolveFederationMeta(path: string): Promise<SEOMetadata | null> {
    const federationIdentifier = this.extractRouteParam(
      path,
      DirectoryControllerV2.FEDERATION_ROUTE_REGEX
    );

    if (!federationIdentifier) {
      return null;
    }

    const federation = await this.federationService.getPublicFederation(federationIdentifier);
    if (!federation) {
      return null;
    }

    return this.seoService.getFederationMeta(federation.id);
  }

  private async resolveJobMeta(path: string): Promise<SEOMetadata | null> {
    const jobIdentifier = this.extractRouteParam(path, DirectoryControllerV2.JOB_ROUTE_REGEX);
    if (!jobIdentifier) {
      return null;
    }

    return this.seoService.getJobListingMeta(jobIdentifier);
  }

  private async resolvePublicActivityMeta(path: string): Promise<SEOMetadata | null> {
    const activityId = this.extractRouteParam(
      path,
      DirectoryControllerV2.PUBLIC_ACTIVITY_ROUTE_REGEX
    );
    if (!activityId) {
      return null;
    }

    return this.seoService.getPublicActivityMeta(activityId);
  }

  private async resolveJoinMeta(path: string): Promise<SEOMetadata | null> {
    const joinToken =
      this.extractRouteParam(path, DirectoryControllerV2.JOIN_ACTIVITY_ROUTE_REGEX) ??
      this.extractRouteParam(path, DirectoryControllerV2.JOIN_SHORT_ROUTE_REGEX);

    if (!joinToken) {
      return null;
    }

    return this.seoService.getJoinActivityMeta(joinToken);
  }

  private resolveStaticPageMeta(path: string): SEOMetadata | null {
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

  private async resolveSeoMetaByPath(path: string): Promise<SEOMetadata> {
    const normalizedPath = (path.split('?')[0] || '/').trim();

    // Home page
    if (DirectoryControllerV2.HOME_ROUTE_REGEX.test(normalizedPath)) {
      return this.seoService.getHomePageMeta();
    }

    // Welcome page
    if (DirectoryControllerV2.WELCOME_ROUTE_REGEX.test(normalizedPath)) {
      return this.seoService.getWelcomePageMeta();
    }

    // Directory home
    if (DirectoryControllerV2.DIRECTORY_ROUTE_REGEX.test(normalizedPath)) {
      return this.seoService.getDirectoryHomeMeta();
    }

    // Organizations and federations
    const organizationMeta = await this.resolveOrganizationMeta(normalizedPath);
    if (organizationMeta) {
      return organizationMeta;
    }

    const federationMeta = await this.resolveFederationMeta(normalizedPath);
    if (federationMeta) {
      return federationMeta;
    }

    // Jobs
    const jobMeta = await this.resolveJobMeta(normalizedPath);
    if (jobMeta) {
      return jobMeta;
    }

    // Activities and join links
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

    // Fallback to home page
    return this.seoService.getHomePageMeta();
  }

  /**
   * GET /api/v2/directory/organizations
   * List public organizations with filtering and pagination
   * No authentication required
   */
  async listOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const filters = buildOrganizationFilters(req.query);
      const pagination = buildPagination(req.query);

      const result = await this.directoryService.getPublicDirectory(filters, pagination);

      // Build HATEOAS links
      const offset = (pagination.page - 1) * pagination.limit;
      const links = buildHateoasLinks(
        '/api/v2/directory/organizations',
        offset,
        pagination.limit,
        result.pagination.total
      );

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit: pagination.limit,
          offset: (pagination.page - 1) * pagination.limit,
          page: pagination.page,
          totalPages: result.pagination.totalPages,
          hasNext: result.pagination.hasNext,
          hasPrevious: result.pagination.hasPrev,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error) {
      logger.error('Error listing organizations:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to list organizations', 500);
    }
  }

  /**
   * GET /api/v2/directory/organizations/:organizationId
   * Get a specific public organization profile
   * No authentication required
   */
  async getOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;

      const profile = await this.directoryService.getPublicProfile(organizationId);

      if (!profile) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Public organization profile not found',
          404
        );
      }

      res.success(profile);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error getting organization:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get organization', 500);
    }
  }

  /**
   * GET /api/v2/directory/organizations/:organizationId/federations
   * Get public federations that the organization belongs to
   * No authentication required
   */
  async getOrganizationFederations(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const federations = await this.federationService.getPublicFederationsForOrg(organizationId);
      res.success(federations);
    } catch (error) {
      logger.error('Error getting organization federations:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to get organization federations',
        500
      );
    }
  }

  /**
   * GET /api/v2/directory/organizations/stats
   * Get directory statistics
   * No authentication required
   */
  async getOrganizationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.directoryService.getDirectoryStats();
      res.success(stats);
    } catch (error) {
      logger.error('Error getting organization stats:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get organization statistics', 500);
    }
  }

  /**
   * GET /api/v2/directory/federations
   * List public federations with filtering and pagination
   * No authentication required
   */
  async listFederations(req: Request, res: Response): Promise<void> {
    try {
      const { name, tags, minMembers, maxMembers } = req.query;

      const filters: Record<string, unknown> = {};

      if (name) {
        filters.name = name;
      }
      if (tags) {
        filters.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
      }
      if (minMembers) {
        const parsed = Number.parseInt(minMembers as string, 10);
        if (!Number.isNaN(parsed)) {
          filters.minMembers = parsed;
        }
      }
      if (maxMembers) {
        const parsed = Number.parseInt(maxMembers as string, 10);
        if (!Number.isNaN(parsed)) {
          filters.maxMembers = parsed;
        }
      }

      // Pagination from parsed query
      const pagination = {
        page: Number.parseInt(req.query.page as string, 10) || 1,
        limit: Math.min(Number.parseInt(req.query.limit as string, 10) || 20, 200),
        sortBy: req.query.sortBy as 'memberCount' | 'createdAt' | 'name',
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
      };

      const result = await this.federationService.getPublicFederations(filters, pagination);

      // Build HATEOAS links
      const offset = (pagination.page - 1) * pagination.limit;
      const links = buildHateoasLinks(
        '/api/v2/directory/federations',
        offset,
        pagination.limit,
        result.pagination.total
      );

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit: pagination.limit,
          offset: (pagination.page - 1) * pagination.limit,
          page: pagination.page,
          totalPages: result.pagination.totalPages,
          hasNext: result.pagination.hasNext,
          hasPrevious: result.pagination.hasPrev,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error) {
      logger.error('Error listing federations:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to list federations', 500);
    }
  }

  /**
   * GET /api/v2/directory/federations/:federationId
   * Get a specific public federation
   * No authentication required
   */
  async getFederation(req: Request, res: Response): Promise<void> {
    try {
      const { federationId } = req.params;

      const federation = await this.federationService.getPublicFederation(federationId);

      if (!federation) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Public federation not found', 404);
      }

      res.success(federation);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error getting federation:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get federation', 500);
    }
  }

  /**
   * GET /api/v2/directory/federations/stats
   * Get public federation statistics
   * No authentication required
   */
  async getFederationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.federationService.getPublicFederationStats();
      res.success(stats);
    } catch (error) {
      logger.error('Error getting federation stats:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get federation statistics', 500);
    }
  }

  /**
   * GET /api/v2/directory/seo
   * Get SEO metadata for directory homepage
   * No authentication required
   */
  async getDirectorySeoMeta(req: Request, res: Response): Promise<void> {
    try {
      const meta = this.seoService.getDirectoryHomeMeta();
      res.success(meta);
    } catch (error) {
      logger.error('Error getting directory SEO meta:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get SEO metadata', 500);
    }
  }

  /**
   * GET /api/v2/directory/organizations/:organizationId/seo
   * Get SEO metadata for a specific organization
   * No authentication required
   */
  async getOrganizationSeoMeta(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const meta = await this.seoService.getOrganizationMeta(organizationId);

      if (!meta) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Organization SEO metadata not found',
          404
        );
      }

      res.success(meta);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error getting organization SEO meta:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get SEO metadata', 500);
    }
  }

  /**
   * GET /api/v2/directory/federations/:federationId/seo
   * Get SEO metadata for a federation
   * No authentication required
   */
  async getFederationSeoMeta(req: Request, res: Response): Promise<void> {
    try {
      const { federationId } = req.params;
      const meta = await this.seoService.getFederationMeta(federationId);

      if (!meta) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Federation SEO metadata not found',
          404
        );
      }

      res.success(meta);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error getting federation SEO meta:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to get SEO metadata', 500);
    }
  }

  /**
   * GET /api/v2/directory/seo/html?path=/directory/organizations/:slug
   * Render crawler-targeted HTML with route-specific SEO metadata.
   */
  async renderSeoHtml(req: Request, res: Response): Promise<void> {
    try {
      const path = (req.query.path as string | undefined) || '/directory';
      const meta = await this.resolveSeoMetaByPath(path);
      const html = renderSeoHtmlDocument(meta);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(html);
    } catch (error) {
      logger.error('Error rendering SEO HTML:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to render SEO HTML', 500);
    }
  }

  /**
   * GET /api/v2/sitemap.xml
   * Return XML sitemap for public routes.
   */
  async getSitemap(req: Request, res: Response): Promise<void> {
    try {
      const xml = await this.seoService.generateSitemapXml();

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(xml);
    } catch (error) {
      logger.error('Error generating sitemap XML:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to generate sitemap', 500);
    }
  }
}
