"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferencesService = exports.PROFILE_PRIVACY_DEFAULTS = void 0;
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const roleUtils_1 = require("../../utils/roleUtils");
const DomainEventBus_1 = require("../shared/DomainEventBus");
exports.PROFILE_PRIVACY_DEFAULTS = {
    profileVisibility: 'public',
    showEmail: false,
    showDiscord: false,
    showBio: true,
    showRsiInfo: true,
    showVerifiedBadge: true,
    showOrganizations: true,
    showPublicShips: true,
    showScStats: false,
    showActivity: true,
};
class UserPreferencesService {
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    async persistActiveOrganizationClear(user, options) {
        const previousOrgId = user.activeOrgId ?? null;
        user.activeOrgId = undefined;
        user.activeOrgChangedAt = new Date();
        const saved = await this.userRepository.save(user);
        if (previousOrgId) {
            DomainEventBus_1.domainEvents.emit('member:primary_org_cleared', {
                timestamp: new Date().toISOString(),
                userId: user.id,
                previousOrgId,
                reason: options.reason,
                ...(options.staleOrganizationId
                    ? { staleOrganizationId: options.staleOrganizationId }
                    : {}),
                ...(options.path ? { path: options.path } : {}),
            });
        }
        return saved;
    }
    async getUserPreferences(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['preferences'],
        });
        return (user?.preferences || this.getDefaultPreferences());
    }
    async updatePreferences(userId, preferences) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        const currentPreferences = user.preferences || this.getDefaultPreferences();
        const updatedPreferences = { ...currentPreferences, ...preferences };
        user.preferences = updatedPreferences;
        await this.userRepository.save(user);
        return updatedPreferences;
    }
    async resetPreferences(userId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        const defaultPreferences = this.getDefaultPreferences();
        user.preferences = defaultPreferences;
        await this.userRepository.save(user);
        return defaultPreferences;
    }
    async getPreference(userId, key) {
        const preferences = await this.getUserPreferences(userId);
        return preferences[key];
    }
    async setPreference(userId, key, value) {
        return this.updatePreferences(userId, { [key]: value });
    }
    async getNotificationPreferences(userId) {
        const preferences = await this.getUserPreferences(userId);
        return {
            emailNotifications: preferences.emailNotifications ?? true,
            pushNotifications: preferences.pushNotifications ?? true,
            weeklyDigest: preferences.weeklyDigest ?? true,
            marketingEmails: preferences.marketingEmails ?? false,
            organizationDeletionNotifications: preferences.organizationDeletionNotifications ?? true,
        };
    }
    async updateNotificationPreferences(userId, notificationSettings) {
        return this.updatePreferences(userId, notificationSettings);
    }
    async getAppearancePreferences(userId) {
        const preferences = await this.getUserPreferences(userId);
        return {
            theme: preferences.theme || 'auto',
            language: preferences.language || 'en',
            timezone: preferences.timezone || 'UTC',
            compactMode: preferences.compactMode ?? false,
        };
    }
    async updateAppearancePreferences(userId, appearanceSettings) {
        return this.updatePreferences(userId, appearanceSettings);
    }
    async getPrivacyPreferences(userId) {
        const preferences = await this.getUserPreferences(userId);
        return {
            defaultVisibility: preferences.defaultVisibility || 'public',
            showOnlineStatus: preferences.showOnlineStatus ?? true,
            allowDirectMessages: preferences.allowDirectMessages ?? true,
        };
    }
    async updatePrivacyPreferences(userId, privacySettings) {
        return this.updatePreferences(userId, privacySettings);
    }
    async getProfilePrivacy(userId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const stored = user?.preferences?.privacy ?? {};
        return { ...exports.PROFILE_PRIVACY_DEFAULTS, ...stored };
    }
    async updateProfilePrivacy(userId, patch) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        const currentPrivacy = user.preferences?.privacy ?? {};
        const updatedPrivacy = { ...currentPrivacy, ...patch };
        user.preferences = user.preferences
            ? { ...user.preferences, privacy: updatedPrivacy }
            : { privacy: updatedPrivacy };
        await this.userRepository.save(user);
        const persisted = await this.userRepository.findOne({ where: { id: userId } });
        const persistedPrivacy = persisted?.preferences?.privacy ?? updatedPrivacy;
        return { ...exports.PROFILE_PRIVACY_DEFAULTS, ...persistedPrivacy };
    }
    async getActiveOrganizationContext(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['activeOrgId', 'username'],
        });
        if (!user?.activeOrgId) {
            return null;
        }
        const membership = await this.userOrgRepository.findOne({
            where: { userId, organizationId: user.activeOrgId, isActive: true },
        });
        if (!membership) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.AUTHZ_FAILURE,
                userId,
                username: user.username,
                resource: `organization/${user.activeOrgId}`,
                action: 'GET_ACTIVE_ORGANIZATION_CONTEXT',
                message: `User ${user.username} attempted to access context for organization ${user.activeOrgId} without being a member`,
                metadata: {
                    userId,
                    organizationId: user.activeOrgId,
                    attemptedAction: 'getActiveOrganizationContext',
                },
            });
            return null;
        }
        return {
            activeOrgId: user.activeOrgId,
            roleInOrg: (0, roleUtils_1.getRoleName)(membership.role) || 'member',
            joinedAt: membership.joinedAt,
            permissions: membership.permissions || [],
            isOwner: (0, roleUtils_1.getRoleName)(membership.role) === 'owner' || (0, roleUtils_1.getRoleName)(membership.role) === 'founder',
            isAdmin: (0, roleUtils_1.getRoleName)(membership.role) === 'admin' ||
                (0, roleUtils_1.getRoleName)(membership.role) === 'owner' ||
                (0, roleUtils_1.getRoleName)(membership.role) === 'founder',
        };
    }
    async setActiveOrganization(userId, organizationId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        if (user.activeOrgId && user.activeOrgId !== organizationId) {
            const currentMembership = await this.userOrgRepository.findOne({
                where: { userId, organizationId: user.activeOrgId, isActive: true },
            });
            if (currentMembership) {
                const currentRole = (0, roleUtils_1.getRoleName)(currentMembership.role);
                if (currentRole === 'founder' || currentRole === 'owner') {
                    throw new apiErrors_1.ForbiddenError('Organization founders and owners cannot switch their primary organization');
                }
            }
        }
        const membership = await this.userOrgRepository.findOne({
            where: { userId, organizationId, isActive: true },
        });
        if (!membership) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.AUTHZ_FAILURE,
                userId,
                username: user.username,
                resource: `organization/${organizationId}`,
                action: 'SET_ACTIVE_ORGANIZATION',
                message: `User ${user.username} attempted to set active organization ${organizationId} without being a member`,
                metadata: {
                    userId,
                    organizationId,
                    attemptedAction: 'setActiveOrganization',
                },
            });
            throw new apiErrors_1.ForbiddenError('You are not a member of this organization');
        }
        const previousOrgId = user.activeOrgId ?? null;
        user.activeOrgId = organizationId;
        user.activeOrgChangedAt = new Date();
        const saved = await this.userRepository.save(user);
        if (previousOrgId !== organizationId) {
            DomainEventBus_1.domainEvents.emit('member:primary_org_switched', {
                timestamp: new Date().toISOString(),
                userId,
                previousOrgId,
                newOrgId: organizationId,
            });
        }
        return saved;
    }
    async clearActiveOrganization(userId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        return this.persistActiveOrganizationClear(user, { reason: 'manual_clear' });
    }
    async clearStaleActiveOrganization(user, context) {
        return this.persistActiveOrganizationClear(user, {
            reason: 'system_stale_membership',
            ...(context?.staleOrganizationId ? { staleOrganizationId: context.staleOrganizationId } : {}),
            ...(context?.path ? { path: context.path } : {}),
        });
    }
    async getOrganizationSwitchHistory(userId, _limit = 10) {
        return [];
    }
    async getCustomSetting(userId, key) {
        const preferences = await this.getUserPreferences(userId);
        return preferences.customSettings?.[key];
    }
    async setCustomSetting(userId, key, value) {
        const preferences = await this.getUserPreferences(userId);
        const customSettings = preferences.customSettings || {};
        customSettings[key] = value;
        return this.updatePreferences(userId, { customSettings });
    }
    async deleteCustomSetting(userId, key) {
        const preferences = await this.getUserPreferences(userId);
        const customSettings = preferences.customSettings || {};
        delete customSettings[key];
        return this.updatePreferences(userId, { customSettings });
    }
    async getAllCustomSettings(userId) {
        const preferences = await this.getUserPreferences(userId);
        return preferences.customSettings || {};
    }
    async getActivityPreferences(userId) {
        const preferences = await this.getUserPreferences(userId);
        return {
            autoJoinVoice: preferences.autoJoinVoice ?? false,
            defaultVisibility: preferences.defaultVisibility || 'public',
        };
    }
    async updateActivityPreferences(userId, activitySettings) {
        return this.updatePreferences(userId, activitySettings);
    }
    getDefaultPreferences() {
        return {
            theme: 'auto',
            language: 'en',
            timezone: 'UTC',
            emailNotifications: true,
            pushNotifications: true,
            weeklyDigest: true,
            marketingEmails: false,
            autoJoinVoice: false,
            defaultVisibility: 'public',
            compactMode: false,
            showOnlineStatus: true,
            allowDirectMessages: true,
            organizationDeletionNotifications: true,
            customSettings: {},
        };
    }
    validatePreferences(preferences) {
        const errors = [];
        if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
            errors.push('Invalid theme value');
        }
        if (preferences.defaultVisibility &&
            !['public', 'private', 'friends'].includes(preferences.defaultVisibility)) {
            errors.push('Invalid default visibility value');
        }
        if (preferences.language && typeof preferences.language !== 'string') {
            errors.push('Language must be a string');
        }
        if (preferences.timezone && typeof preferences.timezone !== 'string') {
            errors.push('Timezone must be a string');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    async exportPreferences(userId) {
        const preferences = await this.getUserPreferences(userId);
        return {
            userId,
            preferences,
            exportedAt: new Date(),
        };
    }
    async importPreferences(userId, preferences) {
        const validation = this.validatePreferences(preferences);
        if (!validation.valid) {
            throw new Error(`Invalid preferences: ${validation.errors.join(', ')}`);
        }
        return this.updatePreferences(userId, preferences);
    }
}
exports.UserPreferencesService = UserPreferencesService;
//# sourceMappingURL=UserPreferencesService.js.map