"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationAggregatorService = void 0;
const data_source_1 = require("../../data-source");
const logger_1 = require("../../utils/logger");
const communication_1 = require("../communication");
const OrganizationMemberService_1 = require("../organization/OrganizationMemberService");
const OrganizationPermissionService_1 = require("../organization/OrganizationPermissionService");
const OrganizationService_1 = require("../organization/OrganizationService");
const OrganizationSettingsService_1 = require("../organization/OrganizationSettingsService");
const UserService_1 = require("../user/UserService");
class OrganizationAggregatorService {
    organizationService;
    memberService;
    permissionService;
    settingsService;
    userService;
    notificationService;
    constructor() {
        this.organizationService = new OrganizationService_1.OrganizationService();
        this.memberService = new OrganizationMemberService_1.OrganizationMemberService();
        this.permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
        this.settingsService = new OrganizationSettingsService_1.OrganizationSettingsService();
        this.userService = new UserService_1.UserService();
        this.notificationService = new communication_1.NotificationService(undefined, undefined);
    }
    async inviteAndOnboardMember(params) {
        return data_source_1.AppDataSource.transaction(async () => {
            try {
                const member = await this.memberService.addMember(params.organizationId, params.userId, params.role || 'member', params.title, {
                    invitedBy: params.invitedBy,
                    invitedAt: new Date(),
                    inviteMessage: params.message,
                }, undefined, { acquisitionSource: 'manual' });
                logger_1.logger.info('Member invited', {
                    organizationId: params.organizationId,
                    userId: params.userId,
                });
                const permissions = [];
                if (params.permissions && params.permissions.length > 0) {
                    for (const permSpec of params.permissions) {
                        try {
                            const perm = await this.permissionService.grantPermission(params.organizationId, params.userId, {
                                resource: permSpec.resource,
                                actions: permSpec.actions,
                                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                            }, params.invitedBy);
                            permissions.push(perm);
                        }
                        catch (error) {
                            logger_1.logger.warn('Failed to grant permission', { error });
                        }
                    }
                }
                let notification;
                if (params.sendNotification) {
                    logger_1.logger.info('Notification requested but email not configured', {
                        organizationId: params.organizationId,
                        userId: params.userId,
                    });
                }
                return { member, permissions, notification };
            }
            catch (error) {
                logger_1.logger.error('Failed to invite member', { error });
                throw error;
            }
        });
    }
    async offboardMember(organizationId, userId, offboardedBy, reason) {
        return data_source_1.AppDataSource.transaction(async () => {
            try {
                await this.permissionService.revokeAllUserPermissions(userId, organizationId);
                await this.memberService.removeMember(organizationId, userId);
                logger_1.logger.info('Member offboarded', { organizationId, userId, offboardedBy, reason });
                return { success: true, permissionsRevoked: 0 };
            }
            catch (error) {
                logger_1.logger.error('Failed to offboard member', { error });
                throw error;
            }
        });
    }
    async bulkInviteMembers(organizationId, invitations, invitedBy) {
        const successful = [];
        const failed = [];
        return data_source_1.AppDataSource.transaction(async () => {
            try {
                const memberData = invitations.map(inv => ({
                    userId: inv.userId,
                    role: inv.role || 'member',
                    acquisitionSource: 'sync',
                }));
                let members;
                try {
                    members = await this.memberService.batchAddMembers(organizationId, memberData);
                    members.forEach(member => {
                        successful.push({ userId: member.userId, member });
                    });
                    logger_1.logger.info('Batch members added', {
                        organizationId,
                        count: members.length,
                    });
                }
                catch (error) {
                    logger_1.logger.warn('Batch add failed, falling back to individual adds', { error });
                    for (const invitation of invitations) {
                        try {
                            const member = await this.memberService.addMember(organizationId, invitation.userId, invitation.role || 'member', undefined, undefined, undefined, { acquisitionSource: 'sync' });
                            successful.push({ userId: invitation.userId, member });
                        }
                        catch (err) {
                            failed.push({
                                userId: invitation.userId,
                                error: err instanceof Error ? err.message : 'Unknown error',
                            });
                        }
                    }
                    members = successful.map(s => s.member);
                }
                if (members.length > 0) {
                    const allGrants = [];
                    invitations.forEach(inv => {
                        if (inv.permissions && inv.permissions.length > 0) {
                            if (successful.find(s => s.userId === inv.userId)) {
                                inv.permissions.forEach(perm => {
                                    allGrants.push({
                                        userId: inv.userId,
                                        resource: perm.resource,
                                        actions: perm.actions,
                                    });
                                });
                            }
                        }
                    });
                    if (allGrants.length > 0) {
                        try {
                            await this.permissionService.batchGrantPermissions(organizationId, allGrants, invitedBy);
                            logger_1.logger.info('Batch permissions granted', {
                                organizationId,
                                count: allGrants.length,
                            });
                        }
                        catch (error) {
                            logger_1.logger.error('Failed to grant batch permissions', { error });
                        }
                    }
                }
                return { successful, failed };
            }
            catch (error) {
                logger_1.logger.error('Bulk invite failed', { error });
                throw error;
            }
        });
    }
    async setupNewOrganization(params) {
        return data_source_1.AppDataSource.transaction(async () => {
            try {
                const organization = await this.organizationService.createOrganization({
                    name: params.name,
                    description: params.description,
                }, params.ownerId);
                logger_1.logger.info('Organization created via aggregator', {
                    organizationId: organization.id,
                    name: params.name,
                });
                const ownerMember = await this.memberService.getMember(organization.id, params.ownerId);
                if (!ownerMember) {
                    throw new Error('Owner member not created');
                }
                const settings = await this.settingsService.updateSettings(organization.id, params.settings || {});
                return {
                    organization,
                    ownerMember,
                    settings: settings,
                    permissions: [],
                };
            }
            catch (error) {
                logger_1.logger.error('Failed to setup organization', { error });
                throw error;
            }
        });
    }
    async getOrganizationOverview(organizationId) {
        try {
            const organization = await this.organizationService.getOrganizationById(organizationId);
            if (!organization) {
                throw new Error('Organization not found');
            }
            const membersResponse = await this.memberService.getMembers(organizationId, true, { limit: 100 });
            const allMembers = membersResponse.data;
            const settings = await this.settingsService.getSettings(organizationId);
            const memberStats = {
                activeMembers: allMembers.filter(m => m.isActive).length,
                pendingInvitations: allMembers.filter(m => !m.isActive).length,
            };
            const recentMembers = [...allMembers]
                .sort((a, b) => new Date(b.joinedAt || b.createdAt).getTime() -
                new Date(a.joinedAt || a.createdAt).getTime())
                .slice(0, 10);
            return {
                organization,
                memberCount: membersResponse.pagination.total,
                memberStats,
                recentMembers,
                settings: settings,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get organization overview', { error });
            throw error;
        }
    }
}
exports.OrganizationAggregatorService = OrganizationAggregatorService;
//# sourceMappingURL=OrganizationAggregatorService.js.map