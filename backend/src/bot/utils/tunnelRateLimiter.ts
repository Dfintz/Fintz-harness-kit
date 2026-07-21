/**
 * Rate Limiter for Tunnel Messages
 * Prevents spam and abuse by limiting message frequency
 */

import type { BlockableRateLimitResult } from '../../services/shared/rateLimitPolicy';
import { logger } from '../../utils/logger';

export interface RateLimitConfig {
  maxMessages: number; // Maximum messages allowed
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // How long to block after limit exceeded
}

/**
 * Tunnel message rate-limit outcome. Aliases the shared
 * {@link BlockableRateLimitResult} taxonomy (ARCH-06); re-exported under this
 * name for back-compat with existing imports from this module.
 */
export type RateLimitResult = BlockableRateLimitResult;

interface UserRateLimit {
  messageCount: number;
  windowStart: Date;
  blockedUntil?: Date;
}

/**
 * Rate limiter for tunnel messages
 */
export class TunnelRateLimiter {
  private static instance: TunnelRateLimiter;
  private userLimits: Map<string, Map<string, UserRateLimit>>; // tunnelId -> userId -> limit

  // Default configuration
  private defaultConfig: RateLimitConfig = {
    maxMessages: 10, // 10 messages
    windowMs: 60000, // per 60 seconds
    blockDurationMs: 300000, // 5 minute block if exceeded
  };

  // Per-tunnel configurations
  private tunnelConfigs: Map<string, RateLimitConfig>;

  private constructor() {
    this.userLimits = new Map();
    this.tunnelConfigs = new Map();

    // Start cleanup task
    this.startCleanupTask();
  }

  public static getInstance(): TunnelRateLimiter {
    if (!TunnelRateLimiter.instance) {
      TunnelRateLimiter.instance = new TunnelRateLimiter();
    }
    return TunnelRateLimiter.instance;
  }

  /**
   * Check if user can send message in tunnel
   */
  public checkRateLimit(tunnelId: string, userId: string): RateLimitResult {
    const config = this.getTunnelConfig(tunnelId);
    const now = new Date();

    // Get or create tunnel limits
    if (!this.userLimits.has(tunnelId)) {
      this.userLimits.set(tunnelId, new Map());
    }
    // Safe: guaranteed to exist after the has/set guard above
    const tunnelLimits = this.userLimits.get(tunnelId) ?? new Map();

    // Get or create user limit
    let userLimit = tunnelLimits.get(userId);
    if (!userLimit) {
      userLimit = {
        messageCount: 0,
        windowStart: now,
      };
      tunnelLimits.set(userId, userLimit);
    }

    // Check if user is currently blocked
    if (userLimit.blockedUntil && now < userLimit.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: userLimit.blockedUntil,
        blockedUntil: userLimit.blockedUntil,
      };
    }

    // Check if window has expired - reset if so
    const windowElapsed = now.getTime() - userLimit.windowStart.getTime();
    if (windowElapsed >= config.windowMs) {
      userLimit.messageCount = 0;
      userLimit.windowStart = now;
      userLimit.blockedUntil = undefined;
    }

    // Check if limit exceeded
    if (userLimit.messageCount >= config.maxMessages) {
      // Block user
      const blockedUntil = new Date(now.getTime() + config.blockDurationMs);
      userLimit.blockedUntil = blockedUntil;

      logger.warn(
        `Rate limit exceeded for user ${userId} in tunnel ${tunnelId}. ` +
          `Blocked until ${blockedUntil.toISOString()}`
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt: blockedUntil,
        blockedUntil,
      };
    }

    // Calculate reset time
    const resetAt = new Date(userLimit.windowStart.getTime() + config.windowMs);

    return {
      allowed: true,
      remaining: config.maxMessages - userLimit.messageCount,
      resetAt,
    };
  }

  /**
   * Record a message (increment counter)
   */
  public recordMessage(tunnelId: string, userId: string): void {
    const tunnelLimits = this.userLimits.get(tunnelId);
    if (!tunnelLimits) {
      return;
    }

    const userLimit = tunnelLimits.get(userId);
    if (!userLimit) {
      return;
    }

    userLimit.messageCount++;

    logger.debug(`User ${userId} message count in tunnel ${tunnelId}: ${userLimit.messageCount}`);
  }

  /**
   * Set custom rate limit for a specific tunnel
   */
  public setTunnelConfig(tunnelId: string, config: Partial<RateLimitConfig>): void {
    const currentConfig = this.getTunnelConfig(tunnelId);
    const newConfig = { ...currentConfig, ...config };

    this.tunnelConfigs.set(tunnelId, newConfig);

    logger.info(
      `Updated rate limit config for tunnel ${tunnelId}: ` +
        `${newConfig.maxMessages} messages per ${newConfig.windowMs}ms`
    );
  }

  /**
   * Get rate limit configuration for a tunnel
   */
  public getTunnelConfig(tunnelId: string): RateLimitConfig {
    return this.tunnelConfigs.get(tunnelId) || this.defaultConfig;
  }

  /**
   * Clear rate limit for a user in a tunnel (admin override)
   */
  public clearUserLimit(tunnelId: string, userId: string): boolean {
    const tunnelLimits = this.userLimits.get(tunnelId);
    if (!tunnelLimits) {
      return false;
    }

    const deleted = tunnelLimits.delete(userId);
    if (deleted) {
      logger.info(`Cleared rate limit for user ${userId} in tunnel ${tunnelId}`);
    }
    return deleted;
  }

  /**
   * Clear all rate limits for a tunnel
   */
  public clearTunnelLimits(tunnelId: string): boolean {
    const deleted = this.userLimits.delete(tunnelId);
    if (deleted) {
      logger.info(`Cleared all rate limits for tunnel ${tunnelId}`);
    }
    return deleted;
  }

  /**
   * Get user's current rate limit status
   */
  public getUserStatus(
    tunnelId: string,
    userId: string
  ): {
    messageCount: number;
    windowStart: Date;
    isBlocked: boolean;
    blockedUntil?: Date;
  } | null {
    const tunnelLimits = this.userLimits.get(tunnelId);
    if (!tunnelLimits) {
      return null;
    }

    const userLimit = tunnelLimits.get(userId);
    if (!userLimit) {
      return null;
    }

    const now = new Date();
    const isBlocked = !!(userLimit.blockedUntil && now < userLimit.blockedUntil);

    return {
      messageCount: userLimit.messageCount,
      windowStart: userLimit.windowStart,
      isBlocked,
      blockedUntil: userLimit.blockedUntil,
    };
  }

  /**
   * Get statistics for all tunnels
   */
  public getStats(): {
    totalTunnels: number;
    totalUsers: number;
    blockedUsers: number;
    byTunnel: Array<{
      tunnelId: string;
      activeUsers: number;
      blockedUsers: number;
      config: RateLimitConfig;
    }>;
  } {
    let totalUsers = 0;
    let blockedUsers = 0;
    const byTunnel: Array<{
      tunnelId: string;
      activeUsers: number;
      blockedUsers: number;
      config: RateLimitConfig;
    }> = [];
    const now = new Date();

    for (const [tunnelId, tunnelLimits] of this.userLimits.entries()) {
      let tunnelBlockedUsers = 0;

      for (const userLimit of tunnelLimits.values()) {
        totalUsers++;
        if (userLimit.blockedUntil && now < userLimit.blockedUntil) {
          blockedUsers++;
          tunnelBlockedUsers++;
        }
      }

      byTunnel.push({
        tunnelId,
        activeUsers: tunnelLimits.size,
        blockedUsers: tunnelBlockedUsers,
        config: this.getTunnelConfig(tunnelId),
      });
    }

    return {
      totalTunnels: this.userLimits.size,
      totalUsers,
      blockedUsers,
      byTunnel: byTunnel.sort((a, b) => b.activeUsers - a.activeUsers),
    };
  }

  /**
   * Start periodic cleanup of expired data
   */
  private startCleanupTask(): void {
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    ); // Run every 5 minutes
  }

  /**
   * Cleanup expired rate limit data
   */
  private cleanup(): void {
    const now = new Date();
    let cleanedUsers = 0;
    let cleanedTunnels = 0;

    for (const [tunnelId, tunnelLimits] of this.userLimits.entries()) {
      const config = this.getTunnelConfig(tunnelId);

      for (const [userId, userLimit] of tunnelLimits.entries()) {
        // Remove if window expired and not blocked
        const windowElapsed = now.getTime() - userLimit.windowStart.getTime();
        const blockExpired = !userLimit.blockedUntil || now >= userLimit.blockedUntil;

        if (windowElapsed > config.windowMs * 2 && blockExpired) {
          tunnelLimits.delete(userId);
          cleanedUsers++;
        }
      }

      // Remove empty tunnel entries
      if (tunnelLimits.size === 0) {
        this.userLimits.delete(tunnelId);
        cleanedTunnels++;
      }
    }

    if (cleanedUsers > 0 || cleanedTunnels > 0) {
      logger.debug(
        `Rate limiter cleanup: removed ${cleanedUsers} users, ${cleanedTunnels} tunnels`
      );
    }
  }
}
