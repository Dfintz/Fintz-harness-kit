"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = exports.FeatureFlagStatus = exports.FeatureFlagScope = void 0;
const data_source_1 = require("../../data-source");
const FeatureFlag_1 = require("../../models/FeatureFlag");
Object.defineProperty(exports, "FeatureFlagScope", { enumerable: true, get: function () { return FeatureFlag_1.FeatureFlagScope; } });
Object.defineProperty(exports, "FeatureFlagStatus", { enumerable: true, get: function () { return FeatureFlag_1.FeatureFlagStatus; } });
const FeatureFlagAuditLog_1 = require("../../models/FeatureFlagAuditLog");
const logger_1 = require("../../utils/logger");
const query_1 = require("../../utils/query");
const featureFlagWebSocketController_1 = require("../../websocket/controllers/featureFlagWebSocketController");
class FeatureFlagService {
    static flagRepository;
    static auditRepository;
    static getRepositories() {
        if (!this.flagRepository) {
            this.flagRepository = data_source_1.AppDataSource.getRepository(FeatureFlag_1.FeatureFlag);
            this.auditRepository = data_source_1.AppDataSource.getRepository(FeatureFlagAuditLog_1.FeatureFlagAuditLog);
        }
        return { flagRepository: this.flagRepository, auditRepository: this.auditRepository };
    }
    static async initializeDefaultFlags() {
        const { flagRepository } = this.getRepositories();
        const defaultFlags = [
            {
                id: 'advanced-analytics',
                name: 'Advanced Analytics',
                description: 'Access to advanced analytics dashboard',
                status: FeatureFlag_1.FeatureFlagStatus.BETA,
                scope: FeatureFlag_1.FeatureFlagScope.BETA_USERS,
                createdBy: undefined,
            },
            {
                id: 'dataloader-optimization',
                name: 'DataLoader Query Optimization',
                description: 'Use DataLoader pattern for N+1 query elimination',
                status: FeatureFlag_1.FeatureFlagStatus.PERCENTAGE,
                scope: FeatureFlag_1.FeatureFlagScope.GLOBAL,
                percentage: 25,
                createdBy: undefined,
            },
            {
                id: 'enhanced-caching',
                name: 'Enhanced Service Caching',
                description: 'Extended cache TTL and advanced invalidation',
                status: FeatureFlag_1.FeatureFlagStatus.ENABLED,
                scope: FeatureFlag_1.FeatureFlagScope.GLOBAL,
                createdBy: undefined,
            },
            {
                id: 'ai-mission-planning',
                name: 'AI Mission Planning',
                description: 'AI-powered mission planning and optimization',
                status: FeatureFlag_1.FeatureFlagStatus.DISABLED,
                scope: FeatureFlag_1.FeatureFlagScope.GLOBAL,
                createdBy: undefined,
            },
            {
                id: 'real-time-collaboration',
                name: 'Real-time Collaboration',
                description: 'WebSocket-based real-time updates',
                status: FeatureFlag_1.FeatureFlagStatus.DISABLED,
                scope: FeatureFlag_1.FeatureFlagScope.GLOBAL,
                createdBy: undefined,
            },
            {
                id: 'titles-badges',
                name: 'Custom Titles & Badges',
                description: 'Per-organization custom titles and badges system (controlled via org settings)',
                status: FeatureFlag_1.FeatureFlagStatus.ENABLED,
                scope: FeatureFlag_1.FeatureFlagScope.GLOBAL,
                createdBy: undefined,
            },
        ];
        for (const flagData of defaultFlags) {
            const existing = await flagRepository.findOne({ where: { id: flagData.id } });
            if (!existing) {
                await flagRepository.save(flagData);
                logger_1.logger.info('Initialized default feature flag', { flagId: flagData.id });
            }
        }
    }
    static async logEvaluation(featureFlagId, result, userId, organizationId) {
        try {
            const { auditRepository } = this.getRepositories();
            await auditRepository.save({
                featureFlagId,
                action: FeatureFlagAuditLog_1.FeatureFlagAction.EVALUATED,
                userId,
                organizationId,
                evaluationResult: result,
                metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to log feature flag evaluation', { error, featureFlagId });
        }
    }
    static async isEnabled(featureId, userId, organizationId) {
        const { flagRepository } = this.getRepositories();
        const flag = await flagRepository.findOne({ where: { id: featureId } });
        if (!flag) {
            logger_1.logger.warn('Feature flag not found', { featureId });
            return false;
        }
        let result = false;
        switch (flag.status) {
            case FeatureFlag_1.FeatureFlagStatus.DISABLED:
                result = false;
                break;
            case FeatureFlag_1.FeatureFlagStatus.ENABLED:
                result = true;
                break;
            case FeatureFlag_1.FeatureFlagStatus.BETA:
                result = this.checkBetaAccess(flag, userId, organizationId);
                break;
            case FeatureFlag_1.FeatureFlagStatus.PERCENTAGE:
                result = this.checkPercentageRollout(flag, userId, organizationId);
                break;
            default:
                result = false;
        }
        this.logEvaluation(featureId, result, userId, organizationId).catch(() => { });
        return result;
    }
    static checkBetaAccess(flag, userId, organizationId) {
        if (flag.scope === FeatureFlag_1.FeatureFlagScope.ORGANIZATION && organizationId) {
            return flag.targetOrganizations?.includes(organizationId) || false;
        }
        if (flag.scope === FeatureFlag_1.FeatureFlagScope.USER && userId) {
            return flag.targetUsers?.includes(userId) || false;
        }
        return false;
    }
    static checkPercentageRollout(flag, userId, organizationId) {
        if (!flag.percentage) {
            return false;
        }
        const identifier = userId || organizationId || 'anonymous';
        const hash = this.hashString(identifier + flag.id);
        const bucket = hash % 100;
        return bucket < flag.percentage;
    }
    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    static async getAllFlags() {
        const { flagRepository } = this.getRepositories();
        return flagRepository.find({ order: { createdAt: 'DESC' } });
    }
    static async getFlag(featureId) {
        const { flagRepository } = this.getRepositories();
        return flagRepository.findOne({ where: { id: featureId } });
    }
    static async createFlag(flag, adminUserId) {
        const { flagRepository, auditRepository } = this.getRepositories();
        const newFlag = flagRepository.create({
            ...flag,
            createdBy: adminUserId,
        });
        const savedFlag = await flagRepository.save(newFlag);
        const auditEntry = auditRepository.create({
            featureFlagId: savedFlag.id,
            action: FeatureFlagAuditLog_1.FeatureFlagAction.CREATED,
            userId: adminUserId,
            newValue: savedFlag,
        });
        await auditRepository.save(auditEntry);
        logger_1.logger.info('Feature flag created', {
            flagId: savedFlag.id,
            adminUserId,
        });
        (0, featureFlagWebSocketController_1.notifyFeatureFlagChange)(savedFlag.id, 'created', savedFlag.scope, savedFlag.status, savedFlag.percentage, savedFlag.targetOrganizations, savedFlag.targetUsers).catch(err => {
            logger_1.logger.error('Failed to notify feature flag creation via WebSocket', {
                error: err,
                flagId: savedFlag.id,
            });
        });
        return savedFlag;
    }
    static async updateFlag(featureId, updates, adminUserId) {
        const { flagRepository, auditRepository } = this.getRepositories();
        const existing = await flagRepository.findOne({ where: { id: featureId } });
        if (!existing) {
            return null;
        }
        const previousValue = { ...existing };
        Object.assign(existing, updates);
        existing.id = featureId;
        const updated = await flagRepository.save(existing);
        const auditEntry = auditRepository.create({
            featureFlagId: featureId,
            action: FeatureFlagAuditLog_1.FeatureFlagAction.UPDATED,
            userId: adminUserId,
            previousValue: previousValue,
            newValue: updated,
        });
        await auditRepository.save(auditEntry);
        logger_1.logger.info('Feature flag updated', {
            flagId: featureId,
            adminUserId,
            changes: updates,
        });
        (0, featureFlagWebSocketController_1.notifyFeatureFlagChange)(featureId, 'updated', updated.scope, updated.status, updated.percentage, updated.targetOrganizations, updated.targetUsers).catch(err => {
            logger_1.logger.error('Failed to notify feature flag update via WebSocket', {
                error: err,
                flagId: featureId,
            });
        });
        return updated;
    }
    static async deleteFlag(featureId, adminUserId) {
        const { flagRepository, auditRepository } = this.getRepositories();
        const existing = await flagRepository.findOne({ where: { id: featureId } });
        if (!existing) {
            return false;
        }
        const auditEntry = auditRepository.create({
            featureFlagId: featureId,
            action: FeatureFlagAuditLog_1.FeatureFlagAction.DELETED,
            userId: adminUserId,
            previousValue: existing,
        });
        await auditRepository.save(auditEntry);
        await flagRepository.delete(featureId);
        logger_1.logger.info('Feature flag deleted', {
            flagId: featureId,
            adminUserId,
        });
        (0, featureFlagWebSocketController_1.notifyFeatureFlagChange)(featureId, 'deleted', existing.scope).catch(err => {
            logger_1.logger.error('Failed to notify feature flag deletion via WebSocket', {
                error: err,
                flagId: featureId,
            });
        });
        return true;
    }
    static async getEnabledFeatures(userId, organizationId) {
        const { flagRepository } = this.getRepositories();
        const enabledFeatures = [];
        await (0, query_1.findInBatches)(flagRepository, {}, async (batch) => {
            for (const flag of batch) {
                if (await this.isEnabled(flag.id, userId, organizationId)) {
                    enabledFeatures.push(flag.id);
                }
            }
        });
        return enabledFeatures;
    }
    static async getStatistics() {
        const { flagRepository } = this.getRepositories();
        const stats = {
            total: 0,
            enabled: 0,
            disabled: 0,
            beta: 0,
            percentageRollout: 0,
        };
        await (0, query_1.findInBatches)(flagRepository, {}, batch => {
            for (const flag of batch) {
                stats.total += 1;
                if (flag.status === FeatureFlag_1.FeatureFlagStatus.ENABLED) {
                    stats.enabled += 1;
                }
                if (flag.status === FeatureFlag_1.FeatureFlagStatus.DISABLED) {
                    stats.disabled += 1;
                }
                if (flag.status === FeatureFlag_1.FeatureFlagStatus.BETA) {
                    stats.beta += 1;
                }
                if (flag.status === FeatureFlag_1.FeatureFlagStatus.PERCENTAGE) {
                    stats.percentageRollout += 1;
                }
            }
        });
        return stats;
    }
    static async getAnalytics(featureFlagId, days = 30) {
        const { auditRepository } = this.getRepositories();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const logs = await auditRepository
            .createQueryBuilder('log')
            .where('log.featureFlagId = :featureFlagId', { featureFlagId })
            .andWhere('log.action = :action', { action: FeatureFlagAuditLog_1.FeatureFlagAction.EVALUATED })
            .andWhere('log.createdAt >= :startDate', { startDate })
            .getMany();
        const enabledCount = logs.filter(l => l.evaluationResult === true).length;
        const disabledCount = logs.filter(l => l.evaluationResult === false).length;
        const uniqueUsers = new Set(logs.map(l => l.userId).filter(Boolean)).size;
        const uniqueOrganizations = new Set(logs.map(l => l.organizationId).filter(Boolean)).size;
        const evaluationsByDay = new Map();
        logs.forEach(log => {
            const dateKey = log.createdAt.toISOString().split('T')[0];
            const existing = evaluationsByDay.get(dateKey) || { enabled: 0, disabled: 0 };
            if (log.evaluationResult) {
                existing.enabled++;
            }
            else {
                existing.disabled++;
            }
            evaluationsByDay.set(dateKey, existing);
        });
        return {
            totalEvaluations: logs.length,
            enabledCount,
            disabledCount,
            uniqueUsers,
            uniqueOrganizations,
            evaluationsByDay: Array.from(evaluationsByDay.entries()).map(([date, counts]) => ({
                date,
                ...counts,
            })),
        };
    }
}
exports.FeatureFlagService = FeatureFlagService;
//# sourceMappingURL=FeatureFlagService.js.map