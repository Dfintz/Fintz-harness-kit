"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserControllerV2 = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const urls_1 = require("../../config/urls");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const ExportRequest_1 = require("../../models/ExportRequest");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const UserAchievement_1 = require("../../models/UserAchievement");
const AuthenticationService_1 = require("../../services/authentication/AuthenticationService");
const PasswordResetService_1 = require("../../services/authentication/PasswordResetService");
const AccountAccessLogService_1 = require("../../services/security/access/AccountAccessLogService");
const TrustedDeviceService_1 = require("../../services/security/access/TrustedDeviceService");
const UserShipService_1 = require("../../services/ship/UserShipService");
const FriendshipService_1 = require("../../services/social/FriendshipService");
const ExportRequestService_1 = require("../../services/user/ExportRequestService");
const GdprDataDeletionService_1 = require("../../services/user/GdprDataDeletionService");
const UserAuthenticationService_1 = require("../../services/user/UserAuthenticationService");
const UserPreferencesService_1 = require("../../services/user/UserPreferencesService");
const UserProfileService_1 = require("../../services/user/UserProfileService");
const UserSearchService_1 = require("../../services/user/UserSearchService");
const api_1 = require("../../types/api");
const authHelpers_1 = require("../../utils/authHelpers");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
class UserControllerV2 {
    static UUID_IDENTIFIER_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    userAuthService;
    authService;
    passwordResetService;
    trustedDeviceService;
    accessLogService;
    userSearchService;
    userShipService;
    userPreferencesService;
    userProfileService;
    COMPLETED_EXPORT_REUSE_WINDOW_MS = 60 * 60 * 1000;
    bufferToDataUrl(buffer, mimetype) {
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimetype};base64,${base64}`;
        if (dataUrl.length > 500_000) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Image is too large for local storage. Please use a smaller image or configure cloud storage.', 400);
        }
        return dataUrl;
    }
    constructor() {
        this.userAuthService = new UserAuthenticationService_1.UserAuthenticationService();
        this.authService = new AuthenticationService_1.AuthenticationService();
        this.passwordResetService = new PasswordResetService_1.PasswordResetService();
        this.trustedDeviceService = (0, TrustedDeviceService_1.getTrustedDeviceService)();
        this.accessLogService = new AccountAccessLogService_1.AccountAccessLogService();
        this.userSearchService = new UserSearchService_1.UserSearchService();
        this.userShipService = new UserShipService_1.UserShipService();
        this.userPreferencesService = new UserPreferencesService_1.UserPreferencesService();
        this.userProfileService = new UserProfileService_1.UserProfileService();
    }
    async findUserByIdentifier(identifier, selectFields) {
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const normalizedIdentifier = identifier.trim();
        const query = userRepo.createQueryBuilder('user');
        if (selectFields && selectFields.length > 0) {
            query.select(selectFields.map(field => `user.${String(field)}`));
        }
        if (UserControllerV2.UUID_IDENTIFIER_REGEX.test(normalizedIdentifier)) {
            query.where('user.id = :identifier', { identifier: normalizedIdentifier });
        }
        else {
            query.where('user.username = :identifier', { identifier: normalizedIdentifier });
        }
        return query.getOne();
    }
    async findUserById(userId, selectFields) {
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const query = userRepo.createQueryBuilder('user').where('user.id = :userId', { userId });
        if (selectFields && selectFields.length > 0) {
            query.select(selectFields.map(field => `user.${String(field)}`));
        }
        return query.getOne();
    }
    async findOrganizationById(organizationId, selectFields) {
        const organizationRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
        const query = organizationRepo
            .createQueryBuilder('organization')
            .where('organization.id = :organizationId', { organizationId });
        if (selectFields && selectFields.length > 0) {
            query.select(selectFields.map(field => `organization.${String(field)}`));
        }
        return query.getOne();
    }
    async findActiveMembership(userId, organizationId, includeRole = false) {
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const query = membershipRepo
            .createQueryBuilder('membership')
            .where('membership.userId = :userId', { userId })
            .andWhere('membership.organizationId = :organizationId', { organizationId })
            .andWhere('membership.isActive = :isActive', { isActive: true });
        if (includeRole) {
            query.leftJoinAndSelect('membership.role', 'role');
        }
        return query.getOne();
    }
    async getSessions(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const tokens = await this.authService.getUserRefreshTokens(userId);
        const sessions = tokens.map(token => ({
            id: token.id,
            createdAt: token.createdAt,
            expiresAt: token.expiresAt,
            lastUsedAt: token.lastUsedAt,
            ipAddress: token.ipAddress,
            userAgent: token.userAgent,
            deviceInfo: token.userAgent || 'Unknown device',
        }));
        res.success(sessions);
    }
    async revokeSession(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const { sessionId } = req.params;
        const revoked = await this.authService.revokeRefreshTokenById(sessionId, userId);
        if (!revoked) {
            res.status(404).json({
                success: false,
                error: 'Session not found or already revoked',
            });
            return;
        }
        res.success({ message: 'Session revoked successfully' });
    }
    async getTrustedDevices(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const devices = await this.trustedDeviceService.getUserDevices(userId);
        res.success(devices);
    }
    async revokeTrustedDevice(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const { deviceId } = req.params;
        const revoked = await this.trustedDeviceService.revokeDevice(userId, deviceId);
        if (!revoked) {
            res.status(404).json({
                success: false,
                error: 'Device not found or already revoked',
            });
            return;
        }
        res.success({ message: 'Device revoked successfully' });
    }
    async getAccessLogs(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        const logs = await this.accessLogService.getUserAccessLogs(userId, limit, offset);
        res.success(logs);
    }
    async getPrivacySettings(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const user = await this.findUserById(userId);
        if (!user) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
        }
        const privacy = user.preferences?.privacy ?? {};
        const settings = {
            profileVisibility: privacy.profileVisibility ?? 'public',
            showEmail: privacy.showEmail ?? false,
            showDiscord: privacy.showDiscord ?? false,
            showBio: privacy.showBio ?? true,
            showRsiInfo: privacy.showRsiInfo ?? true,
            showVerifiedBadge: privacy.showVerifiedBadge ?? true,
            showOrganizations: privacy.showOrganizations ?? true,
            showPublicShips: privacy.showPublicShips ?? true,
            showScStats: privacy.showScStats ?? false,
            showActivity: privacy.showActivity ?? true,
        };
        res.success(settings);
    }
    async updatePrivacySettings(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const allowedKeys = [
            'profileVisibility',
            'showEmail',
            'showDiscord',
            'showBio',
            'showRsiInfo',
            'showVerifiedBadge',
            'showOrganizations',
            'showPublicShips',
            'showScStats',
            'showActivity',
        ];
        const body = (req.body ?? {});
        const patch = {};
        for (const key of allowedKeys) {
            if (body[key] !== undefined) {
                patch[key] = body[key];
            }
        }
        try {
            const persistedPrivacy = await this.userPreferencesService.updateProfilePrivacy(userId, patch);
            res.success(persistedPrivacy);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            throw error;
        }
    }
    async exportData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const ipAddress = req.ip;
            const userAgent = req.headers['user-agent'];
            const exportService = (0, ExportRequestService_1.getExportRequestService)();
            const recentExports = await exportService.getUserExportRequests(userId, 1);
            if (recentExports.length > 0) {
                const recentExport = recentExports[0];
                if (recentExport.status === ExportRequest_1.ExportRequestStatus.PENDING ||
                    recentExport.status === ExportRequest_1.ExportRequestStatus.PROCESSING) {
                    logger_1.logger.info('Returning existing export request', {
                        userId,
                        requestId: recentExport.id,
                    });
                    return res.success({
                        requestId: recentExport.id,
                        status: recentExport.status,
                        message: 'Data export is already in progress',
                        requestedAt: recentExport.requestedAt,
                        estimatedTime: '5-15 minutes',
                    });
                }
                const oneHourAgo = new Date(Date.now() - this.COMPLETED_EXPORT_REUSE_WINDOW_MS);
                if (recentExport.status === ExportRequest_1.ExportRequestStatus.COMPLETED &&
                    recentExport.completedAt &&
                    recentExport.completedAt > oneHourAgo) {
                    logger_1.logger.info('Returning existing completed export', {
                        userId,
                        requestId: recentExport.id,
                    });
                    return res.success({
                        requestId: recentExport.id,
                        status: recentExport.status,
                        downloadToken: recentExport.downloadToken,
                        expiresAt: recentExport.expiresAt,
                        message: 'Your recent data export is still available',
                        completedAt: recentExport.completedAt,
                    });
                }
            }
            const exportRequest = await exportService.createExportRequest(userId, ipAddress, userAgent);
            logger_1.logger.info('GDPR data export request created', {
                userId,
                requestId: exportRequest.id,
            });
            res.success({
                requestId: exportRequest.id,
                status: exportRequest.status,
                message: 'Data export request created. You will be notified via email when complete.',
                requestedAt: exportRequest.requestedAt,
                estimatedTime: '5-15 minutes',
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create export request', {
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create data export request'), undefined, 500);
        }
    }
    async requestAccountDeletion(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { reason, password } = req.body;
            if (typeof password !== 'string' || password.length === 0) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Password is required to request account deletion', undefined, 400);
            }
            const user = await this.userAuthService.getUserWithPassword(userId);
            if (!user) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            if (!user.password) {
                logger_1.logger.warn('Cannot request account deletion - user has no password set', { userId });
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Cannot request account deletion - password is required', undefined, 400);
            }
            const passwordValid = await this.userAuthService.verifyPassword(password, user.password);
            if (!passwordValid) {
                logger_1.logger.warn('Failed account deletion attempt - invalid password', { userId });
                return res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, 'Invalid password', undefined, 401);
            }
            const deletionService = (0, GdprDataDeletionService_1.getGdprDataDeletionService)();
            const ipAddress = req.ip;
            const userAgent = req.headers['user-agent'];
            const existingRequest = await deletionService.getPendingDeletionRequest(userId);
            if (existingRequest) {
                logger_1.logger.info('Returning existing deletion request', {
                    userId,
                    requestId: existingRequest.id,
                });
                return res.success({
                    requestId: existingRequest.id,
                    status: existingRequest.status,
                    message: 'Account deletion request is already pending',
                    requestedAt: existingRequest.requestedAt,
                    scheduledFor: existingRequest.scheduledFor,
                    cancellationDeadline: existingRequest.scheduledFor,
                });
            }
            const deletionRequest = await deletionService.createDeletionRequest(userId, ipAddress, userAgent);
            logger_1.logger.info('Account deletion request created', {
                userId,
                requestId: deletionRequest.id,
                reason: typeof reason === 'string' ? reason : undefined,
            });
            res.success({
                requestId: deletionRequest.id,
                status: deletionRequest.status,
                message: 'Account deletion request submitted. Review period: 30 days. You can cancel anytime before the deadline.',
                requestedAt: deletionRequest.requestedAt,
                scheduledFor: deletionRequest.scheduledFor,
                cancellationDeadline: deletionRequest.scheduledFor,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create deletion request', {
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create account deletion request'), undefined, 500);
        }
    }
    async getBadges(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const userAchievementRepo = database_1.AppDataSource.getRepository(UserAchievement_1.UserAchievement);
            const userAchievements = await userAchievementRepo.find({
                where: { userId },
                relations: ['achievement'],
                order: { awardedAt: 'DESC' },
            });
            const badges = userAchievements
                .filter(ua => ua.achievement)
                .map(ua => ({
                id: ua.achievement.id,
                name: ua.achievement.name,
                description: ua.achievement.description,
                type: ua.achievement.type,
                rarity: ua.achievement.rarity,
                icon: ua.achievement.icon,
                category: ua.achievement.category,
                isDisplayed: ua.isDisplayed,
                earnedAt: ua.awardedAt,
            }));
            res.success(badges);
        }
        catch (error) {
            logger_1.logger.error('Failed to get badges', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get badges'), undefined, 500);
        }
    }
    async getCurrentUser(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const user = await this.findUserById(userId);
        if (!user) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
        }
        let activeOrgName;
        let activeOrgLogoUrl;
        let orgRole;
        let orgPermissions;
        if (user.activeOrgId) {
            const org = await this.findOrganizationById(user.activeOrgId, ['id', 'name', 'logoUrl']);
            if (org) {
                activeOrgName = org.name;
                activeOrgLogoUrl = org.logoUrl ?? undefined;
            }
            const membership = await this.findActiveMembership(user.id, user.activeOrgId, true);
            if (membership) {
                orgRole = (0, roleUtils_1.getRoleName)(membership.role);
                orgPermissions = membership.permissions ?? [];
            }
        }
        const fields = req.queryParams?.fields;
        let userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            discordId: user.discordId,
            role: user.role,
            activeOrgId: user.activeOrgId,
            organizationId: user.activeOrgId,
            activeOrgName,
            activeOrgLogoUrl,
            orgRole,
            orgPermissions,
            displayName: user.displayName,
            bio: user.bio,
            avatar: user.avatar,
            rsiHandle: user.rsiHandle,
            rsiVerified: user.rsiVerified,
            twoFactorEnabled: user.twoFactorEnabled,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
        const allMemberships = await database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership)
            .createQueryBuilder('mem')
            .innerJoinAndSelect('mem.organization', 'org')
            .innerJoinAndSelect('mem.role', 'role')
            .where('mem."userId" = :userId', { userId })
            .andWhere('mem."isActive" = true')
            .andWhere('org."isArchived" = false')
            .orderBy('role.priority', 'DESC')
            .getMany();
        userData.organizations = allMemberships.map(mem => ({
            orgId: mem.organizationId,
            orgName: mem.organization.name,
            orgLogo: mem.organization.logoUrl ?? undefined,
            roleName: mem.role?.name ?? 'Member',
        }));
        if (fields && fields.length > 0) {
            const filtered = {};
            fields.forEach(field => {
                if (field in userData) {
                    filtered[field] = userData[field];
                }
            });
            userData = filtered;
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.success(userData);
    }
    async updateCurrentUser(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const updates = (req.body ?? {});
        if (Object.hasOwn(updates, 'activeOrgId')) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'activeOrgId cannot be updated via this endpoint. Use /api/v2/users/me/active-organization instead', 400);
        }
        const allowedFields = ['displayName', 'bio', 'avatar'];
        const profilePatch = {};
        for (const field of allowedFields) {
            const value = updates[field];
            if (value !== undefined && value !== '') {
                profilePatch[field] = value;
            }
        }
        try {
            const user = await this.userProfileService.updateProfile(userId, profilePatch);
            res.success({
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                bio: user.bio,
                avatar: user.avatar,
                activeOrgId: user.activeOrgId,
                updatedAt: user.updatedAt,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            throw error;
        }
    }
    async getPreferences(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const user = await this.findUserById(userId);
        if (!user) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
        }
        const preferences = user.preferences || {
            theme: 'dark',
            notifications: {
                email: true,
                push: true,
                discord: true,
            },
            privacy: {
                showOnlineStatus: true,
                showProfile: true,
            },
            display: {
                language: 'en',
                timezone: 'UTC',
                dateFormat: 'YYYY-MM-DD',
            },
        };
        res.success(preferences);
    }
    async updatePreferences(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const updates = req.body;
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const user = await this.findUserById(userId);
        if (!user) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
        }
        user.preferences = {
            ...user.preferences,
            ...updates,
        };
        await userRepo.save(user);
        res.success(user.preferences);
    }
    async getUserOrganizations(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const { limit, offset, fields } = req.queryParams || api_1.DEFAULT_QUERY_PARAMS;
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const [memberships, total] = await membershipRepo.findAndCount({
            where: { userId, isActive: true },
            relations: ['organization'],
            skip: offset,
            take: limit,
            order: { joinedAt: 'DESC' },
        });
        const currentUser = await this.findUserById(userId, ['id', 'activeOrgId']);
        const activeOrgId = currentUser?.activeOrgId;
        const organizations = memberships.map(m => ({
            id: m.organizationId,
            name: m
                .organization?.name || 'Unknown',
            role: (0, roleUtils_1.getRoleName)(m.role),
            joinedAt: m.joinedAt,
            isActive: m.organizationId === activeOrgId,
        }));
        const filteredOrgs = (0, queryParser_1.selectFieldsFromArray)(organizations, fields);
        const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/users/me/organizations', offset, limit, total);
        res.paginated(filteredOrgs, {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        }, links);
    }
    async switchActiveOrganization(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const { organizationId } = req.body;
        if (!organizationId || typeof organizationId !== 'string') {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'organizationId is required', 400);
        }
        const updatedUser = await this.userPreferencesService.setActiveOrganization(userId, organizationId);
        const org = await this.findOrganizationById(organizationId, ['id', 'name', 'logoUrl']);
        const membership = await this.findActiveMembership(userId, organizationId);
        res.success({
            activeOrgId: updatedUser.activeOrgId,
            activeOrgName: org?.name,
            activeOrgLogoUrl: org?.logoUrl ?? undefined,
            orgRole: membership ? (0, roleUtils_1.getRoleName)(membership.role) : undefined,
        });
    }
    async getUserActivity(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const activity = {
            userId,
            recentActivities: [],
            stats: {
                activitiesJoined: 0,
                activitiesCreated: 0,
                missionsCompleted: 0,
                totalPlayTime: 0,
            },
            lastActive: new Date().toISOString(),
        };
        res.success(activity);
    }
    async getUserShips(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { limit, offset, sort, filters, fields, search } = req.queryParams || api_1.DEFAULT_QUERY_PARAMS;
            const q = req.query;
            const result = await this.userShipService.findMyShips(userId, {
                manufacturer: (filters.manufacturer ?? q['manufacturer']),
                status: (filters.status ?? q['status']),
                condition: (filters.condition ?? q['condition']),
                sharingLevel: (filters.sharingLevel ?? q['sharingLevel']),
                productionStatus: (filters.productionStatus ?? q['productionStatus']),
                search: search ?? q['search'] ?? undefined,
            }, {
                limit,
                offset,
                sortField: sort?.field,
                sortOrder: sort?.order,
            });
            const filteredShips = (0, queryParser_1.selectFieldsFromArray)(result.data, fields);
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/users/me/ships', offset, limit, result.total);
            res.paginated(filteredShips, {
                total: result.total,
                limit,
                offset,
                hasMore: offset + limit < result.total,
            }, links);
        }
        catch (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to fetch user ships: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async getUserShipsById(req, res) {
        try {
            const { id } = req.params;
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { limit, offset, sort, fields } = req.queryParams || api_1.DEFAULT_QUERY_PARAMS;
            const targetUser = await this.findUserByIdentifier(id);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const result = await this.userShipService.findPublicShips(targetUser.id, requestingUserId, {
                limit,
                offset,
                sortField: sort?.field,
                sortOrder: sort?.order,
            });
            const filteredShips = (0, queryParser_1.selectFieldsFromArray)(result.data, fields);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/users/${targetUser.id}/ships`, offset, limit, result.total);
            res.paginated(filteredShips, { total: result.total, limit, offset, hasMore: offset + limit < result.total }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to fetch user ships: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getUserById(req, res) {
        const { id } = req.params;
        const user = await this.findUserByIdentifier(id);
        if (!user) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
        }
        const publicProfile = {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            avatar: user.avatar,
            createdAt: user.createdAt,
        };
        const fields = req.queryParams?.fields;
        if (fields && fields.length > 0) {
            const filtered = {};
            fields.forEach(field => {
                if (field in publicProfile) {
                    filtered[field] = publicProfile[field];
                }
            });
            res.success(filtered);
        }
        else {
            res.success(publicProfile);
        }
    }
    async changePassword(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Old password and new password are required', 400);
        }
        try {
            await this.userAuthService.updatePassword(userId, oldPassword, newPassword);
            res.success({ message: 'Password changed successfully' });
        }
        catch (error) {
            res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, (0, errorHandler_1.getErrorMessage)(error, 'Password change failed'), undefined, 400);
        }
    }
    async getUserStatistics(req, res) {
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        const days = Number.parseInt(req.query.days, 10) || 30;
        try {
            const { UserActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/user')));
            const activityService = new UserActivityService();
            const statistics = await activityService.getUserActivityStats(userId, days);
            res.success({
                userId,
                period: {
                    days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString(),
                },
                statistics,
            });
        }
        catch (error) {
            res.error(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch statistics'), undefined, 500);
        }
    }
    async getUserActivityStatsById(req, res) {
        try {
            const { id } = req.params;
            const days = Number.parseInt(req.query.days, 10) || 30;
            const targetUser = await this.findUserByIdentifier(id);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const targetUserId = targetUser.id;
            const { UserActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/user')));
            const activityService = new UserActivityService();
            const statistics = await activityService.getUserActivityStats(targetUserId, days);
            res.success({
                userId: targetUserId,
                period: {
                    days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString(),
                },
                statistics,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to fetch user activity stats: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getActivityTimeline(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const days = Math.min(Math.max(Number.parseInt(req.query.days) || 30, 1), 365);
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit) || 50, 1), 200);
            const { UserActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/user')));
            const activityService = new UserActivityService();
            const timeline = await activityService.getUserActivityTimeline(userId, days, limit);
            res.success({
                timeline,
                parameters: { days, limit },
            });
        }
        catch (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get activity timeline: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getActivityHeatmap(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const months = Math.min(Math.max(Number.parseInt(req.query.months, 10) || 12, 1), 24);
            const { UserActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/user')));
            const activityService = new UserActivityService();
            const heatmap = await activityService.getActivityHeatmap(userId, months);
            res.success({
                heatmap,
                parameters: { months },
            });
        }
        catch (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get activity heatmap: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getUserActivityTimeline(req, res) {
        try {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id } = req.params;
            const selectFields = ['id', 'role', 'preferences'];
            const targetUser = await this.findUserByIdentifier(id, selectFields);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const userId = targetUser.id;
            const isOwnProfile = requestingUserId === userId;
            if (!isOwnProfile) {
                const requestingUser = await this.findUserById(requestingUserId, ['id', 'role']);
                if (!requestingUser) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not found', 401);
                }
                const isAdmin = requestingUser.role === 'admin';
                const privacy = targetUser.preferences?.privacy ?? {};
                const showActivity = privacy.showActivity !== false;
                if (!isAdmin && !showActivity) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'User has not made their activity public', 403);
                }
            }
            const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 365);
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
            const { UserActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/user')));
            const activityService = new UserActivityService();
            const timeline = await activityService.getUserActivityTimeline(userId, days, limit);
            res.success({
                timeline,
                parameters: { days, limit },
                userId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get activity timeline: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getUserActivityHeatmap(req, res) {
        try {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id } = req.params;
            const heatmapSelectFields = ['id', 'role', 'preferences'];
            const targetUser = await this.findUserByIdentifier(id, heatmapSelectFields);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const userId = targetUser.id;
            const isOwnProfile = requestingUserId === userId;
            if (!isOwnProfile) {
                const requestingUser = await this.findUserById(requestingUserId, ['id', 'role']);
                if (!requestingUser) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not found', 401);
                }
                const isAdmin = requestingUser.role === 'admin';
                const privacy = targetUser.preferences?.privacy ?? {};
                const showActivity = privacy.showActivity !== false;
                if (!isAdmin && !showActivity) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'User has not made their activity public', 403);
                }
            }
            const months = Math.min(Math.max(Number.parseInt(req.query.months, 10) || 12, 1), 24);
            const { UserActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/user')));
            const activityService = new UserActivityService();
            const heatmap = await activityService.getActivityHeatmap(userId, months);
            res.success({
                heatmap,
                parameters: { months },
                userId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get activity heatmap: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async updateUserRole(req, res) {
        try {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id: userId } = req.params;
            const { role } = req.body;
            if (typeof role !== 'string' || role.length === 0) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Role is required', 400);
            }
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(requestingUserId);
            if (requestingUser?.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
            }
            const targetUser = await this.findUserById(userId);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            targetUser.role = role;
            await userRepo.save(targetUser);
            res.success({
                message: 'User role updated successfully',
                user: {
                    id: targetUser.id,
                    username: targetUser.username,
                    role: targetUser.role,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to update user role: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async searchUsers(req, res) {
        try {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { limit = 20, offset = 0, search } = req.queryParams || {};
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(requestingUserId);
            if (requestingUser?.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
            }
            const queryBuilder = userRepo.createQueryBuilder('user');
            if (search) {
                queryBuilder.where('user.username ILIKE :search OR user.email ILIKE :search OR user.displayName ILIKE :search', { search: `%${search}%` });
            }
            const total = await queryBuilder.getCount();
            const users = await queryBuilder
                .skip(offset)
                .take(limit)
                .orderBy('user.createdAt', 'DESC')
                .getMany();
            const sanitizedUsers = users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
            }));
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/users/search', offset, limit, total);
            res.paginated(sanitizedUsers, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to search users: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async deactivateUser(req, res) {
        try {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id: userId } = req.params;
            const { _reason } = req.body;
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(requestingUserId);
            if (requestingUser?.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
            }
            const targetUser = await this.findUserById(userId);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const targetUserRecord = targetUser;
            targetUserRecord.isActive = false;
            targetUserRecord.deactivationReason = typeof _reason === 'string' ? _reason : undefined;
            targetUserRecord.deactivatedAt = new Date();
            await userRepo.save(targetUser);
            res.success({
                message: 'User account deactivated successfully',
                userId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to deactivate user: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getUserNotifications(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const queryParams = req.queryParams || {};
            const { limit: rawLimit = 20, offset: rawOffset = 0, filter } = queryParams;
            const limit = Number(rawLimit) || 20;
            const offset = Number(rawOffset) || 0;
            const unreadOnly = filter?.unread === 'true' ||
                filter?.unread === true;
            const notifications = [
                {
                    id: '1',
                    userId,
                    type: 'activity_invite',
                    title: 'Activity Invitation',
                    message: 'You have been invited to an upcoming operation',
                    read: false,
                    createdAt: new Date(),
                },
                {
                    id: '2',
                    userId,
                    type: 'org_announcement',
                    title: 'Organization Announcement',
                    message: 'New organization policy update',
                    read: true,
                    createdAt: new Date(Date.now() - 86400000),
                },
            ];
            const filtered = unreadOnly ? notifications.filter(n => !n.read) : notifications;
            const total = filtered.length;
            const items = filtered.slice(offset, offset + limit);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/users/me/notifications`, offset, limit, total);
            res.paginated(items, { total, limit, offset, hasMore: offset + limit < total }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get notifications: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async markNotificationRead(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id: notificationId } = req.params;
            logger_1.logger.info(`Marking notification ${notificationId} as read for user ${userId}`);
            res.success({
                message: 'Notification marked as read',
                notificationId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to mark notification as read: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async markAllNotificationsRead(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            logger_1.logger.info(`Marking all notifications as read for user ${userId}`);
            res.success({
                message: 'All notifications marked as read',
                count: 0,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to mark all notifications as read: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async deleteNotification(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id: notificationId } = req.params;
            logger_1.logger.info(`Deleting notification ${notificationId} for user ${userId}`);
            res.success({
                message: 'Notification deleted successfully',
                notificationId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to delete notification: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getNotificationSettings(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const settings = {
                userId,
                emailNotifications: true,
                pushNotifications: false,
                activityReminders: true,
                organizationAnnouncements: true,
                fleetUpdates: true,
                tradingAlerts: false,
            };
            res.success(settings);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get notification settings: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async updateAvatar(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const file = req.file;
            const avatarUrl = file
                ? await this.resolveAvatarFromUpload(file, userId)
                : this.resolveAvatarFromBody((req.body ?? {}));
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const user = await this.findUserById(userId);
            if (!user) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            user.avatar = avatarUrl;
            await userRepo.save(user);
            logger_1.logger.info(`User ${userId} updated avatar`);
            res.success({
                id: user.id,
                avatar: user.avatar,
                updatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to update avatar: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async resolveAvatarFromUpload(file, userId) {
        try {
            const { AzureBlobService } = await Promise.resolve().then(() => __importStar(require('../../services/cloud/AzureBlobService')));
            const blobService = new AzureBlobService();
            if (blobService.isConfigured()) {
                const fileName = `avatar-${userId}-${Date.now()}.${file.mimetype.split('/')[1] || 'png'}`;
                const blobUrl = await blobService.uploadImage(fileName, file.buffer, file.mimetype, {
                    resize: { width: 256, height: 256, fit: 'cover' },
                    quality: 85,
                    format: 'webp',
                });
                try {
                    const blobFileName = new URL(blobUrl).pathname.split('/').pop();
                    if (blobFileName) {
                        const base = (0, urls_1.getBackendUrl)();
                        return `${base}/api/v2/images/download/${encodeURIComponent(blobFileName)}`;
                    }
                }
                catch {
                }
                return blobUrl;
            }
        }
        catch (blobError) {
            logger_1.logger.warn('AzureBlobService unavailable, using data URL fallback', {
                error: blobError instanceof Error ? blobError.message : String(blobError),
            });
        }
        return this.bufferToDataUrl(file.buffer, file.mimetype);
    }
    resolveAvatarFromBody(body) {
        const { avatar } = body;
        if (!avatar || typeof avatar !== 'string') {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Avatar file or URL is required', 400);
        }
        const trimmed = avatar.trim();
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('data:image/')) {
            if (trimmed.length > 500_000) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Data URL is too large (max 500KB)', 400);
            }
            return trimmed;
        }
        if (trimmed.startsWith('/api/v2/images/download/')) {
            return trimmed;
        }
        if (lower.startsWith('https://')) {
            return trimmed;
        }
        if (lower.startsWith('http://') && process.env.NODE_ENV !== 'production') {
            return trimmed;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Avatar URL must be HTTPS, a data:image/ URL, or an API proxy path', 400);
    }
    async resetAvatar(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { source, rsiHandle } = req.body;
            if (source !== 'discord' && source !== 'rsi') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Source must be "discord" or "rsi"', 400);
            }
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const user = await this.findUserById(userId);
            if (!user) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const resolvedRsiHandle = typeof rsiHandle === 'string' && rsiHandle.length > 0 ? rsiHandle : user.username;
            const avatarUrl = source === 'discord'
                ? await this.fetchDiscordAvatar(user)
                : await this.fetchRsiAvatar(resolvedRsiHandle);
            if (!avatarUrl) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Could not retrieve avatar from source', 400);
            }
            user.avatar = avatarUrl;
            await userRepo.save(user);
            logger_1.logger.info(`User ${userId} reset avatar from ${source}`);
            res.success({
                id: user.id,
                avatar: user.avatar,
                source,
                updatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to reset avatar: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async fetchDiscordAvatar(user) {
        if (!user.discordId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'No Discord account linked', 400);
        }
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken) {
            try {
                const { default: axios } = await Promise.resolve().then(() => __importStar(require('axios')));
                const discordRes = await axios.get(`https://discord.com/api/v10/users/${user.discordId}`, {
                    headers: { Authorization: `Bot ${botToken}` },
                    timeout: 5000,
                });
                const discordUser = discordRes.data;
                if (discordUser.avatar) {
                    const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
                    return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=256`;
                }
            }
            catch {
            }
        }
        return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.discordId) >> 22n) % 6}.png`;
    }
    async fetchRsiAvatar(handle) {
        if (!handle) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'RSI handle is required', 400);
        }
        try {
            const { RsiCrawlerService } = await Promise.resolve().then(() => __importStar(require('../../services/external/RsiCrawlerService')));
            const crawler = new RsiCrawlerService();
            const citizen = await crawler.crawlCitizen(handle);
            return citizen?.avatarUrl ?? null;
        }
        catch {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch RSI profile picture', 500);
        }
    }
    async getPublicProfile(req, res) {
        try {
            const { id } = req.params;
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const publicProfile = await this.userProfileService.getPublicProfile(id, requestingUserId);
            if (!publicProfile) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            if (!publicProfile.isPrivateProfile) {
                await this.userProfileService.incrementProfileViews(publicProfile.id, requestingUserId);
            }
            res.success(publicProfile);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get public profile: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getLinkedAccounts(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const user = await this.findUserById(userId);
            if (!user) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const linkedAccounts = [];
            if (user.discordId &&
                !user.discordId.startsWith('google:') &&
                !user.discordId.startsWith('twitch:')) {
                linkedAccounts.push({
                    provider: 'discord',
                    providerId: user.discordId,
                    username: user.username,
                    linkedAt: user.createdAt,
                });
            }
            if (user.googleId) {
                linkedAccounts.push({
                    provider: 'google',
                    providerId: user.googleId,
                    linkedAt: user.createdAt,
                });
            }
            if (user.twitchId) {
                linkedAccounts.push({
                    provider: 'twitch',
                    providerId: user.twitchId,
                    linkedAt: user.createdAt,
                });
            }
            res.success({
                userId,
                accounts: linkedAccounts,
                total: linkedAccounts.length,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get linked accounts: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async unlinkAccount(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { provider } = req.params;
            if (!['discord', 'google', 'twitch'].includes(provider)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, `Invalid provider: ${provider}`, 400);
            }
            if (provider === 'discord') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Discord is the primary identity provider and cannot be unlinked', 400);
            }
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const user = await this.findUserById(userId);
            if (!user) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const providerField = provider === 'google' ? 'googleId' : 'twitchId';
            if (!user[providerField]) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, `${provider} account is not linked`, 400);
            }
            const hasRealDiscord = user.discordId &&
                !user.discordId.startsWith('google:') &&
                !user.discordId.startsWith('twitch:');
            const loginMethodCount = (hasRealDiscord ? 1 : 0) + (user.googleId ? 1 : 0) + (user.twitchId ? 1 : 0);
            if (loginMethodCount <= 1) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Cannot unlink your only login method. Link another account first.', 400);
            }
            await userRepo.update(userId, { [providerField]: undefined });
            res.success({ message: `${provider} account unlinked successfully` });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to unlink account: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            if (typeof email !== 'string' || email.length === 0) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Email is required', 400);
            }
            const result = await this.passwordResetService.requestPasswordReset(email);
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to request password reset: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async verifyResetToken(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Reset token is required', 400);
            }
            const result = await this.passwordResetService.verifyResetToken(token);
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.TOKEN_EXPIRED, `Failed to verify reset token: ${(0, errorHandler_1.getErrorMessage)(error)}`, 400);
        }
    }
    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;
            if (typeof token !== 'string' || token.length === 0 || typeof password !== 'string') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Token and new password are required', 400);
            }
            if (password.length < 8) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Password must be at least 8 characters', 400);
            }
            const result = await this.passwordResetService.resetPassword(token, password);
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to reset password: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async listUsers(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(userId);
            if (requestingUser?.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only admins can list users', 403);
            }
            const page = Number.parseInt(req.query.page, 10) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100);
            const skip = (page - 1) * limit;
            const [users, total] = await userRepository.findAndCount({
                skip,
                take: limit,
                order: { createdAt: 'DESC' },
            });
            res.success({
                users: users.map(u => ({
                    id: u.id,
                    username: u.username,
                    email: u.email,
                    role: u.role,
                    createdAt: u.createdAt,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to list users: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async createUser(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(userId);
            if (requestingUser?.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only admins can create users', 403);
            }
            const { username, email, password, role } = req.body;
            if (typeof username !== 'string' ||
                username.length === 0 ||
                typeof email !== 'string' ||
                email.length === 0 ||
                typeof password !== 'string' ||
                password.length === 0) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Username, email, and password are required', 400);
            }
            const existingUsernameUser = await userRepository
                .createQueryBuilder('user')
                .where('user.username = :username', { username })
                .getOne();
            const existingEmailUser = await this.userProfileService.getUserByEmail(email);
            if (existingUsernameUser || existingEmailUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_ALREADY_EXISTS, 'User with this username or email already exists', 409);
            }
            const hashedPassword = await this.userAuthService.hashPassword(password);
            const newUser = userRepository.create({
                username,
                email,
                password: hashedPassword,
                role: typeof role === 'string' ? role : 'user',
            });
            await userRepository.save(newUser);
            res.success({
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to create user: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async updateUserAdmin(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id } = req.params;
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(userId);
            if (!requestingUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not found', 401);
            }
            if (requestingUser.id !== id && requestingUser.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You can only update your own profile', 403);
            }
            const targetUser = await this.findUserById(id);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const { email, role, username } = req.body;
            if (typeof email === 'string' && email.length > 0) {
                targetUser.email = email;
            }
            if (typeof username === 'string' && username.length > 0) {
                targetUser.username = username;
            }
            if (typeof role === 'string' && role.length > 0 && requestingUser.role === 'admin') {
                targetUser.role = role;
            }
            await userRepository.save(targetUser);
            res.success({
                id: targetUser.id,
                username: targetUser.username,
                email: targetUser.email,
                role: targetUser.role,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to update user: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async deleteUser(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id } = req.params;
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await this.findUserById(userId);
            if (requestingUser?.role !== 'admin') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only admins can delete users', 403);
            }
            const targetUser = await this.findUserById(id);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            if (targetUser.id === userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You cannot delete your own account', 403);
            }
            await userRepository.remove(targetUser);
            res.success({ deletedId: targetUser.id });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to delete user: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async advancedSearch(req, res) {
        try {
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const { query, role, limit: rawLimit = 20, offset: rawOffset = 0, } = req.body;
            const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? rawLimit : 20;
            const offset = typeof rawOffset === 'number' && Number.isFinite(rawOffset) ? rawOffset : 0;
            if (!query || typeof query !== 'string') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Search query is required', 400);
            }
            const where = {};
            where.username = (0, typeorm_1.Like)(`%${query}%`);
            if (typeof role === 'string' && role.length > 0) {
                where.role = role;
            }
            const [results, total] = await userRepository.findAndCount({
                where,
                take: Math.min(limit, 100),
                skip: offset,
                order: { username: 'ASC' },
            });
            res.success({
                results: results.map(u => ({
                    id: u.id,
                    username: u.username,
                    email: u.email,
                })),
                total,
                query,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Search failed: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getUsernameSuggestions(req, res) {
        try {
            const { partial } = req.params;
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            if (!partial || partial.length < 2) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Partial username must be at least 2 characters', 400);
            }
            const suggestions = await userRepository.find({
                where: {
                    username: (0, typeorm_1.Like)(`%${partial}%`),
                },
                take: 10,
                order: { username: 'ASC' },
            });
            res.success({
                partial,
                suggestions: suggestions.map(u => u.username),
                count: suggestions.length,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get suggestions: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getSimilarUsers(req, res) {
        try {
            const { id } = req.params;
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
            const targetUser = await this.findUserById(id);
            if (!targetUser) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
            }
            const targetMemberships = await membershipRepo.find({
                where: { userId: id },
                select: ['organizationId'],
            });
            const orgIds = targetMemberships.map(m => m.organizationId).filter(Boolean);
            if (orgIds.length === 0) {
                res.success({ userId: id, similarUsers: [], total: 0 });
                return;
            }
            const peerMemberships = await membershipRepo.find({
                where: { organizationId: (0, typeorm_1.In)(orgIds) },
                select: ['userId', 'organizationId'],
            });
            const requesterId = req.user?.id;
            const friendIds = requesterId
                ? await FriendshipService_1.friendshipService.getFriendUserIds(requesterId)
                : new Set();
            const sharedCounts = new Map();
            for (const m of peerMemberships) {
                if (!m.userId || m.userId === id || friendIds.has(m.userId)) {
                    continue;
                }
                sharedCounts.set(m.userId, (sharedCounts.get(m.userId) ?? 0) + 1);
            }
            const ranked = [...sharedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
            const peerUserIds = ranked.map(([uid]) => uid);
            const peerUsers = peerUserIds.length
                ? await userRepository.find({
                    where: { id: (0, typeorm_1.In)(peerUserIds) },
                    select: ['id', 'username', 'displayName', 'avatar'],
                })
                : [];
            const userById = new Map(peerUsers.map(u => [u.id, u]));
            const similarUsers = ranked
                .map(([uid, sharedOrgs]) => {
                const u = userById.get(uid);
                if (!u) {
                    return null;
                }
                return {
                    userId: u.id,
                    username: u.username,
                    displayName: u.displayName,
                    avatar: u.avatar,
                    sharedOrganizations: sharedOrgs,
                };
            })
                .filter((entry) => entry !== null);
            res.success({
                userId: id,
                similarUsers,
                total: similarUsers.length,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get similar users: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async sendFriendRequest(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id } = req.params;
            const connection = await FriendshipService_1.friendshipService.sendFriendRequest(userId, id);
            res.success({
                requestId: connection.id,
                targetUserId: connection.targetUserId,
                status: connection.status,
                createdAt: connection.createdAt,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to send friend request: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async browseCommunityMembers(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { search, page, limit, sortBy, sortOrder, rsiVerifiedOnly, hasOrganization } = req.query;
            const searchService = this.userSearchService;
            const result = await searchService.browseCommunityMembers(userId, {
                search: search ?? undefined,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                sortBy: sortBy,
                sortOrder: sortOrder,
                rsiVerifiedOnly: rsiVerifiedOnly === true || rsiVerifiedOnly === 'true',
                hasOrganization: hasOrganization === true || hasOrganization === 'true',
            });
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                res.error(error.code, error.message, error.details, error.statusCode);
                return;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            logger_1.logger.error('Failed to browse community members', {
                error: message,
                stack: error instanceof Error ? error.stack : undefined,
                query: req.query,
            });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to browse community members', undefined, 500);
        }
    }
}
exports.UserControllerV2 = UserControllerV2;
//# sourceMappingURL=userController.js.map