/**
 * Rate Limit Monitor Service
 *
 * Tracks rate limit violations, patterns, and abuse.
 * Provides alerting and analytics for rate limiting.
 */

import { Request } from 'express';

import {
  RATE_LIMIT_ALERT_THRESHOLD,
  RATE_LIMIT_LOGGING_ENABLED,
} from '../../config/rateLimitConfig';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { AuditCategory, auditService } from '../audit/AuditService';
import { notificationDispatcher } from '../notification/NotificationDispatcher';

interface RateLimitViolation {
  identifier: string; // User ID or IP
  identifierType: 'user' | 'ip' | 'combined';
  endpoint: string;
  timestamp: number;
  userAgent?: string;
  limit: number;
  current: number;
}

interface RateLimitStats {
  violations: number;
  lastViolation: number;
  endpoints: string[];
}

/**
 * Rate Limit Monitor Service
 * Singleton service for tracking and alerting on rate limit violations
 */
class RateLimitMonitorService {
  private static instance: RateLimitMonitorService;
  private readonly violationCache: Map<string, RateLimitStats> = new Map();
  private readonly STATS_TTL = 3600; // 1 hour in seconds
  private readonly REDIS_KEY_PREFIX = 'ratelimit:violations:';
  private readonly cleanupTimer: NodeJS.Timeout;

  private constructor() {
    // Cleanup old violations every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanupOldViolations(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  public static getInstance(): RateLimitMonitorService {
    if (!RateLimitMonitorService.instance) {
      RateLimitMonitorService.instance = new RateLimitMonitorService();
    }
    return RateLimitMonitorService.instance;
  }

  /**
   * Log a rate limit violation
   */
  async logViolation(violation: RateLimitViolation, _req?: Request): Promise<void> {
    if (!RATE_LIMIT_LOGGING_ENABLED) {
      return;
    }

    const key = `${violation.identifierType}:${violation.identifier}`;

    // Get or create stats for this identifier
    let stats = this.violationCache.get(key);
    if (!stats) {
      // Try to load from Redis
      stats = (await this.loadStatsFromRedis(key)) || undefined;
      if (!stats) {
        stats = {
          violations: 0,
          lastViolation: 0,
          endpoints: [],
        };
      }
    }

    // Update stats
    stats.violations++;
    stats.lastViolation = violation.timestamp;
    if (!stats.endpoints.includes(violation.endpoint)) {
      stats.endpoints.push(violation.endpoint);
    }

    // Save to cache and Redis
    this.violationCache.set(key, stats);
    await this.saveStatsToRedis(key, stats);

    // Log the violation
    logger.warn('Rate limit violation', {
      identifier: violation.identifier,
      identifierType: violation.identifierType,
      endpoint: violation.endpoint,
      limit: violation.limit,
      current: violation.current,
      userAgent: violation.userAgent,
      totalViolations: stats.violations,
    });

    // Check if we need to alert admins
    if (stats.violations >= RATE_LIMIT_ALERT_THRESHOLD) {
      this.alertAdmins(violation, stats);
      // Audit as BRUTE_FORCE_ATTEMPT when threshold crossed
      auditService.log({
        category: AuditCategory.SECURITY,
        action: 'BRUTE_FORCE_ATTEMPT',
        message: `Rate limit threshold exceeded for ${violation.identifierType}:${violation.identifier} on ${violation.endpoint} (${stats.violations} violations)`,
        userId: violation.identifierType === 'user' ? violation.identifier : undefined,
        resource: `ratelimit/${violation.endpoint}`,
        metadata: {
          identifier: violation.identifier,
          identifierType: violation.identifierType,
          endpoint: violation.endpoint,
          violations: stats.violations,
          limit: violation.limit,
          severity: 'high',
        },
      });
    }

    // Track in Application Insights if available
    void this.trackInApplicationInsights(violation, stats);
  }

  /**
   * Get violation stats for an identifier
   */
  async getViolationStats(
    identifierType: 'user' | 'ip' | 'combined',
    identifier: string
  ): Promise<RateLimitStats | null> {
    const key = `${identifierType}:${identifier}`;

    // Check cache first
    const stats = this.violationCache.get(key);
    if (stats) {
      return stats;
    }

    // Load from Redis
    const loadedStats = await this.loadStatsFromRedis(key);
    if (loadedStats) {
      this.violationCache.set(key, loadedStats);
      return loadedStats;
    }

    return null;
  }

  /**
   * Get all violation stats (for admin dashboard)
   */
  getAllViolationStats(): Map<string, RateLimitStats> {
    // Return current cache
    // In production, this could be enhanced to query Redis for all keys
    return new Map(this.violationCache);
  }

  /**
   * Clear violation stats for an identifier
   */
  async clearViolationStats(
    identifierType: 'user' | 'ip' | 'combined',
    identifier: string
  ): Promise<void> {
    const key = `${identifierType}:${identifier}`;
    this.violationCache.delete(key);
    await cache.del(`${this.REDIS_KEY_PREFIX}${key}`);
    logger.info(`Cleared rate limit violation stats for ${key}`);
  }

  /**
   * Alert administrators about abuse patterns
   */
  private alertAdmins(violation: RateLimitViolation, stats: RateLimitStats): void {
    // Only alert once per identifier to avoid spam
    const alertKey = `alert:${violation.identifierType}:${violation.identifier}`;
    if (this.violationCache.has(alertKey)) {
      return; // Already alerted
    }

    // Mark as alerted (1 hour TTL)
    this.violationCache.set(alertKey, stats);
    const alertResetTimer = setTimeout(
      () => {
        this.violationCache.delete(alertKey);
      },
      60 * 60 * 1000
    );
    alertResetTimer.unref();

    // Log critical alert
    logger.error('RATE LIMIT ABUSE DETECTED', {
      identifier: violation.identifier,
      identifierType: violation.identifierType,
      totalViolations: stats.violations,
      endpoints: stats.endpoints,
      threshold: RATE_LIMIT_ALERT_THRESHOLD,
      message: `Rate limit violated ${stats.violations} times`,
    });

    // Dispatch in-app notification to all platform admins (non-blocking)
    void notificationDispatcher
      .notifyPlatformAdmins(
        'Rate limit abuse detected',
        `${violation.identifierType} ${violation.identifier} exceeded rate limits ${stats.violations} times across ${stats.endpoints.length} endpoint(s).`,
        {
          data: {
            identifier: violation.identifier,
            identifierType: violation.identifierType,
            violations: stats.violations,
            endpoints: stats.endpoints,
            threshold: RATE_LIMIT_ALERT_THRESHOLD,
          },
        }
      )
      .catch(err => {
        logger.error('Failed to dispatch rate-limit admin alert', { error: err });
      });
  }

  /**
   * Track metrics in Application Insights
   */
  private async trackInApplicationInsights(
    violation: RateLimitViolation,
    stats: RateLimitStats
  ): Promise<void> {
    try {
      // Application Insights integration
      // This uses the global appInsights client if available
      // Dynamic import to avoid issues if applicationinsights is not installed
      const appInsights = await import('applicationinsights');
      if (appInsights.defaultClient) {
        // Track custom metric
        appInsights.defaultClient.trackMetric({
          name: 'RateLimitViolation',
          value: 1,
          properties: {
            identifier: violation.identifier,
            identifierType: violation.identifierType,
            endpoint: violation.endpoint,
            totalViolations: stats.violations.toString(),
          },
        });

        // Track event for pattern analysis
        appInsights.defaultClient.trackEvent({
          name: 'RateLimitViolation',
          properties: {
            identifier: violation.identifier,
            identifierType: violation.identifierType,
            endpoint: violation.endpoint,
            limit: violation.limit.toString(),
            current: violation.current.toString(),
            totalViolations: stats.violations.toString(),
            endpoints: stats.endpoints.join(', '),
          },
        });
      }
    } catch (error: unknown) {
      // Silently fail if Application Insights is not available
      logger.debug('Failed to track rate limit violation in Application Insights', error);
    }
  }

  /**
   * Load stats from Redis
   */
  private async loadStatsFromRedis(key: string): Promise<RateLimitStats | null> {
    try {
      const data = await cache.get<RateLimitStats>(`${this.REDIS_KEY_PREFIX}${key}`);
      return data;
    } catch (error: unknown) {
      logger.debug(`Failed to load rate limit stats from Redis for ${key}`, error);
      return null;
    }
  }

  /**
   * Save stats to Redis
   */
  private async saveStatsToRedis(key: string, stats: RateLimitStats): Promise<void> {
    try {
      await cache.set(`${this.REDIS_KEY_PREFIX}${key}`, stats, this.STATS_TTL);
    } catch (error: unknown) {
      logger.debug(`Failed to save rate limit stats to Redis for ${key}`, error);
    }
  }

  /**
   * Cleanup old violations from cache
   */
  private cleanupOldViolations(): void {
    const now = Date.now();
    const expiryTime = 60 * 60 * 1000; // 1 hour

    const keysToDelete: string[] = [];

    // Collect keys to delete
    this.violationCache.forEach((stats, key) => {
      if (now - stats.lastViolation > expiryTime) {
        keysToDelete.push(key);
      }
    });

    // Delete collected keys
    keysToDelete.forEach(key => {
      this.violationCache.delete(key);
    });
  }
}

export const rateLimitMonitor = RateLimitMonitorService.getInstance();
