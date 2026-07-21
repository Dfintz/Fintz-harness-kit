import { AppDataSource } from '../../../data-source';
import { AccountAccessLog } from '../../../models/AccountAccessLog';
import { obfuscateIP, obfuscateUserAgent } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';

export class AccountAccessLogService {
  private accessLogRepository = AppDataSource.getRepository(AccountAccessLog);

  /**
   * Log an access event for a shared account
   * GDPR-compliant: IP addresses and user agents are obfuscated before storage
   */
  async logAccess(
    accountId: string,
    userId: string,
    organizationId: string | undefined,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>
  ): Promise<AccountAccessLog | null> {
    try {
      // Obfuscate sensitive data for GDPR compliance
      const obfuscatedIP = ipAddress ? obfuscateIP(ipAddress) : undefined;
      const obfuscatedUserAgent = userAgent ? obfuscateUserAgent(userAgent) : undefined;

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
      logger.info(`Access logged: ${action} on account ${accountId} by user ${userId}`);
      return savedLog;
    } catch (error: unknown) {
      logger.error('Error logging account access:', error);
      return null;
    }
  }

  /**
   * Get access logs for a specific account
   */
  async getAccountAccessLogs(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AccountAccessLog[]> {
    try {
      return await this.accessLogRepository.find({
        where: { accountId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
    } catch (error: unknown) {
      logger.error('Error fetching access logs:', error);
      return [];
    }
  }

  /**
   * Get access logs for an organization
   */
  async getOrganizationAccessLogs(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AccountAccessLog[]> {
    try {
      return await this.accessLogRepository.find({
        where: { organizationId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
    } catch (error: unknown) {
      logger.error('Error fetching organization access logs:', error);
      return [];
    }
  }

  /**
   * Get access logs for a specific user
   */
  async getUserAccessLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AccountAccessLog[]> {
    try {
      return await this.accessLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
    } catch (error: unknown) {
      logger.error('Error fetching user access logs:', error);
      return [];
    }
  }

  /**
   * Get analytics for account usage
   */
  async getAccountAnalytics(accountId: string): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    lastAccessed?: Date;
    actionCounts: Record<string, number>;
  }> {
    try {
      const logs = await this.accessLogRepository.find({
        where: { accountId },
      });

      const uniqueUsers = new Set(logs.map(log => log.userId)).size;
      const lastAccessed = logs.length > 0 ? logs[0]?.createdAt : undefined;
      const actionCounts: Record<string, number> = {};

      logs.forEach(log => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      });

      return {
        totalAccesses: logs.length,
        uniqueUsers,
        lastAccessed,
        actionCounts,
      };
    } catch (error: unknown) {
      logger.error('Error getting account analytics:', error);
      return {
        totalAccesses: 0,
        uniqueUsers: 0,
        actionCounts: {},
      };
    }
  }
}

