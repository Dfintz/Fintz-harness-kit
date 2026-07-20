"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_cache_1 = __importDefault(require("node-cache"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const UserActivityService_1 = require("./UserActivityService");
const UserAuthenticationService_1 = require("./UserAuthenticationService");
const UserPreferencesService_1 = require("./UserPreferencesService");
const UserProfileService_1 = require("./UserProfileService");
const UserSearchService_1 = require("./UserSearchService");
const UserSocialService_1 = require("./UserSocialService");
const DASHBOARD_TIMELINE_DAYS = 7;
const DASHBOARD_TIMELINE_LIMIT = 10;
class UserService {
    static SANDBOX_USERNAME_PREFIX = 'sandbox';
    static SANDBOX_EMAIL_DOMAIN = 'sandbox.local';
    userRepository;
    cache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60, useClones: false });
    activityService = new UserActivityService_1.UserActivityService();
    authenticationService = new UserAuthenticationService_1.UserAuthenticationService();
    profileService = new UserProfileService_1.UserProfileService();
    preferencesService = new UserPreferencesService_1.UserPreferencesService();
    searchService = new UserSearchService_1.UserSearchService();
    socialService = new UserSocialService_1.UserSocialService();
    constructor() {
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    }
    async validateUsersInOrganization(userIds, organizationId) {
        if (!userIds || userIds.length === 0) {
            return { valid: [], invalid: [] };
        }
        try {
            const members = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).find({
                where: {
                    organizationId,
                    userId: (0, typeorm_1.In)(userIds),
                },
                select: ['userId'],
            });
            const validIds = new Set(members.map(m => m.userId));
            const invalid = userIds.filter(id => !validIds.has(id));
            return {
                valid: Array.from(validIds),
                invalid,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to validate users in organization', {
                organizationId,
                userCount: userIds.length,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new apiErrors_1.DatabaseError('Failed to verify crew membership');
        }
    }
    async getUserById(userId, options) {
        const hasOptions = options && Object.values(options).some(Boolean);
        if (!hasOptions) {
            const cached = this.cache.get(`user:${userId}`);
            if (cached) {
                return cached;
            }
        }
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            return null;
        }
        if (!hasOptions) {
            this.cache.set(`user:${userId}`, user);
        }
        if (options?.includeProfile) {
            const profileData = await this.profileService.getProfileActivity(userId);
            user.profileData = profileData;
        }
        if (options?.includePreferences) {
            const preferences = await this.preferencesService.getUserPreferences(userId);
            user.preferences = preferences;
        }
        if (options?.includeSocialStats) {
            const socialStats = await this.socialService.getSocialStats(userId);
            user.socialStats = socialStats;
        }
        return user;
    }
    async getUserByUsername(username) {
        const user = await this.userRepository.findOne({ where: { username } });
        return user || null;
    }
    async getUserByEmail(email) {
        return this.profileService.getUserByEmail(email);
    }
    async getUserByDiscordId(discordId) {
        const user = await this.userRepository.findOne({ where: { discordId } });
        return user || null;
    }
    async getUserByGoogleId(googleId) {
        const user = await this.userRepository.findOne({ where: { googleId } });
        return user || null;
    }
    async getUserByTwitchId(twitchId) {
        const user = await this.userRepository.findOne({ where: { twitchId } });
        return user || null;
    }
    async createUser(userData) {
        logger_1.logger.info('Creating user', {
            username: userData.username,
            email: userData.email,
        });
        const user = this.userRepository.create(userData);
        const savedUser = await this.userRepository.save(user);
        await this.preferencesService.resetPreferences(savedUser.id);
        await this.socialService.logSocialActivity({
            userId: savedUser.id,
            activityType: UserSocialService_1.SocialActivityType.PROFILE_VIEW,
            description: 'User account created',
            isPublic: false,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.USER,
            action: 'USER_CREATED',
            message: `User account created: ${savedUser.username}`,
            userId: savedUser.id,
            resource: `user/${savedUser.id}`,
            metadata: {
                username: savedUser.username,
                email: savedUser.email,
            },
        });
        return savedUser;
    }
    async createSandboxUser(options) {
        const usernamePrefix = this.normalizeSandboxUsernamePrefix(options?.usernamePrefix);
        const emailDomain = this.normalizeSandboxEmailDomain(options?.emailDomain);
        const suffix = node_crypto_1.default.randomUUID().split('-')[0];
        const username = `${usernamePrefix}-${suffix}`;
        const email = `${username}@${emailDomain}`;
        return this.createUser({
            id: node_crypto_1.default.randomUUID(),
            username,
            email,
            role: 'user',
            discordId: `sandbox-${suffix}`,
            displayName: 'Sandbox User',
            lastLoginAt: new Date(),
            lastLoginIp: options?.ipAddress,
            loginCount: 1,
        });
    }
    normalizeSandboxUsernamePrefix(rawPrefix) {
        const prefix = (rawPrefix ?? UserService.SANDBOX_USERNAME_PREFIX)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '') || UserService.SANDBOX_USERNAME_PREFIX;
        return prefix;
    }
    normalizeSandboxEmailDomain(rawDomain) {
        const domain = (rawDomain ?? UserService.SANDBOX_EMAIL_DOMAIN)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, '') || UserService.SANDBOX_EMAIL_DOMAIN;
        return domain;
    }
    async updateUser(userId, userData, updateType = 'general') {
        logger_1.logger.info('Updating user', {
            userId,
            updateType,
            updateFields: Object.keys(userData),
        });
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        switch (updateType) {
            case 'profile':
                return this.profileService.updateProfile(userId, userData);
            case 'auth':
                throw new Error('Use authentication service for auth-related updates');
            default: {
                const updateData = {};
                for (const [key, value] of Object.entries(userData)) {
                    updateData[key] = value ?? null;
                }
                await this.userRepository.update(userId, updateData);
                this.cache.del(`user:${userId}`);
                const updated = await this.userRepository.findOne({ where: { id: userId } });
                if (!updated) {
                    throw new Error('User not found after update');
                }
                this.cache.set(`user:${userId}`, updated);
                AuditService_1.auditService.log({
                    category: AuditService_1.AuditCategory.USER,
                    action: 'USER_UPDATED',
                    message: `User account updated`,
                    userId,
                    resource: `user/${userId}`,
                    metadata: {
                        updateType,
                        updateFields: Object.keys(userData),
                    },
                });
                return updated;
            }
        }
    }
    async deleteUser(userId, performedBy, reason) {
        logger_1.logger.info('Deleting user account', {
            userId,
            performedBy,
            reason,
        });
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        this.cache.del(`user:${userId}`);
        await this.socialService.logSocialActivity({
            userId: performedBy,
            targetUserId: userId,
            activityType: UserSocialService_1.SocialActivityType.PROFILE_VIEW,
            description: `User account deleted. Reason: ${reason || 'Not specified'}`,
            isPublic: false,
            metadata: { deletedUserId: userId, reason },
        });
        await this.userRepository.remove(user);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.USER,
            action: 'USER_DELETED',
            message: `User account deleted: ${user.username}`,
            userId: performedBy,
            resource: `user/${userId}`,
            metadata: {
                deletedUserId: userId,
                deletedUsername: user.username,
                deletedEmail: user.email,
                reason: reason || 'Not specified',
            },
        });
    }
    async listUsers(filters, pagination, sort) {
        return this.searchService.searchUsers(undefined, filters, pagination, sort);
    }
    async searchUsers(query, filters, pagination) {
        return this.searchService.searchUsers(query, filters, pagination);
    }
    async validateCredentials(username, password) {
        return this.authenticationService.validateCredentials(username, password);
    }
    async updatePassword(userId, oldPassword, newPassword) {
        await this.authenticationService.updatePassword(userId, oldPassword, newPassword);
        await this.authenticationService.updatePasswordChangedAt(userId);
    }
    async setPassword(userId, password) {
        await this.authenticationService.setPassword(userId, password);
        await this.authenticationService.updatePasswordChangedAt(userId);
    }
    async recordLogin(userId, ipAddress, userAgent) {
        await this.authenticationService.recordLogin(userId, ipAddress, userAgent);
    }
    async getUserProfile(userId) {
        return this.profileService.getUserProfile(userId);
    }
    async updateProfile(userId, profileData) {
        return this.profileService.updateProfile(userId, profileData);
    }
    async updateEmail(userId, newEmail) {
        return this.profileService.updateEmail(userId, newEmail);
    }
    async updateUsername(userId, newUsername) {
        return this.profileService.updateUsername(userId, newUsername);
    }
    async isUsernameAvailable(username, excludeUserId) {
        return this.profileService.isUsernameAvailable(username, excludeUserId);
    }
    async isEmailAvailable(email, excludeUserId) {
        return this.profileService.isEmailAvailable(email, excludeUserId);
    }
    async getUserPreferences(userId) {
        return this.preferencesService.getUserPreferences(userId);
    }
    async updatePreferences(userId, preferences) {
        return this.preferencesService.updatePreferences(userId, preferences);
    }
    async setActiveOrganization(userId, organizationId) {
        return this.preferencesService.setActiveOrganization(userId, organizationId);
    }
    async getSocialStats(userId) {
        return this.socialService.getSocialStats(userId);
    }
    async sendFriendRequest(userId, targetUserId) {
        return this.socialService.sendFriendRequest(userId, targetUserId);
    }
    async getRelationshipStatus(userId, targetUserId) {
        return this.socialService.getRelationshipStatus(userId, targetUserId);
    }
    async getUserDashboard(userId) {
        const [user, profileActivity, preferences, socialStats, organizationContext, timeline] = await Promise.all([
            this.getUserById(userId),
            this.profileService.getProfileActivity(userId),
            this.preferencesService.getUserPreferences(userId),
            this.socialService.getSocialStats(userId),
            this.preferencesService.getActiveOrganizationContext(userId),
            this.activityService.getUserActivityTimeline(userId, DASHBOARD_TIMELINE_DAYS, DASHBOARD_TIMELINE_LIMIT),
        ]);
        if (!user) {
            throw new Error('User not found');
        }
        return {
            user,
            profileCompletion: profileActivity.profileCompletion,
            preferences,
            socialStats,
            recentActivity: timeline.timeline,
            activityStreak: timeline.summary.streak,
            organizationContext,
        };
    }
    async exportUserData(userId) {
        const [user, profileActivity, preferences, socialStats] = await Promise.all([
            this.getUserById(userId),
            this.profileService.getProfileActivity(userId),
            this.preferencesService.exportPreferences(userId),
            this.socialService.getSocialStats(userId),
        ]);
        if (!user) {
            throw new Error('User not found');
        }
        return {
            user,
            profile: {
                profileCompletion: profileActivity.profileCompletion,
                lastProfileUpdate: profileActivity.lastProfileUpdate || undefined,
                activityCount: 0,
            },
            preferences: preferences.preferences,
            socialData: socialStats,
            activities: [],
            exportedAt: new Date(),
        };
    }
    async getUserStatistics(userId) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const [profileActivity, socialStats, organizationContext] = await Promise.all([
            this.profileService.getProfileActivity(userId),
            this.socialService.getSocialStats(userId),
            this.preferencesService.getActiveOrganizationContext(userId),
        ]);
        return {
            basicInfo: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
            activityStats: {
                totalActivities: 0,
                recentActivities: 0,
                activityStreak: 0,
                profileCompletion: profileActivity.profileCompletion,
                lastProfileUpdate: profileActivity.lastProfileUpdate,
                profileViews: profileActivity.profileViews,
            },
            socialStats,
            securityInfo: {
                lastLogin: undefined,
                twoFactorEnabled: await this.authenticationService.hasTwoFactorAuth(userId),
                loginAttempts: 0,
                hasPassword: await this.authenticationService.hasPassword(userId),
                emailVerified: profileActivity.emailVerified,
            },
            organizationInfo: organizationContext,
        };
    }
    async bulkUpdateRoles(userIds, newRole, performedBy) {
        let updatedCount = 0;
        for (const userId of userIds) {
            try {
                const user = await this.getUserById(userId);
                if (user) {
                    user.role = newRole;
                    await this.userRepository.save(user);
                    updatedCount++;
                    await this.socialService.logSocialActivity({
                        userId: performedBy,
                        targetUserId: userId,
                        activityType: UserSocialService_1.SocialActivityType.PROFILE_VIEW,
                        description: `Role changed to ${newRole}`,
                        isPublic: false,
                        metadata: { oldRole: user.role, newRole, performedBy },
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to update role for user ${userId}:`, error);
            }
        }
        return updatedCount;
    }
    async getUsersByRole(role, pagination) {
        return this.searchService.getUsersByRole(role, undefined, pagination);
    }
    getAuthenticationService() {
        return this.authenticationService;
    }
    getProfileService() {
        return this.profileService;
    }
    getPreferencesService() {
        return this.preferencesService;
    }
    getSearchService() {
        return this.searchService;
    }
    getSocialService() {
        return this.socialService;
    }
    getActivityService() {
        return this.activityService;
    }
    async getUserActivityTimeline(userId, days = 30, limit = 50) {
        return this.activityService.getUserActivityTimeline(userId, days, limit);
    }
    async getUserActivityHeatmap(userId, months = 12) {
        return this.activityService.getActivityHeatmap(userId, months);
    }
    validateUserData(userData) {
        const errors = [];
        if (userData.username) {
            if (userData.username.length < 3) {
                errors.push('Username must be at least 3 characters long');
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(userData.username)) {
                errors.push('Username can only contain letters, numbers, underscores, and hyphens');
            }
        }
        if (userData.email) {
            const atIndex = userData.email.indexOf('@');
            const dotIndex = userData.email.lastIndexOf('.');
            const hasSpace = /\s/.test(userData.email);
            if (atIndex < 1 ||
                dotIndex <= atIndex + 1 ||
                dotIndex >= userData.email.length - 1 ||
                hasSpace) {
                errors.push('Invalid email format');
            }
        }
        if (userData.role && !['user', 'admin', 'moderator'].includes(userData.role)) {
            errors.push('Invalid role specified');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    async userExists(userId) {
        const user = await this.getUserById(userId);
        return user !== null;
    }
    async getUserCount(filters) {
        if (filters) {
            const result = await this.searchService.searchUsers(undefined, filters, {
                page: 1,
                limit: 1,
            });
            return result.pagination.total;
        }
        return this.userRepository.count();
    }
}
exports.UserService = UserService;
//# sourceMappingURL=UserService.js.map