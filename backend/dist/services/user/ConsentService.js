"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const UserActivity_1 = require("../../models/UserActivity");
const UserConsent_1 = require("../../models/UserConsent");
const UserSession_1 = require("../../models/UserSession");
const UserShip_1 = require("../../models/UserShip");
const logger_1 = require("../../utils/logger");
class ConsentService {
    consentRepository = data_source_1.AppDataSource.getRepository(UserConsent_1.UserConsent);
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    userActivityRepository = data_source_1.AppDataSource.getRepository(UserActivity_1.UserActivity);
    userShipRepository = data_source_1.AppDataSource.getRepository(UserShip_1.UserShip);
    activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    userOrganizationRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    userSessionRepository = data_source_1.AppDataSource.getRepository(UserSession_1.UserSession);
    async recordConsent(userId, consentType, granted, metadata) {
        try {
            let consent = await this.consentRepository.findOne({
                where: { userId, consentType },
            });
            const effectiveVersion = metadata?.version || this.getCurrentPolicyVersion();
            if (consent) {
                consent.granted = granted;
                consent.purpose = metadata?.purpose || consent.purpose;
                consent.version = effectiveVersion;
                consent.ipAddress = metadata?.ipAddress || consent.ipAddress;
                consent.userAgent = metadata?.userAgent || consent.userAgent;
                consent.expiresAt = metadata?.expiresAt || consent.expiresAt;
            }
            else {
                consent = this.consentRepository.create({
                    userId,
                    consentType,
                    granted,
                    ...metadata,
                    version: effectiveVersion,
                });
            }
            await this.consentRepository.save(consent);
            logger_1.logger.info(`Consent ${granted ? 'granted' : 'revoked'} for user ${userId}: ${consentType}`);
            return consent;
        }
        catch (error) {
            logger_1.logger.error('Error recording consent:', error);
            throw new Error('Failed to record consent');
        }
    }
    async getUserConsents(userId) {
        try {
            return await this.consentRepository.find({
                where: { userId },
                order: { consentType: 'ASC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user consents:', error);
            throw new Error('Failed to fetch consents');
        }
    }
    async hasConsent(userId, consentType) {
        try {
            const consent = await this.consentRepository.findOne({
                where: { userId, consentType, granted: true },
            });
            if (!consent) {
                return false;
            }
            if (consent.expiresAt && consent.expiresAt < new Date()) {
                logger_1.logger.info(`Consent expired for user ${userId}: ${consentType}`);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error checking consent:', error);
            return false;
        }
    }
    async revokeAllConsents(userId) {
        try {
            await this.consentRepository.update({ userId }, { granted: false });
            logger_1.logger.info(`All consents revoked for user ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error revoking consents:', error);
            throw new Error('Failed to revoke consents');
        }
    }
    async exportUserData(userId) {
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId },
                select: [
                    'id',
                    'username',
                    'email',
                    'role',
                    'displayName',
                    'bio',
                    'avatar',
                    'rsiHandle',
                    'rsiVerified',
                    'rsiVerifiedAt',
                    'twoFactorEnabled',
                    'loginCount',
                    'lastLoginAt',
                    'createdAt',
                    'updatedAt',
                ],
            });
            if (!user) {
                throw new Error('User not found');
            }
            const consents = await this.getUserConsents(userId);
            const userShips = await this.userShipRepository.find({
                where: { userId },
            });
            const userCreatedActivities = await this.activityRepository.find({
                where: { creatorId: userId },
                select: [
                    'id',
                    'title',
                    'description',
                    'activityType',
                    'status',
                    'scheduledStartDate',
                    'scheduledEndDate',
                    'location',
                    'currentParticipants',
                    'maxParticipants',
                    'createdAt',
                    'updatedAt',
                ],
            });
            const userOrganizations = await this.userOrganizationRepository.find({
                where: { userId, isActive: true },
            });
            const userActivityLogs = await this.userActivityRepository.find({
                where: { userId },
                select: [
                    'id',
                    'action',
                    'resource',
                    'method',
                    'ipAddress',
                    'statusCode',
                    'duration',
                    'timestamp',
                ],
                order: { timestamp: 'DESC' },
                take: 1000,
            });
            const numericUserId = parseInt(userId, 10);
            const userSessions = !isNaN(numericUserId)
                ? await this.userSessionRepository.find({
                    where: { userId: numericUserId },
                    select: [
                        'id',
                        'ipAddress',
                        'userAgent',
                        'isActive',
                        'createdAt',
                        'expiresAt',
                        'lastActivity',
                    ],
                    order: { createdAt: 'DESC' },
                    take: 100,
                })
                : [];
            return {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    displayName: user.displayName,
                    bio: user.bio,
                    avatar: user.avatar,
                    rsiHandle: user.rsiHandle,
                    rsiVerified: user.rsiVerified,
                    rsiVerifiedAt: user.rsiVerifiedAt,
                    twoFactorEnabled: user.twoFactorEnabled,
                    loginCount: user.loginCount,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
                consents: consents.map(c => ({
                    type: c.consentType,
                    granted: c.granted,
                    purpose: c.purpose,
                    version: c.version,
                    grantedAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    expiresAt: c.expiresAt,
                })),
                ships: userShips.map(ship => ({
                    id: ship.id,
                    shipId: ship.shipId,
                    shipName: ship.shipName,
                    customName: ship.customName,
                    status: ship.status,
                    condition: ship.condition,
                    acquiredDate: ship.acquiredDate,
                    location: ship.location,
                    insuranceLevel: ship.insuranceLevel,
                    insuranceExpires: ship.insuranceExpires,
                    isActive: ship.isActive,
                    sharingLevel: ship.sharingLevel,
                    sharedWithUsers: ship.sharedWithUsers,
                    flightHours: ship.flightHours,
                    missionsCompleted: ship.missionsCompleted,
                    tags: ship.tags,
                    notes: ship.notes,
                    createdAt: ship.createdAt,
                    updatedAt: ship.updatedAt,
                })),
                activities: userCreatedActivities.map(activity => ({
                    id: activity.id,
                    title: activity.title,
                    description: activity.description,
                    type: activity.activityType,
                    status: activity.status,
                    scheduledStartDate: activity.scheduledStartDate,
                    scheduledEndDate: activity.scheduledEndDate,
                    location: activity.location,
                    currentParticipants: activity.currentParticipants,
                    maxParticipants: activity.maxParticipants,
                    createdAt: activity.createdAt,
                    updatedAt: activity.updatedAt,
                })),
                organizations: userOrganizations.map(org => ({
                    organizationId: org.organizationId,
                    role: org.role,
                    securityLevel: org.securityLevel,
                    permissions: org.permissions || [],
                    joinedAt: org.joinedAt,
                })),
                activityLogs: userActivityLogs.map(log => ({
                    id: log.id,
                    action: log.action,
                    resource: log.resource,
                    method: log.method,
                    ipAddress: log.ipAddress,
                    statusCode: log.statusCode,
                    duration: log.duration,
                    timestamp: log.timestamp,
                })),
                sessions: userSessions.map(session => ({
                    id: session.id,
                    ipAddress: session.ipAddress,
                    userAgent: session.userAgent,
                    isActive: session.isActive,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt,
                    lastActivity: session.lastActivity,
                })),
                exportedAt: new Date().toISOString(),
                dataExportVersion: '2.0',
            };
        }
        catch (error) {
            logger_1.logger.error('Error exporting user data:', error);
            throw new Error('Failed to export user data');
        }
    }
    async deleteUserData(userId) {
        try {
            await this.revokeAllConsents(userId);
            const result = await this.consentRepository.delete({ userId });
            const deletedCount = result.affected || 0;
            logger_1.logger.info(`User data deletion initiated for user ${userId}`);
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Error deleting user data:', error);
            throw new Error('Failed to delete user data');
        }
    }
    async getConsentStatistics() {
        try {
            const rawStats = await this.consentRepository
                .createQueryBuilder('consent')
                .select('consent.consentType', 'consentType')
                .addSelect('consent.granted', 'granted')
                .addSelect('COUNT(*)', 'count')
                .groupBy('consent.consentType')
                .addGroupBy('consent.granted')
                .getRawMany();
            const stats = new Map();
            Object.values(UserConsent_1.ConsentType).forEach(type => {
                stats.set(type, { granted: 0, revoked: 0 });
            });
            for (const row of rawStats) {
                const stat = stats.get(row.consentType);
                if (stat) {
                    if (row.granted) {
                        stat.granted = parseInt(String(row.count), 10);
                    }
                    else {
                        stat.revoked = parseInt(String(row.count), 10);
                    }
                }
            }
            return Array.from(stats.entries()).map(([type, { granted, revoked }]) => ({
                type,
                granted,
                revoked,
                total: granted + revoked,
            }));
        }
        catch (error) {
            logger_1.logger.error('Error getting consent statistics:', error);
            throw new Error('Failed to get consent statistics');
        }
    }
    getCurrentPolicyVersion() {
        return process.env.POLICY_VERSION || '2025.01.1';
    }
    async checkConsentVersion(userId, consentType) {
        try {
            const currentVersion = this.getCurrentPolicyVersion();
            const consent = await this.consentRepository.findOne({
                where: { userId, consentType, granted: true },
            });
            if (!consent) {
                return {
                    hasConsent: false,
                    isCurrentVersion: false,
                    currentVersion,
                    requiresRenewal: true,
                };
            }
            if (consent.expiresAt && consent.expiresAt < new Date()) {
                return {
                    hasConsent: false,
                    isCurrentVersion: false,
                    consentedVersion: consent.version,
                    currentVersion,
                    requiresRenewal: true,
                };
            }
            const isCurrentVersion = consent.version === currentVersion;
            return {
                hasConsent: true,
                isCurrentVersion,
                consentedVersion: consent.version,
                currentVersion,
                requiresRenewal: !isCurrentVersion,
            };
        }
        catch (error) {
            logger_1.logger.error('Error checking consent version:', error);
            throw new Error('Failed to check consent version');
        }
    }
    async getUsersRequiringConsentRenewal(consentType) {
        try {
            const currentVersion = this.getCurrentPolicyVersion();
            const consents = await this.consentRepository
                .createQueryBuilder('consent')
                .select('consent.userId')
                .where('consent.consentType = :consentType', { consentType })
                .andWhere('consent.granted = :granted', { granted: true })
                .andWhere('consent.version != :currentVersion', { currentVersion })
                .getRawMany();
            const usersRequiringRenewal = consents.map(c => c.consent_userId);
            logger_1.logger.info(`Found ${usersRequiringRenewal.length} users requiring consent renewal for ${consentType}`);
            return usersRequiringRenewal;
        }
        catch (error) {
            logger_1.logger.error('Error getting users requiring consent renewal:', error);
            throw new Error('Failed to get users requiring consent renewal');
        }
    }
    async recordConsentWithVersion(userId, consentType, granted, metadata) {
        const currentVersion = this.getCurrentPolicyVersion();
        return this.recordConsent(userId, consentType, granted, {
            ...metadata,
            version: currentVersion,
        });
    }
}
exports.ConsentService = ConsentService;
//# sourceMappingURL=ConsentService.js.map