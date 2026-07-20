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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsiVerificationService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const rsiVerificationDbConflict_1 = require("../../utils/rsiVerificationDbConflict");
const rsiVerificationToken_1 = require("../../utils/rsiVerificationToken");
const RSIApiService_1 = require("../external/RSIApiService");
const RsiCrawlerService_1 = require("../external/RsiCrawlerService");
const RsiUserLinkService_1 = require("../external/RsiUserLinkService");
const RsiNotificationService_1 = require("./RsiNotificationService");
const RsiVerificationAnalytics_1 = require("./RsiVerificationAnalytics");
const NULL_STRING = null;
const NULL_DATE = null;
class RsiVerificationService {
    userRepository;
    organizationRepository;
    membershipRepository;
    rsiApiService;
    notificationService;
    VERIFICATION_CODE_VALIDITY_HOURS = 24;
    static MIN_ADMIN_STARS = 4;
    static OWNER_RANKS = ['founder', 'ceo', 'owner'];
    static ADMIN_RANKS = ['director', 'admin', 'board member', 'executive officer'];
    VERIFICATION_CODE_PREFIX = 'SCFM-';
    constructor(userRepository, organizationRepository, rsiApiService, notificationService) {
        this.userRepository = userRepository ?? data_source_1.AppDataSource.getRepository(User_1.User);
        this.organizationRepository =
            organizationRepository ?? data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.rsiApiService = rsiApiService ?? new RSIApiService_1.RsiApiService();
        this.notificationService = notificationService ?? new RsiNotificationService_1.RsiNotificationService();
    }
    generateVerificationCode() {
        const randomPart = node_crypto_1.default.randomBytes(12).toString('hex').toUpperCase();
        return `${this.VERIFICATION_CODE_PREFIX}${randomPart}`;
    }
    hashVerificationCode(code) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET environment variable is required for HMAC operations');
        }
        return node_crypto_1.default.createHmac('sha256', secret).update(code).digest('hex');
    }
    verifyCodeHash(candidate, storedHash) {
        const candidateHash = this.hashVerificationCode(candidate);
        try {
            return node_crypto_1.default.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));
        }
        catch {
            return false;
        }
    }
    async initiateVerification(userId, rsiHandle) {
        try {
            const normalizedHandle = rsiHandle.trim();
            if (!normalizedHandle) {
                return {
                    success: false,
                    error: 'RSI handle is required',
                };
            }
            let handleExists = false;
            let handleError;
            let isExternalError = false;
            try {
                const citizenData = await RsiCrawlerService_1.rsiCrawlerService.crawlCitizen(normalizedHandle);
                handleExists = citizenData !== null;
                if (!handleExists) {
                    handleError = 'RSI handle not found on robertsspaceindustries.com';
                }
            }
            catch {
                try {
                    const verifyResult = await this.rsiApiService.verifyHandle(normalizedHandle);
                    handleExists = verifyResult.verified;
                    if (!handleExists) {
                        handleError = verifyResult.error ?? 'RSI handle not found';
                    }
                }
                catch {
                    handleError = 'Unable to reach RSI to verify your handle. Please try again later.';
                    isExternalError = true;
                }
            }
            if (!handleExists) {
                return {
                    success: false,
                    error: handleError ?? 'RSI handle not found',
                    isExternalError,
                };
            }
            const existingUser = await this.userRepository.findOne({
                where: {
                    rsiHandle: normalizedHandle,
                    rsiVerified: true,
                },
            });
            if (existingUser && existingUser.id !== userId) {
                return {
                    success: false,
                    error: 'This RSI handle is already verified by another account',
                };
            }
            const verificationCode = this.generateVerificationCode();
            const verificationCodeHash = this.hashVerificationCode(verificationCode);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.VERIFICATION_CODE_VALIDITY_HOURS);
            await this.userRepository.update(userId, {
                rsiHandle: normalizedHandle,
                rsiVerified: false,
                rsiVerificationCode: verificationCodeHash,
                rsiVerificationCodeExpiresAt: expiresAt,
            });
            logger_1.logger.info(`RSI verification initiated for user ${userId} with handle ${normalizedHandle}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordInitiation(userId);
            return {
                success: true,
                verificationCode,
                verificationUrl: (0, rsiVerificationToken_1.buildRsiVerificationUrl)(verificationCode),
                expiresAt,
                rsiHandle: normalizedHandle,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to initiate RSI verification for user ${userId}: ${errorMessage}`);
            return {
                success: false,
                error: 'An unexpected error occurred during RSI verification. Please try again later.',
                isExternalError: true,
            };
        }
    }
    async setPublicProfileVerified(orgId, isVerified) {
        try {
            const { PublicOrgDirectoryService } = await Promise.resolve().then(() => __importStar(require('../organization/PublicOrgDirectoryService')));
            const directoryService = new PublicOrgDirectoryService();
            await directoryService.setVerificationStatus(orgId, isVerified);
        }
        catch (err) {
            logger_1.logger.warn(`Failed to update public profile isVerified for org ${orgId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
    sendFailureNotification(userId, errorMessage) {
        this.userRepository
            .findOne({ where: { id: userId } })
            .then(user => {
            if (user?.rsiHandle) {
                this.notificationService
                    .sendVerificationFailed({
                    userEmail: user.email,
                    username: user.username,
                    rsiHandle: user.rsiHandle,
                    reason: errorMessage,
                })
                    .catch(() => {
                });
            }
        })
            .catch(() => {
        });
    }
    getCompletionContext(user) {
        if (!user) {
            return {
                error: {
                    success: false,
                    verified: false,
                    error: 'User not found',
                },
            };
        }
        if (!user.rsiHandle || !user.rsiVerificationCode) {
            return {
                error: {
                    success: false,
                    verified: false,
                    error: 'No pending RSI verification found. Please initiate verification first.',
                },
            };
        }
        if (user.rsiVerificationCodeExpiresAt && user.rsiVerificationCodeExpiresAt < new Date()) {
            return {
                error: {
                    success: false,
                    verified: false,
                    error: 'Verification code has expired. Please initiate a new verification.',
                },
            };
        }
        return {
            user: user,
            verificationHash: user.rsiVerificationCode,
        };
    }
    async fetchVerificationProfileData(rsiHandle) {
        try {
            const citizenData = await RsiCrawlerService_1.rsiCrawlerService.crawlCitizen(rsiHandle);
            return {
                bio: citizenData?.bio,
                displayName: citizenData?.displayName,
                citizenRecord: citizenData?.citizenRecord,
            };
        }
        catch {
            const userData = await this.rsiApiService.fetchUserData(rsiHandle);
            return {
                bio: userData?.bio,
                displayName: userData?.displayName ?? userData?.moniker,
            };
        }
    }
    getCitizenRecordToPersist(crawledCitizenRecord, currentCitizenRecord) {
        if (typeof crawledCitizenRecord === 'string' && crawledCitizenRecord.length > 0) {
            return crawledCitizenRecord;
        }
        if (typeof currentCitizenRecord === 'string' && currentCitizenRecord.length > 0) {
            return currentCitizenRecord;
        }
        return NULL_STRING;
    }
    async isCitizenRecordAlreadyVerifiedByAnotherUser(citizenRecord, userId) {
        if (!citizenRecord) {
            return false;
        }
        const existingByRecord = await this.userRepository.findOne({
            where: { rsiCitizenRecord: citizenRecord, rsiVerified: true },
        });
        return Boolean(existingByRecord && existingByRecord.id !== userId);
    }
    toOptionalString(value) {
        return typeof value === 'string' && value.length > 0 ? value : undefined;
    }
    async completeVerification(userId) {
        try {
            const userRecord = await this.userRepository.findOne({
                where: { id: userId },
            });
            const completionContext = this.getCompletionContext(userRecord);
            if ('error' in completionContext) {
                return completionContext.error;
            }
            const { user, verificationHash: storedVerificationHash } = completionContext;
            const { bio, displayName, citizenRecord } = await this.fetchVerificationProfileData(user.rsiHandle);
            if (!bio) {
                return {
                    success: false,
                    verified: false,
                    error: 'No bio found on your RSI profile. Please add the verification link to your RSI profile bio and try again.',
                };
            }
            const codeFound = (0, rsiVerificationToken_1.someRsiVerificationTokenMatches)(bio, token => this.verifyCodeHash(token, storedVerificationHash));
            if (!codeFound) {
                RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordCompletion(userId, false, 'Verification code not found in bio');
                return {
                    success: false,
                    verified: false,
                    error: 'Verification link not found in your RSI bio. Please add the link to your RSI profile bio and try again.',
                };
            }
            if (await this.isCitizenRecordAlreadyVerifiedByAnotherUser(citizenRecord, userId)) {
                return {
                    success: false,
                    verified: false,
                    error: 'This RSI account is already verified by another user.',
                };
            }
            const citizenRecordToPersist = this.getCitizenRecordToPersist(citizenRecord, user.rsiCitizenRecord);
            try {
                await this.userRepository.update(userId, {
                    rsiVerified: true,
                    rsiVerifiedAt: new Date(),
                    rsiCitizenRecord: citizenRecordToPersist,
                    rsiVerificationCode: NULL_STRING,
                    rsiVerificationCodeExpiresAt: NULL_DATE,
                });
            }
            catch (error) {
                if ((0, rsiVerificationDbConflict_1.isVerifiedCitizenRecordConflict)(error)) {
                    return {
                        success: false,
                        verified: false,
                        error: 'This RSI account is already verified by another user.',
                    };
                }
                throw error;
            }
            logger_1.logger.info(`RSI verification completed for user ${userId} with handle ${user.rsiHandle}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordCompletion(userId, true);
            this.syncVerificationToUserLinks(userId, user.rsiHandle, user.discordId).catch(err => {
                logger_1.logger.warn('Failed to cross-sync RSI verification to RsiUserLink table', {
                    userId,
                    error: err instanceof Error ? err.message : String(err),
                });
            });
            this.syncVerifiedDiscordRole(user.discordId, userId, user.rsiHandle).catch(() => {
            });
            this.notificationService
                .sendVerificationSuccess({
                userEmail: user.email,
                username: user.username,
                rsiHandle: user.rsiHandle,
                displayName: displayName ?? user.rsiHandle,
            })
                .catch(() => {
            });
            return {
                success: true,
                verified: true,
                rsiHandle: user.rsiHandle,
                displayName: displayName ?? user.rsiHandle,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to complete RSI verification for user ${userId}: ${errorMessage}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordCompletion(userId, false, errorMessage);
            this.sendFailureNotification(userId, errorMessage);
            return {
                success: false,
                verified: false,
                error: errorMessage,
            };
        }
    }
    async autoDetectUserVerifications(limit = 50) {
        const now = new Date();
        const pendingUsers = await this.userRepository
            .createQueryBuilder('user')
            .where('user.rsiVerified = :verified', { verified: false })
            .andWhere('user.rsiVerificationCode IS NOT NULL')
            .andWhere('user.rsiVerificationCodeExpiresAt IS NOT NULL')
            .andWhere('user.rsiVerificationCodeExpiresAt > :now', { now })
            .orderBy('user.rsiVerificationCodeExpiresAt', 'ASC')
            .take(limit)
            .getMany();
        let verified = 0;
        for (const user of pendingUsers) {
            try {
                const result = await this.completeVerification(user.id);
                if (result.verified) {
                    verified += 1;
                    logger_1.logger.info(`Auto-detected RSI verification for user ${user.id}`);
                }
            }
            catch (error) {
                logger_1.logger.warn(`Auto-detect failed for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return { checked: pendingUsers.length, verified };
    }
    async autoDetectOrganizationVerifications(limit = 50) {
        const now = new Date();
        const pendingOrgs = await this.organizationRepository
            .createQueryBuilder('org')
            .where('org.rsiVerified = :verified', { verified: false })
            .andWhere('org.rsiVerificationCode IS NOT NULL')
            .andWhere('org.rsiVerificationCodeExpiresAt IS NOT NULL')
            .andWhere('org.rsiVerificationCodeExpiresAt > :now', { now })
            .orderBy('org.rsiVerificationCodeExpiresAt', 'ASC')
            .take(limit)
            .getMany();
        let verified = 0;
        for (const org of pendingOrgs) {
            if (!org.ownerId) {
                continue;
            }
            try {
                const result = await this.completeOrganizationVerification(org.ownerId, org.id);
                if (result.verified) {
                    verified += 1;
                    logger_1.logger.info(`Auto-detected RSI verification for org ${org.id}`);
                }
            }
            catch (error) {
                logger_1.logger.warn(`Auto-detect failed for org ${org.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return { checked: pendingOrgs.length, verified };
    }
    async getVerificationStatus(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            return {
                verified: false,
                pendingVerification: false,
            };
        }
        const pendingVerification = !!(user.rsiVerificationCode &&
            user.rsiVerificationCodeExpiresAt &&
            user.rsiVerificationCodeExpiresAt > new Date());
        return {
            rsiHandle: user.rsiHandle,
            rsiCitizenRecord: this.toOptionalString(user.rsiCitizenRecord),
            verified: user.rsiVerified,
            verifiedAt: user.rsiVerifiedAt,
            pendingVerification,
            verificationCodeExpiresAt: pendingVerification
                ? user.rsiVerificationCodeExpiresAt
                : undefined,
        };
    }
    async removeVerification(userId) {
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId },
                select: ['id', 'discordId'],
            });
            await this.userRepository.update(userId, {
                rsiHandle: NULL_STRING,
                rsiCitizenRecord: NULL_STRING,
                rsiVerified: false,
                rsiVerifiedAt: NULL_DATE,
                rsiVerificationCode: NULL_STRING,
                rsiVerificationCodeExpiresAt: NULL_DATE,
            });
            logger_1.logger.info(`RSI verification removed for user ${userId}`);
            this.clearUserLinksOnRemoval(userId).catch(() => {
            });
            if (user?.discordId) {
                this.removeVerifiedDiscordRole(user.discordId, userId).catch(() => {
                });
            }
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to remove RSI verification for user ${userId}: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    async resolveRsiOrgSid(normalizedSid) {
        try {
            const crawledOrg = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(normalizedSid);
            return { sid: crawledOrg.sid };
        }
        catch (crawlerError) {
            logger_1.logger.debug(`Crawler unavailable for org ${normalizedSid}, using Sentry API fallback`, {
                error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
            });
        }
        try {
            const orgData = await this.rsiApiService.fetchOrganizationData(normalizedSid);
            return { sid: orgData?.sid };
        }
        catch (apiError) {
            logger_1.logger.warn(`Both crawler and API failed for org ${normalizedSid}`, {
                error: apiError instanceof Error ? apiError.message : String(apiError),
            });
            return {
                error: 'Unable to verify RSI organization at this time. RSI services may be temporarily unavailable — please try again later.',
            };
        }
    }
    async verifyRsiOrgMembership(rsiHandle, normalizedSid) {
        try {
            const memberships = await RsiCrawlerService_1.rsiCrawlerService.crawlUserMemberships(rsiHandle);
            const membership = memberships.find(m => m.sid.toUpperCase() === normalizedSid);
            if (membership) {
                const rankLower = (membership.rank ?? '').toLowerCase();
                const isOwner = RsiVerificationService.OWNER_RANKS.some(r => rankLower.includes(r));
                const isAdmin = isOwner ||
                    RsiVerificationService.ADMIN_RANKS.some(r => rankLower.includes(r)) ||
                    membership.stars >= RsiVerificationService.MIN_ADMIN_STARS;
                logger_1.logger.debug(`RSI membership check for ${rsiHandle} in ${normalizedSid}: rank="${membership.rank}", stars=${membership.stars}, isOwner=${isOwner}, isAdmin=${isAdmin}`);
                return { verified: true, isAdmin };
            }
            return { verified: false, isAdmin: false };
        }
        catch (crawlerError) {
            logger_1.logger.debug(`Crawler unavailable for memberships of ${rsiHandle}, using Sentry API fallback`, {
                error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
            });
        }
        try {
            const result = await this.rsiApiService.verifyOrganizationMembership(rsiHandle, normalizedSid);
            return { verified: result.verified, isAdmin: result.isAdmin };
        }
        catch (apiError) {
            logger_1.logger.warn(`Both crawler and API failed for membership check of ${rsiHandle} in ${normalizedSid}`, {
                error: apiError instanceof Error ? apiError.message : String(apiError),
            });
            return {
                verified: false,
                isAdmin: false,
                error: 'Unable to verify your RSI organization membership at this time. RSI services may be temporarily unavailable — please try again later.',
            };
        }
    }
    async fetchRsiOrgContent(rsiSid, skipCache = false) {
        try {
            if (skipCache) {
                RsiCrawlerService_1.rsiCrawlerService.invalidateOrgCache(rsiSid);
            }
            const crawled = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(rsiSid);
            return {
                description: crawled.description,
                history: crawled.history,
                manifesto: crawled.manifesto,
                charter: crawled.charter,
                name: crawled.name,
            };
        }
        catch (crawlerError) {
            logger_1.logger.debug(`Crawler unavailable for org ${rsiSid}, using Sentry API fallback`, {
                error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
            });
            const orgData = await this.rsiApiService.fetchOrganizationData(rsiSid);
            return { description: orgData?.description, name: orgData?.name };
        }
    }
    getRsiMembershipError(check, rsiHandle, sid) {
        if (!check.verified) {
            return `Your RSI handle "${rsiHandle}" was not found as a member of RSI organization "${sid}". Make sure you are a member of this organization on robertsspaceindustries.com.`;
        }
        if (!check.isAdmin) {
            return 'You must be an admin or owner of the RSI organization to verify it. Your detected RSI rank does not have sufficient privileges (4+ stars required). If you believe this is incorrect, ensure your RSI profile and organization membership are publicly visible.';
        }
        return null;
    }
    async checkWebAppOrgPermission(userId, orgId, organization) {
        const isOwner = organization.ownerId === userId;
        if (isOwner) {
            return null;
        }
        const membership = await this.membershipRepository.findOne({
            where: { userId, organizationId: orgId, isActive: true },
        });
        const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
        const isAdmin = roleName === 'admin' || roleName === 'owner' || roleName === 'founder';
        if (!isAdmin) {
            return 'Only organization owners and admins can verify RSI organizations';
        }
        return null;
    }
    async initiateOrganizationVerification(userId, orgId, rsiOrgSid) {
        try {
            const normalizedSid = rsiOrgSid.trim().toUpperCase();
            if (!normalizedSid) {
                return {
                    success: false,
                    error: 'RSI organization SID is required',
                };
            }
            const organization = await this.organizationRepository.findOne({
                where: { id: orgId },
            });
            if (!organization) {
                return {
                    success: false,
                    error: 'Organization not found',
                };
            }
            const permissionError = await this.checkWebAppOrgPermission(userId, orgId, organization);
            if (permissionError) {
                return { success: false, error: permissionError };
            }
            const orgLookup = await this.resolveRsiOrgSid(normalizedSid);
            if (orgLookup.error) {
                return { success: false, error: orgLookup.error };
            }
            const orgSid = orgLookup.sid;
            if (!orgSid) {
                return {
                    success: false,
                    error: 'RSI organization not found',
                };
            }
            const existingOrg = await this.organizationRepository.findOne({
                where: {
                    rsiSid: normalizedSid,
                    rsiVerified: true,
                },
            });
            if (existingOrg && existingOrg.id !== orgId) {
                return {
                    success: false,
                    error: 'This RSI organization is already verified by another organization',
                };
            }
            const user = await this.userRepository.findOne({
                where: { id: userId },
            });
            if (!user?.rsiHandle) {
                return {
                    success: false,
                    error: 'You must set an RSI handle before verifying an organization',
                };
            }
            const memberCheck = await this.verifyRsiOrgMembership(user.rsiHandle, normalizedSid);
            if (memberCheck.error) {
                return { success: false, error: memberCheck.error };
            }
            const rsiMemberError = this.getRsiMembershipError(memberCheck, user.rsiHandle, normalizedSid);
            if (rsiMemberError) {
                return { success: false, error: rsiMemberError };
            }
            const verificationCode = this.generateVerificationCode();
            const verificationCodeHash = this.hashVerificationCode(verificationCode);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.VERIFICATION_CODE_VALIDITY_HOURS);
            await this.organizationRepository.update(orgId, {
                rsiSid: normalizedSid,
                rsiVerified: false,
                rsiVerificationCode: verificationCodeHash,
                rsiVerificationCodeExpiresAt: expiresAt,
            });
            logger_1.logger.info(`RSI organization verification initiated for org ${orgId} with SID ${normalizedSid}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordOrgInitiation(orgId);
            return {
                success: true,
                verificationCode,
                verificationUrl: (0, rsiVerificationToken_1.buildRsiVerificationUrl)(verificationCode),
                expiresAt,
                rsiHandle: normalizedSid,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to initiate RSI org verification for org ${orgId}: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    async completeOrganizationVerification(userId, orgId) {
        try {
            const organization = await this.organizationRepository.findOne({
                where: { id: orgId },
            });
            if (!organization) {
                return {
                    success: false,
                    verified: false,
                    error: 'Organization not found',
                };
            }
            const isOwner = organization.ownerId === userId;
            let isAdmin = false;
            if (!isOwner) {
                const membership = await this.membershipRepository.findOne({
                    where: { userId, organizationId: orgId, isActive: true },
                });
                const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
                isAdmin = roleName === 'admin' || roleName === 'owner' || roleName === 'founder';
            }
            if (!isOwner && !isAdmin) {
                return {
                    success: false,
                    verified: false,
                    error: 'Only organization owners and admins can complete verification',
                };
            }
            if (!organization.rsiSid || !organization.rsiVerificationCode) {
                return {
                    success: false,
                    verified: false,
                    error: 'No pending RSI organization verification found. Please initiate verification first.',
                };
            }
            if (organization.rsiVerificationCodeExpiresAt &&
                organization.rsiVerificationCodeExpiresAt < new Date()) {
                return {
                    success: false,
                    verified: false,
                    error: 'Verification code has expired. Please initiate a new verification.',
                };
            }
            const orgContent = await this.fetchRsiOrgContent(organization.rsiSid, true);
            const { description: orgDescription, history: orgHistory, manifesto: orgManifesto, charter: orgCharter, name: orgDisplayName, } = orgContent;
            const searchableSections = [orgDescription, orgHistory, orgManifesto, orgCharter].filter(Boolean);
            if (searchableSections.length === 0) {
                return {
                    success: false,
                    verified: false,
                    error: 'No content found on your RSI organization page. Please add the verification code to the Introduction, History, Manifesto, or Charter and try again.',
                };
            }
            const combinedText = searchableSections.join(' ');
            const storedHash = organization.rsiVerificationCode;
            const codeFound = (0, rsiVerificationToken_1.someRsiVerificationTokenMatches)(combinedText, token => this.verifyCodeHash(token, storedHash));
            if (!codeFound) {
                return {
                    success: false,
                    verified: false,
                    error: 'Verification code not found on your RSI organization page. Please add the code to the Introduction, History, Manifesto, or Charter and try again.',
                };
            }
            await this.organizationRepository.update(orgId, {
                rsiVerified: true,
                rsiVerifiedAt: new Date(),
                rsiVerificationCode: NULL_STRING,
                rsiVerificationCodeExpiresAt: NULL_DATE,
            });
            await this.setPublicProfileVerified(orgId, true);
            logger_1.logger.info(`RSI organization verification completed for org ${orgId} with SID ${organization.rsiSid}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordOrgCompletion(orgId, true);
            return {
                success: true,
                verified: true,
                rsiHandle: organization.rsiSid,
                displayName: orgDisplayName,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to complete RSI org verification for org ${orgId}: ${errorMessage}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordOrgCompletion(orgId, false, errorMessage);
            return {
                success: false,
                verified: false,
                error: errorMessage,
            };
        }
    }
    async verifyOrganizationByRank(userId, orgId, rsiOrgSid) {
        try {
            const normalizedSid = rsiOrgSid.trim().toUpperCase();
            if (!normalizedSid) {
                return { success: false, verified: false, error: 'RSI organization SID is required' };
            }
            const organization = await this.organizationRepository.findOne({
                where: { id: orgId },
            });
            if (!organization) {
                return { success: false, verified: false, error: 'Organization not found' };
            }
            const permissionError = await this.checkWebAppOrgPermission(userId, orgId, organization);
            if (permissionError) {
                return { success: false, verified: false, error: permissionError };
            }
            const orgLookup = await this.resolveRsiOrgSid(normalizedSid);
            if (orgLookup.error) {
                return { success: false, verified: false, error: orgLookup.error };
            }
            if (!orgLookup.sid) {
                return { success: false, verified: false, error: 'RSI organization not found' };
            }
            const existingOrg = await this.organizationRepository.findOne({
                where: { rsiSid: normalizedSid, rsiVerified: true },
            });
            if (existingOrg && existingOrg.id !== orgId) {
                return {
                    success: false,
                    verified: false,
                    error: 'This RSI organization is already verified by another organization',
                };
            }
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user?.rsiHandle) {
                return {
                    success: false,
                    verified: false,
                    error: 'You must set an RSI handle before verifying an organization',
                };
            }
            const memberCheck = await this.verifyRsiOrgMembership(user.rsiHandle, normalizedSid);
            if (memberCheck.error) {
                return { success: false, verified: false, error: memberCheck.error };
            }
            if (!memberCheck.verified) {
                return {
                    success: false,
                    verified: false,
                    error: `Your RSI handle "${user.rsiHandle}" was not found as a member of RSI organization "${normalizedSid}". Make sure you are a member of this organization on robertsspaceindustries.com.`,
                };
            }
            if (!memberCheck.isAdmin) {
                return {
                    success: false,
                    verified: false,
                    error: 'Rank-based verification requires Founder, Officer, or 5-star rank on the RSI organization. Your current rank does not meet this requirement. You can use the verification code method instead.',
                };
            }
            let orgDisplayName;
            try {
                const orgContent = await this.fetchRsiOrgContent(normalizedSid);
                orgDisplayName = orgContent.name;
            }
            catch {
            }
            await this.organizationRepository.update(orgId, {
                rsiSid: normalizedSid,
                rsiVerified: true,
                rsiVerifiedAt: new Date(),
                rsiVerificationCode: NULL_STRING,
                rsiVerificationCodeExpiresAt: NULL_DATE,
            });
            await this.setPublicProfileVerified(orgId, true);
            logger_1.logger.info(`RSI organization verification by rank completed for org ${orgId} with SID ${normalizedSid}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordOrgCompletion(orgId, true);
            return {
                success: true,
                verified: true,
                rsiHandle: normalizedSid,
                displayName: orgDisplayName,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to verify RSI org by rank for org ${orgId}: ${errorMessage}`);
            RsiVerificationAnalytics_1.rsiVerificationAnalytics.recordOrgCompletion(orgId, false, errorMessage);
            return { success: false, verified: false, error: errorMessage };
        }
    }
    async verifyOrganizationOwnership(userId, orgSid) {
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId },
            });
            if (!user) {
                return {
                    success: false,
                    isOwner: false,
                    isAdmin: false,
                    error: 'User not found',
                };
            }
            if (!user.rsiHandle) {
                return {
                    success: false,
                    isOwner: false,
                    isAdmin: false,
                    error: 'RSI handle not set. Please add your RSI handle to your profile.',
                };
            }
            let isOwner = false;
            let isAdmin = false;
            let orgName;
            let userRank;
            try {
                const memberships = await RsiCrawlerService_1.rsiCrawlerService.crawlUserMemberships(user.rsiHandle);
                const membership = memberships.find(m => m.sid.toUpperCase() === orgSid.toUpperCase());
                if (!membership) {
                    return {
                        success: false,
                        isOwner: false,
                        isAdmin: false,
                        error: `User ${user.rsiHandle} is not a member of RSI organization ${orgSid}`,
                    };
                }
                orgName = membership.name;
                userRank = membership.rank;
                const rankLower = (membership.rank ?? '').toLowerCase();
                isOwner = RsiVerificationService.OWNER_RANKS.some(r => rankLower.includes(r));
                isAdmin =
                    isOwner ||
                        RsiVerificationService.ADMIN_RANKS.some(r => rankLower.includes(r)) ||
                        membership.stars >= RsiVerificationService.MIN_ADMIN_STARS;
            }
            catch {
                const membershipResult = await this.rsiApiService.verifyOrganizationMembership(user.rsiHandle, orgSid);
                if (!membershipResult.verified) {
                    return {
                        success: false,
                        isOwner: false,
                        isAdmin: false,
                        error: membershipResult.error,
                    };
                }
                isOwner = membershipResult.isOwner;
                isAdmin = membershipResult.isAdmin;
                orgName = membershipResult.name;
                userRank = membershipResult.rank;
            }
            let rsiOrgData;
            try {
                const orgData = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(orgSid);
                rsiOrgData = {
                    description: orgData.description,
                    logo: orgData.logo,
                    banner: orgData.banner,
                    archetype: orgData.archetype,
                    commitment: orgData.commitment,
                    memberCount: orgData.memberCount,
                    focus: orgData.focus,
                    recruiting: orgData.recruiting,
                    language: orgData.language,
                    links: orgData.links,
                };
                if (orgData.name) {
                    orgName = orgData.name;
                }
            }
            catch {
                logger_1.logger.warn(`Failed to fetch RSI org data for ${orgSid}, verification continues without auto-population`);
            }
            return {
                success: true,
                isOwner,
                isAdmin,
                orgSid,
                orgName,
                userRank,
                rsiOrgData,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to verify organization ownership for user ${userId}/${orgSid}: ${errorMessage}`);
            return {
                success: false,
                isOwner: false,
                isAdmin: false,
                error: errorMessage,
            };
        }
    }
    async lookupRsiUser(handle) {
        try {
            const citizenData = await RsiCrawlerService_1.rsiCrawlerService.crawlCitizen(handle);
            if (citizenData) {
                return {
                    verified: true,
                    handle: citizenData.handle,
                    displayName: citizenData.displayName,
                    bio: citizenData.bio,
                };
            }
            return { verified: false, error: 'RSI handle not found' };
        }
        catch (crawlerError) {
            logger_1.logger.debug(`Crawler unavailable for citizen ${handle}, using Sentry API fallback`, {
                error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
            });
            return this.rsiApiService.verifyHandle(handle);
        }
    }
    async lookupRsiOrganization(sid) {
        try {
            const crawled = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(sid);
            return {
                found: true,
                data: {
                    sid: crawled.sid,
                    name: crawled.name,
                    description: crawled.description,
                    logo: crawled.logo,
                    banner: crawled.banner,
                    memberCount: crawled.memberCount,
                    focus: crawled.focus,
                    archetype: crawled.archetype,
                    commitment: crawled.commitment,
                    recruiting: crawled.recruiting,
                    language: crawled.language,
                    links: crawled.links,
                },
            };
        }
        catch {
            try {
                const orgData = await this.rsiApiService.fetchOrganizationData(sid);
                if (orgData?.sid) {
                    return { found: true, data: orgData };
                }
                return { found: false, error: 'Organization not found' };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return { found: false, error: errorMessage };
            }
        }
    }
    async requestManualVerification(userId, rsiHandle, reason) {
        try {
            const normalizedHandle = rsiHandle.trim();
            if (!normalizedHandle) {
                return {
                    success: false,
                    error: 'RSI handle is required',
                };
            }
            const requestId = `MANUAL-${Date.now()}-${node_crypto_1.default.randomBytes(6).toString('hex').toUpperCase()}`;
            await this.userRepository.update(userId, {
                rsiHandle: normalizedHandle,
                rsiVerified: false,
                rsiVerificationCode: requestId,
                rsiVerificationCodeExpiresAt: NULL_DATE,
                manualVerificationRequested: true,
                manualVerificationReason: reason ?? 'RSI API unavailable',
            });
            logger_1.logger.info(`Manual RSI verification requested for user ${userId} with handle ${normalizedHandle}, requestId: ${requestId}`);
            return {
                success: true,
                requestId,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to request manual RSI verification for user ${userId}: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    async processManualVerification(userId, adminId, approved, notes) {
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            if (!user.rsiHandle) {
                return {
                    success: false,
                    error: 'No RSI handle found for this user',
                };
            }
            if (approved) {
                await this.userRepository.update(userId, {
                    rsiVerified: true,
                    rsiVerifiedAt: new Date(),
                    rsiVerificationCode: NULL_STRING,
                    rsiVerificationCodeExpiresAt: NULL_DATE,
                    manualVerificationRequested: false,
                    manualVerificationApprovedBy: adminId,
                    manualVerificationApprovedAt: new Date(),
                    manualVerificationNotes: notes,
                });
                logger_1.logger.info(`Manual RSI verification approved for user ${userId} by admin ${adminId}`);
                if (user.discordId) {
                    this.syncVerifiedDiscordRole(user.discordId, userId, user.rsiHandle).catch(() => {
                    });
                }
            }
            else {
                await this.userRepository.update(userId, {
                    rsiVerificationCode: NULL_STRING,
                    manualVerificationRequested: false,
                    manualVerificationRejectedBy: adminId,
                    manualVerificationRejectedAt: new Date(),
                    manualVerificationNotes: notes,
                });
                logger_1.logger.info(`Manual RSI verification rejected for user ${userId} by admin ${adminId}`);
            }
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to process manual verification for user ${userId}: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    async getPendingManualVerifications() {
        try {
            const users = await this.userRepository.find({
                where: { manualVerificationRequested: true },
                select: ['id', 'rsiHandle', 'createdAt', 'manualVerificationReason'],
            });
            return {
                users: users.map(u => ({
                    id: u.id,
                    rsiHandle: u.rsiHandle ?? '',
                    requestedAt: u.createdAt,
                    reason: u.manualVerificationReason,
                })),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to get pending manual verifications: ${errorMessage}`);
            return {
                users: [],
                error: errorMessage,
            };
        }
    }
    async syncVerificationToUserLinks(userId, rsiHandle, discordId) {
        const orgIds = await this.getUserOrgIds(userId);
        if (orgIds.length === 0) {
            return;
        }
        await RsiUserLinkService_1.rsiUserLinkService.syncVerifiedUserAcrossOrganizations(userId, rsiHandle, orgIds, discordId);
    }
    async clearUserLinksOnRemoval(userId) {
        try {
            await RsiUserLinkService_1.rsiUserLinkService.removeAllLinksForUser(userId);
        }
        catch (err) {
            logger_1.logger.warn('Failed to clear RsiUserLink entries on removal', {
                userId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async syncVerifiedDiscordRole(discordId, userId, rsiHandle) {
        if (!discordId) {
            return;
        }
        const orgIds = await this.getUserOrgIds(userId);
        if (orgIds.length === 0) {
            return;
        }
        const { VerifiedRoleSyncService } = await Promise.resolve().then(() => __importStar(require('../discord/VerifiedRoleSyncService')));
        await VerifiedRoleSyncService.getInstance().assignVerifiedRole(discordId, orgIds, rsiHandle);
    }
    async removeVerifiedDiscordRole(discordId, userId) {
        if (!discordId) {
            return;
        }
        const orgIds = await this.getUserOrgIds(userId);
        if (orgIds.length === 0) {
            return;
        }
        const { VerifiedRoleSyncService } = await Promise.resolve().then(() => __importStar(require('../discord/VerifiedRoleSyncService')));
        await VerifiedRoleSyncService.getInstance().removeVerifiedRole(discordId, orgIds);
    }
    async getUserOrgIds(userId) {
        const memberships = await this.membershipRepository.find({
            where: { userId, isActive: true },
            select: ['organizationId'],
        });
        return memberships.map(m => m.organizationId);
    }
}
exports.RsiVerificationService = RsiVerificationService;
//# sourceMappingURL=RsiVerificationService.js.map