/**
 * Redis Health Check Service
 *
 * Provides health monitoring for Redis connection:
 * - Connection status checking
 * - Latency measurements
 * - Memory usage monitoring
 * - Key statistics
 */

import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { cache as redisCache } from '../../utils/redis';

import { ComponentHealth, HealthStatus, IHealthCheckable } from './ServiceHealthMonitor';

/**
 * Redis health check details
 */
export interface RedisHealthDetails {
  connected: boolean;
  enabled: boolean;
  responseTimeMs?: number;
  memoryUsage?: string;
  connectedClients?: number;
  usedMemoryPeak?: string;
  keyCount?: number;
  uptime?: number;
  version?: string;
  error?: string;
}

/**
 * Redis Health Check Service
 *
 * Monitors Redis connection health and provides statistics
 */
export class RedisHealthCheckService implements IHealthCheckable {
  private serviceName: string = 'redis';
  private lastCheck: Date | null = null;
  private lastHealthStatus: HealthStatus = HealthStatus.UNKNOWN;
  private checkHistory: Array<{ timestamp: Date; status: HealthStatus; responseTime: number }> = [];
  private readonly maxHistory: number = 100;

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.serviceName;
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const status = redisCache.getStatus();

      // If Redis is disabled or not connected
      if (!status.enabled) {
        this.lastHealthStatus = HealthStatus.DEGRADED;
        return this.buildHealthResult(
          HealthStatus.DEGRADED,
          'Redis is disabled',
          Date.now() - startTime,
          { connected: false, enabled: false }
        );
      }

      if (!status.connected) {
        this.lastHealthStatus = HealthStatus.UNHEALTHY;
        return this.buildHealthResult(
          HealthStatus.UNHEALTHY,
          'Redis is not connected',
          Date.now() - startTime,
          { connected: false, enabled: true }
        );
      }

      // Perform a ping test
      const pingStart = Date.now();
      const pingSuccess = await this.pingRedis();
      const responseTime = Date.now() - pingStart;

      if (!pingSuccess) {
        this.lastHealthStatus = HealthStatus.UNHEALTHY;
        return this.buildHealthResult(HealthStatus.UNHEALTHY, 'Redis ping failed', responseTime, {
          connected: false,
          enabled: true,
        });
      }

      // Determine health status based on response time
      let healthStatus: HealthStatus;
      let message: string;

      if (responseTime < 50) {
        healthStatus = HealthStatus.HEALTHY;
        message = 'Redis connection healthy';
      } else if (responseTime < 200) {
        healthStatus = HealthStatus.DEGRADED;
        message = 'Redis responding slowly';
      } else {
        healthStatus = HealthStatus.DEGRADED;
        message = 'Redis response time high';
      }

      this.lastHealthStatus = healthStatus;
      this.recordCheck(healthStatus, responseTime);

      // Get additional details
      const details = await this.getRedisDetails(responseTime);

      return this.buildHealthResult(healthStatus, message, responseTime, details);
    } catch (error: unknown) {
      this.lastHealthStatus = HealthStatus.UNHEALTHY;
      const responseTime = Date.now() - startTime;

      logger.error('Redis health check failed', { error: getErrorMessage(error) });

      return this.buildHealthResult(
        HealthStatus.UNHEALTHY,
        getErrorMessage(error, 'Redis health check failed'),
        responseTime,
        { connected: false, enabled: true, error: getErrorMessage(error) }
      );
    }
  }

  /**
   * Ping Redis to check connectivity
   */
  private async pingRedis(): Promise<boolean> {
    try {
      // Use a simple set/get test as a ping
      const testKey = '__health_check_ping__';
      const testValue = Date.now().toString();

      await redisCache.set(testKey, testValue, 10);
      const result = await redisCache.get<string>(testKey);
      await redisCache.del(testKey);

      return result === testValue;
    } catch (_error: unknown) {
      return false;
    }
  }

  /**
   * Get detailed Redis information
   */
  private async getRedisDetails(responseTime: number): Promise<RedisHealthDetails> {
    const status = redisCache.getStatus();
    const details: RedisHealthDetails = {
      connected: status.connected,
      enabled: status.enabled,
      responseTimeMs: responseTime,
    };

    try {
      // Get key count
      const keys = await redisCache.keys('*');
      details.keyCount = keys.length;
    } catch {
      // Ignore - optional detail
    }

    return details;
  }

  /**
   * Build health result
   */
  private buildHealthResult(
    status: HealthStatus,
    message: string,
    responseTime: number,
    details: RedisHealthDetails
  ): ComponentHealth {
    this.lastCheck = new Date();

    return {
      name: this.serviceName,
      status,
      message,
      responseTime,
      details: details as unknown as Record<string, unknown>,
      lastCheck: this.lastCheck,
    };
  }

  /**
   * Record health check in history
   */
  private recordCheck(status: HealthStatus, responseTime: number): void {
    this.checkHistory.push({
      timestamp: new Date(),
      status,
      responseTime,
    });

    // Trim history
    if (this.checkHistory.length > this.maxHistory) {
      this.checkHistory.shift();
    }
  }

  /**
   * Get check history
   */
  getCheckHistory(): Array<{ timestamp: Date; status: HealthStatus; responseTime: number }> {
    return [...this.checkHistory];
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(): number | null {
    if (this.checkHistory.length === 0) {
      return null;
    }

    const sum = this.checkHistory.reduce((acc, check) => acc + check.responseTime, 0);
    return Math.round(sum / this.checkHistory.length);
  }

  /**
   * Get uptime percentage (based on check history)
   */
  getUptimePercentage(): number | null {
    if (this.checkHistory.length === 0) {
      return null;
    }

    const healthyChecks = this.checkHistory.filter(
      check => check.status === HealthStatus.HEALTHY || check.status === HealthStatus.DEGRADED
    ).length;

    return Math.round((healthyChecks / this.checkHistory.length) * 10000) / 100;
  }

  /**
   * Get last health status
   */
  getLastHealthStatus(): HealthStatus {
    return this.lastHealthStatus;
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null {
    return this.lastCheck;
  }
}

// Export singleton instance
export const redisHealthService = new RedisHealthCheckService();

