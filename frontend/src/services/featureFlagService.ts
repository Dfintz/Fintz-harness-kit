/**
 * Feature Flag Service
 * Client-side service for evaluating and managing feature flags
 */

import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { apiClient } from './apiClient';
import { webSocketClient } from './webSocketClient';

export interface FeatureFlagEvaluationResult {
  flagId: string;
  enabled: boolean;
  timestamp: string;
}

export interface FeatureFlagBatchResult {
  flags: Record<string, boolean>;
  timestamp: string;
}

export interface EnabledFlagsResult {
  readonly flags: string[];
  readonly timestamp: string;
}

export interface FeatureFlagUpdateEvent {
  type: 'feature-flag:updated' | 'feature-flag:created' | 'feature-flag:deleted';
  update: {
    flagId: string;
    action: 'created' | 'updated' | 'deleted';
    status?: string;
    scope?: string;
    percentage?: number;
    timestamp: number;
  };
}

class FeatureFlagService {
  private cache: Map<string, { enabled: boolean; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private enabledFlags: Set<string> = new Set();
  private lastFetch: number = 0;
  private changeListeners: Set<(flagId: string, enabled: boolean) => void> = new Set();
  // Force-enable specific flags globally (migration override)
  private readonly forceEnabledFlags: Set<string> = new Set(['new-navigation-ui']);

  private isAuthenticated(): boolean {
    try {
      return useAuthStore.getState().isAuthenticated;
    } catch {
      // If Zustand store is unavailable (e.g., during SSR or test setup), treat as unauthenticated
      return false;
    }
  }

  constructor() {
    this.setupWebSocketListeners();
  }

  /**
   * Setup WebSocket listeners for real-time updates
   */
  private setupWebSocketListeners(): void {
    // Listen for feature flag updates
    webSocketClient.on('feature-flag:updated', (data: unknown) => {
      const event = data as FeatureFlagUpdateEvent;
      if (event?.update?.flagId) {
        logger.info('Received feature flag update via WebSocket', {
          flagId: event.update.flagId,
          action: event.update.action,
        });

        if (event.update.action === 'deleted') {
          // Remove from cache and enabled flags
          this.cache.delete(event.update.flagId);
          this.enabledFlags.delete(event.update.flagId);
          this.notifyChangeListeners(event.update.flagId, false);
        } else {
          // Invalidate cache to force re-evaluation
          this.cache.delete(event.update.flagId);
          // Re-evaluate the flag
          this.isEnabled(event.update.flagId, true).then(enabled => {
            this.notifyChangeListeners(event.update.flagId, enabled);
          });
        }
      }
    });
  }

  /**
   * Add listener for flag changes
   */
  addChangeListener(listener: (flagId: string, enabled: boolean) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(flagId: string, enabled: boolean): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(flagId, enabled);
      } catch (error) {
        logger.error('Error in feature flag change listener', { error, flagId });
      }
    });
  }

  /**
   * Evaluate a single feature flag
   */
  async isEnabled(flagId: string, skipCache = false): Promise<boolean> {
    // Migration override: force-enabled flags
    if (this.forceEnabledFlags.has(flagId)) {
      this.enabledFlags.add(flagId);
      this.cache.set(flagId, { enabled: true, timestamp: Date.now() });
      return true;
    }

    // Skip remote evaluation when unauthenticated to avoid redirect loops
    if (!this.isAuthenticated()) {
      const cached = this.cache.get(flagId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.enabled;
      }
      return false;
    }
    // Check cache first
    if (!skipCache) {
      const cached = this.cache.get(flagId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.enabled;
      }
    }

    try {
      const response = await apiClient.get<FeatureFlagEvaluationResult>(
        `/api/v2/feature-flags/evaluate/${flagId}`
      );

      const enabled = response.data.enabled;

      // Update cache
      this.cache.set(flagId, {
        enabled,
        timestamp: Date.now(),
      });

      // Update enabled flags set
      if (enabled) {
        this.enabledFlags.add(flagId);
      } else {
        this.enabledFlags.delete(flagId);
      }

      return enabled;
    } catch (error) {
      logger.error('Failed to evaluate feature flag:', {
        error: error instanceof Error ? error : new Error(String(error)),
        flagId,
      });
      return false;
    }
  }

  /**
   * Evaluate multiple feature flags at once
   */
  async evaluateBatch(flagIds: string[]): Promise<Record<string, boolean>> {
    // Skip remote evaluation when unauthenticated to avoid redirect loops
    if (!this.isAuthenticated()) {
      const results: Record<string, boolean> = {};

      flagIds.forEach(flagId => {
        const forced = this.forceEnabledFlags.has(flagId);
        const cached = this.cache.get(flagId);
        const cachedValid = cached && Date.now() - cached.timestamp < this.CACHE_TTL;
        const enabled = forced || (cachedValid ? cached.enabled : false);

        // Normalize cache when forced
        if (forced) {
          this.cache.set(flagId, { enabled: true, timestamp: Date.now() });
          this.enabledFlags.add(flagId);
        }

        results[flagId] = enabled;
      });

      return results;
    }

    try {
      const response = await apiClient.post<FeatureFlagBatchResult>(
        '/api/v2/feature-flags/evaluate-batch',
        { flagIds }
      );

      // Update cache and enabled flags set
      Object.entries(response.data.flags).forEach(([flagId, enabled]) => {
        // Apply migration override
        const finalEnabled = this.forceEnabledFlags.has(flagId) ? true : enabled;
        this.cache.set(flagId, {
          enabled: finalEnabled,
          timestamp: Date.now(),
        });

        if (finalEnabled) {
          this.enabledFlags.add(flagId);
        } else {
          this.enabledFlags.delete(flagId);
        }
      });
      // Ensure any forced flags missing from the response are present
      this.forceEnabledFlags.forEach(flagId => {
        if (!Object.hasOwn(response.data.flags, flagId)) {
          this.cache.set(flagId, { enabled: true, timestamp: Date.now() });
          this.enabledFlags.add(flagId);
        }
      });

      return Object.fromEntries(
        Object.entries(response.data.flags).map(([flagId, enabled]) => [
          flagId,
          this.forceEnabledFlags.has(flagId) ? true : enabled,
        ])
      );
    } catch (error) {
      logger.error('Failed to evaluate feature flags batch:', {
        error: error instanceof Error ? error : new Error(String(error)),
        flagIds,
      });
      return {};
    }
  }

  /**
   * Get all enabled feature flags for the current user
   */
  async getEnabledFlags(forceRefresh = false): Promise<string[]> {
    const now = Date.now();

    // Skip remote fetch when unauthenticated to avoid redirect loops
    if (!this.isAuthenticated()) {
      return Array.from(new Set([...this.enabledFlags, ...this.forceEnabledFlags]));
    }

    // Use cache if recent enough
    if (!forceRefresh && now - this.lastFetch < this.CACHE_TTL) {
      return Array.from(this.enabledFlags);
    }

    try {
      const response = await apiClient.get<EnabledFlagsResult>('/api/v2/feature-flags/enabled');

      // Update enabled flags set
      this.enabledFlags = new Set([...response.data.flags, ...this.forceEnabledFlags]);
      this.lastFetch = now;

      // Update cache for individual flags
      response.data.flags.forEach(flagId => {
        this.cache.set(flagId, {
          enabled: true,
          timestamp: now,
        });
      });

      return response.data.flags;
    } catch (error) {
      logger.error('Failed to get enabled feature flags:', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Return cached plus forced flags
      return Array.from(new Set([...this.enabledFlags, ...this.forceEnabledFlags]));
    }
  }

  /**
   * Check if a feature is enabled from cache only (synchronous)
   */
  isEnabledSync(flagId: string): boolean {
    if (this.forceEnabledFlags.has(flagId)) {
      return true;
    }
    const cached = this.cache.get(flagId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.enabled;
    }
    return this.enabledFlags.has(flagId);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.enabledFlags.clear();
    this.lastFetch = 0;
  }

  /**
   * Prefetch all enabled flags on initialization
   */
  async initialize(): Promise<void> {
    try {
      await this.getEnabledFlags(true);
      logger.info('Feature flags initialized');
    } catch (error) {
      logger.error('Failed to initialize feature flags:', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

export const featureFlagService = new FeatureFlagService();
