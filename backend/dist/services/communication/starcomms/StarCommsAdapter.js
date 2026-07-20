"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsAdapter = void 0;
const axios_1 = require("axios");
const apiErrors_1 = require("../../../utils/apiErrors");
const logger_1 = require("../../../utils/logger");
const StarCommsClientFactory_1 = require("./StarCommsClientFactory");
const BULK_ASSIGN_PAGE_SIZE = 200;
class StarCommsAdapter {
    clientFactory;
    constructor(clientFactory = new StarCommsClientFactory_1.StarCommsClientFactory()) {
        this.clientFactory = clientFactory;
    }
    buildConnectionConfig(integration) {
        const baseUrl = integration.starCommsConfig?.baseUrl || integration.apiConfig?.baseUrl;
        if (!baseUrl) {
            throw new apiErrors_1.ValidationError('StarComms integration requires a baseUrl');
        }
        const apiKey = integration.authConfig?.type === 'bearer' ? integration.authConfig.token : undefined;
        return {
            baseUrl,
            apiKey,
            shardId: integration.starCommsConfig?.shardId,
            netMappings: integration.starCommsConfig?.netMappings,
            timeoutMs: integration.starCommsConfig?.metricsWindowMinutes
                ? Math.max(5000, integration.starCommsConfig.metricsWindowMinutes * 100)
                : 5000,
        };
    }
    async getShardStatus(config) {
        const client = await this.clientFactory.createClient(config);
        const payload = await client.getStatus();
        return {
            service: 'starcomms',
            status: this.normalizeStatus(payload.status),
            shardId: this.readString(payload.shardId) || config.shardId,
            connectedUsers: this.readNumber(payload.connectedUsers),
            channels: this.readNumber(payload.channels),
            operationOpen: typeof payload.operationOpen === 'boolean' ? payload.operationOpen : undefined,
            updatedAt: this.readString(payload.updatedAt) || new Date().toISOString(),
            raw: payload,
        };
    }
    async getMetricsWindow(config, window) {
        const client = await this.clientFactory.createClient(config);
        const payload = await client.getMetrics(window);
        return {
            attendanceRate: this.readNumber(payload.attendanceRate),
            activeParticipants: this.readNumber(payload.activeParticipants),
            avgSessionMinutes: this.readNumber(payload.avgSessionMinutes),
            window: {
                startDate: window.startDate,
                endDate: window.endDate,
                windowMinutes: window.windowMinutes,
            },
            raw: payload,
        };
    }
    async ensureOperationFromActivity(config, payload) {
        const client = await this.clientFactory.createClient(config);
        logger_1.logger.info('StarComms: opening operation from activity', {
            activityId: this.readString(payload.activityId),
            shardId: config.shardId,
        });
        try {
            const result = await client.openOperation({ open: true });
            return {
                success: true,
                operationId: this.readString(result.operationId) || this.readString(payload.activityId),
                message: this.readString(result.message) || 'Operation opened',
            };
        }
        catch (err) {
            if ((0, axios_1.isAxiosError)(err) && err.response?.status === 409) {
                logger_1.logger.info('StarComms: operation already open', {
                    activityId: this.readString(payload.activityId),
                });
                return {
                    success: true,
                    operationId: this.readString(payload.activityId),
                    message: 'Operation already open',
                };
            }
            throw err;
        }
    }
    async syncAssignments(config, payload) {
        const netMappings = config.netMappings ?? {};
        const rawAssignments = Array.isArray(payload.assignments)
            ? payload.assignments
            : [];
        const assignmentRequests = [];
        for (const participant of rawAssignments) {
            const role = this.readString(participant.role) ?? '';
            const userId = this.readString(participant.userId);
            if (!userId) {
                continue;
            }
            const netUid = netMappings[role];
            if (!netUid) {
                logger_1.logger.warn('StarComms: no netUid mapping for role — participant skipped', {
                    role,
                    userId,
                    activityId: this.readString(payload.activityId),
                });
                continue;
            }
            assignmentRequests.push({ userId, netUid, action: 'assign' });
        }
        if (assignmentRequests.length === 0) {
            return {
                success: true,
                message: 'No eligible participants to assign (check netMappings configuration)',
            };
        }
        const client = await this.clientFactory.createClient(config);
        let processed = 0;
        let failed = 0;
        for (let i = 0; i < assignmentRequests.length; i += BULK_ASSIGN_PAGE_SIZE) {
            const page = assignmentRequests.slice(i, i + BULK_ASSIGN_PAGE_SIZE);
            try {
                const result = await client.bulkAssign({ assignments: page });
                const pageResult = result;
                processed += typeof pageResult.processed === 'number' ? pageResult.processed : page.length;
                failed += typeof pageResult.failed === 'number' ? pageResult.failed : 0;
            }
            catch (err) {
                logger_1.logger.error('StarComms: bulk assign page failed', {
                    pageStart: i,
                    pageSize: page.length,
                    error: err instanceof Error ? err.message : String(err),
                });
                failed += page.length;
            }
        }
        logger_1.logger.info('StarComms: assignment sync complete', {
            activityId: this.readString(payload.activityId),
            total: assignmentRequests.length,
            processed,
            failed,
        });
        return {
            success: failed === 0,
            message: failed > 0
                ? `Assignment sync partial: ${processed} processed, ${failed} failed`
                : `Assignment sync complete: ${processed} assigned`,
        };
    }
    normalizeStatus(value) {
        const normalized = this.readString(value)?.toLowerCase();
        if (normalized === 'healthy' || normalized === 'degraded' || normalized === 'offline') {
            return normalized;
        }
        return 'unknown';
    }
    readString(value) {
        return typeof value === 'string' ? value : undefined;
    }
    readNumber(value) {
        return typeof value === 'number' ? value : undefined;
    }
}
exports.StarCommsAdapter = StarCommsAdapter;
//# sourceMappingURL=StarCommsAdapter.js.map