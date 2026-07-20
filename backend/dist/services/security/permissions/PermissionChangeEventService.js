"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionChangeEventService = exports.PermissionChangeEventService = void 0;
const node_crypto_1 = require("node:crypto");
const auditLogger_1 = require("../../../utils/auditLogger");
const logger_1 = require("../../../utils/logger");
const websocketServer_1 = require("../../../websocket/websocketServer");
const PermissionCacheService_1 = require("./PermissionCacheService");
const PermissionManagerService_1 = require("./PermissionManagerService");
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_ORG_FALLBACK_THRESHOLD = 400;
class PermissionChangeEventService {
    static instance;
    permissionManager = new PermissionManagerService_1.PermissionManagerService();
    permissionCacheService = PermissionCacheService_1.PermissionCacheService.getInstance();
    refreshVersionByOrg = new Map();
    batchSize;
    orgFallbackThreshold;
    constructor() {
        this.batchSize = this.resolvePositiveNumber(process.env.PERMISSION_REFRESH_BATCH_SIZE, DEFAULT_BATCH_SIZE);
        this.orgFallbackThreshold = this.resolvePositiveNumber(process.env.PERMISSION_REFRESH_ORG_FALLBACK_THRESHOLD, DEFAULT_ORG_FALLBACK_THRESHOLD);
    }
    static getInstance() {
        if (!PermissionChangeEventService.instance) {
            PermissionChangeEventService.instance = new PermissionChangeEventService();
        }
        return PermissionChangeEventService.instance;
    }
    async onRolePermissionChanged(orgId, affectedUserIds, changeType, actorUserId) {
        return this.processChange({ orgId, actorUserId, changeType, affectedUserIds });
    }
    async onUserRoleChanged(orgId, userId, changeType, actorUserId) {
        return this.processChange({ orgId, actorUserId, changeType, affectedUserIds: [userId] });
    }
    async processChange(context) {
        const startedAt = Date.now();
        const affectedUserIds = this.normalizeUserIds(context.affectedUserIds);
        const decision = this.decideEmissionMode(affectedUserIds);
        const emissionMode = decision.mode;
        let invalidatedCount = 0;
        invalidatedCount = this.invalidatePermissionCaches(context.orgId, emissionMode, affectedUserIds);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: context.actorUserId,
            resource: 'permissions',
            action: 'invalidate',
            message: `Permission invalidation processed for org ${context.orgId}`,
            metadata: {
                orgId: context.orgId,
                actorUserId: context.actorUserId,
                changeType: context.changeType,
                affectedUserCount: affectedUserIds.length,
                emissionMode,
                timestamp: new Date().toISOString(),
            },
        });
        const payload = {
            orgId: context.orgId,
            changeType: context.changeType,
            eventId: (0, node_crypto_1.randomUUID)(),
            eventTimestamp: Date.now(),
            refreshVersion: this.nextRefreshVersion(context.orgId),
            emissionMode,
        };
        const { emittedCount, failedEmitCount } = this.emitSessionRefresh(context.orgId, context.changeType, emissionMode, affectedUserIds, payload);
        logger_1.logger.info('Permission change emission telemetry', {
            orgId: context.orgId,
            changeType: context.changeType,
            affectedCount: affectedUserIds.length,
            emissionMode,
            emittedCount,
            failedEmitCount,
            durationMs: Date.now() - startedAt,
            fallbackReason: decision.fallbackReason,
        });
        return {
            invalidatedCount,
            emittedCount,
            failedEmitCount,
            emissionMode,
        };
    }
    decideEmissionMode(affectedUserIds) {
        if (affectedUserIds.length === 0) {
            return { mode: 'org_fallback', fallbackReason: 'unknown_affected_set' };
        }
        if (affectedUserIds.length > this.orgFallbackThreshold) {
            return { mode: 'org_fallback', fallbackReason: 'threshold_exceeded' };
        }
        return { mode: 'per_user' };
    }
    invalidatePermissionCaches(orgId, emissionMode, affectedUserIds) {
        if (emissionMode === 'org_fallback') {
            this.permissionManager.clearOrganizationPermissionCache(orgId);
            this.permissionCacheService.invalidateOrganization(orgId);
            return affectedUserIds.length;
        }
        let invalidatedCount = 0;
        for (const chunk of this.toChunks(affectedUserIds, this.batchSize)) {
            for (const userId of chunk) {
                this.permissionManager.invalidateUserPermissionCacheForUser(orgId, userId);
                this.permissionCacheService.invalidate(userId, orgId);
                invalidatedCount += 1;
            }
        }
        return invalidatedCount;
    }
    emitSessionRefresh(orgId, changeType, emissionMode, affectedUserIds, payload) {
        let emittedCount = 0;
        let failedEmitCount = 0;
        try {
            const io = (0, websocketServer_1.getIO)();
            if (emissionMode === 'org_fallback') {
                io.to(`org:${orgId}`).emit('session:refresh', payload);
                emittedCount = 1;
            }
            else {
                for (const chunk of this.toChunks(affectedUserIds, this.batchSize)) {
                    for (const userId of chunk) {
                        io.to(`user:${userId}`).emit('session:refresh', payload);
                        emittedCount += 1;
                    }
                }
            }
        }
        catch (error) {
            failedEmitCount = emissionMode === 'org_fallback' ? 1 : affectedUserIds.length;
            logger_1.logger.warn('Failed to emit session refresh event', {
                orgId,
                changeType,
                emissionMode,
                failedEmitCount,
                error,
            });
        }
        return { emittedCount, failedEmitCount };
    }
    normalizeUserIds(userIds) {
        return Array.from(new Set(userIds.filter((userId) => typeof userId === 'string' && userId.length > 0)));
    }
    toChunks(items, chunkSize) {
        if (items.length === 0) {
            return [];
        }
        const chunks = [];
        for (let index = 0; index < items.length; index += chunkSize) {
            chunks.push(items.slice(index, index + chunkSize));
        }
        return chunks;
    }
    nextRefreshVersion(orgId) {
        const nextVersion = (this.refreshVersionByOrg.get(orgId) ?? 0) + 1;
        this.refreshVersionByOrg.set(orgId, nextVersion);
        return nextVersion;
    }
    resolvePositiveNumber(value, fallback) {
        const parsed = Number.parseInt(value ?? '', 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }
}
exports.PermissionChangeEventService = PermissionChangeEventService;
exports.permissionChangeEventService = PermissionChangeEventService.getInstance();
//# sourceMappingURL=PermissionChangeEventService.js.map