"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicDirectoryController = void 0;
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const OrganizationFederationService_1 = require("../services/organization/OrganizationFederationService");
const OrganizationMemberService_1 = require("../services/organization/OrganizationMemberService");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const PublicOrgDirectoryService_1 = require("../services/organization/PublicOrgDirectoryService");
const SeoService_1 = require("../services/seo/SeoService");
const apiErrors_1 = require("../utils/apiErrors");
const controllerHelpers_1 = require("../utils/controllerHelpers");
const logger_1 = require("../utils/logger");
const roleUtils_1 = require("../utils/roleUtils");
const BaseController_1 = require("./BaseController");
const VALID_FEDERATION_SORT_FIELDS = ['memberCount', 'createdAt', 'name'];
class PublicDirectoryController extends BaseController_1.BaseController {
    directoryService = new PublicOrgDirectoryService_1.PublicOrgDirectoryService();
    federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    memberService = new OrganizationMemberService_1.OrganizationMemberService();
    seoService = new SeoService_1.SeoService();
    parseStringArray(value) {
        if (!value) {
            return undefined;
        }
        if (typeof value === 'string') {
            return value.split(',').map(s => s.trim());
        }
        if (Array.isArray(value)) {
            return value;
        }
        return undefined;
    }
    buildDirectoryFilters(query) {
        const { primaryFocus, primaryFocuses, activityLevel, activityLevels, isRecruiting, isVerified, minMemberCount, maxMemberCount, languages, timezone, } = query;
        const filters = {};
        const parsedFocuses = this.parseStringArray(primaryFocuses);
        if (parsedFocuses) {
            filters.primaryFocuses = parsedFocuses;
        }
        else if (primaryFocus) {
            filters.primaryFocus = primaryFocus;
        }
        const parsedLevels = this.parseStringArray(activityLevels);
        if (parsedLevels) {
            filters.activityLevels = parsedLevels;
        }
        else if (activityLevel) {
            filters.activityLevel = activityLevel;
        }
        if (isRecruiting !== undefined) {
            filters.isRecruiting = isRecruiting === 'true';
        }
        if (isVerified !== undefined) {
            filters.isVerified = isVerified === 'true';
        }
        if (minMemberCount) {
            filters.minMemberCount = Number.parseInt(minMemberCount, 10);
        }
        if (maxMemberCount) {
            filters.maxMemberCount = Number.parseInt(maxMemberCount, 10);
        }
        const parsedLangs = this.parseStringArray(languages);
        if (parsedLangs) {
            filters.languages = parsedLangs;
        }
        if (timezone) {
            filters.timezone = timezone;
        }
        const searchTerm = (0, controllerHelpers_1.parseSearchTerm)(query);
        if (searchTerm) {
            filters.searchTerm = searchTerm;
        }
        return filters;
    }
    getDirectory = async (req, res) => {
        await this.execute(req, res, async () => {
            const filters = this.buildDirectoryFilters(req.query);
            const pagination = (0, controllerHelpers_1.parsePaginationParams)(req.query);
            const result = await this.directoryService.getPublicDirectory(filters, pagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    getPublicProfile = async (req, res) => {
        await this.execute(req, res, async () => {
            const identifier = req.params.identifier || req.params.organizationId;
            const profile = await this.directoryService.getPublicProfile(identifier);
            if (!profile) {
                throw new apiErrors_1.NotFoundError('Public organization profile');
            }
            res.json({
                success: true,
                data: profile,
            });
        });
    };
    getDirectoryStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const stats = await this.directoryService.getDirectoryStats();
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    getFilterOptions = async (req, res) => {
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
    getPublicFederations = async (req, res) => {
        await this.execute(req, res, async () => {
            const { name, tags, minMembers, maxMembers, _page, _limit, _sortBy, _sortOrder } = req.query;
            const filters = {};
            if (name) {
                filters.name = name;
            }
            if (tags) {
                filters.tags =
                    typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
            }
            if (minMembers) {
                filters.minMembers = Number.parseInt(minMembers, 10);
            }
            if (maxMembers) {
                filters.maxMembers = Number.parseInt(maxMembers, 10);
            }
            const pagination = (0, controllerHelpers_1.parsePaginationParams)(req.query);
            const validatedPagination = {
                ...pagination,
                sortBy: pagination.sortBy &&
                    VALID_FEDERATION_SORT_FIELDS.includes(pagination.sortBy)
                    ? pagination.sortBy
                    : undefined,
            };
            const result = await this.federationService.getPublicFederations(filters, validatedPagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    getPublicFederation = async (req, res) => {
        await this.execute(req, res, async () => {
            const { federationId } = req.params;
            const federation = await this.federationService.getPublicFederation(federationId);
            if (!federation) {
                throw new apiErrors_1.NotFoundError('Public federation');
            }
            res.json({
                success: true,
                data: federation,
            });
        });
    };
    getPublicFederationStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const stats = await this.federationService.getPublicFederationStats();
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    getOwnProfile = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            let hasPermission = false;
            try {
                const permResult = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.VIEW);
                hasPermission = permResult.allowed;
            }
            catch (permError) {
                logger_1.logger.warn('Permission check failed for getOwnProfile, falling back to membership', {
                    error: permError instanceof Error ? permError.message : String(permError),
                });
                const membership = await this.memberService.getMember(organizationId, userId);
                hasPermission = !!membership;
            }
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view public profile settings');
            }
            const profile = await this.directoryService.getOrCreateProfile(organizationId);
            res.json({
                success: true,
                data: profile,
            });
        });
    };
    updateOwnProfile = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            let hasPermission = false;
            try {
                const permResult = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
                hasPermission = permResult.allowed;
            }
            catch (permError) {
                logger_1.logger.warn('Permission check failed for updateOwnProfile, falling back to membership', {
                    error: permError instanceof Error ? permError.message : String(permError),
                });
                const membership = await this.memberService.getMember(organizationId, userId);
                const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
                hasPermission = ['owner', 'founder', 'admin'].includes(roleName);
            }
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update public profile');
            }
            const profile = await this.directoryService.updateProfile(organizationId, req.body);
            res.json({
                success: true,
                message: 'Public profile updated successfully',
                data: profile,
            });
        });
    };
    syncFromRsi = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const userId = req.user?.id;
            const { rsiSid } = req.body;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            if (!rsiSid || typeof rsiSid !== 'string' || rsiSid.trim().length === 0) {
                throw new Error('RSI organization SID is required');
            }
            let hasPermission = false;
            try {
                const permResult = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
                hasPermission = permResult.allowed;
            }
            catch (permError) {
                logger_1.logger.warn('Permission check failed for syncFromRsi, falling back to membership', {
                    error: permError instanceof Error ? permError.message : String(permError),
                });
                const membership = await this.memberService.getMember(organizationId, userId);
                const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
                hasPermission = ['owner', 'founder', 'admin'].includes(roleName);
            }
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to sync from RSI');
            }
            const profile = await this.directoryService.syncFromRsi(organizationId, rsiSid.trim());
            res.json({
                success: true,
                message: 'Profile synced from RSI successfully',
                data: profile,
            });
        });
    };
    setVerificationStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const { isVerified } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
            if (!isAdmin) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const profile = await this.directoryService.setVerificationStatus(organizationId, isVerified);
            res.json({
                success: true,
                message: `Organization ${isVerified ? 'verified' : 'unverified'} successfully`,
                data: profile,
            });
        });
    };
    getDirectorySeoMeta = async (req, res) => {
        await this.execute(req, res, async () => {
            const meta = this.seoService.getDirectoryHomeMeta();
            res.json({
                success: true,
                data: meta,
            });
        });
    };
    getOrganizationSeoMeta = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const meta = await this.seoService.getOrganizationMeta(organizationId);
            if (!meta) {
                throw new apiErrors_1.NotFoundError('Organization SEO metadata');
            }
            res.json({
                success: true,
                data: meta,
            });
        });
    };
    getFederationSeoMeta = async (req, res) => {
        await this.execute(req, res, async () => {
            const { federationId } = req.params;
            const meta = await this.seoService.getFederationMeta(federationId);
            if (!meta) {
                throw new apiErrors_1.NotFoundError('Federation SEO metadata');
            }
            res.json({
                success: true,
                data: meta,
            });
        });
    };
    getSitemap = async (req, res) => {
        try {
            const sitemapXml = await this.seoService.generateSitemapXml();
            res.set('Content-Type', 'application/xml');
            res.send(sitemapXml);
        }
        catch (error) {
            logger_1.logger.error('Error generating sitemap:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate sitemap',
            });
        }
    };
}
exports.PublicDirectoryController = PublicDirectoryController;
//# sourceMappingURL=publicDirectoryController.js.map