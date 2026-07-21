import fs from 'fs';

import { AppDataSource } from '../../data-source';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Health check result for a single component
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
  lastCheck: Date;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  version: string;
  components: ComponentHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

/**
 * Health check interface that all services should implement
 */
export interface IHealthCheckable {
  /**
   * Perform health check
   * @returns Health status information
   */
  healthCheck(): Promise<ComponentHealth>;

  /**
   * Get service name
   */
  getServiceName(): string;
}

/**
 * Service Health Monitor
 *
 * Centralized health checking for all services:
 * - Database connectivity
 * - External service availability
 * - Cache status
 * - Service-specific health checks
 */
export class ServiceHealthMonitor {
  private startTime: Date;
  private version: string;
  private registeredServices: Map<string, IHealthCheckable>;

  constructor(version: string = '1.0.0') {
    this.startTime = new Date();
    this.version = version;
    this.registeredServices = new Map();
  }

  /**
   * Register a service for health monitoring
   */
  registerService(service: IHealthCheckable): void {
    const name = service.getServiceName();
    this.registeredServices.set(name, service);
    logger.info('Service registered for health monitoring', { serviceName: name });
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceName: string): void {
    this.registeredServices.delete(serviceName);
    logger.info('Service unregistered from health monitoring', { serviceName });
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (!AppDataSource.isInitialized) {
        return {
          name: 'database',
          status: HealthStatus.UNHEALTHY,
          message: 'Database not initialized',
          lastCheck: new Date(),
        };
      }

      // Test connection with a simple query
      await AppDataSource.query('SELECT 1');

      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: responseTime < 100 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: responseTime < 100 ? 'Database connection healthy' : 'Database responding slowly',
        responseTime,
        details: {
          isConnected: AppDataSource.isInitialized,
          driver: AppDataSource.driver?.options?.type || 'unknown',
        },
        lastCheck: new Date(),
      };
    } catch (error: unknown) {
      return {
        name: 'database',
        status: HealthStatus.UNHEALTHY,
        message: getErrorMessage(error, 'Database connection failed'),
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<ComponentHealth> {
    try {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

      let status: HealthStatus;
      let message: string;

      if (heapUsedPercent < 70) {
        status = HealthStatus.HEALTHY;
        message = 'Memory usage normal';
      } else if (heapUsedPercent < 85) {
        status = HealthStatus.DEGRADED;
        message = 'Memory usage elevated';
      } else {
        status = HealthStatus.UNHEALTHY;
        message = 'Memory usage critical';
      }

      return {
        name: 'memory',
        status,
        message,
        details: {
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
          heapUsedPercent: `${heapUsedPercent.toFixed(1)}%`,
          rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        },
        lastCheck: new Date(),
      };
    } catch (error: unknown) {
      return {
        name: 'memory',
        status: HealthStatus.UNKNOWN,
        message: getErrorMessage(error, 'Unable to check memory'),
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Check disk space using fs.statfs
   */
  private async checkDiskHealth(): Promise<ComponentHealth> {
    try {
      const stats = await fs.promises.statfs('/');
      const totalBytes = stats.bsize * stats.blocks;
      const freeBytes = stats.bsize * stats.bfree;
      const usedBytes = totalBytes - freeBytes;
      const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

      const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

      let status: HealthStatus;
      let message: string;

      if (usagePercent >= 95) {
        status = HealthStatus.UNHEALTHY;
        message = `Disk usage critical: ${usagePercent}%`;
      } else if (usagePercent >= 85) {
        status = HealthStatus.DEGRADED;
        message = `Disk usage high: ${usagePercent}%`;
      } else {
        status = HealthStatus.HEALTHY;
        message = `Disk space adequate: ${usagePercent}% used`;
      }

      return {
        name: 'disk',
        status,
        message,
        details: {
          totalMB: toMB(totalBytes),
          usedMB: toMB(usedBytes),
          freeMB: toMB(freeBytes),
          usagePercent,
        },
        lastCheck: new Date(),
      };
    } catch (error: unknown) {
      return {
        name: 'disk',
        status: HealthStatus.UNKNOWN,
        message: getErrorMessage(error, 'Unable to check disk'),
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Get health status for all registered services
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const componentChecks: Promise<ComponentHealth>[] = [
      this.checkDatabaseHealth(),
      this.checkMemoryHealth(),
      this.checkDiskHealth(),
    ];

    // Add registered service health checks
    for (const [name, service] of this.registeredServices.entries()) {
      componentChecks.push(
        service.healthCheck().catch(error => ({
          name,
          status: HealthStatus.UNHEALTHY,
          message: getErrorMessage(error, 'Health check failed'),
          lastCheck: new Date(),
        }))
      );
    }

    const components = await Promise.all(componentChecks);

    // Calculate summary
    const summary = {
      total: components.length,
      healthy: components.filter(c => c.status === HealthStatus.HEALTHY).length,
      degraded: components.filter(c => c.status === HealthStatus.DEGRADED).length,
      unhealthy: components.filter(c => c.status === HealthStatus.UNHEALTHY).length,
    };

    // Determine overall status
    let overallStatus: HealthStatus;
    if (summary.unhealthy > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (summary.degraded > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else if (summary.healthy === summary.total) {
      overallStatus = HealthStatus.HEALTHY;
    } else {
      overallStatus = HealthStatus.UNKNOWN;
    }

    const uptime = Date.now() - this.startTime.getTime();

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime,
      version: this.version,
      components,
      summary,
    };
  }

  /**
   * Get health status for a specific component
   */
  async getComponentHealth(componentName: string): Promise<ComponentHealth | null> {
    // Check system components
    if (componentName === 'database') {
      return this.checkDatabaseHealth();
    }
    if (componentName === 'memory') {
      return this.checkMemoryHealth();
    }
    if (componentName === 'disk') {
      return this.checkDiskHealth();
    }

    // Check registered services
    const service = this.registeredServices.get(componentName);
    if (service) {
      try {
        return await service.healthCheck();
      } catch (error: unknown) {
        return {
          name: componentName,
          status: HealthStatus.UNHEALTHY,
          message: getErrorMessage(error, 'Health check failed'),
          lastCheck: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Get uptime in human-readable format
   */
  getUptimeFormatted(): string {
    const uptime = Date.now() - this.startTime.getTime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Check if system is healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await this.getSystemHealth();
    return health.status === HealthStatus.HEALTHY || health.status === HealthStatus.DEGRADED;
  }

  /**
   * Get list of unhealthy components
   */
  async getUnhealthyComponents(): Promise<ComponentHealth[]> {
    const health = await this.getSystemHealth();
    return health.components.filter(c => c.status === HealthStatus.UNHEALTHY);
  }

  /**
   * Log health summary
   */
  async logHealthSummary(): Promise<void> {
    const health = await this.getSystemHealth();

    logger.info('System Health Summary', {
      status: health.status,
      uptime: this.getUptimeFormatted(),
      components: {
        healthy: health.summary.healthy,
        degraded: health.summary.degraded,
        unhealthy: health.summary.unhealthy,
        total: health.summary.total,
      },
    });

    if (health.summary.unhealthy > 0) {
      const unhealthy = health.components.filter(c => c.status === HealthStatus.UNHEALTHY);
      logger.warn('Unhealthy components detected', {
        count: unhealthy.length,
        components: unhealthy.map(c => ({
          name: c.name,
          message: c.message,
        })),
      });
    }
  }
}

// Global health monitor instance
export const healthMonitor = new ServiceHealthMonitor(process.env.npm_package_version || '1.0.0');

