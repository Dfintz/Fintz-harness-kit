import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { ActivityLevel, OrgPrimaryFocus } from '../models/PublicOrgProfile';
import { OrganizationFederationService } from '../services/organization/OrganizationFederationService';
import { OrganizationMemberService } from '../services/organization/OrganizationMemberService';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import {
  DirectoryFilterOptions,
  PublicOrgDirectoryService,
} from '../services/organization/PublicOrgDirectoryService';
import { SeoService } from '../services/seo/SeoService';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiErrors';
import { parsePaginationParams, parseSearchTerm } from '../utils/controllerHelpers';
import { logger } from '../utils/logger';
import { getRoleName } from '../utils/roleUtils';

import { BaseController } from './BaseController';

// Valid sort fields for federation listing
const VALID_FEDERATION_SORT_FIELDS = ['memberCount', 'createdAt', 'name'] as const;

/**
 * Controller for public organization directory
 *
 * Provides public endpoints for browsing the organization directory,
 * public federations/alliances, and authenticated endpoints for managing
 * organization public profiles.
 */
export class PublicDirectoryController extends BaseController {
  private readonly directoryService = new PublicOrgDirectoryService();
  private readonly federationService = OrganizationFederationService.getInstance();
  private readonly permissionService = new OrganizationPermissionService();
  private readonly memberService = new OrganizationMemberService();
  private readonly seoService = new SeoService();

  // ==================== PUBLIC ENDPOINTS (NO AUTH) ====================

  /**
   * Parse a query param that may be a CSV string or string array.
   */
  private parseStringArray(value: unknown): string[] | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim());
    }
    if (Array.isArray(value)) {
      return value as string[];
    }
    return undefined;
  }

  /**
   * Build directory filter options from query parameters.
   */
  private buildDirectoryFilters(query: AuthRequest['query']): DirectoryFilterOptions {
    const {
      primaryFocus,
      primaryFocuses,
      activityLevel,
      activityLevels,
      isRecruiting,
      isVerified,
      minMemberCount,
      maxMemberCount,
      languages,
      timezone,
    } = query;

    const filters: DirectoryFilterOptions = {};

    const parsedFocuses = this.parseStringArray(primaryFocuses);
    if (parsedFocuses) {
      filters.primaryFocuses = parsedFocuses as OrgPrimaryFocus[];
    } else if (primaryFocus) {
      filters.primaryFocus = primaryFocus as OrgPrimaryFocus;
    }

    const parsedLevels = this.parseStringArray(activityLevels);
    if (parsedLevels) {
      filters.activityLevels = parsedLevels as ActivityLevel[];
    } else if (activityLevel) {
      filters.activityLevel = activityLevel as ActivityLevel;
    }

    if (isRecruiting !== undefined) {
      filters.isRecruiting = isRecruiting === 'true';
    }
    if (isVerified !== undefined) {
      filters.isVerified = isVerified === 'true';
    }
    if (minMemberCount) {
      filters.minMemberCount = Number.parseInt(minMemberCount as string, 10);
    }
    if (maxMemberCount) {
      filters.maxMemberCount = Number.parseInt(maxMemberCount as string, 10);
    }

    const parsedLangs = this.parseStringArray(languages);
    if (parsedLangs) {
      filters.languages = parsedLangs;
    }
    if (timezone) {
      filters.timezone = timezone as string;
    }

    const searchTerm = parseSearchTerm(query);
    if (searchTerm) {
      filters.searchTerm = searchTerm;
    }

    return filters;
  }

  /**
   * Get public organization directory
   * GET /api/directory
   * No authentication required
   */
  public getDirectory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const filters = this.buildDirectoryFilters(req.query);
      const pagination = parsePaginationParams(req.query);

      const result = await this.directoryService.getPublicDirectory(filters, pagination);

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Get a specific public organization profile
   * GET /api/directory/:identifier
   * Accepts UUID or slug. No authentication required.
   */
  public getPublicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const identifier = req.params.identifier || req.params.organizationId;

      const profile = await this.directoryService.getPublicProfile(identifier);

      if (!profile) {
        throw new NotFoundError('Public organization profile');
      }

      res.json({
        success: true,
        data: profile,
      });
    });
  };

  /**
   * Get directory statistics
   * GET /api/directory/stats
   * No authentication required
   */
  public getDirectoryStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const stats = await this.directoryService.getDirectoryStats();

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  /**
   * Get available filter options
   * GET /api/directory/options
   * No authentication required
   */
  public getFilterOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      res.json({
        success: true,
        data: {
          focusOptions: this.directoryService.getFocusOptions(),
          activityLevelOptions: this.directoryService.getActivityLevelOptions(),
        },
      });
    });
  };

  // ==================== PUBLIC FEDERATION ENDPOINTS (NO AUTH) ====================

  /**
   * Get public federations/alliances directory
   * GET /api/directory/federations
   * Phase 2: Enhanced with sorting options
   * No authentication required
   */
  public getPublicFederations = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { name, tags, minMembers, maxMembers, _page, _limit, _sortBy, _sortOrder } = req.query;

      const filters: {
        name?: string;
        tags?: string[];
        minMembers?: number;
        maxMembers?: number;
      } = {};

      if (name) {
        filters.name = name as string;
      }
      if (tags) {
        filters.tags =
          typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : (tags as string[]);
      }
      if (minMembers) {
        filters.minMembers = Number.parseInt(minMembers as string, 10);
      }
      if (maxMembers) {
        filters.maxMembers = Number.parseInt(maxMembers as string, 10);
      }

      // Use helper function for pagination
      const pagination = parsePaginationParams(req.query);

      // Validate sortBy to ensure it matches expected values
      type FederationSortField = (typeof VALID_FEDERATION_SORT_FIELDS)[number];
      const validatedPagination = {
        ...pagination,
        sortBy:
          pagination.sortBy &&
          (VALID_FEDERATION_SORT_FIELDS as readonly string[]).includes(pagination.sortBy)
            ? (pagination.sortBy as FederationSortField)
            : undefined,
      };

      const result = await this.federationService.getPublicFederations(
        filters,
        validatedPagination
      );

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Get a specific public federation
   * GET /api/directory/federations/:federationId
   * No authentication required
   */
  public getPublicFederation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { federationId } = req.params;

      const federation = await this.federationService.getPublicFederation(federationId);

      if (!federation) {
        throw new NotFoundError('Public federation');
      }

      res.json({
        success: true,
        data: federation,
      });
    });
  };

  /**
   * Get public federation statistics
   * GET /api/directory/federations/stats
   * No authentication required
   */
  public getPublicFederationStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const stats = await this.federationService.getPublicFederationStats();

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  // ==================== AUTHENTICATED ENDPOINTS ====================

  /**
   * Get own organization's public profile (for editing)
   * GET /api/organizations/:id/public-profile
   * Requires authentication and organization membership
   */
  public getOwnProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user has permission to view/manage settings
      let hasPermission = false;
      try {
        const permResult = await this.permissionService.checkPermission(
          userId,
          organizationId,
          ResourceType.SETTINGS,
          PermissionAction.VIEW
        );
        hasPermission = permResult.allowed;
      } catch (permError) {
        // Permission service may fail — fall back to membership role check
        logger.warn('Permission check failed for getOwnProfile, falling back to membership', {
          error: permError instanceof Error ? permError.message : String(permError),
        });
        const membership = await this.memberService.getMember(organizationId, userId);
        hasPermission = !!membership; // Any active member can view the profile
      }

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions to view public profile settings');
      }

      const profile = await this.directoryService.getOrCreateProfile(organizationId);

      res.json({
        success: true,
        data: profile,
      });
    });
  };

  /**
   * Update organization's public profile
   * PATCH /api/organizations/:id/public-profile
   * Requires authentication and organization admin permissions
   */
  public updateOwnProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user has permission to edit settings
      let hasPermission = false;
      try {
        const permResult = await this.permissionService.checkPermission(
          userId,
          organizationId,
          ResourceType.SETTINGS,
          PermissionAction.EDIT
        );
        hasPermission = permResult.allowed;
      } catch (permError) {
        logger.warn('Permission check failed for updateOwnProfile, falling back to membership', {
          error: permError instanceof Error ? permError.message : String(permError),
        });
        const membership = await this.memberService.getMember(organizationId, userId);
        const roleName = getRoleName(membership?.role);
        hasPermission = ['owner', 'founder', 'admin'].includes(roleName);
      }

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions to update public profile');
      }

      const profile = await this.directoryService.updateProfile(organizationId, req.body);

      res.json({
        success: true,
        message: 'Public profile updated successfully',
        data: profile,
      });
    });
  };

  /**
   * Sync profile data from RSI organization page
   * POST /api/organizations/:id/public-profile/sync-rsi
   * Requires authentication and organization admin permissions
   */
  public syncFromRsi = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const userId = req.user?.id;
      const { rsiSid } = req.body;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!rsiSid || typeof rsiSid !== 'string' || rsiSid.trim().length === 0) {
        throw new Error('RSI organization SID is required');
      }

      // Check permission
      let hasPermission = false;
      try {
        const permResult = await this.permissionService.checkPermission(
          userId,
          organizationId,
          ResourceType.SETTINGS,
          PermissionAction.EDIT
        );
        hasPermission = permResult.allowed;
      } catch (permError) {
        logger.warn('Permission check failed for syncFromRsi, falling back to membership', {
          error: permError instanceof Error ? permError.message : String(permError),
        });
        const membership = await this.memberService.getMember(organizationId, userId);
        const roleName = getRoleName(membership?.role);
        hasPermission = ['owner', 'founder', 'admin'].includes(roleName);
      }

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions to sync from RSI');
      }

      const profile = await this.directoryService.syncFromRsi(organizationId, rsiSid.trim());

      res.json({
        success: true,
        message: 'Profile synced from RSI successfully',
        data: profile,
      });
    });
  };

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Set organization verification status
   * PATCH /api/admin/directory/:organizationId/verify
   * Requires admin authentication
   */
  public setVerificationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { organizationId } = req.params;
      const { isVerified } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check for admin role (simplified check - real implementation would use admin service)
      // This could be enhanced to use a proper admin permission check
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

      if (!isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      const profile = await this.directoryService.setVerificationStatus(organizationId, isVerified);

      res.json({
        success: true,
        message: `Organization ${isVerified ? 'verified' : 'unverified'} successfully`,
        data: profile,
      });
    });
  };

  // ==================== SEO ENDPOINTS (NO AUTH) ====================

  /**
   * Get SEO metadata for directory homepage
   * GET /api/directory/seo
   * No authentication required
   */
  public getDirectorySeoMeta = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const meta = this.seoService.getDirectoryHomeMeta();
      res.json({
        success: true,
        data: meta,
      });
    });
  };

  /**
   * Get SEO metadata for a specific organization
   * GET /api/directory/:organizationId/seo
   * No authentication required
   */
  public getOrganizationSeoMeta = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { organizationId } = req.params;
      const meta = await this.seoService.getOrganizationMeta(organizationId);

      if (!meta) {
        throw new NotFoundError('Organization SEO metadata');
      }

      res.json({
        success: true,
        data: meta,
      });
    });
  };

  /**
   * Get SEO metadata for a federation
   * GET /api/directory/federations/:federationId/seo
   * No authentication required
   */
  public getFederationSeoMeta = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { federationId } = req.params;
      const meta = await this.seoService.getFederationMeta(federationId);

      if (!meta) {
        throw new NotFoundError('Federation SEO metadata');
      }

      res.json({
        success: true,
        data: meta,
      });
    });
  };

  /**
   * Get sitemap XML
   * GET /api/sitemap.xml
   * No authentication required
   */
  public getSitemap = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const sitemapXml = await this.seoService.generateSitemapXml();
      res.set('Content-Type', 'application/xml');
      res.send(sitemapXml);
    } catch (error) {
      logger.error('Error generating sitemap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate sitemap',
      });
    }
  };
}
