/**
 * Integration Status Dashboard Service
 *
 * Provides health status for all external integrations and third-party services.
 * Issue: Nice to Have - Integration status dashboard / Visual health overview
 */

import { circuitBreakerService } from '../resilience/CircuitBreakerService';

/**
 * Status levels for integrations
 */
export enum IntegrationStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Integration health data
 */
export interface IntegrationHealth {
  name: string;
  description: string;
  status: IntegrationStatus;
  lastCheck: Date;
  responseTime?: number;
  errorMessage?: string;
  circuitBreakerState?: string;
  metrics?: {
    successRate?: number;
    avgResponseTime?: number;
    requestCount?: number;
  };
}

/**
 * Overall system health summary
 */
export interface SystemHealthSummary {
  overallStatus: IntegrationStatus;
  timestamp: Date;
  integrations: IntegrationHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
}

/**
 * Integration Status Service
 */
export class IntegrationStatusService {
  private static instance: IntegrationStatusService;
  private readonly healthCache: Map<string, IntegrationHealth> = new Map();
  private readonly cacheTtlMs = 30000; // 30 seconds cache
  private lastCacheUpdate: Date = new Date(0);

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): IntegrationStatusService {
    if (!IntegrationStatusService.instance) {
      IntegrationStatusService.instance = new IntegrationStatusService();
    }
    return IntegrationStatusService.instance;
  }

  /**
   * Get health status for all integrations
   */
  public async getSystemHealth(): Promise<SystemHealthSummary> {
    const integrations = await this.checkAllIntegrations();

    const summary = {
      total: integrations.length,
      healthy: integrations.filter(i => i.status === IntegrationStatus.HEALTHY).length,
      degraded: integrations.filter(i => i.status === IntegrationStatus.DEGRADED).length,
      unhealthy: integrations.filter(i => i.status === IntegrationStatus.UNHEALTHY).length,
      unknown: integrations.filter(i => i.status === IntegrationStatus.UNKNOWN).length,
    };

    // Determine overall status
    let overallStatus = IntegrationStatus.HEALTHY;
    if (summary.unhealthy > 0) {
      overallStatus = IntegrationStatus.UNHEALTHY;
    } else if (summary.degraded > 0) {
      overallStatus = IntegrationStatus.DEGRADED;
    } else if (summary.unknown === summary.total) {
      overallStatus = IntegrationStatus.UNKNOWN;
    }

    return {
      overallStatus,
      timestamp: new Date(),
      integrations,
      summary,
    };
  }

  /**
   * Check all integrations
   */
  private async checkAllIntegrations(): Promise<IntegrationHealth[]> {
    // Check cache
    if (Date.now() - this.lastCacheUpdate.getTime() < this.cacheTtlMs) {
      return Array.from(this.healthCache.values());
    }

    // Check each integration in parallel
    const integrations = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkMemoryHealth(),
      this.checkRedisHealth(),
      this.checkRSIApiHealth(),
      this.checkUIFApiHealth(),
      this.checkDiscordHealth(),
      this.checkAzureServicesHealth(),
    ]);

    // Update cache
    this.healthCache.clear();
    for (const integration of integrations) {
      this.healthCache.set(integration.name, integration);
    }
    this.lastCacheUpdate = new Date();

    return integrations;
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<IntegrationHealth> {
    try {
      const usage = process.memoryUsage();
      const heapUsedPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);
      const threshold = 80;

      let status = IntegrationStatus.HEALTHY;
      let errorMessage: string | undefined = undefined;

      if (heapUsedPercent > 90) {
        status = IntegrationStatus.UNHEALTHY;
        errorMessage = `Memory critical: ${heapUsedPercent}% of heap in use`;
      } else if (heapUsedPercent > threshold) {
        status = IntegrationStatus.DEGRADED;
        errorMessage = `Memory warning: ${heapUsedPercent}% of heap in use`;
      }

      const metrics = {
        successRate: heapUsedPercent,
        avgResponseTime: Math.round(usage.rss / 1024 / 1024), // RSS in MB
      };

      return this.createHealthEntry(
        'Memory',
        'Node.js process heap and memory',
        status,
        errorMessage,
        undefined,
        undefined,
        metrics
      );
    } catch (error: unknown) {
      return this.createHealthEntry(
        'Memory',
        'Node.js process heap and memory',
        IntegrationStatus.UNKNOWN,
        error instanceof Error ? error.message : 'Unable to check memory'
      );
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<IntegrationHealth> {
    const startTime = Date.now();
    try {
      const { AppDataSource } = await import('../../config/database');

      if (!AppDataSource.isInitialized) {
        return this.createHealthEntry(
          'PostgreSQL Database',
          'Primary data store',
          IntegrationStatus.UNHEALTHY,
          'Database not initialized'
        );
      }

      // Simple query to check connection
      await AppDataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return this.createHealthEntry(
        'PostgreSQL Database',
        'Primary data store',
        responseTime < 100 ? IntegrationStatus.HEALTHY : IntegrationStatus.DEGRADED,
        undefined,
        responseTime
      );
    } catch (error: unknown) {
      return this.createHealthEntry(
        'PostgreSQL Database',
        'Primary data store',
        IntegrationStatus.UNHEALTHY,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<IntegrationHealth> {
    const startTime = Date.now();
    try {
      // Check if Redis environment variable is configured
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;

      if (!redisUrl) {
        return this.createHealthEntry(
          'Redis Cache',
          'Session and cache storage',
          IntegrationStatus.UNKNOWN,
          'Not configured'
        );
      }

      // Get Redis status and cache statistics
      const { cache } = await import('../../utils/redis');
      const redisStatus = cache.getStatus();
      const cacheStats = cache.getStats();
      const responseTime = Date.now() - startTime;

      // Determine health status based on connection
      let status: IntegrationStatus;
      if (redisStatus.connected && redisStatus.enabled) {
        status = IntegrationStatus.HEALTHY;
      } else if (redisStatus.enabled) {
        status = IntegrationStatus.DEGRADED;
      } else {
        status = IntegrationStatus.UNKNOWN;
      }

      // Create metrics object with cache hit rate
      const metrics = {
        hitRate: cacheStats.hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      };

      return this.createHealthEntry(
        'Redis Cache',
        'Session and cache storage',
        status,
        redisStatus.connected ? undefined : 'Not connected',
        responseTime,
        undefined,
        metrics as IntegrationHealth['metrics']
      );
    } catch (error: unknown) {
      return this.createHealthEntry(
        'Redis Cache',
        'Session and cache storage',
        IntegrationStatus.DEGRADED,
        error instanceof Error ? error.message : 'Redis unavailable'
      );
    }
  }

  /**
   * Check RSI API health
   */
  private async checkRSIApiHealth(): Promise<IntegrationHealth> {
    const circuitState = circuitBreakerService.getState('rsi-api');
    const stats = circuitBreakerService.getStats('rsi-api');

    let status = IntegrationStatus.UNKNOWN;
    if (circuitState === 'CLOSED') {
      status = IntegrationStatus.HEALTHY;
    } else if (circuitState === 'HALF_OPEN') {
      status = IntegrationStatus.DEGRADED;
    } else if (circuitState === 'OPEN') {
      status = IntegrationStatus.UNHEALTHY;
    }

    // Map circuit breaker stats to our metrics format
    const metrics = stats?.stats
      ? {
          successRate:
            stats.stats.fires > 0
              ? Math.round((stats.stats.successes / stats.stats.fires) * 100)
              : undefined,
          requestCount: stats.stats.fires,
        }
      : undefined;

    return this.createHealthEntry(
      'RSI API',
      'Star Citizen user verification',
      status,
      circuitState === 'OPEN' ? 'Circuit breaker is open' : undefined,
      undefined,
      circuitState ?? undefined,
      metrics
    );
  }

  /**
   * Check UIF API health
   */
  private async checkUIFApiHealth(): Promise<IntegrationHealth> {
    const circuitState = circuitBreakerService.getState('uif-api');
    const stats = circuitBreakerService.getStats('uif-api');

    let status = IntegrationStatus.UNKNOWN;
    if (circuitState === 'CLOSED') {
      status = IntegrationStatus.HEALTHY;
    } else if (circuitState === 'HALF_OPEN') {
      status = IntegrationStatus.DEGRADED;
    } else if (circuitState === 'OPEN') {
      status = IntegrationStatus.UNHEALTHY;
    }

    // Map circuit breaker stats to our metrics format
    const metrics = stats?.stats
      ? {
          successRate:
            stats.stats.fires > 0
              ? Math.round((stats.stats.successes / stats.stats.fires) * 100)
              : undefined,
          requestCount: stats.stats.fires,
        }
      : undefined;

    return this.createHealthEntry(
      'UIF Trading API',
      'Market prices and trading data',
      status,
      circuitState === 'OPEN' ? 'Circuit breaker is open' : undefined,
      undefined,
      circuitState ?? undefined,
      metrics
    );
  }

  /**
   * Check Discord health
   */
  private async checkDiscordHealth(): Promise<IntegrationHealth> {
    try {
      // Check if Discord bot token is configured
      const discordToken = process.env.DISCORD_BOT_TOKEN;
      if (!discordToken) {
        return this.createHealthEntry(
          'Discord Bot',
          'Chat and notification integration',
          IntegrationStatus.UNKNOWN,
          'Not configured'
        );
      }

      // We can't easily check Discord API without making requests
      // Use circuit breaker state if available
      const circuitState = circuitBreakerService.getState('discord-api');

      if (circuitState === 'OPEN') {
        return this.createHealthEntry(
          'Discord Bot',
          'Chat and notification integration',
          IntegrationStatus.UNHEALTHY,
          'Circuit breaker is open',
          undefined,
          circuitState
        );
      }

      return this.createHealthEntry(
        'Discord Bot',
        'Chat and notification integration',
        IntegrationStatus.HEALTHY,
        undefined,
        undefined,
        circuitState ?? 'CLOSED'
      );
    } catch (error: unknown) {
      return this.createHealthEntry(
        'Discord Bot',
        'Chat and notification integration',
        IntegrationStatus.UNKNOWN,
        error instanceof Error ? error.message : 'Check failed'
      );
    }
  }

  /**
   * Check Azure services health
   */
  private async checkAzureServicesHealth(): Promise<IntegrationHealth> {
    try {
      // Check if Azure is configured
      const azureConfigured = !!(
        process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_KEY_VAULT_URL
      );

      if (!azureConfigured) {
        return this.createHealthEntry(
          'Azure Services',
          'Cloud infrastructure',
          IntegrationStatus.UNKNOWN,
          'Not configured'
        );
      }

      return this.createHealthEntry(
        'Azure Services',
        'Cloud infrastructure',
        IntegrationStatus.HEALTHY
      );
    } catch (error: unknown) {
      return this.createHealthEntry(
        'Azure Services',
        'Cloud infrastructure',
        IntegrationStatus.UNKNOWN,
        error instanceof Error ? error.message : 'Check failed'
      );
    }
  }

  /**
   * Create health entry helper
   */
  private createHealthEntry(
    name: string,
    description: string,
    status: IntegrationStatus,
    errorMessage?: string,
    responseTime?: number,
    circuitBreakerState?: string,
    metrics?: IntegrationHealth['metrics']
  ): IntegrationHealth {
    return {
      name,
      description,
      status,
      lastCheck: new Date(),
      responseTime,
      errorMessage,
      circuitBreakerState,
      metrics,
    };
  }

  /**
   * Get health for specific integration
   */
  public async getIntegrationHealth(integrationName: string): Promise<IntegrationHealth | null> {
    await this.getSystemHealth(); // Ensure cache is updated
    return this.healthCache.get(integrationName) || null;
  }

  /**
   * Force refresh health status
   */
  public async refreshHealth(): Promise<SystemHealthSummary> {
    this.lastCacheUpdate = new Date(0); // Invalidate cache
    return this.getSystemHealth();
  }
}

// Export singleton instance
export const integrationStatusService = IntegrationStatusService.getInstance();

