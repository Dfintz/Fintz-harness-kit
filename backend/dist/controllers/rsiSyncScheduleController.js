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
exports.RsiSyncScheduleController = void 0;
const rsiSyncScheduler_1 = require("../jobs/rsiSyncScheduler");
const RsiUserLink_1 = require("../models/RsiUserLink");
const rsi_1 = require("../services/rsi");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class RsiSyncScheduleController extends BaseController_1.BaseController {
    getSchedule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const status = await rsi_1.rsiSyncScheduleService.getScheduleStatus(orgId);
            return {
                schedule: status.exists
                    ? {
                        enabled: status.enabled,
                        interval: status.interval,
                        rsiOrgSid: status.rsiOrgSid,
                        lastSync: status.lastSync,
                        nextSync: status.nextSync,
                        failures: status.failures,
                        autoDisabled: status.autoDisabled,
                    }
                    : null,
            };
        });
    };
    upsertSchedule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const body = req.body;
            const input = {
                organizationId: orgId,
                rsiOrgSid: body.rsiOrgSid,
                guildId: body.guildId,
                isEnabled: body.isEnabled,
                intervalMinutes: body.intervalMinutes,
                notifyOnChanges: body.notifyOnChanges,
                notifyOnErrors: body.notifyOnErrors,
                notificationChannelId: body.notificationChannelId,
                removeRolesOnLeave: body.removeRolesOnLeave,
                affiliateHandling: body.affiliateHandling,
                affiliateRoleId: body.affiliateRoleId,
            };
            const schedule = await rsi_1.rsiSyncScheduleService.upsertSchedule(input);
            return {
                message: 'Schedule saved successfully',
                schedule: {
                    id: schedule.id,
                    enabled: schedule.isEnabled,
                    interval: schedule.getIntervalDisplay(),
                    rsiOrgSid: schedule.rsiOrgSid,
                    lastSync: schedule.lastSyncAt ?? null,
                    nextSync: schedule.nextSyncAt ?? null,
                    failures: schedule.consecutiveFailures,
                    autoDisabled: schedule.isAutoDisabled(),
                },
            };
        });
    };
    enableSchedule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const schedule = await rsi_1.rsiSyncScheduleService.enableSchedule(orgId);
            if (!schedule) {
                throw new apiErrors_1.NotFoundError('Schedule not found');
            }
            return {
                message: 'Schedule enabled successfully',
                schedule: {
                    enabled: schedule.isEnabled,
                    nextSync: schedule.nextSyncAt,
                },
            };
        });
    };
    disableSchedule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const schedule = await rsi_1.rsiSyncScheduleService.disableSchedule(orgId);
            if (!schedule) {
                throw new apiErrors_1.NotFoundError('Schedule not found');
            }
            return {
                message: 'Schedule disabled successfully',
                schedule: { enabled: schedule.isEnabled },
            };
        });
    };
    deleteSchedule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const deleted = await rsi_1.rsiSyncScheduleService.deleteSchedule(orgId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Schedule not found');
            }
            return { message: 'Schedule deleted successfully' };
        });
    };
    getAuditLogs = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 200);
            const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
            const syncType = req.query.syncType;
            let hasErrors;
            if (req.query.hasErrors !== undefined) {
                hasErrors = (0, queryUtils_1.parseBooleanQuery)(req.query.hasErrors);
            }
            const { logs, total } = await rsi_1.rsiSyncAuditService.getLogs({
                organizationId: orgId,
                syncType,
                hasErrors,
                limit,
                offset,
            });
            const stats = await rsi_1.rsiSyncAuditService.getStatistics(orgId);
            return {
                logs: logs.map(log => ({
                    id: log.id,
                    syncType: log.syncType,
                    changesDetected: log.changesDetected,
                    changesApplied: log.changesApplied,
                    errors: log.errors,
                    syncedAt: log.syncedAt,
                    summary: log.getSummary(),
                    durationSeconds: log.getDurationSeconds(),
                })),
                total,
                stats: {
                    totalSyncs: stats.totalSyncs,
                    successfulSyncs: stats.successfulSyncs,
                    failedSyncs: stats.failedSyncs,
                    totalChangesApplied: stats.totalChangesApplied,
                },
            };
        });
    };
    getAuditStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : undefined;
            const stats = await rsi_1.rsiSyncAuditService.getStatistics(orgId, fromDate);
            return { stats };
        });
    };
    getAuditLogById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, logId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const log = await rsi_1.rsiSyncAuditService.getLogById(logId);
            if (!log || log.organizationId !== orgId) {
                throw new apiErrors_1.NotFoundError('Audit log not found');
            }
            return {
                log: {
                    id: log.id,
                    syncType: log.syncType,
                    changesDetected: log.changesDetected,
                    changesApplied: log.changesApplied,
                    errors: log.errors,
                    syncedAt: log.syncedAt,
                    summary: log.getSummary(),
                    durationSeconds: log.getDurationSeconds(),
                    details: log.details,
                },
            };
        });
    };
    triggerManualSync = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const triggeredBy = this.getAuthUser(req).id;
            await (0, rsiSyncScheduler_1.triggerManualSync)(orgId, triggeredBy);
            return {
                message: 'Manual sync triggered successfully',
                note: 'Check the audit log for sync results',
            };
        });
    };
    listMembers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const includeRemoved = (0, queryUtils_1.parseBooleanQuery)(req.query.includeRemoved);
            const links = await rsi_1.rsiUserLinkService.getLinksByOrganization(orgId, includeRemoved);
            const stats = await rsi_1.rsiUserLinkService.getOrgSyncStats(orgId);
            return {
                members: links.map(link => ({
                    id: link.id,
                    userId: link.userId,
                    rsiHandle: link.rsiHandle,
                    verificationMethod: link.verificationMethod,
                    verified: link.isVerified(),
                    verifiedAt: link.verifiedAt,
                    syncStatus: link.syncStatus,
                    lastSyncedAt: link.lastSyncedAt,
                    lastKnownRank: link.lastKnownRank,
                    isAffiliate: link.isAffiliate,
                    discordUserId: link.discordUserId,
                    createdAt: link.createdAt,
                })),
                total: links.length,
                stats,
            };
        });
    };
    manualAssign = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const { userId, rsiHandle, discordUserId, rank } = req.body;
            const adminId = this.getAuthUser(req).id;
            if (!userId || !rsiHandle) {
                throw new apiErrors_1.ValidationError('userId and rsiHandle are required');
            }
            const existing = await rsi_1.rsiUserLinkService.getLinkByUserAndOrg(userId, orgId);
            if (existing) {
                throw new apiErrors_1.ConflictError(`User already has a link for this organization (handle: ${existing.rsiHandle})`);
            }
            const link = await rsi_1.rsiUserLinkService.createLink({
                userId,
                organizationId: orgId,
                rsiHandle,
                verificationMethod: RsiUserLink_1.VerificationMethod.MANUAL,
                discordUserId,
            });
            await rsi_1.rsiUserLinkService.manuallyVerify(link.id);
            if (rank) {
                await rsi_1.rsiUserLinkService.updateLink(link.id, {
                    lastKnownRank: rank,
                    metadata: {
                        manuallyAssignedBy: adminId,
                        manuallyAssignedAt: new Date().toISOString(),
                        manualRank: rank,
                    },
                });
            }
            logger_1.logger.info(`Admin ${adminId} manually assigned ${rsiHandle} to user ${userId} in org ${orgId}`);
            return {
                message: 'Member manually assigned and verified',
                link: {
                    id: link.id,
                    userId: link.userId,
                    rsiHandle: link.rsiHandle,
                    verified: true,
                    verificationMethod: RsiUserLink_1.VerificationMethod.MANUAL,
                    discordUserId: link.discordUserId,
                },
            };
        }, 201);
    };
    manualVerify = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, linkId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const adminId = this.getAuthUser(req).id;
            const link = await rsi_1.rsiUserLinkService.manuallyVerify(linkId);
            if (!link) {
                throw new apiErrors_1.NotFoundError('Link not found');
            }
            if (link.discordUserId) {
                const { VerifiedRoleSyncService } = await Promise.resolve().then(() => __importStar(require('../services/discord/VerifiedRoleSyncService')));
                VerifiedRoleSyncService.getInstance()
                    .assignVerifiedRole(link.discordUserId, [orgId])
                    .catch(err => logger_1.logger.warn('Failed to assign verified role after manual verify', err));
            }
            logger_1.logger.info(`Admin ${adminId} manually verified link ${linkId}`);
            return { message: 'Link verified successfully' };
        });
    };
    removeMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, linkId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const adminId = this.getAuthUser(req).id;
            const deleted = await rsi_1.rsiUserLinkService.deleteLink(linkId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Link not found');
            }
            logger_1.logger.info(`Admin ${adminId} removed member link ${linkId}`);
            return { message: 'Member link removed successfully' };
        });
    };
    bulkVerify = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const { linkIds } = req.body;
            const adminId = this.getAuthUser(req).id;
            if (!Array.isArray(linkIds) || linkIds.length === 0) {
                throw new apiErrors_1.ValidationError('linkIds array is required and must not be empty');
            }
            if (linkIds.length > 100) {
                throw new apiErrors_1.ValidationError('Maximum 100 links per bulk operation');
            }
            const result = await rsi_1.rsiUserLinkService.bulkManuallyVerify(linkIds);
            logger_1.logger.info(`Admin ${adminId} bulk verified ${result.verified} links`);
            return {
                message: `Bulk verification complete: ${result.verified} verified, ${result.failed} failed`,
                ...result,
            };
        });
    };
    bulkAssign = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const { entries } = req.body;
            const adminId = this.getAuthUser(req).id;
            if (!Array.isArray(entries) || entries.length === 0) {
                throw new apiErrors_1.ValidationError('entries array is required and must not be empty');
            }
            if (entries.length > 100) {
                throw new apiErrors_1.ValidationError('Maximum 100 entries per bulk operation');
            }
            for (const entry of entries) {
                if (!entry.userId || !entry.rsiHandle) {
                    throw new apiErrors_1.ValidationError('Each entry must have userId and rsiHandle');
                }
            }
            const result = await rsi_1.rsiUserLinkService.bulkCreateAndVerify(orgId, entries);
            logger_1.logger.info(`Admin ${adminId} bulk assigned ${result.created} members in org ${orgId}`);
            return {
                message: `Bulk assign complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
                ...result,
            };
        }, 201);
    };
    getReviewQueue = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100);
            const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
            const { items, total } = await rsi_1.rsiSyncReviewService.getReviewQueue(orgId, {
                limit,
                offset,
            });
            return { items, total };
        });
    };
    resolveReviewItem = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const { linkId, resolution, adminNotes, updatedRank } = req.body;
            const adminId = this.getAuthUser(req).id;
            if (!linkId || !resolution) {
                throw new apiErrors_1.ValidationError('linkId and resolution are required');
            }
            const validResolutions = Object.values(rsi_1.ReviewResolution);
            if (!validResolutions.includes(resolution)) {
                throw new apiErrors_1.ValidationError(`resolution must be one of: ${validResolutions.join(', ')}`);
            }
            const result = await rsi_1.rsiSyncReviewService.resolveReviewItem({ linkId, resolution: resolution, adminNotes, updatedRank }, adminId);
            if (!result) {
                throw new apiErrors_1.NotFoundError('Link not found');
            }
            return {
                message: `Review item resolved as ${resolution}`,
                link: {
                    id: result.id,
                    syncStatus: result.syncStatus,
                    rsiHandle: result.rsiHandle,
                },
            };
        });
    };
    getReviewStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const stats = await rsi_1.rsiSyncReviewService.getReviewStats(orgId);
            return { stats };
        });
    };
    flagForReview = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            this.verifyOrgAccess(req, orgId);
            const { linkId, reason } = req.body;
            if (!linkId || !reason) {
                throw new apiErrors_1.ValidationError('linkId and reason are required');
            }
            const result = await rsi_1.rsiSyncReviewService.flagForReview(linkId, reason);
            if (!result) {
                throw new apiErrors_1.NotFoundError('Link not found');
            }
            return {
                message: 'Link flagged for review',
                link: {
                    id: result.id,
                    syncStatus: result.syncStatus,
                    rsiHandle: result.rsiHandle,
                },
            };
        });
    };
    verifyOrgAccess(req, orgId) {
        if (req.orgMembership?.organizationId !== orgId) {
            logger_1.logger.warn('Unauthorized org access attempt', {
                userId: req.user?.id,
                requestedOrgId: orgId,
            });
            throw new apiErrors_1.ForbiddenError('You are not authorized to access this organization');
        }
    }
}
exports.RsiSyncScheduleController = RsiSyncScheduleController;
//# sourceMappingURL=rsiSyncScheduleController.js.map