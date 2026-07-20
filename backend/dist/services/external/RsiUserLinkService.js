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
exports.rsiUserLinkService = exports.RsiUserLinkService = exports.AffiliateHandling = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const RsiRoleMapping_1 = require("../../models/RsiRoleMapping");
const RsiUserLink_1 = require("../../models/RsiUserLink");
const TeamMember_1 = require("../../models/TeamMember");
const logger_1 = require("../../utils/logger");
const rsiVerificationDbConflict_1 = require("../../utils/rsiVerificationDbConflict");
const rsiVerificationToken_1 = require("../../utils/rsiVerificationToken");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const TeamService_1 = require("../team/TeamService");
const roleSyncBackpressure_1 = require("./roleSyncBackpressure");
const RSIApiService_1 = require("./RSIApiService");
const RsiCrawlerService_1 = require("./RsiCrawlerService");
const RsiRoleMappingService_1 = require("./RsiRoleMappingService");
const RsiRoleSyncService_1 = require("./RsiRoleSyncService");
const RsiUserLinkService_types_1 = require("./RsiUserLinkService.types");
var RsiUserLinkService_types_2 = require("./RsiUserLinkService.types");
Object.defineProperty(exports, "AffiliateHandling", { enumerable: true, get: function () { return RsiUserLinkService_types_2.AffiliateHandling; } });
class RsiUserLinkService {
    userLinkRepository;
    roleMappingRepository;
    _teamService;
    get teamService() {
        this._teamService ??= new TeamService_1.TeamService();
        return this._teamService;
    }
    constructor() {
        this.userLinkRepository = data_source_1.AppDataSource.getRepository(RsiUserLink_1.RsiUserLink);
        this.roleMappingRepository = data_source_1.AppDataSource.getRepository(RsiRoleMapping_1.RsiRoleMapping);
        logger_1.logger.info('RsiUserLinkService initialized');
    }
    async createLink(input) {
        try {
            const existing = await this.userLinkRepository.findOne({
                where: {
                    userId: input.userId,
                    organizationId: input.organizationId,
                },
            });
            if (existing) {
                throw new Error('User already has a link for this organization');
            }
            let verificationCode;
            if (input.verificationMethod === RsiUserLink_1.VerificationMethod.BIO_CODE) {
                verificationCode = RsiUserLink_1.RsiUserLink.generateVerificationCode();
            }
            const link = this.userLinkRepository.create({
                userId: input.userId,
                organizationId: input.organizationId,
                rsiHandle: input.rsiHandle,
                verificationMethod: input.verificationMethod,
                verificationCode,
                discordUserId: input.discordUserId,
                syncStatus: RsiUserLink_1.SyncStatus.PENDING,
            });
            const saved = await this.userLinkRepository.save(link);
            logger_1.logger.info(`Created user link for ${input.rsiHandle}`, {
                userId: input.userId,
                organizationId: input.organizationId,
            });
            return saved;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Failed to create user link', { error: errorMessage, input });
            throw error;
        }
    }
    async getLinkById(id) {
        return this.userLinkRepository.findOne({ where: { id } });
    }
    async getLinkByUserAndOrg(userId, organizationId) {
        return this.userLinkRepository.findOne({
            where: { userId, organizationId },
        });
    }
    async getLinksByUser(userId) {
        return this.userLinkRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }
    async getLinksByOrganization(organizationId, includeRemoved = false) {
        const queryBuilder = this.userLinkRepository
            .createQueryBuilder('link')
            .where('link.organizationId = :organizationId', { organizationId });
        if (!includeRemoved) {
            queryBuilder.andWhere('link.syncStatus != :removed', { removed: RsiUserLink_1.SyncStatus.REMOVED });
        }
        return queryBuilder.orderBy('link.createdAt', 'DESC').getMany();
    }
    async getLinkByHandleAndOrg(rsiHandle, organizationId) {
        return this.userLinkRepository.findOne({
            where: { rsiHandle, organizationId },
        });
    }
    async getLinkByDiscordAndOrg(discordUserId, organizationId) {
        return this.userLinkRepository.findOne({
            where: { discordUserId, organizationId },
        });
    }
    async updateLink(id, updates) {
        const link = await this.userLinkRepository.findOne({ where: { id } });
        if (!link) {
            return null;
        }
        if (updates.rsiHandle !== undefined) {
            const oldHandle = link.rsiHandle;
            link.rsiHandle = updates.rsiHandle;
            link.verifiedAt = undefined;
            link.syncStatus = RsiUserLink_1.SyncStatus.PENDING;
            if (oldHandle !== updates.rsiHandle) {
                DomainEventBus_1.domainEvents.emit('member:rsi_handle_changed', {
                    timestamp: new Date().toISOString(),
                    userId: link.userId,
                    organizationId: link.organizationId,
                    oldHandle,
                    newHandle: updates.rsiHandle,
                    rsiOrgSid: link.metadata?.rsiOrgSid ?? '',
                });
            }
        }
        if (updates.discordUserId !== undefined) {
            const oldDiscordId = link.discordUserId;
            if (oldDiscordId && !updates.discordUserId) {
                DomainEventBus_1.domainEvents.emit('member:discord_unlinked', {
                    timestamp: new Date().toISOString(),
                    userId: link.userId,
                    organizationId: link.organizationId,
                    discordId: oldDiscordId,
                });
            }
            link.discordUserId = updates.discordUserId;
        }
        if (updates.metadata !== undefined) {
            link.metadata = updates.metadata;
        }
        if (updates.lastKnownRank !== undefined) {
            link.lastKnownRank = updates.lastKnownRank;
        }
        return this.userLinkRepository.save(link);
    }
    async deleteLink(id) {
        const link = await this.getLinkById(id);
        const result = await this.userLinkRepository.delete(id);
        const deleted = (result.affected ?? 0) > 0;
        if (deleted && link) {
            await this.clearVerificationFromUser(link.userId);
        }
        return deleted;
    }
    async unlinkUser(userId, organizationId) {
        const result = await this.userLinkRepository.delete({
            userId,
            organizationId,
        });
        if ((result.affected ?? 0) > 0) {
            logger_1.logger.info(`Unlinked user ${userId} from organization ${organizationId}`);
            await this.clearVerificationFromUser(userId);
            return true;
        }
        return false;
    }
    async syncVerifiedUserAcrossOrganizations(userId, rsiHandle, organizationIds, discordUserId) {
        if (organizationIds.length === 0) {
            return;
        }
        for (const organizationId of organizationIds) {
            const existing = await this.userLinkRepository.findOne({
                where: { userId, organizationId },
            });
            if (existing) {
                existing.rsiHandle = rsiHandle;
                if (!existing.isVerified()) {
                    existing.markVerified();
                }
                if (discordUserId) {
                    existing.discordUserId = discordUserId;
                }
                await this.userLinkRepository.save(existing);
                continue;
            }
            const link = this.userLinkRepository.create({
                userId,
                organizationId,
                rsiHandle,
                verificationMethod: RsiUserLink_1.VerificationMethod.BIO_CODE,
                verifiedAt: new Date(),
                syncStatus: RsiUserLink_1.SyncStatus.PENDING,
                discordUserId,
            });
            await this.userLinkRepository.save(link);
        }
        logger_1.logger.debug(`Synced RSI verification to ${organizationIds.length} RsiUserLink entries`, {
            userId,
        });
    }
    async removeAllLinksForUser(userId) {
        const result = await this.userLinkRepository.delete({ userId });
        if ((result.affected ?? 0) > 0) {
            await this.clearVerificationFromUser(userId);
        }
        logger_1.logger.debug(`Cleared RsiUserLink entries for user ${userId}`, {
            userId,
            removed: result.affected ?? 0,
        });
    }
    async verifyLink(linkId, rsiOrgSid) {
        try {
            const link = await this.getLinkById(linkId);
            if (!link) {
                return { success: false, verified: false, error: 'Link not found' };
            }
            let result;
            switch (link.verificationMethod) {
                case RsiUserLink_1.VerificationMethod.MANUAL:
                    result = { success: true, verified: true };
                    break;
                case RsiUserLink_1.VerificationMethod.BIO_CODE:
                    result = await this.verifyBioCode(link, rsiOrgSid);
                    break;
                case RsiUserLink_1.VerificationMethod.DISCORD_MATCH:
                    result = await this.verifyDiscordMatch(link, rsiOrgSid);
                    break;
                default:
                    result = { success: false, verified: false, error: 'Unknown verification method' };
            }
            if (result.verified) {
                const existingConflict = await this.userLinkRepository.findOne({
                    where: {
                        rsiHandle: link.rsiHandle,
                        organizationId: link.organizationId,
                        verifiedAt: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                    },
                });
                if (existingConflict && existingConflict.userId !== link.userId) {
                    logger_1.logger.warn('Impersonation suspected: RSI handle conflict', {
                        rsiHandle: link.rsiHandle,
                        existingUserId: existingConflict.userId,
                        newUserId: link.userId,
                        organizationId: link.organizationId,
                    });
                    const { MemberAuditService } = await Promise.resolve().then(() => __importStar(require('../intel/MemberAuditService')));
                    const auditService = new MemberAuditService();
                    const flagDto = {
                        flagType: shared_types_1.MemberFlagType.IMPERSONATION_SUSPECTED,
                        severity: shared_types_1.FlagSeverity.CRITICAL,
                        description: `RSI handle \"${link.rsiHandle}\" is claimed by multiple users`,
                        metadata: {
                            rsiHandle: link.rsiHandle,
                            conflictingUserId: existingConflict.userId,
                            newUserId: link.userId,
                        },
                    };
                    try {
                        await auditService.createFlag({
                            ...flagDto,
                            userId: link.userId,
                            organizationId: link.organizationId,
                        });
                        await auditService.createFlag({
                            ...flagDto,
                            userId: existingConflict.userId,
                            organizationId: link.organizationId,
                            description: `RSI handle \"${link.rsiHandle}\" is being claimed by another user`,
                        });
                    }
                    catch (e) {
                        logger_1.logger.error('Failed to create impersonation flags', { error: e });
                    }
                    return {
                        success: false,
                        verified: false,
                        error: 'RSI handle is already verified by another user',
                    };
                }
                link.markVerified();
                if (result.rank) {
                    link.lastKnownRank = result.rank;
                }
                if (result.isAffiliate !== undefined) {
                    link.isAffiliate = result.isAffiliate;
                }
                await this.userLinkRepository.save(link);
                logger_1.logger.info(`Verified link for ${link.rsiHandle}`, {
                    linkId,
                    method: link.verificationMethod,
                });
                const syncResult = await this.syncVerificationToUser(link);
                if (!syncResult.success) {
                    logger_1.logger.warn('Link verified but user projection sync failed', {
                        linkId,
                        userId: link.userId,
                        error: syncResult.error,
                    });
                }
                DomainEventBus_1.domainEvents.emit('member:rsi_org_joined', {
                    timestamp: new Date().toISOString(),
                    userId: link.userId,
                    organizationId: link.organizationId,
                    rsiHandle: link.rsiHandle,
                    rsiOrgSid,
                    rsiOrgName: rsiOrgSid,
                    isHostile: false,
                    isRedacted: false,
                });
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Verification failed', { error: errorMessage, linkId });
            return { success: false, verified: false, error: errorMessage };
        }
    }
    async manuallyVerify(linkId) {
        const link = await this.getLinkById(linkId);
        if (!link) {
            return null;
        }
        link.markVerified();
        await this.userLinkRepository.save(link);
        logger_1.logger.info(`Manually verified link for ${link.rsiHandle}`, { linkId });
        return link;
    }
    async bulkManuallyVerify(linkIds) {
        const results = [];
        let verified = 0;
        let failed = 0;
        for (const linkId of linkIds) {
            try {
                const link = await this.getLinkById(linkId);
                if (!link) {
                    results.push({ linkId, success: false, error: 'Link not found' });
                    failed++;
                    continue;
                }
                if (link.isVerified()) {
                    results.push({
                        linkId,
                        success: true,
                        rsiHandle: link.rsiHandle,
                        error: 'Already verified',
                    });
                    verified++;
                    continue;
                }
                link.markVerified();
                await this.userLinkRepository.save(link);
                results.push({ linkId, success: true, rsiHandle: link.rsiHandle });
                verified++;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({ linkId, success: false, error: errorMessage });
                failed++;
            }
        }
        logger_1.logger.info(`Bulk verification: ${verified} verified, ${failed} failed out of ${linkIds.length}`);
        return { verified, failed, results };
    }
    async bulkCreateAndVerify(organizationId, entries) {
        const results = [];
        let created = 0;
        let skipped = 0;
        let failed = 0;
        for (const entry of entries) {
            try {
                const existing = await this.getLinkByUserAndOrg(entry.userId, organizationId);
                if (existing) {
                    results.push({
                        userId: entry.userId,
                        rsiHandle: entry.rsiHandle,
                        success: true,
                        linkId: existing.id,
                        error: 'Link already exists',
                    });
                    skipped++;
                    continue;
                }
                const link = await this.createLink({
                    userId: entry.userId,
                    organizationId,
                    rsiHandle: entry.rsiHandle,
                    verificationMethod: RsiUserLink_1.VerificationMethod.MANUAL,
                    discordUserId: entry.discordUserId,
                });
                link.markVerified();
                await this.userLinkRepository.save(link);
                DomainEventBus_1.domainEvents.emit('member:rsi_org_joined', {
                    timestamp: new Date().toISOString(),
                    userId: entry.userId,
                    organizationId,
                    rsiHandle: entry.rsiHandle,
                    rsiOrgSid: organizationId,
                    rsiOrgName: entry.rsiHandle,
                    isHostile: false,
                    isRedacted: false,
                });
                results.push({
                    userId: entry.userId,
                    rsiHandle: entry.rsiHandle,
                    success: true,
                    linkId: link.id,
                });
                created++;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    userId: entry.userId,
                    rsiHandle: entry.rsiHandle,
                    success: false,
                    error: errorMessage,
                });
                failed++;
            }
        }
        logger_1.logger.info(`Bulk create+verify: ${created} created, ${skipped} skipped, ${failed} failed`);
        return { created, skipped, failed, results };
    }
    async verifyBioCode(link, rsiOrgSid) {
        if (!link.verificationCode) {
            return { success: false, verified: false, error: 'No verification code generated' };
        }
        try {
            RsiCrawlerService_1.rsiCrawlerService.invalidateCitizenCache(link.rsiHandle);
            const profileData = await RSIApiService_1.rsiApiService.fetchUserData(link.rsiHandle);
            if (!profileData) {
                return { success: false, verified: false, error: 'Could not fetch RSI profile' };
            }
            const bio = profileData.bio || '';
            if (!(0, rsiVerificationToken_1.containsRsiVerificationToken)(bio, link.verificationCode)) {
                return {
                    success: true,
                    verified: false,
                    error: `Verification link not found in bio. Please add: ${(0, rsiVerificationToken_1.buildRsiVerificationUrl)(link.verificationCode)}`,
                };
            }
            const memberResult = await RSIApiService_1.rsiApiService.verifyOrganizationMembership(link.rsiHandle, rsiOrgSid);
            if (!memberResult.verified) {
                return {
                    success: true,
                    verified: false,
                    error: `User is not a member of organization ${rsiOrgSid}`,
                };
            }
            return {
                success: true,
                verified: true,
                rank: memberResult.rank,
                isAffiliate: memberResult.rank?.toLowerCase().includes('affiliate'),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, verified: false, error: errorMessage };
        }
    }
    async verifyBioCodeOnly(link) {
        if (!link.verificationCode) {
            return { success: false, verified: false, error: 'No verification code generated' };
        }
        try {
            RsiCrawlerService_1.rsiCrawlerService.invalidateCitizenCache(link.rsiHandle);
            const profileData = await RSIApiService_1.rsiApiService.fetchUserData(link.rsiHandle);
            if (!profileData) {
                return { success: false, verified: false, error: 'Could not fetch RSI profile' };
            }
            const bio = profileData.bio || '';
            if (!(0, rsiVerificationToken_1.containsRsiVerificationToken)(bio, link.verificationCode)) {
                return {
                    success: true,
                    verified: false,
                    error: `Verification link not found in bio. Please add: ${(0, rsiVerificationToken_1.buildRsiVerificationUrl)(link.verificationCode)}`,
                };
            }
            const citizenRecord = typeof profileData.citizenRecord === 'string' ? profileData.citizenRecord.trim() : '';
            if (citizenRecord) {
                const hasConflict = await this.hasCitizenRecordConflict(link.userId, citizenRecord);
                if (hasConflict) {
                    return {
                        success: false,
                        verified: false,
                        error: 'This RSI account is already verified by another user.',
                    };
                }
            }
            const existingConflict = await this.userLinkRepository.findOne({
                where: {
                    rsiHandle: link.rsiHandle,
                    organizationId: link.organizationId,
                    verifiedAt: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                },
            });
            if (existingConflict && existingConflict.userId !== link.userId) {
                logger_1.logger.warn('Impersonation suspected during bio-only verify', {
                    rsiHandle: link.rsiHandle,
                    existingUserId: existingConflict.userId,
                    newUserId: link.userId,
                    organizationId: link.organizationId,
                });
                return {
                    success: false,
                    verified: false,
                    error: 'RSI handle is already verified by another user',
                };
            }
            const syncResult = await this.syncVerificationToUser(link, citizenRecord || undefined, true);
            if (!syncResult.success) {
                return {
                    success: false,
                    verified: false,
                    error: syncResult.error ?? 'Failed to sync RSI verification to user profile',
                };
            }
            link.markVerified();
            await this.userLinkRepository.save(link);
            logger_1.logger.info(`Bio-verified link for ${link.rsiHandle}`, {
                linkId: link.id,
                method: link.verificationMethod,
            });
            return { success: true, verified: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, verified: false, error: errorMessage };
        }
    }
    async hasCitizenRecordConflict(userId, citizenRecord) {
        const { User: UserEntity } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
        const userRepo = data_source_1.AppDataSource.getRepository(UserEntity);
        const existing = await userRepo.findOne({
            where: { rsiCitizenRecord: citizenRecord, rsiVerified: true },
        });
        return !!(existing && existing.id !== userId);
    }
    async syncVerificationToUser(link, citizenRecord, strict = false) {
        try {
            const { User: UserEntity } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
            const userRepo = data_source_1.AppDataSource.getRepository(UserEntity);
            const updatePayload = {
                rsiHandle: link.rsiHandle,
                rsiVerified: true,
                rsiVerifiedAt: new Date(),
            };
            if (citizenRecord) {
                updatePayload.rsiCitizenRecord = citizenRecord;
            }
            const updateResult = await userRepo.update(link.userId, updatePayload);
            if ((updateResult.affected ?? 0) === 0) {
                const notFoundError = 'User profile not found for RSI verification sync';
                logger_1.logger.warn('User projection sync skipped because user was not found', {
                    userId: link.userId,
                    linkId: link.id,
                });
                return { success: false, error: notFoundError };
            }
            logger_1.logger.debug(`Synced RSI verification to User table for user ${link.userId}`);
            return { success: true };
        }
        catch (err) {
            if ((0, rsiVerificationDbConflict_1.isVerifiedCitizenRecordConflict)(err)) {
                const conflictMessage = 'This RSI account is already verified by another user.';
                logger_1.logger.warn('RSI citizen record uniqueness conflict during user sync', {
                    userId: link.userId,
                    rsiHandle: link.rsiHandle,
                });
                return { success: false, error: conflictMessage };
            }
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger_1.logger.warn('Failed to sync RSI verification to User table', {
                userId: link.userId,
                error: errorMessage,
            });
            if (strict) {
                return { success: false, error: errorMessage };
            }
            return { success: false, error: 'Failed to sync RSI verification to user profile' };
        }
    }
    async clearVerificationFromUser(userId) {
        try {
            const remainingLinks = await this.userLinkRepository.find({
                where: { userId },
            });
            const hasVerified = remainingLinks.some(l => l.isVerified());
            if (!hasVerified) {
                const { User: UserEntity } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
                const userRepo = data_source_1.AppDataSource.getRepository(UserEntity);
                await userRepo.update(userId, {
                    rsiVerified: false,
                    rsiVerifiedAt: null,
                });
                logger_1.logger.debug(`Cleared RSI verification from User table for user ${userId}`);
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to clear RSI verification from User table', {
                userId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async verifyDiscordMatch(link, rsiOrgSid) {
        if (!link.discordUserId) {
            return { success: false, verified: false, error: 'No Discord user ID linked' };
        }
        try {
            const memberResult = await RSIApiService_1.rsiApiService.verifyOrganizationMembership(link.rsiHandle, rsiOrgSid);
            if (!memberResult.verified) {
                return {
                    success: true,
                    verified: false,
                    error: `User is not a member of organization ${rsiOrgSid}`,
                };
            }
            return {
                success: true,
                verified: true,
                rank: memberResult.rank,
                isAffiliate: memberResult.rank?.toLowerCase().includes('affiliate'),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, verified: false, error: errorMessage };
        }
    }
    async regenerateVerificationCode(linkId) {
        const link = await this.getLinkById(linkId);
        if (link?.verificationMethod !== RsiUserLink_1.VerificationMethod.BIO_CODE) {
            return null;
        }
        link.verificationCode = RsiUserLink_1.RsiUserLink.generateVerificationCode();
        link.verifiedAt = undefined;
        link.syncStatus = RsiUserLink_1.SyncStatus.PENDING;
        await this.userLinkRepository.save(link);
        return link.verificationCode;
    }
    async syncUserRoles(linkId, config, discordService) {
        const link = await this.getLinkById(linkId);
        if (!link) {
            return {
                userId: '',
                rsiHandle: '',
                success: false,
                rolesAdded: [],
                rolesRemoved: [],
                error: 'Link not found',
            };
        }
        const result = {
            userId: link.userId,
            rsiHandle: link.rsiHandle,
            success: false,
            rolesAdded: [],
            rolesRemoved: [],
            previousRank: link.lastKnownRank || undefined,
        };
        try {
            if (!link.isVerified()) {
                result.error = 'Link not verified';
                return result;
            }
            if (!link.discordUserId) {
                result.error = 'No Discord user ID configured';
                return result;
            }
            const verifyResult = await RsiRoleSyncService_1.rsiRoleSyncService.verifyAndCacheMember(link.organizationId, config.rsiOrgSid, link.rsiHandle);
            if (verifyResult.status === 'api_error') {
                const { RsiCrawledMember } = await Promise.resolve().then(() => __importStar(require('../../models/RsiCrawledMember')));
                const crawledRepo = data_source_1.AppDataSource.getRepository(RsiCrawledMember);
                const crawled = await crawledRepo.findOne({
                    where: { organizationSid: config.rsiOrgSid, handle: link.rsiHandle },
                });
                if (crawled) {
                    logger_1.logger.info(`Skipping sync for ${link.rsiHandle}: API unavailable but member exists in crawled data`, { organizationId: link.organizationId });
                    result.success = true;
                    result.newRank = crawled.rank ?? link.lastKnownRank;
                    return result;
                }
                result.error = 'API unavailable and no cached data';
                return result;
            }
            if (verifyResult.status === 'departed') {
                result.rolesRemoved = await this.handleDepartedMember(link, config, discordService);
                link.markRemoved();
                await this.userLinkRepository.save(link);
                DomainEventBus_1.domainEvents.emit('member:rsi_org_left', {
                    timestamp: new Date().toISOString(),
                    userId: link.userId,
                    organizationId: link.organizationId,
                    rsiHandle: link.rsiHandle,
                    rsiOrgSid: config.rsiOrgSid,
                    rsiOrgName: config.rsiOrgSid,
                });
                result.success = true;
                result.isRemoved = true;
                return result;
            }
            const member = verifyResult.member;
            if (member.isAffiliate && config.affiliateHandling === RsiUserLinkService_types_1.AffiliateHandling.EXCLUDE) {
                link.markSynced(member.rsiRank, true);
                await this.userLinkRepository.save(link);
                result.success = true;
                result.newRank = member.rsiRank;
                return result;
            }
            const mapping = await RsiRoleMappingService_1.rsiRoleMappingService.getMappingByRank(link.organizationId, member.rsiRank);
            if (discordService && config.guildId) {
                if (member.isAffiliate &&
                    config.affiliateHandling === RsiUserLinkService_types_1.AffiliateHandling.SPECIAL_ROLE &&
                    config.affiliateRoleId) {
                    try {
                        await discordService.assignRole(config.guildId, link.discordUserId, config.affiliateRoleId);
                        result.rolesAdded.push(config.affiliateRoleId);
                    }
                    catch (err) {
                        logger_1.logger.error('Failed to assign affiliate role', { err, linkId });
                    }
                }
                if (mapping?.discordRoleId) {
                    if (link.lastKnownRank && link.lastKnownRank !== member.rsiRank) {
                        DomainEventBus_1.domainEvents.emit('member:rsi_rank_changed', {
                            timestamp: new Date().toISOString(),
                            userId: link.userId,
                            organizationId: link.organizationId,
                            rsiHandle: link.rsiHandle,
                            rsiOrgSid: config.rsiOrgSid,
                            oldRank: link.lastKnownRank,
                            newRank: member.rsiRank,
                        });
                        const oldMapping = await RsiRoleMappingService_1.rsiRoleMappingService.getMappingByRank(link.organizationId, link.lastKnownRank);
                        if (oldMapping?.discordRoleId && oldMapping.discordRoleId !== mapping.discordRoleId) {
                            try {
                                await discordService.removeRole(config.guildId, link.discordUserId, oldMapping.discordRoleId);
                                result.rolesRemoved.push(oldMapping.discordRoleId);
                            }
                            catch (err) {
                                logger_1.logger.error('Failed to remove old role', { err, linkId });
                            }
                        }
                    }
                    try {
                        await discordService.assignRole(config.guildId, link.discordUserId, mapping.discordRoleId);
                        result.rolesAdded.push(mapping.discordRoleId);
                    }
                    catch (err) {
                        logger_1.logger.error('Failed to assign role', { err, linkId });
                    }
                }
            }
            if (mapping?.hasInternalRole()) {
                try {
                    await this.syncInternalRole(link.organizationId, link.userId, mapping.internalRoleId);
                }
                catch (err) {
                    logger_1.logger.error('Failed to sync internal role', {
                        err: err instanceof Error ? err.message : String(err),
                        linkId,
                        internalRoleId: mapping.internalRoleId,
                    });
                }
            }
            if (mapping?.hasAutoAssignTeams()) {
                try {
                    await this.syncTeamAssignments(link.organizationId, link.userId, mapping.autoAssignTeamIds, member.rsiRank);
                }
                catch (err) {
                    logger_1.logger.error('Failed to sync team assignments', {
                        err: err instanceof Error ? err.message : String(err),
                        linkId,
                        teamIds: mapping.autoAssignTeamIds,
                    });
                }
            }
            link.markSynced(member.rsiRank, member.isAffiliate);
            if (link.metadata?.failedSyncCount) {
                link.metadata = { ...link.metadata, failedSyncCount: 0 };
            }
            await this.userLinkRepository.save(link);
            result.success = true;
            result.newRank = member.rsiRank;
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            link.markFailed(errorMessage);
            const prevCount = link.metadata?.failedSyncCount;
            const consecutiveFailures = (typeof prevCount === 'number' ? prevCount : 0) + 1;
            link.metadata = {
                ...link.metadata,
                failedSyncCount: consecutiveFailures,
            };
            await this.userLinkRepository.save(link);
            const isAccountGone = errorMessage.includes('404') || errorMessage.includes('not found');
            DomainEventBus_1.domainEvents.emit('member:rsi_sync_failed', {
                timestamp: new Date().toISOString(),
                userId: link.userId,
                organizationId: link.organizationId,
                rsiHandle: link.rsiHandle,
                failureReason: isAccountGone ? 'account_not_found' : errorMessage,
                consecutiveFailures,
            });
            result.error = errorMessage;
            return result;
        }
    }
    async syncInternalRole(organizationId, userId, internalRoleId) {
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membership = await membershipRepo.findOne({
            where: { organizationId, userId, isActive: true },
        });
        if (!membership) {
            logger_1.logger.warn('syncInternalRole: No active membership found', {
                organizationId,
                userId,
            });
            return;
        }
        if (membership.roleId === internalRoleId) {
            return;
        }
        const currentPriority = membership.role?.priority ?? 0;
        const { Role } = await Promise.resolve().then(() => __importStar(require('../../models/Role')));
        const targetRole = await data_source_1.AppDataSource.getRepository(Role).findOne({
            where: { id: internalRoleId },
        });
        const targetPriority = targetRole?.priority ?? 0;
        if (currentPriority > targetPriority) {
            logger_1.logger.info('syncInternalRole: Skipping — current role has higher priority', {
                organizationId,
                userId,
                currentRoleId: membership.roleId,
                currentPriority,
                targetRoleId: internalRoleId,
                targetPriority,
            });
            return;
        }
        membership.roleId = internalRoleId;
        await membershipRepo.save(membership);
        logger_1.logger.info('syncInternalRole: Updated membership role', {
            organizationId,
            userId,
            internalRoleId,
        });
    }
    async syncTeamAssignments(organizationId, userId, teamIds, rsiRank) {
        const teamService = this.teamService;
        for (const teamId of teamIds) {
            try {
                const memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
                const existing = await memberRepo.findOne({
                    where: { organizationId, teamId, userId },
                });
                if (existing && existing.status !== 'removed') {
                    if (existing.rank !== rsiRank) {
                        existing.rank = rsiRank;
                        await memberRepo.save(existing);
                    }
                    continue;
                }
                await teamService.addMember(organizationId, teamId, userId, 'member', {
                    rank: rsiRank,
                });
                logger_1.logger.info('syncTeamAssignments: Added user to team', {
                    organizationId,
                    userId,
                    teamId,
                    rsiRank,
                });
            }
            catch (err) {
                logger_1.logger.warn('syncTeamAssignments: Failed to assign team', {
                    organizationId,
                    userId,
                    teamId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }
    async handleDepartedMember(link, config, discordService) {
        const removedRoles = [];
        if (!config.removeRolesOnLeave || !discordService || !link.discordUserId) {
            return removedRoles;
        }
        try {
            const mappings = await RsiRoleMappingService_1.rsiRoleMappingService.getMappingsByOrganization(link.organizationId);
            for (const mapping of mappings) {
                if (mapping.discordRoleId) {
                    try {
                        await discordService.removeRole(config.guildId, link.discordUserId, mapping.discordRoleId);
                        removedRoles.push(mapping.discordRoleId);
                    }
                    catch (err) {
                        logger_1.logger.debug('Could not remove role (may not be assigned)', { err });
                    }
                }
            }
            if (config.affiliateRoleId) {
                try {
                    await discordService.removeRole(config.guildId, link.discordUserId, config.affiliateRoleId);
                    removedRoles.push(config.affiliateRoleId);
                }
                catch (err) {
                    logger_1.logger.debug('Could not remove affiliate role', { err });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling departed member', { error, linkId: link.id });
        }
        return removedRoles;
    }
    async runOrganizationSync(organizationId, config, discordService) {
        const startTime = Date.now();
        const result = {
            organizationId,
            totalUsers: 0,
            synced: 0,
            failed: 0,
            removed: 0,
            errors: [],
            duration: 0,
            userResults: [],
        };
        const roleSyncLimiter = discordService ? (0, roleSyncBackpressure_1.createRoleSyncRateLimiter)() : undefined;
        const pacedDiscordService = discordService && roleSyncLimiter
            ? (0, roleSyncBackpressure_1.wrapWithRoleSyncBackpressure)(discordService, roleSyncLimiter)
            : discordService;
        try {
            const links = await this.getLinksByOrganization(organizationId);
            const verifiedLinks = links.filter(l => l.isVerified());
            result.totalUsers = verifiedLinks.length;
            logger_1.logger.info(`Starting org sync for ${organizationId}`, {
                totalLinks: links.length,
                verifiedLinks: verifiedLinks.length,
            });
            let orgStillExists = true;
            let rsiOrgName;
            try {
                const orgData = await RSIApiService_1.rsiApiService.fetchOrganizationData(config.rsiOrgSid);
                if (!orgData?.sid) {
                    orgStillExists = false;
                }
                else {
                    rsiOrgName = orgData.name;
                }
            }
            catch (orgCheckError) {
                const msg = orgCheckError instanceof Error ? orgCheckError.message : '';
                if (msg.includes('404') || msg.includes('not found')) {
                    orgStillExists = false;
                }
            }
            if (!orgStillExists) {
                logger_1.logger.warn(`RSI organization ${config.rsiOrgSid} appears dissolved — flagging all members`, {
                    organizationId,
                    affectedUsers: verifiedLinks.length,
                });
                DomainEventBus_1.domainEvents.emit('member:rsi_org_dissolved', {
                    timestamp: new Date().toISOString(),
                    organizationId,
                    rsiOrgSid: config.rsiOrgSid,
                    rsiOrgName: rsiOrgName ?? config.rsiOrgSid,
                    affectedUserIds: verifiedLinks.map(l => l.userId),
                });
                for (const link of verifiedLinks) {
                    link.markNeedsReview('RSI organization dissolved');
                    await this.userLinkRepository.save(link);
                    result.failed++;
                }
                result.errors.push(`RSI organization ${config.rsiOrgSid} no longer exists`);
                result.duration = Date.now() - startTime;
                return result;
            }
            for (const link of verifiedLinks) {
                const userResult = await this.syncUserRoles(link.id, config, pacedDiscordService);
                result.userResults.push(userResult);
                if (userResult.success) {
                    if (userResult.isRemoved) {
                        result.removed++;
                    }
                    else {
                        result.synced++;
                    }
                }
                else {
                    result.failed++;
                    if (userResult.error) {
                        result.errors.push(`${link.rsiHandle}: ${userResult.error}`);
                    }
                }
            }
            result.duration = Date.now() - startTime;
            const completionContext = {
                synced: result.synced,
                failed: result.failed,
                removed: result.removed,
                duration: result.duration,
            };
            if (roleSyncLimiter) {
                const pacing = roleSyncLimiter.getStats();
                completionContext.roleOps = pacing.acquisitions;
                completionContext.backpressureEvents = pacing.backpressureEvents;
                completionContext.pacingWaitMs = pacing.totalWaitMs;
                completionContext.peakIntervalMs = pacing.peakIntervalMs;
            }
            logger_1.logger.info(`Org sync completed for ${organizationId}`, completionContext);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Sync failed: ${errorMessage}`);
            result.duration = Date.now() - startTime;
            logger_1.logger.error('Org sync failed', { error: errorMessage, organizationId });
            return result;
        }
    }
    async getUserLinkStatus(userId, organizationId) {
        const link = await this.getLinkByUserAndOrg(userId, organizationId);
        if (!link) {
            return {
                linked: false,
                verified: false,
                syncStatus: RsiUserLink_1.SyncStatus.PENDING,
                isAffiliate: false,
            };
        }
        return {
            linked: true,
            rsiHandle: link.rsiHandle,
            verified: link.isVerified(),
            syncStatus: link.syncStatus,
            lastSynced: link.lastSyncedAt || undefined,
            rank: link.lastKnownRank || undefined,
            isAffiliate: link.isAffiliate,
            verificationCode: link.verificationMethod === RsiUserLink_1.VerificationMethod.BIO_CODE ? link.verificationCode : undefined,
        };
    }
    async getOrgSyncStats(organizationId) {
        const links = await this.getLinksByOrganization(organizationId, true);
        return {
            totalLinks: links.length,
            verified: links.filter(l => l.isVerified()).length,
            pending: links.filter(l => l.syncStatus === RsiUserLink_1.SyncStatus.PENDING).length,
            synced: links.filter(l => l.syncStatus === RsiUserLink_1.SyncStatus.SYNCED).length,
            failed: links.filter(l => l.syncStatus === RsiUserLink_1.SyncStatus.FAILED).length,
            removed: links.filter(l => l.syncStatus === RsiUserLink_1.SyncStatus.REMOVED).length,
            needsReview: links.filter(l => l.syncStatus === RsiUserLink_1.SyncStatus.NEEDS_REVIEW).length,
            affiliates: links.filter(l => l.isAffiliate).length,
        };
    }
}
exports.RsiUserLinkService = RsiUserLinkService;
exports.rsiUserLinkService = new RsiUserLinkService();
//# sourceMappingURL=RsiUserLinkService.js.map