"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAccessLogService = void 0;
const data_source_1 = require("../../../data-source");
const AccountAccessLog_1 = require("../../../models/AccountAccessLog");
const encryption_1 = require("../../../utils/encryption");
const logger_1 = require("../../../utils/logger");
class AccountAccessLogService {
    accessLogRepository = data_source_1.AppDataSource.getRepository(AccountAccessLog_1.AccountAccessLog);
    async logAccess(accountId, userId, organizationId, action, ipAddress, userAgent, metadata) {
        try {
            const obfuscatedIP = ipAddress ? (0, encryption_1.obfuscateIP)(ipAddress) : undefined;
            const obfuscatedUserAgent = userAgent ? (0, encryption_1.obfuscateUserAgent)(userAgent) : undefined;
            const log = this.accessLogRepository.create({
                accountId,
                userId,
                organizationId,
                action,
                ipAddress: obfuscatedIP,
                userAgent: obfuscatedUserAgent,
                metadata,
            });
            const savedLog = await this.accessLogRepository.save(log);
            logger_1.logger.info(`Access logged: ${action} on account ${accountId} by user ${userId}`);
            return savedLog;
        }
        catch (error) {
            logger_1.logger.error('Error logging account access:', error);
            return null;
        }
    }
    async getAccountAccessLogs(accountId, limit = 50, offset = 0) {
        try {
            return await this.accessLogRepository.find({
                where: { accountId },
                order: { createdAt: 'DESC' },
                take: limit,
                skip: offset,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching access logs:', error);
            return [];
        }
    }
    async getOrganizationAccessLogs(organizationId, limit = 50, offset = 0) {
        try {
            return await this.accessLogRepository.find({
                where: { organizationId },
                order: { createdAt: 'DESC' },
                take: limit,
                skip: offset,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching organization access logs:', error);
            return [];
        }
    }
    async getUserAccessLogs(userId, limit = 50, offset = 0) {
        try {
            return await this.accessLogRepository.find({
                where: { userId },
                order: { createdAt: 'DESC' },
                take: limit,
                skip: offset,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user access logs:', error);
            return [];
        }
    }
    async getAccountAnalytics(accountId) {
        try {
            const logs = await this.accessLogRepository.find({
                where: { accountId },
            });
            const uniqueUsers = new Set(logs.map(log => log.userId)).size;
            const lastAccessed = logs.length > 0 ? logs[0]?.createdAt : undefined;
            const actionCounts = {};
            logs.forEach(log => {
                actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
            });
            return {
                totalAccesses: logs.length,
                uniqueUsers,
                lastAccessed,
                actionCounts,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting account analytics:', error);
            return {
                totalAccesses: 0,
                uniqueUsers: 0,
                actionCounts: {},
            };
        }
    }
}
exports.AccountAccessLogService = AccountAccessLogService;
//# sourceMappingURL=AccountAccessLogService.js.map